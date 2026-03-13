// Unknown city fallback using SMA slope formula + optional OSRM routing

const PORT_LAT = 33.7329
const PORT_LON = -118.2637

interface DistanceResult {
  distanceMiles: number
  source: 'osrm' | 'estimated'
}

async function getOsrmDistance(destLat: number, destLon: number): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${PORT_LON},${PORT_LAT};${destLon},${destLat}?overview=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as { routes?: Array<{ distance: number }> }
    if (!data.routes?.[0]) return null
    const meters = data.routes[0].distance
    return meters / 1609.34 // convert to miles
  } catch {
    return null
  }
}

export async function estimateDrayageForUnknownCity(city: string): Promise<{
  estimatedRate: number
  distanceMiles: number
  dropFee: number
  isEstimated: true
  source: string
}> {
  // Try to get coordinates via a simple geocoding approach
  // For now use SMA slope formula with a default distance estimate
  const estimatedDistanceMiles = 35 // conservative default for unknown SoCal city
  const estimatedRate = 380 + (estimatedDistanceMiles * 3.85)
  const dropFee = estimatedDistanceMiles > 40 ? 150 : 0

  return {
    estimatedRate: Math.round(estimatedRate),
    distanceMiles: estimatedDistanceMiles,
    dropFee,
    isEstimated: true,
    source: 'sma-slope-formula',
  }
}
