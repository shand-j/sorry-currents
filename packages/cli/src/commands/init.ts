import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Command } from 'commander';

import {
  type InitConfig,
  type GeneratedFile,
  ConsoleLogger,
  LogLevel,
  detectCI,
} from '@sorry-currents/core';

interface InitOptions {
  readonly ci?: string;
  readonly shards: string;
  readonly packageManager?: string;
  readonly playwrightConfig?: string;
  readonly skipPrompts?: boolean;
  readonly dryRun?: boolean;
  readonly verbose?: boolean;
}

/** Detect the package manager from lock files */
function detectPackageManager(cwd: string): 'npm' | 'yarn' | 'pnpm' {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/** Find the Playwright config file */
function detectPlaywrightConfig(cwd: string): string | undefined {
  const candidates = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mjs',
  ] as const;

  for (const candidate of candidates) {
    if (existsSync(join(cwd, candidate))) return candidate;
  }
  return undefined;
}

/** Detect CI provider from the filesystem */
function detectCIProvider(cwd: string): InitConfig['ciProvider'] | undefined {
  if (existsSync(join(cwd, '.github'))) return 'github-actions';
  if (existsSync(join(cwd, '.gitlab-ci.yml'))) return 'gitlab-ci';
  if (existsSync(join(cwd, 'azure-pipelines.yml'))) return 'azure-pipelines';
  return undefined;
}

/** Derive the install command from the package manager */
function deriveInstallCommand(pm: 'npm' | 'yarn' | 'pnpm'): string {
  const commands = {
    npm: 'npm ci',
    yarn: 'yarn install --frozen-lockfile',
    pnpm: 'pnpm install --frozen-lockfile',
  } as const;
  return commands[pm];
}

/** Generate a GitHub Actions workflow file */
function generateGitHubActionsWorkflow(config: InitConfig): string {
  return `name: Playwright Tests

on:
  push:
    branches: [${config.branchFilters.map((b) => `'${b}'`).join(', ')}]
  pull_request:
    branches: [${config.branchFilters.map((b) => `'${b}'`).join(', ')}]

jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: \${{ steps.plan.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: ${config.installCommand}
      - name: Download previous timing data
        uses: actions/download-artifact@v4
        with:
          name: sorry-currents-timing
          path: .sorry-currents/
        continue-on-error: true
      - name: Generate shard plan
        id: plan
        run: npx sorry-currents plan --shards ${config.shardCount} --output-matrix

  test:
    needs: plan
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix: \${{ fromJson(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: ${config.installCommand}
      - name: Install Playwright browsers
        run: ${config.browserInstallCommand}
      - name: Run tests
        run: npx sorry-currents run --shard-plan shard-plan.json --shard-index \${{ matrix.shardIndex }}
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-results-\${{ matrix.shardIndex }}
          path: .sorry-currents/

  report:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: ${config.installCommand}
      - name: Download all shard results
        uses: actions/download-artifact@v4
        with:
          pattern: sorry-currents-results-*
          path: .sorry-currents/shards/
      - name: Merge & generate report
        run: |
          npx sorry-currents merge
          npx sorry-currents report --format html
      - name: Upload timing data for next run
        uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-timing
          path: .sorry-currents/timing-data.json
          retention-days: 90
      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        with:
          name: sorry-currents-report
          path: .sorry-currents/report/
`;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description(
      'Auto-detect project setup and generate CI workflow + reporter config',
    )
    .option(
      '--ci <provider>',
      "CI provider: 'github-actions' | 'gitlab-ci' | 'azure-pipelines'",
    )
    .option('--shards <n>', 'Number of parallel shards', '4')
    .option(
      '--package-manager <pm>',
      "Package manager: 'npm' | 'yarn' | 'pnpm'",
    )
    .option('--playwright-config <path>', 'Path to playwright config')
    .option('--skip-prompts', 'Accept all defaults, no interactive prompts')
    .option(
      '--dry-run',
      'Print what would be generated without writing files',
    )
    .option('--verbose', 'Enable debug logging')
    .action(async (options: InitOptions) => {
      const logger = new ConsoleLogger(
        options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
      );
      const cwd = process.cwd();

      // Auto-detect settings
      const packageManager =
        (options.packageManager as InitConfig['ciProvider'] | undefined) ??
        detectPackageManager(cwd);
      const ciProvider =
        (options.ci as InitConfig['ciProvider'] | undefined) ??
        detectCIProvider(cwd) ??
        'github-actions';
      const playwrightConfig =
        options.playwrightConfig ?? detectPlaywrightConfig(cwd);
      const shardCount = parseInt(options.shards, 10) || 4;

      if (!playwrightConfig) {
        logger.error(
          'No playwright.config.{ts,js,mjs} found. Please specify with --playwright-config',
        );
        process.exit(2);
      }

      logger.info('Detected project settings', {
        ciProvider,
        packageManager,
        playwrightConfig,
        shardCount,
      });

      const config: InitConfig = {
        ciProvider,
        shardCount,
        packageManager: packageManager as InitConfig['packageManager'],
        playwrightConfigPath: playwrightConfig,
        installCommand: deriveInstallCommand(packageManager as 'npm' | 'yarn' | 'pnpm'),
        browserInstallCommand: 'npx playwright install --with-deps',
        testCommand: 'npx playwright test',
        branchFilters: ['main', 'master'],
        includeSlack: false,
        includeGitHubComment: true,
      };

      const filesToGenerate: GeneratedFile[] = [];

      // Generate CI workflow
      if (ciProvider === 'github-actions') {
        filesToGenerate.push({
          path: '.github/workflows/playwright.yml',
          content: generateGitHubActionsWorkflow(config),
          action: 'create',
          description: 'GitHub Actions CI workflow with shard balancing',
        });
      }

      // Write files
      for (const file of filesToGenerate) {
        const absPath = resolve(cwd, file.path);

        if (options.dryRun) {
          logger.info(`[DRY RUN] Would create: ${file.path}`, {
            description: file.description,
          });
          continue;
        }

        await mkdir(join(absPath, '..'), { recursive: true });
        await writeFile(absPath, file.content, 'utf-8');
        logger.info(`✅ Created ${file.path}`, { description: file.description });
      }

      if (!options.dryRun) {
        console.error('');
        console.error('Add the sorry-currents reporter to your Playwright config:');
        console.error('');
        console.error(`  // ${playwrightConfig}`);
        console.error(`  export default defineConfig({`);
        console.error(`    reporter: [`);
        console.error(`      ['html'],`);
        console.error(`      ['@sorry-currents/reporter', { outputDir: '.sorry-currents' }],`);
        console.error(`    ],`);
        console.error(`    // ...rest of your config`);
        console.error(`  });`);
        console.error('');
        console.error('Next steps:');
        console.error(`  1. Add the reporter to ${playwrightConfig} (see above)`);
        console.error('  2. Commit these changes and push');
        console.error(
          '  3. Your first run will use native sharding (cold start)',
        );
        console.error(
          '  4. From the second run, smart shard balancing kicks in automatically',
        );
        console.error('');
      }
    });
}
