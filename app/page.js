import PublicDiscoverySection from '@/components/PublicDiscoverySection'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import HomeTutorialTrigger from '@/components/HomeTutorialTrigger'

const HomeMapSection = dynamic(() => import('@/components/HomeMapSection'), { ssr: false })
const HomeUserStats = dynamic(() => import('@/components/HomeUserStats'), { ssr: false })

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-layout">
          <div className="hero-copy">
            <h1>Explore. Share. Repeat.</h1>
            <p>USA-Sehenswürdigkeiten – empfohlen von Menschen wie dir. Mach mit und inspiriere andere.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link className="btn" href="/register">Join the Community</Link>
              <Link className="btn btn-secondary" href="/explore">Explore Spots</Link>
              <HomeTutorialTrigger />
            </div>
          </div>
          <HomeUserStats />
        </div>
      </section>
      <HomeMapSection />
      <PublicDiscoverySection />
    </>
  )
}
