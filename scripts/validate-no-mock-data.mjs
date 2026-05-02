#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const targetRoots = [
  'backend/app',
  'backend/alembic',
  'backend/src',
  'backend/data',
  'backend/scripts',
  'device',
  'tremor-guard-frontend/src',
  'tremor-guard-frontend/api',
  'tremor-guard-frontend/scripts',
  'tremor-guard-frontend_Claude Design/src',
  'tremor-guard-frontend_Claude Design/api',
  'tremor-guard-frontend_Claude Design/scripts',
];

const ignoredDirectoryNames = new Set([
  '.git',
  '.omx',
  '.venv',
  'coverage',
  'dist',
  'build',
  'node_modules',
]);

const textFileExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.mjs',
  '.ts',
  '.tsx',
]);

const demoSeedAllowlist = new Set(['backend/app/seed_demo.py']);

const rules = [
  {
    name: 'mock-data keyword in runtime code',
    pattern:
      /\b(mock|fake|dummy|fixture|sample)\b|模拟数据|假数据|占位数据|样例数据/iu,
  },
  {
    name: 'legacy test user identity in bundled data',
    pattern:
      /test-user-\d{8}@example\.com|name@test\.com|nancyzhangold6@gmail\.com|\bTest User\b|\bTEst\b|\bNancy Zhang\b/u,
  },
  {
    name: 'generic hard-coded device serial or verification code',
    pattern:
      /"(serialNumber|verificationCode)"\s*:\s*"(123456|000000|111111|654321)"|(?:serialNumber|verificationCode)\s*[:=]\s*['"`](123456|000000|111111|654321)['"`]/iu,
  },
  {
    name: 'demo seed value outside allowlisted demo seed script',
    pattern:
      /demo@tremorguard\.local|Demo123456|TG-DEMO-001|\b888888\b|演示账号|演示震颤卫士手环/iu,
    allowFiles: demoSeedAllowlist,
  },
];

const violations = [];

for (const relativeRoot of targetRoots) {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  await scanPath(absoluteRoot);
}

if (violations.length === 0) {
  console.log('No mock-data validation issues found.');
  process.exit(0);
}

console.error('No-mock-data validation failed:');
for (const violation of violations) {
  console.error(
    `- ${violation.file}:${violation.lineNumber} ${violation.rule}: ${violation.line}`,
  );
}
console.error('');
console.error('Expected fixes:');
console.error('- Remove bundled runtime data that creates users, devices, metrics, or reports.');
console.error('- Keep the FastAPI demo account/data only in backend/app/seed_demo.py.');
console.error('- Keep test doubles and fixtures inside test-only files/directories.');
process.exit(1);

async function scanPath(absolutePath) {
  let entries;

  try {
    entries = await readdir(absolutePath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    const childPath = path.join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }

      await scanPath(childPath);
      continue;
    }

    if (!entry.isFile() || !textFileExtensions.has(path.extname(entry.name))) {
      continue;
    }

    await scanFile(childPath);
  }
}

async function scanFile(absoluteFilePath) {
  const relativeFilePath = toPosixPath(path.relative(repoRoot, absoluteFilePath));
  const content = await readFile(absoluteFilePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.allowFiles?.has(relativeFilePath)) {
        continue;
      }

      if (rule.pattern.test(line)) {
        violations.push({
          file: relativeFilePath,
          lineNumber: index + 1,
          line: line.trim(),
          rule: rule.name,
        });
      }
    }
  });
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}
