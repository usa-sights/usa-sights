import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${origin}/login`)

  const response = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name) { return request.cookies.get(name)?.value },
      set(name, value, options) { response.cookies.set({ name, value, ...options }) },
      remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
    },
  })

  const { data } = await supabase.auth.exchangeCodeForSession(code)
  const userId = data?.user?.id
  let target = '/account'

  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    if (profile?.role === 'admin') target = '/admin/dashboard'
  }

  return NextResponse.redirect(`${origin}${target}`, { headers: response.headers })
}
