'use client'

import { useEffect } from 'react'

export default function ToastNotice({ toast, onClose }) {
  useEffect(() => {
    if (!toast?.message) return
    const timer = window.setTimeout(() => onClose?.(), toast.duration || 4500)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast?.message) return null

  const type = toast.type || 'info'
  return (
    <div className="toast-notice-wrap" role="status" aria-live="polite">
      <div className={`toast-notice toast-${type}`}>
        <span className="toast-notice-icon">{type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️'}</span>
        <span>{toast.message}</span>
        <button type="button" className="toast-notice-close" onClick={onClose} aria-label="Meldung schließen">×</button>
      </div>
    </div>
  )
}
