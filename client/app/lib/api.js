const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '')
const configuredUrlIsLocal = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(configuredApiUrl)

export const API_BASE = configuredApiUrl && !(process.env.NODE_ENV === 'production' && configuredUrlIsLocal)
  ? configuredApiUrl
  : process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : ''