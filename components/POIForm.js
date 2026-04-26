'use client'

import { useEffect, useMemo, useState } from 'react'
import { isAllowedImage } from '@/lib/utils'
import { processImageForUpload } from '@/lib/imageUpload'
import ExternalLinksEditor from '@/components/ExternalLinksEditor'
import { authFetchJson } from '@/utils/authFetch'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'

const MAX_FILES = 6
const MAX_FILE_SIZE = 15 * 1024 * 1024

export default function POIForm({ coords, userId, initialData = null, mode = 'create', onSaved = null, compactUserMode = false, enableAI = false }) {
  const [categories, setCategories] = useState([])
  const [message, setMessage] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [files, setFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadLabel, setUploadLabel] = useState('')
  const [savedPoiId, setSavedPoiId] = useState(initialData?.id || null)
  const [pendingLinks, setPendingLinks] = useState([])
  const [linkForm, setLinkForm] = useState({ label: '', url: '' })
  const [form, setForm] = useState({
    title: initialData?.title || '',
    category_id: initialData?.category_id || '',
    state: initialData?.state || '',
    city: initialData?.city || '',
    address: initialData?.address || '',
    short_description: initialData?.short_description || '',
    description: initialData?.description || '',
    website_url: initialData?.website_url || '',
    opening_hours_text: initialData?.opening_hours_text || '',
    price_info_text: initialData?.price_info_text || '',
    nice_to_know: initialData?.nice_to_know || '',
    hotels_nearby_text: initialData?.hotels_nearby_text || '',
  })

  useEffect(() => {
    async function loadCategories() {
      const { items, error } = await authFetchJson('/api/categories')
      const data = items
      if (error) return setMessage(error)
      setCategories(data || [])
    }
    loadCategories()
  }, [])

  useEffect(() => {
    async function loadLinks() {
      if (!initialData?.id) return
      const endpoint = compactUserMode ? `/api/me/poi-links?poi_id=${initialData.id}` : `/api/admin/poi-links?poi_id=${initialData.id}`
      const result = await authFetchJson(endpoint)
      setPendingLinks(result.items || [])
    }
    loadLinks()
  }, [initialData?.id, compactUserMode])

  useEffect(() => {
    if (!initialData) return
    setSavedPoiId(initialData.id || null)
    setForm({
      title: initialData.title || '',
      category_id: initialData.category_id || '',
      state: initialData.state || '',
      city: initialData.city || '',
      address: initialData.address || '',
      short_description: initialData.short_description || '',
      description: initialData.description || '',
      website_url: initialData.website_url || '',
      opening_hours_text: initialData.opening_hours_text || '',
      price_info_text: initialData.price_info_text || '',
      nice_to_know: initialData.nice_to_know || '',
      hotels_nearby_text: initialData.hotels_nearby_text || '',
    })
  }, [initialData])

  async function generateAI() {
    if (!enableAI) return
    setAiLoading(true)
    setMessage('')
    try {
      const payload = {
        title: form.title,
        category: categories.find((x) => x.id === form.category_id)?.name || '',
        state: form.state,
        city: form.city,
        latitude: coords?.lat || initialData?.latitude || null,
        longitude: coords?.lng || initialData?.longitude || null,
        short_description: form.short_description,
        description: form.description,
        website_url: form.website_url,
      }
      const res = await fetch('/api/ai/generate-poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'KI-Aufruf fehlgeschlagen')
      const out = data.output || {}
      setForm((prev) => ({
        ...prev,
        short_description: out.short_description || prev.short_description,
        description: out.long_description || prev.description,
        nice_to_know: Array.isArray(out.nice_to_know) ? out.nice_to_know.join(' | ') : prev.nice_to_know,
      }))
      setMessage('KI-Vorschlag in die Felder übernommen.')
    } catch (err) {
      setMessage(err.message || 'KI-Aufruf fehlgeschlagen')
    } finally {
      setAiLoading(false)
    }
  }

  async function reverseGeocode() {
    if (!coords) return setMessage('Bitte zuerst einen Punkt auf der Karte wählen.')
    setGeoLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reverse Geocoding fehlgeschlagen')
      setForm((prev) => ({ ...prev, state: data.state || '', city: data.city || '', address: data.address || '' }))
    } catch (err) {
      setMessage(err.message || 'Reverse Geocoding fehlgeschlagen')
    } finally {
      setGeoLoading(false)
    }
  }

  async function handleFiles(listLike) {
    const list = Array.from(listLike || [])
    if (list.length > MAX_FILES) return setMessage(`Maximal ${MAX_FILES} Fotos pro Einreichung.`)
    for (const file of list) {
      if (!isAllowedImage(file)) return setMessage('Nur JPG, PNG und WebP sind erlaubt.')
      if (file.size > 15 * 1024 * 1024) return setMessage('Originaldateien dürfen maximal 15 MB groß sein.')
    }
    try {
      setUploadProgress(4)
      setUploadLabel('Fotos werden vorbereitet ...')
      const converted = []
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i]
        converted.push(await processImageForUpload(file))
        setUploadProgress(Math.min(35, 8 + Math.round(((i + 1) / list.length) * 24)))
        setUploadLabel(`Foto ${i + 1} von ${list.length} wird vorbereitet ...`)
      }
      for (const item of converted) {
        if (item.original.size > MAX_FILE_SIZE) return setMessage('Ein konvertiertes Bild ist noch zu groß.')
      }
      setFiles(converted)
      setUploadProgress(35)
      setUploadLabel('Fotos sind vorbereitet und warten auf den Upload.')
      setMessage(`${converted.length} Bild(er) vorbereitet. Sobald du speicherst, starten Upload und Prüfung automatisch.`)
    } catch {
      setMessage('Bildkonvertierung fehlgeschlagen.')
    }
  }

  function addPendingLink() {
    const url = linkForm.url.trim()
    if (!url) return
    setPendingLinks((prev) => [...prev, { label: linkForm.label.trim() || null, url, is_new: true }])
    setLinkForm({ label: '', url: '' })
  }

  function removePendingLink(index) {
    setPendingLinks((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadImages(poiId) {
    if (!files.length) return
    setUploadProgress(2)
    setUploadLabel('Fotos werden hochgeladen ...')

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Bitte zuerst einloggen.')

    const formData = new FormData()
    formData.append('poi_id', poiId)
    formData.append('caption', form.title.trim())
    formData.append('variant_prefix', 'poi')
    formData.append('is_cover_first', 'true')
    for (let i = 0; i < files.length; i += 1) {
      const item = files[i]
      formData.append(`original_${i}`, item.original, item.original.name)
      formData.append(`thumb_${i}`, item.thumb, item.thumb.name)
      formData.append(`filename_${i}`, item.original.name)
    }

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/poi-images')
      xhr.responseType = 'json'
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const next = Math.max(5, Math.min(96, Math.round((event.loaded / event.total) * 100)))
        setUploadProgress(next)
        setUploadLabel(`Fotos werden hochgeladen (${files.length}) ...`)
      }

      xhr.onload = () => {
        const payload = xhr.response || {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload)
          return
        }
        reject(new Error(payload.error || `HTTP ${xhr.status}`))
      }

      xhr.onerror = () => reject(new Error('Foto-Upload fehlgeschlagen.'))
      xhr.send(formData)
    })

    setUploadProgress(100)
    setUploadLabel('Fotos wurden erfolgreich hochgeladen.')
  }

  async function savePendingLinks(poiId) {
    for (const link of pendingLinks.filter((x) => x.is_new)) {
      const endpoint = compactUserMode ? '/api/me/poi-links' : '/api/admin/poi-links'
      const result = await authFetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poi_id: poiId, label: link.label || '', url: link.url }),
      })
      if (result.error) throw new Error(result.error)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const title = (form.title || '').trim()
    const categoryId = (form.category_id || '').toString().trim()

    if (!userId) return setMessage('Bitte zuerst registrieren oder einloggen, damit du einen Vorschlag einreichen kannst.')
    if (!coords && mode === 'create') return setMessage('Bitte einen Standort auf der Karte wählen.')
    if (!title || !categoryId) return setMessage('Bitte Titel und Kategorie ausfüllen.')
    if (!categories.length) return setMessage('Es sind aktuell keine Kategorien geladen. Bitte Admin prüfen.')
    setSaving(true)
    setMessage('')

    try {
      const sendSubmissionNotification = async (poiId) => {
        if (!poiId || mode === 'edit') return
        try {
          await authFetchJson('/api/me/poi-submission-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poi_id: poiId }),
          })
        } catch {}
      }

      const payload = compactUserMode ? {
        title,
        category_id: categoryId,
        short_description: form.short_description?.trim() || null,
        website_url: form.website_url?.trim() || null,
      } : {
        title,
        category_id: categoryId,
        state: form.state?.trim() || null,
        city: form.city?.trim() || null,
        address: form.address?.trim() || null,
        short_description: form.short_description?.trim() || null,
        description: form.description?.trim() || null,
        website_url: form.website_url?.trim() || null,
        opening_hours_text: form.opening_hours_text?.trim() || null,
        price_info_text: form.price_info_text?.trim() || null,
        hotels_nearby_text: form.hotels_nearby_text?.trim() || null,
      }

      let poiId = initialData?.id
      if (mode === 'edit' && initialData?.id) {
        const result = await authFetchJson('/api/me/pois', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: initialData.id, ...payload, updated_at: new Date().toISOString() }),
        })
        if (result.error) throw new Error(result.error)
        poiId = result.item.id
      } else {
        const result = await authFetchJson('/api/me/pois', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            latitude: coords.lat,
            longitude: coords.lng,
            title,
            category_id: categoryId,
          }),
        })
        if (result.error) throw new Error(result.error)
        poiId = result.item?.id
        if (result.duplicate) {
          setSavedPoiId(poiId)
          setMessage('Dein Vorschlag wurde bereits vor wenigen Sekunden gespeichert. Du musst ihn nicht noch einmal absenden.')
          onSaved?.()
          return
        }
      }

      if (files.length && poiId) await uploadImages(poiId)
      if (pendingLinks.length && poiId) await savePendingLinks(poiId)
      await sendSubmissionNotification(poiId)

      setSavedPoiId(poiId)
      if (files.length) setFiles([])
      setMessage(mode === 'edit' ? 'POI aktualisiert.' : 'POI wurde gespeichert.')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('app-data-changed'))
        window.dispatchEvent(new Event('admin-pending-changed'))
      }
      onSaved?.()
    } catch (err) {
      setMessage(err.message || 'Fehler beim Speichern')
      setUploadProgress(0)
      setUploadLabel('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="notice">
        {!userId ? 'Du musst registriert und eingeloggt sein, bevor du einen POI-Vorschlag einreichen kannst.'
          : compactUserMode ? 'Für deinen Vorschlag brauchen wir hier nur die wichtigsten Angaben.'
          : 'Vollständiger Bearbeitungsmodus.'}
      </div>

      {enableAI && !compactUserMode ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-secondary" type="button" onClick={generateAI} disabled={aiLoading}>
            {aiLoading ? 'KI lädt ...' : 'KI Vorschlag'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={reverseGeocode} disabled={geoLoading}>
            {geoLoading ? 'Füllt ...' : 'Adresse automatisch übernehmen'}
          </button>
        </div>
      ) : null}

      <label className="label">Titel</label>
      <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

      <label className="label">Kategorie</label>
      <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
        <option value="">Bitte wählen</option>
        {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
      </select>

      {!compactUserMode && (
        <div className="inline-3">
          <div><label className="label">Bundesstaat</label><input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div><label className="label">Stadt</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">Adresse</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
      )}

      <label className="label">Kurzbeschreibung</label>
      <textarea className="textarea" rows="3" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />

      {!compactUserMode && (
        <>
          <label className="label">Beschreibung</label>
          <textarea className="textarea" rows="5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </>
      )}

      <label className="label">Website</label>
      <input className="input" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />

      <label className="label">Weiterführende Links</label>
      <div className="grid grid-2">
        <input className="input" placeholder="Label" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} />
        <input className="input" placeholder="https://..." value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} />
      </div>
      <button className="btn btn-secondary" type="button" onClick={addPendingLink}>Link hinzufügen</button>
      <div className="grid" style={{ marginTop: 12 }}>
        {pendingLinks.map((link, index) => (
          <div key={`${link.url}-${index}`} className="card">
            <strong>{link.label || 'Link'}</strong>
            <p className="muted">{link.url}</p>
            <button className="btn btn-danger" type="button" onClick={() => removePendingLink(index)}>Entfernen</button>
          </div>
        ))}
      </div>

      {!compactUserMode && (
        <>
          <div className="grid grid-2">
            <div>
              <label className="label">Öffnungszeiten</label>
              <textarea className="textarea" rows="3" value={form.opening_hours_text} onChange={(e) => setForm({ ...form, opening_hours_text: e.target.value })} />
            </div>
            <div>
              <label className="label">Preise</label>
              <textarea className="textarea" rows="3" value={form.price_info_text} onChange={(e) => setForm({ ...form, price_info_text: e.target.value })} />
            </div>
          </div>
          <label className="label">Nice to know</label>
          <textarea className="textarea" rows="3" value={form.nice_to_know} onChange={(e) => setForm({ ...form, nice_to_know: e.target.value })} />
          <label className="label">Hotels in der Nähe</label>
          <textarea className="textarea" rows="3" value={form.hotels_nearby_text} onChange={(e) => setForm({ ...form, hotels_nearby_text: e.target.value })} />
        </>
      )}

      <label className="label">Fotos (maximal 6)</label>
      <input className="input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFiles(e.target.files)} />
      <div className="muted">{files.length ? `${files.length} optimierte Datei(en) bereit zum Upload · Maximal ${MAX_FILES} Fotos pro Einreichung` : `Keine Datei ausgewählt · Maximal ${MAX_FILES} Fotos pro Einreichung`}</div>
      {uploadProgress > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div className="muted">{uploadLabel || 'Fotos werden verarbeitet ...'}</div>
          <div className="upload-progress-track">
            <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="muted">{uploadProgress}% abgeschlossen</div>
        </div>
      ) : null}
      <div className="muted">Maximal 6 Fotos pro Einreichung. Wenn du Fotos auswählst, bereiten wir sie direkt für die Website vor. Nach dem Speichern startet der Upload automatisch.</div>

      <button className="btn" disabled={saving || !userId} style={{ marginTop: 12 }}>
        {saving ? 'Speichert ...' : mode === 'edit' ? 'Änderungen speichern' : 'Zur Prüfung einreichen'}
      </button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
      {!compactUserMode && savedPoiId ? <ExternalLinksEditor poiId={savedPoiId} isAdmin={!compactUserMode} allowCreate={true} /> : null}
    </form>
  )
}
