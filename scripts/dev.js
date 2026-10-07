import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--watch', '--env-file-if-exists=.env', 'server/index.js'], {
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', 'localhost'], {
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill('SIGTERM'));
  setTimeout(() => process.exit(code), 200);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
children.forEach((child) => child.on('exit', (code) => stop(code || 0)));
