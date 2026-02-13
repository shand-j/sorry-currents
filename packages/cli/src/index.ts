#!/usr/bin/env node

import { Command } from 'commander';

import { registerMergeCommand } from './commands/merge.js';
import { registerInitCommand } from './commands/init.js';
import { registerPlanCommand } from './commands/plan.js';
import { registerRunCommand } from './commands/run.js';
import { registerReportCommand } from './commands/report.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerNotifyCommand } from './commands/notify.js';

const program = new Command();

program
  .name('sorry-currents')
  .description(
    'CLI-native, zero-infrastructure Playwright test orchestration. ' +
    'Smart shard balancing, enhanced reporting, and flaky test detection.',
  )
  .version('0.1.0');

registerMergeCommand(program);
registerInitCommand(program);
registerPlanCommand(program);
registerRunCommand(program);
registerReportCommand(program);
registerHistoryCommand(program);
registerNotifyCommand(program);

program.parse();
