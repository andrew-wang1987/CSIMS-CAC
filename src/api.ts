const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const SEARCH_RADIUS_METERS = 10000
const MAX_RESULTS = 10

interface Coordinates {
  lat: number
  lon: number
}

interface OverpassElement {
  id?: number
  type?: string
  lat?: number
  lon?: number
  center?: Coordinates
  tags?: Record<string, string | undefined>
}

interface NearbySupportPlace {
  id: string
  name: string
  type: string
  phone?: string
  website?: string
  lat: number
  lon: number
  distance: number
}

interface Location {
  latitude: number
  longitude: number
}

function distanceBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusKm = 6371
  const deltaLat = radians(lat2 - lat1)
  const deltaLon = radians(lon2 - lon1)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(deltaLon / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getCoordinates(element: OverpassElement): Coordinates | null {
  if (!element || typeof element !== 'object') return null

  const position =
    typeof element.lat === 'number' && typeof element.lon === 'number'
      ? element
      : element.center

  if (
    !position ||
    typeof position.lat !== 'number' ||
    typeof position.lon !== 'number' ||
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.lon)
  ) {
    return null
  }

  return { lat: position.lat, lon: position.lon }
}

function getWebsite(tags: Record<string, string | undefined>): string | undefined {
  const value = tags.website || tags['contact:website']
  if (typeof value !== 'string') return undefined

  try {
    const website = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    )
    return ['http:', 'https:'].includes(website.protocol)
      ? website.href
      : undefined
  } catch {
    return undefined
  }
}

export async function findNearbySupport({
  latitude,
  longitude,
}: Location): Promise<NearbySupportPlace[]> {
  const query = `[out:json][timeout:25];nwr["amenity"~"social_facility|clinic|hospital|community_centre"](around:${SEARCH_RADIUS_METERS},${latitude},${longitude});out center tags;`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error('Nearby services could not be loaded. Please try again later.')
    }

    const data: { elements?: OverpassElement[] } = await response.json()
    if (!data || !Array.isArray(data.elements)) {
      throw new Error('Nearby services returned an invalid response. Please try again later.')
    }

    return data.elements
      .map((element): NearbySupportPlace | null => {
        const position = getCoordinates(element)
        if (!position) return null

        const tags = element.tags ?? {}
        const type = tags.amenity?.replaceAll('_', ' ') || 'community service'
        return {
          id: `${element.type ?? 'unknown'}-${element.id ?? 'unknown'}`,
          name: tags.name || (type === 'community service' ? 'Support service' : type),
          type,
          phone: tags['contact:phone'] || tags.phone,
          website: getWebsite(tags),
          lat: position.lat,
          lon: position.lon,
          distance: distanceBetween(
            latitude,
            longitude,
            position.lat,
            position.lon,
          ),
        }
      })
      .filter((place): place is NearbySupportPlace => place !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_RESULTS)
  } finally {
    window.clearTimeout(timeout)
  }
}
