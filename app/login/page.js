'use client'

import { useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import AuthStatus from '@/components/AuthStatus'

export default function LoginPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function getBaseUrl() {
    if (typeof window !== 'undefined') return window.location.origin
    return process.env.NEXT_PUBLIC_SITE_URL || ''
  }

  async function login() {
    setMessage('')
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const userId = data.user?.id
      let target = '/account'
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
        if (profile?.role === 'admin') target = '/admin/dashboard'
      }
      setMessage('Login erfolgreich. Seite wird aktualisiert ...')
      window.location.href = target
    } catch (e) {
      const msg = e?.message || 'Login fehlgeschlagen'
      if (msg.toLowerCase().includes('refresh token')) {
        try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
        setMessage('Alte Session war defekt. Bitte erneut einloggen.')
      } else {
        setMessage(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  async function sendPasswordReset() {
    setMessage('')
    if (!email.trim()) {
      setMessage('Bitte zuerst deine E-Mail-Adresse eingeben.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getBaseUrl()}/reset-password`,
      })
      if (error) throw error
      setMessage('Wenn die E-Mail registriert ist, wurde ein Link zum Zurücksetzen des Passworts gesendet.')
    } catch (e) {
      setMessage(e?.message || 'Passwort-Reset konnte nicht gestartet werden.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try { await supabase.auth.signOut({ scope: 'global' }) } catch {}
    Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k))
    window.location.href = '/'
  }

  return (
    <main className="container">
      <h1>Login</h1>
      <div className="grid grid-2">
        <div className="card">
          <label className="label">E-Mail</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label className="label">Passwort</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <button className="btn" type="button" onClick={login} disabled={busy}>Login</button>
            <button className="btn btn-secondary" type="button" onClick={logout} disabled={busy}>Logout</button>
            <button className="btn btn-secondary" type="button" onClick={sendPasswordReset} disabled={busy}>Passwort vergessen?</button>
          </div>
          {message && <p>{message}</p>}
          <p className="muted" style={{ marginTop:12 }}>Bei „Passwort vergessen?“ erhältst du per E-Mail einen Link. Danach kannst du unter „Neues Passwort setzen“ dein Passwort ändern.</p>
        </div>
        <AuthStatus />
      </div>
    </main>
  )
}
