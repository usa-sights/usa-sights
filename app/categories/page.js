import Link from 'next/link'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import PublicDiscoverySection from '@/components/PublicDiscoverySection'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const admin = createSupabaseAdminClient()
  const { data: categories } = await admin
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const ids = (categories || []).map((c) => c.id)
  const counts = {}
  if (ids.length) {
    const { data: pois } = await admin
      .from('pois')
      .select('id,category_id')
      .eq('status', 'published')
      .in('category_id', ids)
    for (const poi of (pois || [])) {
      counts[poi.category_id] = (counts[poi.category_id] || 0) + 1
    }
  }

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
