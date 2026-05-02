import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDir, '..')
const repoRoot = resolve(frontendRoot, '..')
const backendRoot = resolve(repoRoot, 'backend')
const backendBundle = resolve(frontendRoot, 'api', '_backend_bundle')

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })
}

if (!existsSync(backendRoot)) {
  console.warn(`Skipping backend bundle; source not found: ${backendRoot}`)
  process.exit(0)
}

run('npm', ['ci'], backendRoot)
run('npm', ['run', 'build'], backendRoot)

rmSync(backendBundle, { recursive: true, force: true })
mkdirSync(backendBundle, { recursive: true })
writeFileSync(resolve(backendBundle, 'package.json'), '{"type":"commonjs"}\n', 'utf8')

for (const entry of ['dist', 'data']) {
  const source = resolve(backendRoot, entry)
  if (existsSync(source)) {
    cpSync(source, resolve(backendBundle, entry), { recursive: true })
  }
}

console.log(`Prepared Vercel backend bundle at ${backendBundle}`)
