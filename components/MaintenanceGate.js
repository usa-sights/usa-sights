'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { authFetchJson } from '@/utils/authFetch'
import { fetchPublicAppSettings, primePublicAppSettings } from '@/utils/publicAppSettings'

function MaintenanceScreen() {
  return (
    <main className="container" style={{ paddingTop: 56, paddingBottom: 56 }}>
      <div className="card" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 18, background: '#fee2e2', color: '#b91c1c', marginBottom: 14 }}>
          <Wrench size={26} />
        </div>
        <h1 style={{ marginTop: 0 }}>Wartungsmodus aktiv</h1>
        <p className="muted" style={{ fontSize: 16 }}>
          USA Sights wird gerade aktualisiert. Bitte versuche es in Kürze erneut.
        </p>
      </div>
    </main>
  )
}

export default function MaintenanceGate({ children }) {
  const pathname = usePathname() || '/'
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)

  const adminOrAuthPath = pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/register')

  useEffect(() => {
    let cancelled = false

    async function load({ force = false } = {}) {
      if (adminOrAuthPath) {
        if (!cancelled) {
          setMaintenanceMode(false)
          setIsAdmin(false)
          setReady(true)
        }
        return
      }

      const settings = await fetchPublicAppSettings({ force })
      if (cancelled) return

      setMaintenanceMode(settings.maintenanceMode === true)

      // In the common case maintenance mode is disabled. Avoid the extra
      // Supabase session/profile requests on every public page load.
      if (settings.maintenanceMode !== true) {
        setIsAdmin(false)
        setReady(true)
        return
      }

      let admin = false
      const sessionResult = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (sessionResult.data?.session?.user) {
        const profile = await authFetchJson('/api/me/profile').catch(() => null)
        admin = profile?.item?.role === 'admin'
      }

      if (!cancelled) {
        setIsAdmin(admin)
        setReady(true)
      }
    }

    function onSettingsChanged(event) {
      if (event?.detail && Object.prototype.hasOwnProperty.call(event.detail, 'maintenanceMode')) {
        primePublicAppSettings({ maintenanceMode: event.detail.maintenanceMode === true })
        setMaintenanceMode(event.detail.maintenanceMode === true)
        return
      }
      load({ force: true })
    }

    load()
    window.addEventListener('app-settings-changed', onSettingsChanged)
    return () => {
      cancelled = true
      window.removeEventListener('app-settings-changed', onSettingsChanged)
    }
  }, [adminOrAuthPath, supabase])

  if (!ready) return children
  if (maintenanceMode && !isAdmin && !adminOrAuthPath) return <MaintenanceScreen />
  return children
}
