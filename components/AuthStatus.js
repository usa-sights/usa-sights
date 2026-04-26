'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'

export default function AuthStatus() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const { data } = await supabase.auth.getSession()
        setUser(data.session?.user ?? null)
      } catch {
        try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
        setMessage('Defekte Session bereinigt. Bitte neu einloggen.')
        setUser(null)
      }
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  return (
    <div className="card">
      <strong>Session</strong>
      <p>{user ? `Eingeloggt als ${user.email}` : 'Nicht eingeloggt'}</p>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  )
}
