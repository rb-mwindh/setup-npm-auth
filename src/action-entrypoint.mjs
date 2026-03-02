import * as core from '@actions/core';
import {parseInclude, run, unquote} from './setup-npm-auth.mjs';

(async () => {
    const includes = core.getMultilineInput('includes', {trimWhitespace: true});
    const location = core.getInput('location');
    const dryRun = core.getBooleanInput('dry-run');
    const verbose = core.getBooleanInput('verbose');
    const verifyAuth = core.getBooleanInput('verifyAuth');

    /** @type {CmdOpts} */
    const opts = {
        verbose: verbose,
        dryRun: dryRun,
        location: unquote(location),
        include: [],
        verifyAuth: verifyAuth,
    };

    for (const inc of includes) {
        opts.include = parseInclude(inc, opts.include)
    }

    const registries = await run(opts);
    for (const {scope, registryUrl} of registries) {
        core.setOutput(scope, registryUrl);
    }

})().catch(err => {
    core.error(err);
    core.setFailed(err instanceof Error ? err.message : String(err));
});
