import ImpressumText from '@/components/legal/ImpressumText'

export const metadata = {
  title: 'Impressum – USA Sights',
  description: 'Impressum von USA Sights.',
}

export default function ImpressumPage() {
  return (
    <main className="container legal-page">
      <div className="card legal-card">
        <ImpressumText />
      </div>
    </main>
  )
}
