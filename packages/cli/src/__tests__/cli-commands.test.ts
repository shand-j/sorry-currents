/** Tests for CLI command registration and argument parsing. */
import { describe, expect, it } from 'vitest';
import { Command } from 'commander';

import { registerMergeCommand } from '../commands/merge.js';
import { registerInitCommand } from '../commands/init.js';
import { registerPlanCommand } from '../commands/plan.js';
import { registerRunCommand } from '../commands/run.js';
import { registerReportCommand } from '../commands/report.js';
import { registerHistoryCommand } from '../commands/history.js';
import { registerNotifyCommand } from '../commands/notify.js';

// --- Helpers ---

function createProgram(): Command {
  return new Command().exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
}

// --- Command Registration ---

describe('CLI command registration', () => {
  it('should register all 7 commands', () => {
    const program = createProgram();

    registerMergeCommand(program);
    registerInitCommand(program);
    registerPlanCommand(program);
    registerRunCommand(program);
    registerReportCommand(program);
    registerHistoryCommand(program);
    registerNotifyCommand(program);

    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toContain('merge');
    expect(commandNames).toContain('init');
    expect(commandNames).toContain('plan');
    expect(commandNames).toContain('run');
    expect(commandNames).toContain('report');
    expect(commandNames).toContain('history');
    expect(commandNames).toContain('notify');
    expect(commandNames).toHaveLength(7);
  });
});

// --- Merge command ---

describe('merge command', () => {
  it('should accept --input and --output options', () => {
    const program = createProgram();
    registerMergeCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'merge')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--input');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--verbose');
  });

  it('should have correct default values', () => {
    const program = createProgram();
    registerMergeCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'merge')!;
    const inputOpt = cmd.options.find((o) => o.long === '--input');
    const outputOpt = cmd.options.find((o) => o.long === '--output');

    expect(inputOpt?.defaultValue).toBe('.sorry-currents/shards');
    expect(outputOpt?.defaultValue).toBe('.sorry-currents');
  });
});

// --- Init command ---

describe('init command', () => {
  it('should accept all documented options', () => {
    const program = createProgram();
    registerInitCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'init')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--ci');
    expect(optionNames).toContain('--shards');
    expect(optionNames).toContain('--package-manager');
    expect(optionNames).toContain('--playwright-config');
    expect(optionNames).toContain('--skip-prompts');
    expect(optionNames).toContain('--dry-run');
  });
});

// --- Plan command ---

describe('plan command', () => {
  it('should accept all documented options', () => {
    const program = createProgram();
    registerPlanCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'plan')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--shards');
    expect(optionNames).toContain('--timing');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--output-matrix');
    expect(optionNames).toContain('--strategy');
    expect(optionNames).toContain('--default-timeout');
    expect(optionNames).toContain('--target-duration');
    expect(optionNames).toContain('--max-shards');
    expect(optionNames).toContain('--risk-factor');
    expect(optionNames).toContain('--test-dir');
  });
});

// --- Run command ---

describe('run command', () => {
  it('should accept all documented options', () => {
    const program = createProgram();
    registerRunCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'run')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--shard-plan');
    expect(optionNames).toContain('--shard-index');
    expect(optionNames).toContain('--run-id');
  });
});

// --- Report command ---

describe('report command', () => {
  it('should accept all documented options', () => {
    const program = createProgram();
    registerReportCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'report')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--format');
    expect(optionNames).toContain('--input');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--history');
    expect(optionNames).toContain('--open');
  });
});

// --- History command ---

describe('history command', () => {
  it('should accept all documented options', () => {
    const program = createProgram();
    registerHistoryCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'history')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--flaky');
    expect(optionNames).toContain('--slow');
    expect(optionNames).toContain('--failing');
    expect(optionNames).toContain('--limit');
    expect(optionNames).toContain('--format');
  });
});

// --- Notify command ---

describe('notify command', () => {
  it('should accept all documented options', () => {
    const program = createProgram();
    registerNotifyCommand(program);

    const cmd = program.commands.find((c) => c.name() === 'notify')!;
    const optionNames = cmd.options.map((o) => o.long);

    expect(optionNames).toContain('--github-comment');
    expect(optionNames).toContain('--github-status');
    expect(optionNames).toContain('--slack');
    expect(optionNames).toContain('--webhook');
    expect(optionNames).toContain('--input');
    expect(optionNames).toContain('--report-url');
  });
});
