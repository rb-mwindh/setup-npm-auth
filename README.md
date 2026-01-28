# setup-npm-auth

[![npm version](https://img.shields.io/npm/v/@rb-mwindh/setup-npm-auth.svg)](https://www.npmjs.com/package/@rb-mwindh/setup-npm-auth)

A CLI and GitHub Action to discover configured npm registries and write authentication tokens to the npm user config. Supports default, publish, and scoped registries. Designed for use in CI/CD pipelines and local development.

## Features
- Discovers all configured npm registries (default, publishConfig, and @scope registries)
- Writes authentication tokens to the correct npm config location
- Supports dry-run and verbose modes
- Usable as a CLI or as a declarative GitHub Action

## Usage

### CLI

Install globally or use via npx:

```sh
npx @rb-mwindh/setup-npm-auth --include default --include publish=PUBLISH_TOKEN --include @myscope=SCOPE_TOKEN
```

#### Options
- `--include <scope>[=<ENV_VAR>]`  
  Include a registry. Repeatable. Grammar: `default`, `publish`, or `@scope[=ENV_VAR]`. Defaults to `NODE_AUTH_TOKEN` if ENV_VAR is omitted.
- `-L, --location <global|project|user>`  
  Specify npm config location. Defaults to user-level config.
- `--dry-run`  
  Show what would be configured, but do not write anything.
- `-v, --verbose`  
  Show detailed output.

#### Examples

```sh
# Set auth for the default registry using NODE_AUTH_TOKEN
NODE_AUTH_TOKEN=foo npx @rb-mwindh/setup-npm-auth

# Set auth for default and publishConfig.registry using the same token from NODE_AUTH_TOKEN
NODE_AUTH_TOKEN=foo PUBLISH_TOKEN=bar npx @rb-mwindh/setup-npm-auth --include default --include publish

# Set auth for default and publishConfig.registry using different env vars
NODE_AUTH_TOKEN=foo PUBLISH_TOKEN=bar npx @rb-mwindh/setup-npm-auth --include default --include publish=PUBLISH_TOKEN

# Set auth for a scoped registry
SCOPE_TOKEN=abc npx @rb-mwindh/setup-npm-auth --include @myscope=SCOPE_TOKEN

# Use a specific npm config location (e.g. user)
NODE_AUTH_TOKEN=foo npx @rb-mwindh/setup-npm-auth -L user

# Show what would be configured, but do not write anything
NODE_AUTH_TOKEN=foo npx @rb-mwindh/setup-npm-auth --dry-run

# Show planned configuration details before execution
NODE_AUTH_TOKEN=foo npx @rb-mwindh/setup-npm-auth --verbose
```

### GitHub Action

You can use this tool as a declarative GitHub Action in your workflows:

```yaml
- uses: rb-mwindh/setup-npm-auth@main
  with:
    verbose: 'true'
    includes: |
      default
      publish=PUBLISH_TOKEN
      @myscope=SCOPE_TOKEN
```

#### Action Inputs
- `includes`: Registries to include (e.g. `default`, `publish`, `@scope=ENV`)
- `location`: npm config location (user, global, project)
- `dry-run`: Show what would be done, but do not execute
- `verbose`: Show more output

## License

MIT © Markus Windhager
