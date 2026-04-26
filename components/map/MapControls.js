'use client'

import { memo, useMemo } from 'react'
import { Expand, Images, LocateFixed, Map as MapIcon, Mountain, X } from 'lucide-react'

export const TILE_PRESETS = {
  street: {
    label: 'Straßenkarte',
    icon: MapIcon,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    label: 'Satellit + Orte',
    icon: Images,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    overlays: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Labels &copy; Esri',
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Roads &copy; Esri',
      },
    ],
  },
  trail: {
    label: 'Wanderkarte',
    icon: Mountain,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap, OpenStreetMap contributors',
  },
}

const MapControls = memo(function MapControls({ mapStyle, setMapStyle, showTrailToggle, fullScreen, isFullscreen, setIsFullscreen }) {
  const availableLayers = useMemo(
    () => Object.entries(TILE_PRESETS).filter(([key]) => key !== 'trail' || showTrailToggle),
    [showTrailToggle]
  )

  return (
    <div className="map-toolbar" data-map-toolbar="1" style={{ zIndex: isFullscreen ? 1500 : 950, pointerEvents: 'auto' }}>
      <div className="map-toolbar-group" role="group" aria-label="Kartentyp auswählen">
        {availableLayers.map(([key, config]) => {
          const Icon = config.icon
          return (
            <button
              key={key}
              type="button"
              className={`map-toolbar-btn${mapStyle === key ? ' active' : ''}`}
              onClick={() => setMapStyle(key)}
              aria-pressed={mapStyle === key}
            >
              <Icon size={16} />
              <span>{config.label}</span>
            </button>
          )
        })}
      </div>
      {fullScreen ? (
        <button
          type="button"
          className="map-toolbar-btn"
          onClick={() => setIsFullscreen((prev) => !prev)}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? <X size={16} /> : <Expand size={16} />}
          <span>{isFullscreen ? 'Schließen' : 'Vollbild'}</span>
        </button>
      ) : null}
    </div>
  )
})

export function LocateUserButton({ onLocate, status = 'idle' }) {
  return (
    <button
      type="button"
      className={`map-locate-btn${status === 'loading' ? ' is-loading' : ''}`}
      onClick={onLocate}
      aria-label="Aktuellen Standort anzeigen"
      title="Aktuellen Standort anzeigen"
      disabled={status === 'loading'}
    >
      <LocateFixed size={18} />
    </button>
  )
}

export default MapControls
