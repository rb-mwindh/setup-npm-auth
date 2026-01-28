import * as core from '@actions/core';
import {parseInclude, run, unquote} from './setup-npm-auth.mjs';

(async () => {
    const includes = core.getMultilineInput('includes', {trimWhitespace: true});
    const location = core.getInput('location');
    const dryRun = core.getBooleanInput('dry-run');
    const verbose = core.getBooleanInput('verbose');

    /** @type {CmdOpts} */
    const opts = {
        verbose: verbose,
        dryRun: dryRun,
        location: unquote(location),
        include: [],
    };

    for (const inc of includes) {
        opts.include = parseInclude(inc, opts.include)
    }

    await run(opts);
})().catch(err => {
    core.error(err);
    core.setFailed(err instanceof Error ? err.message : String(err));
});
