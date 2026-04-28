'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { authFetchJson } from '@/utils/authFetch'
import { deriveThumbPath } from '@/lib/imageUpload'

const PAGE_SIZE_OPTIONS = [48, 72, 120, 180]

function formatDate(value) {
  if (!value) return '—'
  try { return new Intl.DateTimeFormat('de-AT', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) } catch { return value }
}

export default function AdminMediaClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState(searchParams.get('status') || 'pending')
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [selectedIds, setSelectedIds] = useState([])
  const [activePreview, setActivePreview] = useState(null)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(72)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (next = {}) => {
    const nextStatus = next.status ?? status
    const nextPage = next.page ?? page
    const nextPageSize = next.pageSize ?? pageSize
    setLoading(true)
    setMessage('')
    const offset = nextPage * nextPageSize
    const data = await authFetchJson(`/api/admin/media?status=${encodeURIComponent(nextStatus)}&limit=${nextPageSize}&offset=${offset}`)
    setLoading(false)
    if (data.error) {
      setItems([])
      setUrls({})
      setMessage(data.error)
      return
    }
    const rows = data.items || []
    setItems(rows)
    setTotal(Number(data.total || rows.length || 0))
    setHasMore(data.has_more === true)
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)))

    if (rows.length) {
      const paths = Array.from(new Set(rows.flatMap((x) => [x.thumb_path || deriveThumbPath(x.path), x.path].filter(Boolean))))
      const signed = await fetch('/api/images/signed-urls', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ paths })
      }).then((r) => r.json()).catch(() => ({ urls:{} }))
      setUrls(signed.urls || {})
    } else {
      setUrls({})
    }
  }, [status, page, pageSize])

  useEffect(() => {
    const nextStatus = searchParams.get('status') || 'pending'
    setStatus(nextStatus)
    setPage(0)
    load({ status: nextStatus, page: 0 })
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load({ page, pageSize })
  }, [page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let rows = [...items]
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((x) => {
        const title = x.pois?.title || ''
        const caption = x.caption || ''
        return title.toLowerCase().includes(q) || caption.toLowerCase().includes(q)
      })
    }
    if (sortKey === 'created_at') rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortKey === 'title') rows.sort((a, b) => String(a.pois?.title || '').localeCompare(String(b.pois?.title || '')))
    return rows
  }, [items, search, sortKey])

  useEffect(() => {
    setActivePreview((prev) => (prev && filtered.some((row) => row.id === prev.id) ? prev : filtered[0] || null))
  }, [filtered])

  async function updateImage(payload) {
    setBusy(true)
    const data = await authFetchJson('/api/admin/media', {
      method:'PUT',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    })
    setBusy(false)
    setMessage(data.error || data.message || 'Bild aktualisiert')
    if (!data.error) {
      await load()
      window.dispatchEvent(new Event('app-data-changed'))
    }
  }

  const grouped = useMemo(() => filtered.reduce((acc, item) => {
    const key = item.pois?.title || 'Ohne POI'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {}), [filtered])

  const selectedCount = selectedIds.length
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id))
  const someVisibleSelected = filtered.some((row) => selectedIds.includes(row.id))
  const pageStart = total ? page * pageSize + 1 : 0
  const pageEnd = Math.min((page + 1) * pageSize, total)
  const activePreviewIndex = activePreview ? filtered.findIndex((row) => row.id === activePreview.id) : -1

  function showPreviousPreview(event) {
    event?.stopPropagation?.()
    if (!filtered.length) return
    const index = activePreviewIndex >= 0 ? activePreviewIndex : 0
    setActivePreview(filtered[(index - 1 + filtered.length) % filtered.length])
  }

  function showNextPreview(event) {
    event?.stopPropagation?.()
    if (!filtered.length) return
    const index = activePreviewIndex >= 0 ? activePreviewIndex : -1
    setActivePreview(filtered[(index + 1) % filtered.length])
  }

  function isSelected(id) { return selectedIds.includes(id) }
  function toggleSelect(id) { setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) }
  function toggleGroup(rows, checked) {
    const ids = rows.map((row) => row.id)
    setSelectedIds((prev) => checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)))
  }
  function toggleVisible(checked) {
    const ids = filtered.map((row) => row.id)
    setSelectedIds((prev) => checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)))
  }
  function visibleImageUrl(img) {
    const thumbPath = img.thumb_path || deriveThumbPath(img.path)
    return urls[thumbPath] || img.thumb_url || urls[img.path] || null
  }
  function largeImageUrl(img) {
    const thumbPath = img.thumb_path || deriveThumbPath(img.path)
    return urls[thumbPath] || img.thumb_url || urls[img.path] || null
  }
  async function bulkApprove() { if (selectedIds.length) { await updateImage({ ids: selectedIds, status:'approved' }); setSelectedIds([]) } }
  async function bulkReject() { if (selectedIds.length) { await updateImage({ ids: selectedIds, status:'rejected' }); setSelectedIds([]) } }
  async function bulkDelete() {
    if (!selectedIds.length || busy) return
    if (!window.confirm(`Möchtest du ${selectedIds.length} Bild${selectedIds.length === 1 ? '' : 'er'} wirklich löschen? Dabei werden auch die Dateien im Supabase Storage entfernt.`)) return
    setBusy(true)
    const data = await authFetchJson('/api/admin/media', { method:'DELETE', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ids: selectedIds }) })
    setBusy(false)
    setMessage(data.error || data.message || 'Bilder gelöscht')
    if (!data.error) { setSelectedIds([]); await load(); window.dispatchEvent(new Event('app-data-changed')) }
  }

  useEffect(() => {
    if (!previewFullscreen) return
    function onKey(event) {
      if (event.key === 'Escape') setPreviewFullscreen(false)
      if (event.key === 'ArrowLeft') showPreviousPreview(event)
      if (event.key === 'ArrowRight') showNextPreview(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewFullscreen, activePreviewIndex, filtered])

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Medien</h1>
      {message ? <div className="notice">{message}</div> : null}

      <div className="card" style={{ marginBottom:16 }}>
        <div className="admin-media-filterbar">
          <div><label className="label">Status</label><select className="select" value={status} onChange={(e)=>{ setStatus(e.target.value); setPage(0); load({ status:e.target.value, page:0 }) }}><option value="pending">pending</option><option value="rejected">rejected</option><option value="approved">approved</option></select></div>
          <div><label className="label">Suche auf dieser Seite</label><input className="input" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="POI oder Bildtext" /></div>
          <div><label className="label">Sortierung</label><select className="select" value={sortKey} onChange={(e)=>setSortKey(e.target.value)}><option value="created_at">neueste zuerst</option><option value="title">POI Titel</option></select></div>
          <div><label className="label">Bilder pro Seite</label><select className="select" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(0) }}>{PAGE_SIZE_OPTIONS.map((n)=><option key={n} value={n}>{n}</option>)}</select></div>
          <label className="admin-media-selectall admin-media-selectall-page"><input type="checkbox" checked={allVisibleSelected} ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }} onChange={(e) => toggleVisible(e.target.checked)} />Alle angezeigten markieren</label>
          <button type="button" className="btn btn-secondary" disabled={!selectedCount || busy} onClick={bulkApprove}>Auswahl freigeben{selectedCount ? ` (${selectedCount})` : ""}</button>
          <button type="button" className="btn btn-danger" disabled={!selectedCount || busy} onClick={bulkReject}>Auswahl ablehnen</button>
          <button type="button" className="btn btn-danger" disabled={!selectedCount || busy} onClick={bulkDelete}>Auswahl löschen</button>
        </div>
        <div className="admin-media-pager">
          <span>{loading ? 'Lädt …' : `${pageStart}–${pageEnd} von ${total.toLocaleString('de-DE')} Bildern`}</span>
          <div>
            <button type="button" className="btn btn-secondary" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>Zurück</button>
            <button type="button" className="btn btn-secondary" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>Weiter</button>
          </div>
        </div>
        <p className="muted" style={{ margin:'8px 0 0' }}>Die Administration lädt Bilder seitenweise. So bleibt sie auch bei vielen Nutzer-Uploads schnell und übersichtlich.</p>
      </div>

      <div className="admin-media-layout">
        <div>
          {Object.entries(grouped).map(([title, rows]) => {
            const allSelected = rows.every((row) => isSelected(row.id))
            const someSelected = rows.some((row) => isSelected(row.id))
            return (
              <div key={title} className="card admin-media-group-card">
                <div className="admin-media-group-header">
                  <div>
                    <h3 style={{ margin:'0 0 4px' }}>{rows[0]?.pois?.slug ? <Link href={`/poi/${rows[0].pois.slug}`} className="poi-inline-link">{title}</Link> : title}</h3>
                    <p className="muted" style={{ margin:0 }}>{rows.length} Bild{rows.length === 1 ? '' : 'er'} auf dieser Seite · Statusfilter: {status}</p>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                    <label className="admin-media-selectall"><input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected }} onChange={(e) => toggleGroup(rows, e.target.checked)} />Alle markieren</label>
                    <button type="button" className="btn btn-secondary" disabled={!rows.some((row) => isSelected(row.id)) || busy} onClick={() => updateImage({ ids: rows.filter((row) => isSelected(row.id)).map((row) => row.id), status:'approved' })}>Gruppe freigeben</button>
                  </div>
                </div>
                <div className="admin-media-grid">
                  {rows.map((img) => {
                    const selected = isSelected(img.id)
                    const previewUrl = visibleImageUrl(img)
                    return (
                      <article key={img.id} className={`admin-media-thumb ${selected ? 'is-selected' : ''} ${activePreview?.id === img.id ? 'is-active' : ''}`} onClick={() => setActivePreview(img)}>
                        <label className="admin-media-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected} onChange={() => toggleSelect(img.id)} /></label>
                        <div className="admin-media-thumb-image">{previewUrl ? <img src={previewUrl} alt={img.caption || title} loading="lazy" /> : <div className="muted">Kein Bild</div>}</div>
                        <div className="admin-media-thumb-body"><div className="admin-media-thumb-topline"><span className={`status-pill status-${img.status}`}>{img.status}</span>{img.is_cover ? <span className="badge">Cover</span> : null}{img.is_gallery_pick ? <span className="badge">Galerie</span> : null}</div><strong className="admin-media-thumb-caption">{img.caption || 'Ohne Bildtext'}</strong><span className="muted admin-media-thumb-date">{formatDate(img.created_at)}</span></div>
                      </article>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <aside className="card admin-media-preview-card">
          {!activePreview ? <p className="muted">Keine Bilder gefunden.</p> : <>
            <button type="button" className="admin-media-preview-image" onClick={() => setPreviewFullscreen(true)} title="Großansicht öffnen">{largeImageUrl(activePreview) ? <img src={largeImageUrl(activePreview)} alt={activePreview.caption || activePreview.pois?.title || 'Bild'} /> : <div className="muted">Kein Bild verfügbar</div>}</button>
            <div className="admin-media-preview-meta"><h3 style={{ margin:'0 0 6px' }}>{activePreview.pois?.title || 'Ohne POI'}</h3><p style={{ margin:'0 0 8px' }}>{activePreview.caption || 'Kein Bildtext vorhanden.'}</p><div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}><span className={`status-pill status-${activePreview.status}`}>{activePreview.status}</span>{activePreview.is_cover ? <span className="badge">Aktuelles Cover</span> : null}{activePreview.is_gallery_pick ? <span className="badge">In Galerie</span> : null}</div><p className="muted" style={{ margin:'0 0 14px' }}>Hochgeladen am {formatDate(activePreview.created_at)}</p><div style={{ display:'grid', gap:8 }}><button type="button" className="btn" disabled={busy} onClick={() => updateImage({ id: activePreview.id, status:'approved' })}>Freigeben</button><button type="button" className="btn btn-danger" disabled={busy} onClick={() => updateImage({ id: activePreview.id, status:'rejected' })}>Ablehnen</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => updateImage({ id: activePreview.id, is_cover:true })}>Als Cover festlegen</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => updateImage({ id: activePreview.id, is_gallery_pick: !activePreview.is_gallery_pick })}>{activePreview.is_gallery_pick ? 'Aus Galerie entfernen' : 'Zur Galerie hinzufügen'}</button></div></div>
          </>}
        </aside>
      </div>
      {previewFullscreen && activePreview ? (
        <div className="admin-media-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewFullscreen(false)}>
          <button type="button" className="admin-media-lightbox-close" onClick={() => setPreviewFullscreen(false)}>Schließen</button>
          {filtered.length > 1 ? <button type="button" className="admin-media-lightbox-nav admin-media-lightbox-prev" onClick={showPreviousPreview} aria-label="Vorheriges Bild">‹</button> : null}
          {largeImageUrl(activePreview) ? <img src={largeImageUrl(activePreview)} alt={activePreview.caption || activePreview.pois?.title || "Bild"} onClick={(e) => e.stopPropagation()} /> : null}
          {filtered.length > 1 ? <button type="button" className="admin-media-lightbox-nav admin-media-lightbox-next" onClick={showNextPreview} aria-label="Nächstes Bild">›</button> : null}
          <div className="admin-media-lightbox-caption" onClick={(e) => e.stopPropagation()}>
            <strong>{activePreview.pois?.title || 'Ohne POI'}</strong>
            <span>{activePreviewIndex + 1} / {filtered.length} · {activePreview.caption || 'Kein Bildtext'}</span>
          </div>
        </div>
      ) : null}
    </main>
  )
}
