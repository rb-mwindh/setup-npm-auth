import * as core from '@actions/core';
import {exec} from '@actions/exec';
import * as process from 'node:process';
import * as path from 'node:path';

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

    const actionPath = process.env.GITHUB_ACTION_PATH;
    if (!actionPath) {
        throw new Error('GITHUB_ACTION_PATH is not defined');
    }

    const scriptPath = path.join(actionPath, 'src', 'setup-npm-auth.mjs');

    await exec(process.execPath, [scriptPath, ...args]);
}

run().catch(err => {
    core.error(err);
    core.setFailed(err instanceof Error ? err.message : String(err));
});
