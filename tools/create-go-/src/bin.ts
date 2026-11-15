#!/usr/bin/env node
import { main } from '@go-/cli';
import { toInitArgs } from './index.js';

process.exitCode = await main(toInitArgs(process.argv.slice(2)));
