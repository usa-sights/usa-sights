'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch, authFetchJson } from '@/utils/authFetch'
import { Activity, Heart, Image as ImageIcon, Link2, MapPinned, MessageCircle, Reply, ShieldAlert, Star, Users } from 'lucide-react'

function MetricCard({ icon: Icon, title, total, totalInfo, items = [] }) {
  return (
    <div className="card metric-card">
      <div className="dashboard-stat-head" title={totalInfo || undefined}>
        <Icon size={18} />
        <span>{title}</span>
      </div>
      <div className="metric-total" title={totalInfo || undefined}>{Number(total || 0).toLocaleString('de-DE')}</div>
      <div className="metric-breakdown">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`metric-chip metric-${item.tone || 'neutral'}`}
            title={item.info || undefined}
          >
            <span>{item.label}</span>
            <strong>{Number(item.value || 0).toLocaleString('de-DE')}</strong>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ value }) {
  return <span className={`status-pill status-${value}`}>{value}</span>
}

function QualityList({ title, icon: Icon, items = [], emptyText }) {
  return (
    <div className="card">
      <h3 className="dashboard-stat-head" style={{ marginBottom: 12 }}>
        <Icon size={18} />
        <span>{title}</span>
      </h3>
      <div className="dashboard-status-list">
        {!items.length ? <div className="muted">{emptyText}</div> : null}
        {items.map((item) => (
          <Link key={`${title}-${item.key}`} className="dashboard-status-item" href={item.slug ? `/poi/${item.slug}` : '/admin/pois'}>
            {item.thumb_url ? (
              <img className="content-thumb" src={item.thumb_url} alt={item.title || 'POI'} loading="lazy" />
            ) : (
              <div className="content-thumb content-thumb-fallback">POI</div>
            )}
            <span>
              <strong>{item.title || 'POI'}</strong>
              <small>{item.count.toLocaleString('de-DE')} Einträge</small>
            </span>
            <div className="dashboard-list-meta">
              <span>{title.includes('favor') ? 'Favoriten' : 'Bewertungen'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function ActivityIcon({ type }) {
  if (type === 'Review') return <Star size={16} />
  if (type === 'Bild') return <ImageIcon size={16} />
  if (type === 'Link') return <Link2 size={16} />
  if (type === 'Antwort') return <Reply size={16} />
  if (type === 'POI') return <MapPinned size={16} />
  return <Activity size={16} />
}

function moderationLabel(label) {
  return String(label || '')
    .replace('POIs pending', 'POIs ausstehend')
    .replace('Bilder pending', 'Bilder ausstehend')
    .replace('Links pending', 'Links ausstehend')
    .replace('Änderungen pending', 'Änderungen ausstehend')
}

export default function AdminDashboardClient() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [publicRankingVisible, setPublicRankingVisible] = useState(false)
  const [settingsMissing, setSettingsMissing] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [dashboardRes, settingsRes] = await Promise.all([
          authFetchJson('/api/admin/dashboard', { cache: 'no-store' }),
          authFetchJson('/api/admin/app-settings', { cache: 'no-store' }).catch(() => ({ publicRankingVisible: false, missingTable: true })),
        ])
        if (!active) return
        if (dashboardRes.error) {
          setError(dashboardRes.error)
          return
        }
        setError('')
        setData(dashboardRes)
        setPublicRankingVisible(settingsRes.publicRankingVisible === true)
        setSettingsMissing(settingsRes.missingTable === true)
      } catch (e) {
        if (active) setError(e.message)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [refreshTick])

  useEffect(() => {
    const refresh = () => setRefreshTick((value) => value + 1)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const interval = window.setInterval(refresh, 120000)
    window.addEventListener('focus', refresh)
    window.addEventListener('app-data-changed', refresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('app-data-changed', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  if (error) return <main className="container"><div className="error-box">{error}</div></main>
  if (!data) return <main className="container"><p>Lädt ...</p></main>

  async function togglePublicRanking() {
    if (settingsSaving) return
    const desiredValue = !publicRankingVisible
    setSettingsSaving(true)
    setSettingsError('')
    setPublicRankingVisible(desiredValue)

    try {
      const next = await authFetchJson('/api/admin/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicRankingVisible: desiredValue }),
        cache: 'no-store',
      })
      if (next.error) throw new Error(next.error)

      const persistedValue = next.publicRankingVisible === true
      setPublicRankingVisible(persistedValue)
      if (persistedValue !== desiredValue) {
        throw new Error('Die Einstellung wurde nicht dauerhaft gespeichert. Bitte app_settings in Supabase prüfen.')
      }

      window.dispatchEvent(new Event('app-settings-changed'))
      window.dispatchEvent(new Event('app-data-changed'))
    } catch (e) {
      setPublicRankingVisible(!desiredValue)
      setSettingsError(e.message || 'Einstellung konnte nicht gespeichert werden.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const { kpis, moderationItems, activityFeed, quality } = data

  return (
    <main className="container admin-editor-container">
      <h1>Admin-Dashboard</h1>

      <div className="metrics-grid">
        <MetricCard
          icon={MapPinned}
          title="Orte (POIs)"
          total={kpis.totalPois}
          totalInfo="Gesamtzahl aller Orte im System, unabhängig vom Status."
          items={[
            { label: 'Veröffentlicht', value: kpis.publishedPois || 0, href: '/admin/pois?status=published', tone: 'green', info: 'Anzahl aller bereits freigegebenen Orte.' },
            { label: 'Ausstehend', value: kpis.pendingPois || 0, href: '/admin/pois?status=pending', tone: 'yellow', info: 'Anzahl aller Orte, die noch geprüft oder freigegeben werden müssen.' },
            { label: 'Abgelehnt', value: kpis.rejectedPois || 0, href: '/admin/pois?status=rejected', tone: 'red', info: 'Anzahl aller Orte, die abgelehnt wurden.' },
          ]}
        />
        <MetricCard
          icon={MessageCircle}
          title="Bewertungen"
          total={kpis.reviewsTotal}
          totalInfo="Gesamtzahl aller abgegebenen Bewertungen und Rezensionen."
          items={[
            { label: 'Heute', value: kpis.reviewsToday || 0, href: '/admin/reviews?period=today', tone: 'blue', info: 'Bewertungen, die heute neu erstellt wurden.' },
            { label: 'Letzte 7 Tage', value: kpis.reviews7d || 0, href: '/admin/reviews?period=7d', tone: 'blue', info: 'Bewertungen, die in den letzten 7 Tagen eingegangen sind.' },
            { label: 'Ø Bewertung', value: kpis.avgRating || 0, href: '/admin/reviews', tone: 'neutral', info: 'Durchschnitt der vorhandenen Bewertungssterne über alle Reviews.' },
          ]}
        />
        <MetricCard
          icon={Heart}
          title="Favoriten"
          total={kpis.favoritesTotal}
          totalInfo="Gesamtzahl aller Favoriten-Markierungen von Nutzern."
          items={[
            { label: 'Gesamt', value: kpis.favoritesTotal || 0, href: '/admin/favorites', tone: 'red', info: 'Alle gespeicherten Favoriten-Markierungen im System.' },
          ]}
        />
        <MetricCard
          icon={ImageIcon}
          title="Bilder"
          total={kpis.imagesTotal || 0}
          totalInfo="Gesamtzahl aller Bilddateien im System."
          items={[
            { label: 'Veröffentlicht', value: kpis.imagesPublished || 0, href: '/admin/media?status=approved', tone: 'green', info: 'Bilder, die bereits freigegeben wurden.' },
            { label: 'Ausstehend', value: kpis.imagesPending || 0, href: '/admin/media?status=pending', tone: 'yellow', info: 'Bilder, die noch geprüft oder freigegeben werden müssen.' },
            { label: 'Abgelehnt', value: kpis.imagesRejected || 0, href: '/admin/media?status=rejected', tone: 'red', info: 'Bilder, die abgelehnt wurden.' },
          ]}
        />
        <MetricCard
          icon={Users}
          title="Nutzerkonten"
          total={kpis.totalUsers}
          totalInfo="Anzahl aller registrierten Nutzerprofile."
          items={[
            { label: 'Gesamt', value: kpis.totalUsers || 0, href: '/admin/users', tone: 'neutral', info: 'Alle registrierten Nutzerprofile.' },
            { label: 'Beiträge 7 Tage', value: kpis.contributions7d || 0, href: '/admin/dashboard#activity', tone: 'blue', info: 'Summe neuer POIs, Bewertungen, Bilder, Links und Änderungsmeldungen der letzten 7 Tage.' },
          ]}
        />
        <MetricCard
          icon={Link2}
          title="Externe Links"
          total={kpis.linksTotal || 0}
          totalInfo="Gesamtzahl aller gespeicherten externen Links zu Orten."
          items={[
            { label: 'Veröffentlicht', value: kpis.linksPublished || 0, href: '/admin/admin-links?status=published', tone: 'green', info: 'Links, die bereits freigegeben wurden.' },
            { label: 'Ausstehend', value: kpis.linksPending || 0, href: '/admin/admin-links?status=pending', tone: 'yellow', info: 'Links, die noch moderiert oder geprüft werden müssen.' },
            { label: 'Abgelehnt', value: kpis.linksRejected || 0, href: '/admin/admin-links?status=rejected', tone: 'red', info: 'Links, die abgelehnt wurden.' },
          ]}
        />
        <MetricCard
          icon={ShieldAlert}
          title="Offene Moderation"
          total={kpis.openModeration}
          totalInfo="Summe aller offenen Moderationsfälle aus POIs, Bildern, Links und Änderungswünschen."
          items={moderationItems.filter((x) => x.count > 0).map((item) => ({
            label: moderationLabel(item.label),
            value: item.count,
            href: item.href,
            tone: 'yellow',
            info: `Aktuell offene Moderationsfälle in der Rubrik „${moderationLabel(item.label)}“.`,
          }))}
        />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card" id="quality">
          <h2>Qualität &amp; Auswertung</h2>
          <div className="dashboard-links">
            <Link title="Anzahl der Orte, zu denen noch kein freigegebenes Bild vorhanden ist." href="/admin/pois?missing=images">POIs ohne Bilder: {quality.poisWithoutImages.toLocaleString('de-DE')}</Link>
            <Link title="Anzahl der Orte, bei denen noch keine Kategorie gesetzt wurde." href="/admin/pois?missing=category">POIs ohne Kategorie: {quality.poisWithoutCategory.toLocaleString('de-DE')}</Link>
            <Link title="Anzahl der Orte, bei denen die Beschreibung fehlt oder leer ist." href="/admin/pois?missing=description">POIs ohne Beschreibung: {quality.poisWithoutDescription.toLocaleString('de-DE')}</Link>
            <Link title="Anzahl der Orte, zu denen es noch keine Bewertungen gibt." href="/admin/reviews?missing=reviews">POIs ohne Bewertungen: {quality.poisWithoutReviews.toLocaleString('de-DE')}</Link>
          </div>
        </div>
        <div className="card">
          <h2>Moderationsübersicht</h2>
          <div className="dashboard-links">
            {moderationItems.map((item) => (
              <Link key={item.key} href={item.href} title={`Zeigt alle Einträge aus ${moderationLabel(item.label)} an.`}>{moderationLabel(item.label)}: {Number(item.count || 0).toLocaleString('de-DE')}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <QualityList
          title="Meist favorisierte POIs"
          icon={Heart}
          items={quality.mostFavoritedPois || []}
          emptyText="Noch keine Favoriten vorhanden."
        />
        <QualityList
          title="Meist bewertete POIs"
          icon={Star}
          items={quality.mostReviewedPois || []}
          emptyText="Noch keine Bewertungen vorhanden."
        />
      </div>

      <div className="card recent-activity-card" id="activity" style={{ marginTop: 16 }}>
        <h2>Aktivitätsfeed</h2>
        <div className="recent-activity-list">
          {(activityFeed || []).map((item, idx) => (
            <Link key={`${item.type}-${idx}-${item.created_at}`} href={item.href} className="dashboard-status-item">
              {item.thumb_url ? (
                <img className="content-thumb" src={item.thumb_url} alt={item.title || item.type} loading="lazy" />
              ) : (
                <div className="content-thumb content-thumb-fallback"><ActivityIcon type={item.type} /></div>
              )}
              <span>
                <strong>{item.title || item.type}</strong>
                <small>{item.label}</small>
                {item.url ? <small className="content-url">{item.url}</small> : null}
              </span>
              <div className="dashboard-list-meta">
                {item.status ? <StatusBadge value={item.status} /> : null}
                <span>{item.created_at_label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
