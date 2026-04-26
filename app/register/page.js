'use client'
import { useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'

export default function RegisterPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function register() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setMessage('')
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: redirectTo, data: { name } }
    })
    if (error) {
      const msg = String(error.message || '')
      if (/rate limit/i.test(msg)) {
        setMessage('Zu viele Bestätigungsanfragen in kurzer Zeit. Bitte warte ein paar Minuten und versuche es dann erneut oder nutze später die Passwort-vergessen-Funktion, falls die E-Mail schon unterwegs ist.')
      } else {
        setMessage(msg)
      }
      setIsSubmitting(false)
      return
    }
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, name, role: 'user' })
    }
    setMessage('Fast geschafft: Bitte bestätige deine E-Mail. Falls die Nachricht nicht sofort ankommt, prüfe kurz Spam/Junk und warte ein paar Minuten, bevor du es erneut versuchst.')
    setIsSubmitting(false)
  }

  return (
    <main className="container">
      <h1>Registrieren</h1>
      <div className="card">
        <div className="notice">Lege dein kostenloses Konto an und bestätige danach kurz deine E-Mail-Adresse. Wir speichern nur die Angaben, die du für dein Konto sowie für Vorschläge, Uploads und eigene Beiträge wirklich brauchst. Falls die Bestätigungs-Mail nicht sofort ankommt, prüfe bitte auch deinen Spam-Ordner und gib dem Versand ein paar Minuten Zeit.</div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">E-Mail</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label">Passwort</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn" onClick={register} disabled={isSubmitting}>{isSubmitting ? 'Wird gesendet ...' : 'Registrieren'}</button>
        {message && <p>{message}</p>}
      </div>
    </main>
  )
}
