'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { authFetchJson } from '@/utils/authFetch'
import { Menu, Map, Tags, PlusSquare, LogIn, UserPlus, Heart, LayoutDashboard, FolderPen, PencilLine, LogOut, FolderOpenDot, Compass, CircleUserRound, Trophy } from 'lucide-react'

function MenuLink({ href, icon: Icon, children, onClick, badge = null, vertical = false }) {
  return (
    <Link href={href} className={vertical ? 'admin-rail-link' : 'nav-link'} onClick={onClick}>
      <Icon size={18} />
      <span>{children}</span>
      {badge !== null ? <span className="badge" style={{ marginLeft: 6 }}>{badge}</span> : null}
    </Link>
  )
}


function MapNavToggle({ vertical = false }) {
  const [enabled, setEnabled] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('mapNavigationButtons')
    if (stored === '0') setEnabled(false)
  }, [])
  function toggle() {
    setEnabled((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('mapNavigationButtons', next ? '1' : '0')
        window.dispatchEvent(new CustomEvent('map-navigation-setting-changed', { detail: { enabled: next } }))
      }
      return next
    })
  }
  return (
    <button type="button" className={vertical ? 'admin-rail-link admin-toggle-btn' : 'nav-link-button admin-toggle-btn'} onClick={toggle} title="Steuert, ob Apple Karten und Google Maps im Karten-Popup angezeigt werden.">
      <Map size={18} />
      <span>Navigations-Buttons {enabled ? 'an' : 'aus'}</span>
    </button>
  )
}

function RankingVisibilityToggle({ vertical = false }) {
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function loadSetting() {
    const data = await authFetchJson("/api/admin/app-settings?t=" + Date.now(), { cache: "no-store" }).catch(() => ({ publicRankingVisible: false }))
    setEnabled(data.publicRankingVisible === true)
  }

  useEffect(() => { loadSetting() }, [])

  async function toggle() {
    if (saving) return
    const nextValue = !enabled
    setSaving(true)
    setError("")
    setEnabled(nextValue)
    const data = await authFetchJson("/api/admin/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicRankingVisible: nextValue }),
      cache: "no-store",
    }).catch((e) => ({ error: e.message }))
    if (data.error || data.publicRankingVisible !== nextValue) {
      setEnabled(!nextValue)
      setError(data.error || "Ranking-Einstellung konnte nicht dauerhaft gespeichert werden.")
    } else {
      window.dispatchEvent(new Event("app-settings-changed"))
    }
    setSaving(false)
  }

  return (
    <button type="button" className={vertical ? "admin-rail-link admin-toggle-btn" : "nav-link-button admin-toggle-btn"} onClick={toggle} disabled={saving} title={error || "Steuert, ob das öffentliche Ranking im Frontend sichtbar und aufrufbar ist."}>
      <Trophy size={18} />
      <span>{saving ? "Ranking speichert ..." : enabled ? "Ranking an" : "Ranking aus"}</span>
    </button>
  )
}

