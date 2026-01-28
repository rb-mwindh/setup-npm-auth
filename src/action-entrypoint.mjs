import * as core from '@actions/core';
import {exec} from '@actions/exec';
import * as process from 'node:process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const includes = core.getMultilineInput('includes', {trimWhitespace: true});
    const location = core.getInput('location');
    const dryRun = core.getBooleanInput('dry-run');
    const verbose = core.getBooleanInput('verbose');

    let args = [];
    for (const inc of includes) {
        if (inc) {
            args.push('--include', inc);
        }
    }

    if (location) {
        args.push('--location', location);
    }

    if (dryRun) {
        args.push('--dry-run');
    }

    if (verbose) {
        args.push('--verbose');
    }

    const scriptPath = path.join(__dirname, 'src', 'setup-npm-auth.mjs');

    await exec(process.execPath, [scriptPath, ...args]);
}

run().catch(err => {
    core.error(err);
    core.setFailed(err instanceof Error ? err.message : String(err));
});
