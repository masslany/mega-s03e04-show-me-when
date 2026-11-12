import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Build requires a full Git SHA.');
await mkdir('dist', { recursive: true });
await cp('app', 'dist', { recursive: true });
const html = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', html.replaceAll('local-preview', sha));
console.log(`Built ${sha}`);
