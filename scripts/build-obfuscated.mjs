import { access, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const DIST_DIR = 'dist';

const OBFUSCATE_TARGETS = [
  'app.js',
  'Controller',
  'Model',
  'middleware',
  'Router',
  'config',
  'utils',
];

const COPY_TARGETS = ['uploads', 'package.json', 'package-lock.json'];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function obfuscateTarget(target) {
  const destination = join(DIST_DIR, target);
  await mkdir(dirname(destination), { recursive: true });

  await run('npx', [
    'javascript-obfuscator',
    target,
    '--output',
    destination,
    '--compact',
    'true',
    '--string-array',
    'true',
    '--string-array-threshold',
    '0.75',
  ]);
}

async function copyTarget(target) {
  if (!(await exists(target))) {
    return;
  }

  await cp(target, join(DIST_DIR, target), { recursive: true });
}

async function main() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  for (const target of OBFUSCATE_TARGETS) {
    if (await exists(target)) {
      await obfuscateTarget(target);
    }
  }

  for (const target of COPY_TARGETS) {
    await copyTarget(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
