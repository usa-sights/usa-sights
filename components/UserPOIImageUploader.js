'use client'

import { useMemo, useState } from 'react'
import { isAllowedImage } from '@/lib/utils'
import { processImageForUpload } from '@/lib/imageUpload'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'

export default function UserPOIImageUploader({ poiId, isAdmin = false, title = 'Bilder ergänzen', onUploaded = null }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentLabel, setCurrentLabel] = useState('')

  async function uploadPrepared(preparedFiles, originalFiles) {
    if (!poiId || !preparedFiles.length) return

    setUploading(true)
    setProgress(2)
    setCurrentLabel('Upload wird vorbereitet ...')
    setMessage('')

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Bitte zuerst einloggen.')

      const uploadPayload = {
        poi_id: poiId,
        caption: isAdmin ? 'Admin Upload' : 'User Upload',
        variant_prefix: 'extra',
        files: preparedFiles.map((item, index) => ({
          filename: item.original.name,
          original_type: item.original.type || 'image/webp',
          thumb_type: item.thumb.type || 'image/webp',
          is_cover: index === 0 && false,
        })),
      }

      const signed = await fetch('/api/poi-images/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(uploadPayload),
      }).then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || `HTTP ${r.status}`)
        return payload
      })

      const uploads = signed.uploads || []
      for (let i = 0; i < uploads.length; i += 1) {
        const item = preparedFiles[i]
        const entry = uploads[i]
        setCurrentLabel(`Datei ${i + 1} von ${preparedFiles.length}: ${originalFiles[i]?.name || item.original.name}`)

        const originalResult = await supabase.storage.from('poi-images').uploadToSignedUrl(entry.original.path, entry.original.token, item.original)
        if (originalResult.error) throw new Error(originalResult.error.message)
        setProgress(Math.max(5, Math.round(((i * 2 + 1) / (uploads.length * 2 + 1)) * 95)))

        const thumbResult = await supabase.storage.from('poi-images').uploadToSignedUrl(entry.thumb.path, entry.thumb.token, item.thumb)
        if (thumbResult.error) throw new Error(thumbResult.error.message)
        setProgress(Math.max(5, Math.round(((i * 2 + 2) / (uploads.length * 2 + 1)) * 95)))
      }

      const result = await fetch('/api/poi-images/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upload_id: signed.upload_id, uploads: signed.uploads }),
      }).then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || `HTTP ${r.status}`)
        return payload
      })

      setProgress(100)
      setMessage(result.message || (isAdmin ? 'Bilder hochgeladen und direkt freigegeben.' : 'Deine Fotos wurden hochgeladen und werden nun geprüft.'))
      setCurrentLabel('Upload abgeschlossen')
      onUploaded?.(result.items || [])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-data-changed', { detail: { method: 'POST', url: '/api/poi-images', items: result.items || [] } }))
      }
    } catch (err) {
      setMessage(err.message || 'Upload fehlgeschlagen')
      setProgress(0)
      setCurrentLabel('')
    } finally {
      setUploading(false)
    }
  }

  async function prepareFiles(listLike) {
    const nextFiles = Array.from(listLike || [])
    if (!nextFiles.length) return
    for (const file of nextFiles) {
      if (!isAllowedImage(file)) {
        setMessage('Bitte nur JPG, PNG oder WebP auswählen.')
        return
      }
    }
    try {
      setMessage('Bilder werden vorbereitet ...')
      const prepared = []
      for (const file of nextFiles) prepared.push(await processImageForUpload(file))
      await uploadPrepared(prepared, nextFiles)
    } catch (err) {
      setMessage(err.message || 'Bildvorbereitung fehlgeschlagen')
      setProgress(0)
      setCurrentLabel('')
      setUploading(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>{title}</h3>
      <input className="input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => prepareFiles(e.target.files)} disabled={uploading} />
      {uploading ? (
        <div style={{ marginTop: 10 }}>
          <div className="muted">{currentLabel || 'Upload läuft ...'}</div>
          <div className="upload-progress-track">
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="muted">{progress}% abgeschlossen</div>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>
          {isAdmin ? 'Bilder werden direkt nach der Auswahl hochgeladen und sind anschließend sofort sichtbar.' : 'Sobald du Bilder auswählst, startet der Upload automatisch. Danach prüfen wir sie kurz und schalten sie frei.'}
        </p>
      )}
      {message ? <p>{message}</p> : null}
    </div>
  )
}
