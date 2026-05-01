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
