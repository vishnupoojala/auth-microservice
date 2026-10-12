import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coverage = process.argv.includes('--coverage');

const args = ['--experimental-vm-modules', path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'), '--runInBand'];
if (coverage) args.push('--coverage');

console.log(`Running Jest tests${coverage ? ' (with coverage)' : ''}...`);
const result = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: root });

process.exit(result.status ?? 1);