'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'
import { dispatchAppDataChanged } from '@/lib/appEvents'

function normalizeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

function getLinksEndpoint({ poiId, isAdmin, publicOnly }) {
  if (publicOnly) return `/api/poi-links?poi_id=${poiId}`
  if (isAdmin) return `/api/admin/poi-links?poi_id=${poiId}`
  return `/api/me/poi-links?poi_id=${poiId}`
}

function createChangePayload(method, payload = {}) {
  return {
    method,
    url: '/api/poi-links',
    ...payload,
  }
}

export default function ExternalLinksEditor({ poiId, isAdmin = false, allowCreate = true, publicOnly = false }) {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState({ label: '', url: '' })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const endpoint = useMemo(
    () => getLinksEndpoint({ poiId, isAdmin, publicOnly }),
    [poiId, isAdmin, publicOnly]
  )

  const load = useCallback(async () => {
    if (!poiId) return
    const data = publicOnly
      ? await (await fetch(endpoint, { cache: 'no-store' })).json()
      : await authFetchJson(endpoint)

    if (data.error) {
      setMessage(data.error)
      return
    }

    setItems(data.items || [])
  }, [endpoint, poiId, publicOnly])

  useEffect(() => {
    load()
  }, [load])

  async function addLink() {
    const normalizedUrl = normalizeUrl(draft.url)

    if (!poiId) return setMessage('POI konnte nicht geladen werden.')
    if (!normalizedUrl) return setMessage('Bitte eine gültige URL eingeben.')

    setSaving(true)
    setMessage('')

    const data = await authFetchJson(isAdmin ? '/api/admin/poi-links' : '/api/me/poi-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poi_id: poiId,
        label: draft.label.trim(),
        url: normalizedUrl,
      }),
    })

    setSaving(false)
    setMessage(data.error || 'Link gespeichert')

    if (data.error) return

    setDraft({ label: '', url: '' })
    setItems((current) => (data.item ? [data.item, ...current] : current))
    dispatchAppDataChanged(createChangePayload('POST', { item: data.item || null }))
    load()
  }

  async function updateItem(item) {
    const normalizedUrl = normalizeUrl(item.url)
    if (!normalizedUrl) return setMessage('Bitte eine gültige URL eingeben.')

    const data = await authFetchJson('/api/admin/poi-links', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, url: normalizedUrl }),
    })

    setMessage(data.error || 'Link aktualisiert')
    if (data.error) return

    dispatchAppDataChanged(createChangePayload('PUT', { item: data.item || null }))
    load()
  }

  async function removeItem(id) {
    const data = await authFetchJson(`/api/admin/poi-links?id=${id}`, { method: 'DELETE' })
    setMessage(data.error || 'Link gelöscht')
    if (data.error) return

    setItems((current) => current.filter((item) => item.id !== id))
    dispatchAppDataChanged(createChangePayload('DELETE', { id }))
    load()
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Weiterführende Links</h3>
      {message ? <div className="notice">{message}</div> : null}

      {allowCreate && !publicOnly ? (
        <>
          <div className="grid grid-2">
            <div>
              <label className="label">Label</label>
              <input
                className="input"
                value={draft.label}
                onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder="z. B. Offizielle Infoseite"
              />
            </div>
            <div>
              <label className="label">URL</label>
              <input
                className="input"
                value={draft.url}
                onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <button className="btn btn-secondary" type="button" onClick={addLink} disabled={saving}>
            {saving ? 'Speichert ...' : 'Link hinzufügen'}
          </button>
        </>
      ) : null}

      <div className="grid" style={{ marginTop: 16 }}>
        {items.length === 0 ? <p className="muted">Keine Links vorhanden.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="card">
            {isAdmin && !publicOnly ? (
              <>
                <input
                  className="input"
                  value={item.label || ''}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, label: event.target.value } : entry
                      )
                    )
                  }
                />
                <input
                  className="input"
                  value={item.url || ''}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, url: event.target.value } : entry
                      )
                    )
                  }
                />
                <select
                  className="select"
                  value={item.status || 'pending'}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, status: event.target.value } : entry
                      )
                    )
                  }
                >
                  <option value="pending">pending</option>
                  <option value="published">published</option>
                  <option value="rejected">rejected</option>
                </select>
                <button className="btn" type="button" onClick={() => updateItem(item)}>
                  Speichern
                </button>
                <button className="btn btn-danger" type="button" onClick={() => removeItem(item.id)} style={{ marginLeft: 8 }}>
                  Löschen
                </button>
              </>
            ) : (
              <>
                <strong>{item.label || 'Link'}</strong>
                <p className="muted">{item.url}</p>
                {publicOnly ? (
                  <a className="btn btn-secondary" href={item.url} target="_blank" rel="noreferrer">
                    Öffnen
                  </a>
                ) : (
                  <p>Status: {item.status}</p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
