'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function updatePassword() {
    setMessage('')
    if (!password || password.length < 8) {
      setMessage('Bitte ein Passwort mit mindestens 8 Zeichen eingeben.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('Die Passwörter stimmen nicht überein.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage('Passwort wurde aktualisiert. Du kannst dich jetzt anmelden.')
    } catch (e) {
      setMessage(e?.message || 'Passwort konnte nicht geändert werden. Bitte den Reset-Link erneut anfordern.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container">
      <h1>Neues Passwort setzen</h1>
      <div className="card" style={{ maxWidth: 560 }}>
        <label className="label">Neues Passwort</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <label className="label">Neues Passwort wiederholen</label>
        <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" type="button" onClick={updatePassword} disabled={busy}>Passwort speichern</button>
          <Link className="btn btn-secondary" href="/login">Zum Login</Link>
        </div>
        {message ? <p>{message}</p> : null}
      </div>
    </main>
  )
}
