import Link from 'next/link'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import PublicDiscoverySection from '@/components/PublicDiscoverySection'

export const revalidate = 600

async function getPublishedPoiCounts(admin, categories = []) {
  const entries = await Promise.all((categories || []).map(async (category) => {
    const { count, error } = await admin
      .from('pois')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('category_id', category.id)

    if (error) return [category.id, 0]
    return [category.id, count || 0]
  }))

  return Object.fromEntries(entries)
}

export default async function CategoriesPage() {
  const admin = createSupabaseAdminClient()
  const { data: categories } = await admin
    .from('categories')
    .select('id,name,slug,description,sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  const counts = await getPublishedPoiCounts(admin, categories || [])

  return (
    <main className="container admin-editor-container">
      <h1>Kategorien</h1>
      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {(categories || []).map((cat) => (
          <Link key={cat.id} href={`/categories/${cat.slug}`} className="card">
            <div className="category-list-card">
              <strong>{cat.name}</strong>
              <div className="category-count">{counts[cat.id] || 0}</div>
            </div>
            <p className="muted">{cat.description || '-'}</p>
          </Link>
        ))}
      </div>
      <PublicDiscoverySection />
    </main>
  )
}
