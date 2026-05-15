import PublicDiscoverySection from '@/components/PublicDiscoverySection'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import HomeTutorialTrigger from '@/components/HomeTutorialTrigger'
import { MapPinned, Sparkles, Route, Binoculars, Mountain, Camera, Building2, Lightbulb, Users, CheckCircle2, Heart, FileDown, Navigation } from 'lucide-react'

const HomeMapSection = dynamic(() => import('@/components/HomeMapSection'), { ssr: false })
const HomeUserStats = dynamic(() => import('@/components/HomeUserStats'), { ssr: false })

const categories = [
  { title: 'Nationalparks', text: 'Naturwunder, Trails und ikonische Landschaften.', icon: Mountain },
  { title: 'Viewpoints', text: 'Aussichtspunkte für Sonnenaufgang, Sonnenuntergang und Wow-Momente.', icon: Binoculars },
  { title: 'Scenic Drives', text: 'Straßen, die selbst schon das Ziel sind.', icon: Route },
  { title: 'Städte-Highlights', text: 'Must-sees, Fotospots und Lieblingsorte in US-Cities.', icon: Building2 },
  { title: 'Roadtrip-Stopps', text: 'Kurze Pausen, die deine Route besser machen.', icon: MapPinned },
  { title: 'Geheimtipps', text: 'Orte, die man nicht immer sofort im Reiseführer findet.', icon: Lightbulb },
]

const steps = [
  'Spots suchen, filtern oder direkt auf der Karte entdecken.',
  'Favoriten markieren und als persönliche Sammlung speichern.',
  'Unterwegs direkt per Google Maps oder Apple Karten zum POI navigieren.',
]

const travelTools = [
  { title: 'Favoriten merken', text: 'Interessante POIs speichern und später gesammelt wiederfinden.', icon: Heart },
  { title: 'GPX & KML Export', text: 'Favoriten als Datei für GPS, Google Earth oder Routenplanung herunterladen.', icon: FileDown },
  { title: 'Direkt navigieren', text: 'Aus Karte und POI-Ansicht direkt zu Google Maps oder Apple Karten springen.', icon: Navigation },
]

export const metadata = {
  title: 'USA Sights – Sehenswürdigkeiten, Roadtrip-Spots & Geheimtipps in den USA',
  description: 'Entdecke Sehenswürdigkeiten, Nationalparks, Scenic Drives, Aussichtspunkte und Geheimtipps in den USA – empfohlen von Reisenden.',
  openGraph: {
    title: 'USA Sights – USA entdecken, Spot für Spot',
    description: 'Finde echte Empfehlungen für deinen nächsten USA-Roadtrip: Sehenswürdigkeiten, Viewpoints, Scenic Drives und Geheimtipps.',
    type: 'website',
  },
}

export default function Home() {
  return (
    <>
      <section className="hero home-hero">
        <div className="container hero-layout home-hero-layout">
          <div className="hero-copy home-hero-copy">
            <div className="eyebrow"><Sparkles size={16} /> Community-Guide für USA-Reisen</div>
            <h1>USA entdecken. Spots finden.</h1>
            <p className="hero-lead">
              Finde Sehenswürdigkeiten, Viewpoints, Scenic Drives und Geheimtipps für deinen nächsten USA-Roadtrip – empfohlen von echten Reisenden.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-hero" href="/explore">Spots entdecken</Link>
              <Link className="btn btn-glass" href="/#karte">Karte öffnen</Link>
              <Link className="btn btn-ghost-light" href="/submit-poi">Spot vorschlagen</Link>
            </div>
            <div className="hero-proof">
              <span><CheckCircle2 size={16} /> Schnell stöbern</span>
              <span><CheckCircle2 size={16} /> Favoriten merken</span>
              <span><CheckCircle2 size={16} /> Direkt navigieren</span>
            </div>
          </div>
          <HomeUserStats />
        </div>
      </section>

      <section className="container home-intro">
        <div className="intro-card intro-main-card">
          <div className="eyebrow dark"><Camera size={16} /> Nicht jeder gute Ort steht im Reiseführer</div>
          <h2>Dein schneller Einstieg zu Orten, die sich wirklich lohnen.</h2>
          <p>
            USA Sights sammelt bekannte Highlights und persönliche Lieblingsorte – damit du deine Route schneller planst,
            unterwegs bessere Stopps findest und Inspiration von Menschen bekommst, die selbst dort waren.
          </p>
          <div className="intro-actions">
            <HomeTutorialTrigger />
            <Link className="text-link" href="/categories">Kategorien ansehen →</Link>
          </div>
        </div>
        <div className="intro-card compact-card">
          <Users size={26} />
          <h3>Community statt Katalog</h3>
          <p>Empfehlungen, Fotos, Bewertungen und persönliche Hinweise machen die Spots nützlicher als reine Listen.</p>
        </div>
      </section>

      <section className="container home-categories-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Schnell reinfinden</p>
            <h2>Was möchtest du entdecken?</h2>
          </div>
          <Link className="btn btn-secondary" href="/categories">Alle Kategorien</Link>
        </div>
        <div className="feature-grid">
          {categories.map(({ title, text, icon: Icon }) => (
            <Link key={title} className="feature-card" href="/categories">
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      </section>


      <section className="container travel-tools-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Für unterwegs</p>
            <h2>Alles dabei, wenn aus Inspiration eine Route wird.</h2>
          </div>
        </div>
        <div className="travel-tools-grid">
          {travelTools.map(({ title, text, icon: Icon }) => (
            <div className="travel-tool-card" key={title}>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container how-it-works">
        <div className="section-heading centered-heading">
          <div>
            <p className="section-kicker">Intuitiv geplant</p>
            <h2>In drei Schritten zum nächsten Lieblingsspot</h2>
          </div>
        </div>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div className="step-card" key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <HomeMapSection />

      <section className="container community-cta">
        <div className="community-cta-inner">
          <div>
            <p className="section-kicker">Mitmachen</p>
            <h2>Warst du an einem Ort, den andere sehen sollten?</h2>
            <p>Teile deinen Spot mit der Community und hilf anderen, ihre USA-Reise besser zu planen.</p>
          </div>
          <Link className="btn" href="/submit-poi">Spot vorschlagen</Link>
        </div>
      </section>

      <section className="container home-discovery-wrap">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Aktuell auf USA Sights</p>
            <h2>Beliebte und neue Spots</h2>
          </div>
          <Link className="text-link" href="/explore">Mehr entdecken →</Link>
        </div>
        <PublicDiscoverySection />
      </section>
    </>
  )
}
