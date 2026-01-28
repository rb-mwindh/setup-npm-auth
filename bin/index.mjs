#!/usr/bin/env node

import { main } from '../src/setup-npm-auth.mjs';
import process from "node:process";

main().catch(err => {
    console.error("[ERROR]:", err?.message || err);
    process.exit(1);
});
