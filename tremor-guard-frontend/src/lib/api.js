const defaultProductionApiBaseUrl = 'http://localhost:3000/api'

export function getApiBaseUrl(env = import.meta.env) {
  const configuredBaseUrl = env?.VITE_API_BASE_URL?.trim()

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '')
  }

  return env?.DEV ? '/api' : defaultProductionApiBaseUrl
}

export function buildApiUrl(path, env = import.meta.env) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${getApiBaseUrl(env)}${normalizedPath}`
}
