import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApiUrl, getApiBaseUrl } from '../src/lib/api.js'

test('uses the Vite proxy path in development by default', () => {
  assert.equal(getApiBaseUrl({ DEV: true }), '/api')
  assert.equal(buildApiUrl('/health', { DEV: true }), '/api/health')
})

test('uses the configured production API base URL when provided', () => {
  const env = {
    DEV: false,
    VITE_API_BASE_URL: 'http://127.0.0.1:3300/api/',
  }

  assert.equal(getApiBaseUrl(env), 'http://127.0.0.1:3300/api')
  assert.equal(
    buildApiUrl('dashboard/summary', env),
    'http://127.0.0.1:3300/api/dashboard/summary',
  )
})
