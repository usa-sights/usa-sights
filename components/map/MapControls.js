'use client'

import { memo, useMemo, useState } from 'react'
import { ChevronDown, Expand, Images, Map as MapIcon, X } from 'lucide-react'

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
}

const MapControls = memo(function MapControls({ mapStyle, setMapStyle, fullScreen, isFullscreen, setIsFullscreen }) {
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const availableLayers = useMemo(() => Object.entries(TILE_PRESETS), [])
  const current = TILE_PRESETS[mapStyle] || TILE_PRESETS.street
  const CurrentIcon = current.icon || MapIcon

  return (
    <div className="map-toolbar" data-map-toolbar="1" style={{ zIndex: isFullscreen ? 1500 : 950, pointerEvents: 'auto' }}>
      <div className="map-layer-menu">
        <button
          type="button"
          className="map-toolbar-btn map-layer-trigger"
          onClick={() => setLayerMenuOpen((prev) => !prev)}
          aria-expanded={layerMenuOpen}
          aria-haspopup="menu"
        >
          <CurrentIcon size={16} />
          <span>{current.label}</span>
          <ChevronDown size={15} />
        </button>
        {layerMenuOpen ? (
          <div className="map-layer-popover" role="menu" aria-label="Kartenlayer auswählen">
            {availableLayers.map(([key, config]) => {
              const Icon = config.icon
              return (
                <button
                  key={key}
                  type="button"
                  className={`map-layer-option${mapStyle === key ? ' active' : ''}`}
                  onClick={() => {
                    setMapStyle(key)
                    setLayerMenuOpen(false)
                  }}
                  role="menuitemradio"
                  aria-checked={mapStyle === key}
                >
                  <Icon size={16} />
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>
        ) : null}
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

export default MapControls
