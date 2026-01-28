#!/usr/bin/env node
/**
 * setup-npm-auth.mjs
 *
 * npm-only CLI to configure user-level auth tokens for registries derived from:
 * - default registry (config key: "registry")
 * - publishConfig.registry (from package.json via `npm pkg get`)
 * - scoped registries (config keys: "@scope:registry")
 *
 * No file parsing. Uses npm commands and parses JSON output only.
 *
 * Example:
 *   node setup-npm-auth.mjs \
 *     --include default=NODE_AUTH_TOKEN \
 *     --include publish=NODE_AUTH_TOKEN \
 *     --include @scopeA=SCOPE_A_AUTH_TOKEN \
 *     -L project -L user
 */

/**
 * @typedef {string} Scope
 * @typedef {string} AuthToken
 * @typedef {string} EnvVar
 * @typedef {string} RegistryUrl
 * @typedef {"global"|"user"|"project"} Location
 * @typedef {import("node:buffer").Buffer} Buffer
 * @typedef {import("node:process").ProcessEnv} ProcessEnv
 */
/**
 * @typedef {Object} CmdOpts
 * @property {boolean} [verbose]
 * @property {boolean} [dryRun]
 * @property {Location} [location]
 * @property {Array<Scope2EnvVar>} [include]
 */
/**
 * @typedef {Object} Scope2EnvVar
 * @property {Scope} scope
 * @property {EnvVar} envVar
 */
/**
 * @typedef {Object} Task
 * @property {Scope} scope
 * @property {EnvVar} envVar
 * @property {RegistryUrl} registryUrl
 */

import {Command} from "commander";
import {spawn} from "node:child_process";
import process from "node:process";
import pkg from '../package.json' with { type: "json" };


/**
 * @param {...any} data
 */
const verbose = (...data) => {
  if (verbose.enabled === true) {
    console.log(...data);
  }
}

// --- npm DSL API ---
const npm = {
  pkg: {
    /**
     * Get a value from package.json via npm (supports fallback for old npm).
     * @param {string} key
     * @returns {Promise<any>}
     */
    async get(key) {
      try {
        const out = await npmExec(["pkg", "get", key, "--json"]);
        const parsed = tryParseJson(out);
        // npm >=7: { key: value }, npm <7: value
        if (typeof parsed === "object" && parsed !== null && key in parsed) return parsed[key];
        return parsed;
      } catch {
        // fallback: try without --json
        const out = await npmExec(["pkg", "get", key]);
        return tryParseJson(out);
      }
    }
  },
  config(location) {
    return {
      /**
       * List config values for a given location (or default).
       * @returns {Promise<Object>}
       */
      async list() {
        const args = ["config", "list", "--json"];
        if (location) args.push(`--location=${location}`);
        const out = await npmExec(args);
        return tryParseJson(out);
      },
      /**
       * Set a config value for a given location (default: user).
       * @param {string} key
       * @param {string} value
       * @param {boolean} [dryRun=false]
       * @returns {Promise<void>}
       */
      async set(key, value, dryRun = false) {
        const loc = location ? ['--location', location] : [];
        const args = ["config", "set", ...loc, key, value];
        await npmExec(args, { dryRun });
      }
    };
  }
};

/**
 *
 * @param {string[]} args
 * @param {{ cwd?: string, env?: ProcessEnv, stdin?: string | Buffer, timeoutMs?: number, dryRun?: boolean }} [options]
 * @returns {Promise<string>}
 */