export default function NavBar() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [publicRankingVisible, setPublicRankingVisible] = useState(false)
  const currentUserRef = useRef(null)
  const profileRefreshRef = useRef(null)

  async function refreshProfile(currentUser) {
    currentUserRef.current = currentUser
    if (!currentUser) {
      setRole(null)
      setPendingCount(0)
      setProfileName('')
      return
    }

    const data = await authFetchJson('/api/me/profile')
    if (data.error) {
      setRole(null)
      setPendingCount(0)
      setProfileName(currentUser.email || 'Eingeloggt')
      return
    }

    const nextRole = data.item?.role || 'user'
    setRole(nextRole)
    setProfileName(data.item?.name || currentUser.email || 'Eingeloggt')

    if (nextRole === 'admin') {
      const countData = await authFetchJson('/api/admin/pending-count')
      setPendingCount(countData.count || 0)
    } else {
      setPendingCount(0)
    }
  }

  profileRefreshRef.current = refreshProfile

  async function doLogout() {
    try { await supabase.auth.signOut({ scope: 'global' }) } catch {}
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k))
      window.location.href = '/'
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      const [sessionResult, settingsResult] = await Promise.all([
        supabase.auth.getSession(),
        fetch('/api/public/app-settings', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({ publicRankingVisible: false })),
      ])
      if (cancelled) return
      const u = sessionResult.data.session?.user ?? null
      setUser(u)
      setPublicRankingVisible(settingsResult.publicRankingVisible === true)
      await profileRefreshRef.current?.(u)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      currentUserRef.current = u
      setUser(u)
      await profileRefreshRef.current?.(u)
    })

    async function onPendingChanged() {
      await profileRefreshRef.current?.(currentUserRef.current)
    }
    async function onSettingsChanged() {
      const settingsResult = await fetch('/api/public/app-settings', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({ publicRankingVisible: false }))
      if (!cancelled) setPublicRankingVisible(settingsResult.publicRankingVisible === true)
    }

    window.addEventListener('admin-pending-changed', onPendingChanged)
    window.addEventListener('app-settings-changed', onSettingsChanged)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      window.removeEventListener('admin-pending-changed', onPendingChanged)
      window.removeEventListener('app-settings-changed', onSettingsChanged)
    }
  }, [supabase])

  return (
    <>
      <div className="nav-shell">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <Compass size={20} />
            <span>USA Sights</span>
          </Link>

          <div className="desktop-nav">
            <MenuLink href="/categories" icon={Tags}>Kategorien</MenuLink>
            {publicRankingVisible ? <MenuLink href="/ranking" icon={Trophy}>Ranking</MenuLink> : null}
            <MenuLink href="/submit-poi" icon={PlusSquare}>POI vorschlagen</MenuLink>

            {user ? (
              <>
                <div className="login-pill" title={user.email || 'Eingeloggt'}>
                  <CircleUserRound size={16} />
                  <span>{profileName || 'Eingeloggt'}</span>
                  {role === 'admin' ? <span className="badge">Admin</span> : null}
                </div>
                <MenuLink href="/account/my-pois" icon={FolderOpenDot}>Meine POIs</MenuLink>
                <MenuLink href="/account/favorites" icon={Heart}>Favoriten</MenuLink>
                {role !== 'admin' ? <MenuLink href="/account" icon={LayoutDashboard}>Dashboard</MenuLink> : null}
                <button className="nav-link-button" type="button" onClick={doLogout}>
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <MenuLink href="/login" icon={LogIn}>Login</MenuLink>
                <MenuLink href="/register" icon={UserPlus}>Registrieren</MenuLink>
              </>
            )}
          </div>

          <button className="mobile-toggle" type="button" onClick={() => setOpen(!open)} aria-label="Menü">
            <Menu size={22} />
          </button>
        </div>

        {open && (
          <div className="mobile-panel">
            <div className="mobile-panel-inner">
              <div className="section-title">Entdecken</div>
              <MenuLink href="/categories" icon={Tags} onClick={() => setOpen(false)}>Kategorien</MenuLink>
              {publicRankingVisible ? <MenuLink href="/ranking" icon={Trophy} onClick={() => setOpen(false)}>Ranking</MenuLink> : null}
              <MenuLink href="/submit-poi" icon={PlusSquare} onClick={() => setOpen(false)}>POI vorschlagen</MenuLink>

              {user ? (
                <>
                  <div className="section-title">Konto</div>
                  <div className="login-pill" style={{ marginBottom: 10 }}>
                    <CircleUserRound size={16} />
                    <span>{profileName || 'Eingeloggt'}</span>
                    {role === 'admin' ? <span className="badge">Admin</span> : null}
                  </div>
                  <MenuLink href="/account/my-pois" icon={FolderOpenDot} onClick={() => setOpen(false)}>Meine POIs</MenuLink>
                  <MenuLink href="/account/favorites" icon={Heart} onClick={() => setOpen(false)}>Favoriten</MenuLink>
                  {role === 'admin' ? (
                    <>
                      <div className="section-title">Admin</div>
                      <MenuLink href="/admin/dashboard" icon={LayoutDashboard} onClick={() => setOpen(false)}>Dashboard</MenuLink>
                      <MenuLink href="/admin/pois" icon={FolderPen} onClick={() => setOpen(false)}>Alle POIs</MenuLink>
                      <MenuLink href="/admin/categories" icon={Tags} onClick={() => setOpen(false)}>Kategorien</MenuLink>
                      <MenuLink href="/admin/media" icon={FolderPen} onClick={() => setOpen(false)}>Medien</MenuLink>
                      <MenuLink href="/admin/change-requests" icon={PencilLine} onClick={() => setOpen(false)}>Änderungen</MenuLink>
                      <MenuLink href="/admin/affiliate-providers" icon={Tags} onClick={() => setOpen(false)}>Affiliates</MenuLink>
                      <MapNavToggle />
                      <RankingVisibilityToggle />
                    </>
                  ) : (
                    <MenuLink href="/account" icon={LayoutDashboard} onClick={() => setOpen(false)}>Dashboard</MenuLink>
                  )}
                  <button className="nav-link-button" type="button" onClick={doLogout}>
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="section-title">Konto</div>
                  <MenuLink href="/login" icon={LogIn} onClick={() => setOpen(false)}>Login</MenuLink>
                  <MenuLink href="/register" icon={UserPlus} onClick={() => setOpen(false)}>Registrieren</MenuLink>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {user && role === 'admin' ? (
        <aside className="admin-rail">
          <div className="admin-rail-inner">
            <div className="admin-rail-title">Admin</div>
            <MenuLink href="/admin/dashboard" icon={LayoutDashboard} vertical>Dashboard</MenuLink>
            <MenuLink href="/admin/pois" icon={FolderPen} vertical>Alle POIs</MenuLink>
            <MenuLink href="/admin/categories" icon={Tags} vertical>Kategorien</MenuLink>
            <MenuLink href="/admin/media" icon={FolderPen} vertical>Medien</MenuLink>
            <MenuLink href="/admin/change-requests" icon={PencilLine} vertical>Änderungen</MenuLink>
            <MenuLink href="/admin/affiliate-providers" icon={Tags} vertical>Affiliates</MenuLink>
            <MapNavToggle vertical />
            <RankingVisibilityToggle vertical />
          </div>
        </aside>
      ) : null}
    </>
  )
}
