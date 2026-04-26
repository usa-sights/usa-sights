import Link from 'next/link'
export default function NotFound() {
  return <main className="container"><div className="card"><h1>Seite nicht gefunden</h1><p>Diese Seite existiert nicht oder wurde verschoben.</p><Link className="btn" href="/">Zur Startseite</Link></div></main>
}