async function npmExec(args, options = {}) {

  if (!Array.isArray(args) || !args.every(a => typeof a === "string")) {
    throw new TypeError("npmExec(args): args must be an array of strings.");
  }

  // const cmdForLog = [npm, ...args].join(" ");
  const suffix = options.dryRun === true ? "\x1b[33m(dry-run)\x1b[0m" : "";
  console.log(`$ \x1b[34mnpm`, ...args, "\x1b[0m", suffix);

  if (options.dryRun === true) {
    return Promise.resolve("");
  }

  const { cwd, env, stdin, timeoutMs } = options;

  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd,
      env,
      shell: true,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    /** @type {Buffer[]} */
    const stdoutChunks = [];
    child.stdout.on("data", chunk => stdoutChunks.push(chunk));

    /** @type {Buffer[]} */
    const stderrChunks = [];
    child.stderr.on("data", chunk => stderrChunks.push(chunk));

    let timeoutId = null;
    if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        // SIGTERM first; called can decide if they want harsher behavior.
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.on("error", err => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        // Spawn errors: ENOENT, EACCES, etc.
        reject(err);
      }
    });

    child.on("close", (code, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (signal) {
        const error = new Error(`npm was terminated by signal ${signal}`);
        error.code = "E_NPM_SIGNAL";
        error.signal = signal;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      if (code !== 0) {
        const error = new Error(`npm exited with code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve(stdout.trim());
    });

    // Optional: pass stdin (useful for some npm workflows)
    if (stdin !== null) {
      child.stdin.end(stdin);
    } else {
      child.stdin.end();
    }
  });
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function registryToAuthKey(registryUrl) {
  const u = new URL(registryUrl);
  let hostPath = u.host + u.pathname;
  if (!hostPath.endsWith("/")) hostPath += "/";
  return `//${hostPath}:_authToken`;
}

/**
 * Removes leading and trailing single or double quotes from a string.
 *
 * @param {string} str
 * @returns {string}
 */
export function unquote(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/^['"](.*)['"]$/, '$1');
}

/**
 * Parse a repeatable --include option for commander.
 * * Grammar: <scope>[=<ENV_VAR>]
 * * scope ∈ {"default","publish"} or "@scope"
 *
 * If `ENV_VAR` is omitted, defaults to `NODE_AUTH_TOKEN`.
 *
 * @param {string} val
 * @param {Array<Scope2EnvVar>} acc
 * @returns {Array<Scope2EnvVar>}
 */
export function parseInclude(val, acc) {
  const raw = unquote(String(val).trim());
  if (!raw) {
    throw new Error(`Invalid --include value "${val}".`);
  }
  const eq = raw.indexOf("=");
  const scope = unquote(eq === -1 ? raw : raw.slice(0, eq)).trim();
  const env = unquote(eq === -1 ? "" : raw.slice(eq + 1)).trim();
  if (!scope) {
    throw new Error(`Invalid --include value "${val}".`);
  }
  const envVar = env || "NODE_AUTH_TOKEN";
  if (!(scope === "default" || scope === "publish" || scope.startsWith("@"))) {
    throw new Error(
      `Invalid include target "${scope}". Use "default", "publish", or an "@scope" like "@my-scope".`
    );
  }
  return [...(acc || []), {scope, envVar}];
}

/**
 *
 * @param {Scope2EnvVar[]} [include]
 * @returns {Scope2EnvVar[]}
 */
function ensureIncludes(include) {
  if (!include?.length) {
    return [{scope: "default", envVar: "NODE_AUTH_TOKEN"}];
  }
  return include;
}

/**
 *
 * @param {Scope2EnvVar[]} includes
 * @param {{registry: string}} configJson
 * @returns {Promise<Task[]>}
 */
async function discoverRegistries(includes, configJson) {
  const result = [];

  const defaultInclude = includes.find(({scope}) => scope === "default");
  if (defaultInclude) {
    const defaultRegistry = configJson?.registry || null;
    if (defaultRegistry) {
      result.push({ scope: "default", registryUrl: defaultRegistry, envVar: defaultInclude.envVar });
    }
  }

  const publishInclude = includes.find(({scope}) => scope === "publish");
  if (publishInclude) {
    const publishRegistry = await npm.pkg.get("publishConfig.registry");
    if (publishRegistry) {
      result.push({ scope: "publish", registryUrl: publishRegistry, envVar: publishInclude.envVar });
    }
  }

  for (const [key, value] of Object.entries(configJson)) {
    if (key.startsWith("@") && key.endsWith(":registry")) {
      const scope = key.slice(0, key.indexOf(":registry"));
      const scopeInclude = includes.find(inc => inc.scope === scope);
      if (scopeInclude) {
        result.push({ scope, registryUrl: value, envVar: scopeInclude.envVar });
      }
    }
  }

  // return result;
  return result;
}

/**
 *
 * @param {Scope2EnvVar[]} includes
 * @param {Task[]} registries
 */
function ensureAllFound(includes, registries) {
  const missing = includes.find(inc => !registries.some(t => t.scope === inc.scope));
  if (missing) {
    const proposals = {
      default: "Is a default registry configured?",
      publish: "Is publishConfig.registry set in package.json?",
      scope: "Is this scope configured via @scope:registry somewhere in npm config?",
    }

    throw new Error(
      `Include target "${missing.scope}" was requested `
      + `but no registry could be discovered for it. `
      + (proposals[missing.scope] || proposals.scope)
    );
  }
}

/**
 *
 * @param {Task[]} registries
 * @param {CmdOpts} opts
 * @returns {Promise<void>}
 */
async function setupRegistryAuth(registries, opts) {
  for (const reg of registries) {
    const {envVar, registryUrl} = reg;
    const authKey = registryToAuthKey(registryUrl);
    const token = process.env[reg.envVar] || null;
    if (token === null) {
      console.error(`[ERROR]: Environment variable \x1b[31m${envVar}\x1b[0m does not exist.`);
      continue;
    }

    await npm.config("user").set(authKey, token, !!opts.dryRun);
  }
}

/**
 * @param {CmdOpts} opts
 * @returns {Promise<void>}
 */
export async function run(opts) {
  verbose.enabled = opts.verbose;

  const includes = ensureIncludes(opts.include);
  verbose("");
  verbose("🚀  Running with options:");
  verbose("   🛠️  dryRun:", opts.dryRun ? "enabled" : "disabled");
  verbose("   🛠️  verbose:", opts.verbose ? "enabled" : "disabled");
  verbose("   🛠️  location:", opts.location || "none given. Using npm default.");
  verbose("   🛠️  includes:")
  for (const inc of includes) {
    verbose(`      ▶ ${inc.scope} -> ${inc.envVar}`)
  }
  verbose("");

  const configJson = await npm.config(opts.location).list();
  const registries = await discoverRegistries(includes, configJson);

  verbose("");
  verbose("🔎  Discovered registries:");
  for (const { scope, registryUrl, envVar } of registries) {
    verbose(`   ▶ ${scope} -> ${registryUrl} -> ${envVar}`);
  }
  verbose("");
  if (registries.length === 0) {
    console.log("Nothing to configure.");
    return;
  }

  ensureAllFound(includes, registries);

  await setupRegistryAuth(registries, opts);
}

// CLI entry point
export async function main() {
  const program = new Command()
    .name("setup-npm-auth")
    .description("Configure user-level auth tokens for npm registries.")
    .version(pkg.version)
    .addHelpText('after', `

Examples:

  # Set auth for the default registry using NODE_AUTH_TOKEN
  $ NODE_AUTH_TOKEN=foo node ./setup-npm-auth.mjs

  # Set auth for default and publishConfig.registry using different env vars
  $ NODE_AUTH_TOKEN=foo PUBLISH_TOKEN=bar node ./setup-npm-auth.mjs --include default --include publish=PUBLISH_TOKEN

  # Set auth for a scoped registry
  $ SCOPE_TOKEN=abc node ./setup-npm-auth.mjs --include @myscope=SCOPE_TOKEN

  # Use a specific npm config location (e.g. user)
  $ NODE_AUTH_TOKEN=foo node ./setup-npm-auth.mjs -L user

  # Show what would be configured, but do not write anything
  $ NODE_AUTH_TOKEN=foo node ./setup-npm-auth.mjs --dry-run

  # Show planned configuration details before execution
  $ NODE_AUTH_TOKEN=foo node ./setup-npm-auth.mjs --verbose

  # Fail if a required registry is not found
  $ node ./setup-npm-auth.mjs --include @notfound

  # Show help
  $ node ./setup-npm-auth.mjs --help
`)
    .option(
      "-i, --include <scope>",
      'Include a registry. Repeatable. Grammar: <scope>[=<ENV_VAR>]. Defaults to "default".',
      parseInclude,
    )
    .option(
      "-L, --location <global|project|user>",
      "Specify config location. Defaults to npm-default (user-level config).",
        unquote,
    )
    .option(
      "--dry-run",
      "Show which commands would be run, but don't execute them.",
    )
    .option(
      "-v, --verbose",
      "Show more detailed output.",
    )
    .action(opts => run(opts));

  await program.parseAsync(process.argv);
}
