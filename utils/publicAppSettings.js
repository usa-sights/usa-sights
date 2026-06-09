const DEFAULT_PUBLIC_APP_SETTINGS = {
  publicRankingVisible: false,
  maintenanceMode: false,
  missingTable: false,
}

let cachedSettings = null
let cachedAt = 0
let inFlightRequest = null

const DEFAULT_TTL_MS = 15_000

function normalizeSettings(data = {}) {
  return {
    publicRankingVisible: data.publicRankingVisible === true,
    maintenanceMode: data.maintenanceMode === true,
    missingTable: data.missingTable === true,
  }
}

export function getCachedPublicAppSettings() {
  return cachedSettings ? { ...cachedSettings } : { ...DEFAULT_PUBLIC_APP_SETTINGS }
}

export function primePublicAppSettings(partialSettings = {}) {
  cachedSettings = normalizeSettings({ ...getCachedPublicAppSettings(), ...partialSettings })
  cachedAt = Date.now()
  return getCachedPublicAppSettings()
}

export function clearPublicAppSettingsCache() {
  cachedSettings = null
  cachedAt = 0
  inFlightRequest = null
}

export async function fetchPublicAppSettings({ force = false } = {}) {
  const now = Date.now()
  if (!force && cachedSettings && now - cachedAt < DEFAULT_TTL_MS) {
    return getCachedPublicAppSettings()
  }

  if (!force && inFlightRequest) return inFlightRequest

  const request = fetch('/api/public/app-settings', force ? { cache: 'no-store' } : undefined)
    .then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      cachedSettings = normalizeSettings(data)
      cachedAt = Date.now()
      return getCachedPublicAppSettings()
    })
    .catch(() => getCachedPublicAppSettings())
    .finally(() => {
      if (inFlightRequest === request) inFlightRequest = null
    })

  if (!force) inFlightRequest = request
  return request
}
