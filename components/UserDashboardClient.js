'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { authFetchJson } from '@/utils/authFetch'
import { Heart, MessageCircle, Reply, Image as ImageIcon, Link as LinkIcon, PencilLine, Clock3, MapPinned, Star, MessageSquareQuote } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'

function formatDateTime(value) {
  return value ? new Intl.DateTimeFormat('de-DE', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '-'
}

function MetricCard({ icon:Icon, title, total, href, tone='neutral', subtitle }) {
  return <Link href={href} className={`card metric-card metric-card-link metric-${tone}`}><div className="dashboard-stat-head"><Icon size={18} /><span>{title}</span></div><div className="metric-total">{Number(total || 0).toLocaleString('de-DE')}</div>{subtitle ? <div className="metric-subtitle">{subtitle}</div> : null}</Link>
}

function ImageThumb({ item, fallback }) {
  const src = item?.thumb_url || item?.url || null
  if (!src || !String(src).startsWith('http')) return <div className="content-thumb content-thumb-fallback">{fallback}</div>
  return <img className="content-thumb" src={src} alt={item.caption || item.poi_title || item.title || fallback} loading="lazy" />
}
function ThumbFromUrl({ src, fallback }) {
  if (!src || !String(src).startsWith('http')) return <div className="content-thumb content-thumb-fallback">{fallback}</div>
  return <img className="content-thumb" src={src} alt="" loading="lazy" />
}

function TypeIcon({ type }) {
  if (type === 'Bewertung') return <Star size={16} />
  if (type === 'Antwort') return <MessageSquareQuote size={16} />
  if (type === 'Bild') return <ImageIcon size={16} />
  if (type === 'Link') return <LinkIcon size={16} />
  if (type === 'Änderung') return <PencilLine size={16} />
  if (type === 'Einreichung') return <MapPinned size={16} />
  return <Clock3 size={16} />
}

function DashboardItem({ href, title, subtitle, status = null, thumb = null, thumbUrl = '', iconLabel = null, meta = null, url = '' }) {
  return (
    <Link className="dashboard-status-item" href={href}>
      {thumb ? thumb : (thumbUrl ? <ThumbFromUrl src={thumbUrl} fallback={iconLabel || '•'} /> : <div className="content-thumb content-thumb-fallback">{iconLabel || '•'}</div>)}
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
        {url ? <small className="content-url">{url}</small> : null}
      </span>
      <div className="dashboard-list-meta">
        {status ? <StatusBadge value={status} /> : null}
        {meta ? <span>{meta}</span> : null}
      </div>
    </Link>
  )
}

export default function UserDashboardClient() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const section = searchParams.get('section') || 'overview'

  const loadDashboard = useCallback(async () => {
    const next = await authFetchJson(`/api/me/dashboard?t=${Date.now()}`, { cache: 'no-store' })
    if (next.error) {
      setError(next.error)
      return
    }
    setError('')
    setData(next)
  }, [])

  useEffect(() => {
    loadDashboard().catch((e) => setError(e.message))
  }, [loadDashboard])

  useEffect(() => {
    const refresh = () => loadDashboard().catch((e) => setError(e.message))
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
  }, [loadDashboard])

  const sectionLinks = useMemo(() => ([
    { key:'overview', label:'Übersicht' },
    { key:'favorites', label:'Favoriten' },
    { key:'reviews', label:'Bewertungen' },
    { key:'replies', label:'Antworten' },
    { key:'images', label:'Bilder' },
    { key:'links', label:'Links' },
    { key:'changes', label:'Änderungen' },
    { key:'submissions', label:'Einreichungen' },
  ]), [])

  if (error) return <main className="container"><div className="error-box">{error}</div></main>
  if (!data) return <main className="container"><p>Lädt ...</p></main>

  const { kpis, lists, recentActivity } = data
  const openBreakdown = [
    { label: 'POIs ausstehend', value: kpis.pendingOwnPois || 0 },
    { label: 'Bilder ausstehend', value: kpis.pendingOwnImages || 0 },
    { label: 'Links ausstehend', value: kpis.pendingOwnLinks || 0 },
  ]

  const renderSectionItems = () => {
    if (section === 'favorites') return (lists.favorites || []).map((item) => (
      <DashboardItem key={item.id} href={item.pois?.slug ? `/poi/${item.pois.slug}` : '/account'} title={item.pois?.title || 'POI'} subtitle={formatDateTime(item.created_at)} thumbUrl={item.thumb_url} iconLabel="♥" meta="Favorit" />
    ))
    if (section === 'reviews') return (lists.reviews || []).map((item) => (
      <DashboardItem key={item.id} href={item.pois?.slug ? `/poi/${item.pois.slug}#review-${item.id}` : '/account'} title={item.pois?.title || 'POI'} subtitle={item.review_text || formatDateTime(item.created_at)} thumbUrl={item.thumb_url} iconLabel={<Star size={16} />} meta={`${item.rating}/5`} />
    ))
    if (section === 'replies') return (lists.replies || []).map((item) => (
      <DashboardItem key={item.id} href={item.poi_slug ? `/poi/${item.poi_slug}#reply-${item.id}` : '/account'} title={item.poi_title} subtitle={item.reply_text || formatDateTime(item.created_at)} thumbUrl={item.thumb_url} iconLabel={<MessageSquareQuote size={16} />} meta={formatDateTime(item.created_at)} />
    ))
    if (section === 'images') return (lists.images || []).map((item) => (
      <DashboardItem key={item.id} href={item.poi_slug ? `/poi/${item.poi_slug}#poi-gallery` : '/account'} title={item.poi_title} subtitle={formatDateTime(item.created_at)} thumb={<ImageThumb item={item} fallback="Bild" />} status={item.status} />
    ))
    if (section === 'links') return (lists.links || []).map((item) => (
      <DashboardItem key={item.id} href={item.href || (item.poi_slug ? `/poi/${item.poi_slug}#poi-external-links` : '/account')} title={item.poi_title} subtitle={item.label || 'Weiterführender Link'} thumbUrl={item.thumb_url} url={item.url || ''} status={item.status} iconLabel={<LinkIcon size={16} />} />
    ))
    if (section === 'changes') return (lists.changes || []).map((item) => (
      <DashboardItem key={item.id} href={item.poi_slug ? `/poi/${item.poi_slug}#poi-visitor-info` : '/account'} title={item.poi_title} subtitle={item.field_name || 'Änderung'} thumbUrl={item.thumb_url} status={item.status} iconLabel={<PencilLine size={16} />} meta={formatDateTime(item.created_at)} />
    ))
    if (section === 'submissions') return (lists.submissions || []).map((item) => (
      <DashboardItem key={item.id} href={`/account/my-pois/${item.id}`} title={item.title} subtitle={formatDateTime(item.updated_at || item.created_at)} thumbUrl={item.thumb_url} status={item.status} iconLabel="POI" />
    ))
    return []
  }

  return <main className="container admin-editor-container"><h1>Nutzer-Dashboard</h1><div className="metrics-grid"><MetricCard icon={Heart} title="Favoriten" total={kpis.favoritesCount} href="/account?section=favorites" tone="red" subtitle="Gespeicherte POIs" /><MetricCard icon={MessageCircle} title="Bewertungen" total={kpis.ownReviewsCount} href="/account?section=reviews" tone="blue" subtitle="Eigene Meinungen" /><MetricCard icon={Reply} title="Antworten" total={kpis.ownRepliesCount} href="/account?section=replies" tone="blue" subtitle="Eigene Antworten" /><MetricCard icon={ImageIcon} title="Bilder" total={kpis.ownImagesCount} href="/account?section=images" subtitle="Uploads und Status" /><MetricCard icon={LinkIcon} title="Links" total={kpis.ownLinksCount} href="/account?section=links" subtitle="Eigene Verweise" /><MetricCard icon={PencilLine} title="Änderungen" total={kpis.ownChangesCount} href="/account?section=changes" subtitle="Vorgeschlagene Änderungen" /><MetricCard icon={MapPinned} title="POIs" total={kpis.ownPoisCount} href="/account/my-pois" tone="green" subtitle={`${kpis.publishedOwnPois} veröffentlicht`} /><MetricCard icon={Clock3} title="Offen" total={kpis.pendingOwnTotal} href="/account?section=submissions" tone="yellow" subtitle={openBreakdown.map((item) => `${item.label}: ${Number(item.value || 0).toLocaleString('de-DE')}`).join(' · ')} /></div><div className="dashboard-tabs">{sectionLinks.map((item) => <Link key={item.key} href={item.key === 'overview' ? '/account' : `/account?section=${item.key}`} className={`dashboard-tab ${section === item.key ? 'active' : ''}`}>{item.label}</Link>)}</div>{section === 'overview' ? <><div className="grid grid-2" style={{ marginTop:16 }}><div className="card"><h2>Meine Inhalte</h2><div className="dashboard-status-list">{(lists.reviews || []).slice(0,4).map((item) => <DashboardItem key={`review-${item.id}`} href={item.pois?.slug ? `/poi/${item.pois.slug}#review-${item.id}` : '/account?section=reviews'} title={item.pois?.title || 'POI'} subtitle={item.review_text || 'Bewertung ohne Text'} thumbUrl={item.thumb_url} iconLabel={<Star size={16} />} meta={`${item.rating}/5`} />)}{(lists.replies || []).slice(0,4).map((item) => <DashboardItem key={`reply-${item.id}`} href={item.poi_slug ? `/poi/${item.poi_slug}#reply-${item.id}` : '/account?section=replies'} title={item.poi_title} subtitle={item.reply_text || 'Antwort'} thumbUrl={item.thumb_url} iconLabel={<MessageSquareQuote size={16} />} meta={formatDateTime(item.created_at)} />)}{(lists.links || []).slice(0,4).map((item) => <DashboardItem key={`link-${item.id}`} href={item.href || (item.poi_slug ? `/poi/${item.poi_slug}#poi-external-links` : '/account?section=links')} title={item.poi_title} subtitle={item.label || 'Weiterführender Link'} thumbUrl={item.thumb_url} iconLabel={<LinkIcon size={16} />} url={item.url || ''} status={item.status} />)}</div></div><div className="card"><h2>Status meiner Inhalte</h2><div className="dashboard-status-list">{(lists.images || []).slice(0,4).map((item) => <DashboardItem key={`img-${item.id}`} href={item.poi_slug ? `/poi/${item.poi_slug}#poi-gallery` : '/account?section=images'} title={item.poi_title} subtitle={formatDateTime(item.created_at)} thumb={<ImageThumb item={item} fallback="Bild" />} status={item.status} />)}{(lists.submissions || []).slice(0,4).map((item) => <DashboardItem key={`poi-${item.id}`} href={`/account/my-pois/${item.id}`} title={item.title} subtitle={formatDateTime(item.updated_at || item.created_at)} thumbUrl={item.thumb_url} status={item.status} iconLabel="POI" />)}{(lists.changes || []).slice(0,4).map((item) => <DashboardItem key={`change-${item.id}`} href={item.poi_slug ? `/poi/${item.poi_slug}#poi-visitor-info` : '/account?section=changes'} title={item.poi_title} subtitle={item.field_name || 'Änderung'} thumbUrl={item.thumb_url} status={item.status} iconLabel={<PencilLine size={16} />} meta={formatDateTime(item.created_at)} />)}</div></div></div><div className="card recent-activity-card" style={{ marginTop:16 }}><h2>Zuletzt aktiv</h2><div className="recent-activity-list">{recentActivity.map((item, idx) => <Link key={`${item.type}-${idx}-${item.created_at}`} href={item.href} className="dashboard-status-item">{item.thumb_url ? <img className="content-thumb" src={item.thumb_url} alt="" loading="lazy" /> : <div className="content-thumb content-thumb-fallback"><TypeIcon type={item.type} /></div>}<span><strong>{item.type}</strong><small>{item.label}</small>{item.url ? <small className="content-url">{item.url}</small> : null}</span><div className="dashboard-list-meta"><span>{item.created_at_label}</span></div></Link>)}</div></div></> : null}{section !== 'overview' ? <div className="card dashboard-list-card"><h2>{sectionLinks.find((item) => item.key === section)?.label || 'Inhalte'}</h2><div className="dashboard-status-list">{renderSectionItems()}</div></div> : null}</main>
}
