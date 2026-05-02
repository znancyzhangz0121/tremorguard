import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appFileUrl = new URL('../src/App.jsx', import.meta.url)
const packageFileUrl = new URL('../package.json', import.meta.url)
const vercelFileUrl = new URL('../vercel.json', import.meta.url)
const viteConfigUrl = new URL('../vite.config.js', import.meta.url)

test('frontend app routes API traffic through the shared API helper', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /import \{[^}]*buildApiUrl[^}]*\} from '\.\/lib\/api'/)
  assert.match(source, /fetch\(buildApiUrl\(/)
  assert.doesNotMatch(source, /fetch\('\/api\//)
})

test('frontend has the required post-login workflow guards', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /patients\/me/)
  assert.match(source, /onboardingCompleted/)
  assert.match(source, /devices\/me/)
  assert.match(source, /DeviceScreen/)
})

test('frontend uses authenticated AI, rehab, and report endpoints', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /\/ai\/chat/)
  assert.match(source, /\/rehab-plans/)
  assert.match(source, /\/health-reports/)
  assert.match(source, /Authorization: `Bearer \$\{token\}`/)
})

test('frontend production package no longer bundles NestJS or Prisma', async () => {
  const pkg = JSON.parse(await readFile(packageFileUrl, 'utf8'))
  const dependencyNames = Object.keys(pkg.dependencies || {})

  assert.equal(dependencyNames.some((name) => name.includes('nestjs')), false)
  assert.equal(dependencyNames.some((name) => name.includes('prisma')), false)
})

test('frontend Vercel config does not package a backend function', async () => {
  const config = JSON.parse(await readFile(vercelFileUrl, 'utf8'))

  assert.equal(config.functions, undefined)
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
})

test('vite proxy target stays configurable for local integration environments', async () => {
  process.env.VITE_API_PROXY_TARGET = 'http://127.0.0.1:3300'
  const { default: config } = await import(`${viteConfigUrl.href}?t=${Date.now()}`)

  assert.equal(config.server.proxy['/api'].target, 'http://127.0.0.1:3300')
})
