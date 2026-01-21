const DEFAULT_WS_URL = 'wss://geobusters-backend.hiratakoudai61.workers.dev/ws'
const LOCAL_WS_URL = 'ws://localhost:8787/ws'

const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (envUrl) return envUrl
  if (typeof window === 'undefined') return DEFAULT_WS_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return LOCAL_WS_URL
  }
  return DEFAULT_WS_URL
}

export const baseURL = resolveBaseUrl()
