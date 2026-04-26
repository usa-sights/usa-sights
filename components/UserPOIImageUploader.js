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

      const form = new FormData()
      form.append('poi_id', poiId)
      form.append('caption', isAdmin ? 'Admin Upload' : 'User Upload')
      form.append('variant_prefix', 'extra')
      for (let i = 0; i < preparedFiles.length; i += 1) {
        const item = preparedFiles[i]
        setCurrentLabel(`Datei ${i + 1} von ${preparedFiles.length}: ${originalFiles[i]?.name || item.original.name}`)
        form.append(`original_${i}`, item.original, item.original.name)
        form.append(`thumb_${i}`, item.thumb, item.thumb.name)
        form.append(`filename_${i}`, item.original.name)
      }

      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/poi-images')
        xhr.responseType = 'json'
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          const next = Math.max(5, Math.min(95, Math.round((event.loaded / event.total) * 100)))
          setProgress(next)
        }

        xhr.onload = () => {
          const payload = xhr.response || {}
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(payload)
            return
          }
          reject(new Error(payload.error || `HTTP ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error('Upload fehlgeschlagen'))
        xhr.send(form)
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
