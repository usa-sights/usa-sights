'use client'

import { useEffect, useMemo, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'

function defaultPlacement(providerKey) {
  const key = String(providerKey || '').toLowerCase()
  if (key === 'booking' || key === 'getyourguide') return 'after_visit_info'
  return 'after_description'
}

export default function AdminPOIAffiliateManager({ poi, value = [], onChange = null }) {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      if (!poi?.id) return
      const [settingsData, providersData] = await Promise.all([
        authFetchJson(`/api/admin/poi-affiliates?poi_id=${poi.id}`),
        authFetchJson('/api/admin/affiliate-providers'),
      ])
      if (settingsData.error) setMessage(settingsData.error)
      if (providersData.error) setMessage(providersData.error)

      const merged = (providersData.items || []).map((provider) => {
        const existing = (settingsData.items || []).find((x) => String(x.provider_key).toLowerCase() === String(provider.provider_key).toLowerCase())
        return {
          provider_key: provider.provider_key,
          provider_name: provider.provider_name,
          is_global_enabled: !!provider.is_global_enabled,
          is_enabled: existing?.is_enabled ?? true,
          manual_url: existing?.manual_url || '',
          generated_text: existing?.generated_text || '',
          cta_text: existing?.cta_text || 'Verfügbarkeit prüfen',
          placement: existing?.placement || defaultPlacement(provider.provider_key),
          user_intent: existing?.user_intent || 'information',
        }
      })

      setItems(merged)
      onChange?.(merged)
    }
    load()
  }, [poi?.id])

  const externalValue = useMemo(() => JSON.stringify(value || []), [value])

  useEffect(() => {
    if (!value?.length) return
    setItems(value)
  }, [externalValue])

  function updateItem(provider_key, patch) {
    const next = items.map((x) => String(x.provider_key).toLowerCase() === String(provider_key).toLowerCase() ? { ...x, ...patch } : x)
    setItems(next)
    onChange?.(next)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Affiliate-Steuerung</h3>
      <p className="muted">Wird zusammen mit Speichern oder Freigeben gesichert.</p>
      {message ? <div className="notice">{message}</div> : null}
      <div className="grid grid-2 admin-subgrid">
        {items.map((item) => (
          <div key={item.provider_key} className="card" style={{ padding: 14 }}>
            <div className="category-list-card">
              <strong>{item.provider_name}</strong>
              <label>
                <input type="checkbox" checked={!!item.is_enabled} onChange={(e) => updateItem(item.provider_key, { is_enabled: e.target.checked })} /> aktiv
              </label>
            </div>
            <p className="muted">Global: {item.is_global_enabled ? 'aktiv' : 'deaktiviert'}</p>
            <label className="label">Affiliate URL</label>
            <input className="input" value={item.manual_url || ''} onChange={(e) => updateItem(item.provider_key, { manual_url: e.target.value })} />
            <label className="label">Empfehlungstext</label>
            <textarea className="textarea" rows="3" value={item.generated_text || ''} onChange={(e) => updateItem(item.provider_key, { generated_text: e.target.value })} />
            <div className="grid grid-2">
              <div>
                <label className="label">CTA</label>
                <input className="input" value={item.cta_text || ''} onChange={(e) => updateItem(item.provider_key, { cta_text: e.target.value })} />
              </div>
              <div>
                <label className="label">Platzierung</label>
                <select className="select" value={item.placement || defaultPlacement(item.provider_key)} onChange={(e) => updateItem(item.provider_key, { placement: e.target.value })}>
                  <option value="after_description">nach Beschreibung</option>
                  <option value="after_visit_info">nach Besucherinfos</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
