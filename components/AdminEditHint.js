'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'

export default function AdminEditHint({ poiId }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(data?.role === 'admin')
    }
    load()
  }, [supabase])

  if (!isAdmin || !poiId) return null
  return <Link href={`/admin/poi/${poiId}`} className="btn btn-secondary" style={{ marginLeft: 8 }}>Als Admin bearbeiten</Link>
}
