import DatenschutzText from '@/components/legal/DatenschutzText'

export const metadata = {
  title: 'Datenschutzerklärung – USA Sights',
  description: 'Datenschutzerklärung von USA Sights.',
}

export default function DatenschutzPage() {
  return (
    <main className="container legal-page">
      <div className="card legal-card">
        <DatenschutzText />
      </div>
    </main>
  )
}
