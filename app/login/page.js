'use client'

import { useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import AuthStatus from '@/components/AuthStatus'

export default function LoginPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function login() {
    setMessage('')
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
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="label">Passwort</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" type="button" onClick={login}>Login</button>
          <button className="btn btn-secondary" type="button" onClick={logout} style={{ marginLeft: 8 }}>Logout</button>
          {message && <p>{message}</p>}
        </div>
        <AuthStatus />
      </div>
    </main>
  )
}
