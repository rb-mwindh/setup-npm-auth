import core from '@actions/core';
import { exec } from '@actions/exec';

async function run() {
  try {
    const include = core.getInput('include');
    const location = core.getInput('location');
    const dryRun = core.getBooleanInput('dry-run');
    const verbose = core.getBooleanInput('verbose');

    let args = [];
    if (include) args.push('--include', include);
    if (location) args.push('--location', location);
    if (dryRun) args.push('--dry-run');
    if (verbose) args.push('--verbose');

    await exec(`node ./src/setup-npm-auth.mjs`, args);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run().catch(err => core.error(err));
