export function getApiBaseUrl(env = import.meta.env) {
  const configuredBaseUrl = env?.VITE_API_BASE_URL?.trim()

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '')
  }

  if (env?.DEV) {
    return '/api'
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`
  }

  return '/api'
}

export function buildApiUrl(path, env = import.meta.env) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${getApiBaseUrl(env)}${normalizedPath}`
}

export async function readApiJson(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()

  if (text.startsWith('<!doctype') || text.startsWith('<html') || text.startsWith('The page c')) {
    throw new Error(
      '前端已经打开，但 API 还没有连通。请在 Vercel 前端项目中设置 VITE_API_BASE_URL 指向后端域名的 /api。',
    )
  }

  throw new Error(text || fallbackMessage)
}
