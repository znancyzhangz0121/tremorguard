import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const appFileUrl = new URL('../src/App.jsx', import.meta.url)
const viteConfigUrl = pathToFileURL(new URL('../vite.config.js', import.meta.url).pathname)

test('frontend app routes API traffic through the shared API helper', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /import \{ buildApiUrl \} from '\.\/lib\/api'/)
  assert.match(source, /fetch\(buildApiUrl\('/)
  assert.doesNotMatch(source, /fetch\('\/api\//)
})

test('frontend restores stored auth sessions instead of clearing them on boot', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /const parseStoredAuthSession =/)
  assert.match(source, /setAuthSession\(storedSession\)/)
  assert.doesNotMatch(source, /window\.localStorage\.removeItem\(authStorageKey\)\s+setIsAuthenticated\(false\)\s+setCurrentUser\(null\)/)
})

test('frontend records view targets the dedicated medical-records boundary and keeps legacy reports separate', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /buildApiUrl\('\/medical-records\/archives'\)/)
  assert.match(source, /buildApiUrl\(`\/medical-records\/reports\/\$\{reportId\}\/pdf`\)/)
  assert.match(source, /长期病历档案与纵向健康报告/)
  assert.match(source, /Output PDF/)
  assert.match(source, /Output PDF Files/)
  assert.match(source, /生成 PDF 报告/)
})

test('frontend only clears auth state on explicit unauthorized responses, not generic dashboard failures', async () => {
  const source = await readFile(appFileUrl, 'utf8')

  assert.match(source, /const clearAuthState = \(\) =>/)
  assert.match(source, /if \(isUnauthorized\) \{\s+clearAuthState\(\)/s)
  assert.doesNotMatch(
    source,
    /catch \{\s+window\.localStorage\.removeItem\(authStorageKey\)\s+setAuthSession\(null\)\s+setIsAuthenticated\(false\)/s,
  )
})

test('vite proxy target stays configurable for local integration environments', async () => {
  process.env.VITE_API_PROXY_TARGET = 'http://127.0.0.1:3300'
  const { default: config } = await import(`${viteConfigUrl.href}?t=${Date.now()}`)

  assert.equal(config.server.proxy['/api'].target, 'http://127.0.0.1:3300')
})
