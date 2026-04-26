'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'

export default function HomeTutorialTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="hero-info-link"
        aria-label="Kurzes Tutorial anzeigen"
        onClick={() => setOpen(true)}
      >
        <Info size={18} />
        <span>Info</span>
      </button>

      {open ? (
        <div className="hero-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hero-tutorial-title">
          <div className="hero-modal-card">
            <div className="hero-modal-head">
              <div>
                <div className="tutorial-badge">Kurzer Einstieg</div>
                <h2 id="hero-tutorial-title" style={{ margin: '8px 0 0' }}>In 3 Schritten zum nächsten Spot</h2>
              </div>
              <button type="button" className="hero-modal-close" onClick={() => setOpen(false)} aria-label="Popup schließen">
                <X size={18} />
              </button>
            </div>
            <div className="tutorial-grid">
              <div>
                <strong>1. Entdecken</strong>
                <p>Suche nach Ort, Bundesstaat oder Thema und finde Highlights direkt auf der Karte.</p>
              </div>
              <div>
                <strong>2. Merken & teilen</strong>
                <p>Speichere Favoriten, lade Bilder hoch und hilf anderen mit deinen Tipps weiter.</p>
              </div>
              <div>
                <strong>3. POI einreichen</strong>
                <p>Fehlt ein Spot? Reiche ihn ein. Nach kurzer Prüfung wird er für alle sichtbar.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
