'use client'

import { useMemo } from 'react'
import { clusterPoints, getVisibleClusterEntries } from '@/lib/map/clusterUtils'
import { normalizePois } from '@/lib/map/poiUtils'

export function usePoiMarkers({ points = [], pois = [], zoom = 4, visibleBounds = null }) {
  const sourceRows = points?.length ? points : pois
  const normalizedPois = useMemo(() => normalizePois(sourceRows), [sourceRows])

  // Cache the expensive grouping by data + zoom only. Panning then only filters
  // already prepared entries by buffered viewport bounds.
  const clusteredEntries = useMemo(
    () => clusterPoints(normalizedPois, zoom),
    [normalizedPois, zoom]
  )

  const markerEntries = useMemo(
    () => getVisibleClusterEntries(clusteredEntries, visibleBounds, 0.3),
    [clusteredEntries, visibleBounds]
  )

  return { normalizedPois, markerEntries }
}
