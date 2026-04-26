import CategoryDetailClient from '@/components/CategoryDetailClient'

export const dynamic = 'force-dynamic'

export default function CategoryDetailPage({ params }) {
  return <CategoryDetailClient slug={params.slug} />
}
