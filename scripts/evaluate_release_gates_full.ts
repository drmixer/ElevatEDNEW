import { spawnSync } from 'node:child_process';
import process from 'node:process';

const run = (command: string, args: string[]): void => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
};

const main = (): void => {
  const forwardedArgs = process.argv.slice(2);
  run('npx', ['tsx', 'scripts/evaluate_release_gates.ts', ...forwardedArgs]);
  run('npx', [
    'tsx',
    'scripts/audit_question_bank_quality.ts',
    '--max-flagged',
    '0',
    '--max-blocked',
    '0',
    '--max-generic',
    '0',
    '--max-flagged-rate',
    '0',
  ]);
};

main();
