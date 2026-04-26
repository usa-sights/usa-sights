import { Suspense } from 'react'
import MediaPageClient from './MediaPageClient'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MediaPageClient />
    </Suspense>
  )
}
