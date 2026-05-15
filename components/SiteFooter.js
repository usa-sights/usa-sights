import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner compact-footer">
        <div>
          <strong>USA Sights</strong>
          <p>Sehenswürdigkeiten, Roadtrip-Spots und Geheimtipps in den USA – empfohlen von Reisenden.</p>
        </div>
        <nav className="footer-links" aria-label="Footer Navigation">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <a href="mailto:office@usa-sights.com">Kontakt</a>
        </nav>
      </div>
    </footer>
  )
}
