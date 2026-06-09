import './globals.css'
import NavBar from '@/components/NavBar'
import SiteFooter from '@/components/SiteFooter'
import MaintenanceGate from '@/components/MaintenanceGate'

function getSupabaseOrigin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export const metadata = {
  title: 'USA Sights',
  description: 'POIs auf Karte mit Community und Admin-Freigabe',
}

export default function RootLayout({ children }) {
  const supabaseOrigin = getSupabaseOrigin()

  return (
    <html lang="de">
      <head>
        {supabaseOrigin ? <>
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={supabaseOrigin} />
        </> : null}
      </head>
      <body>
        <NavBar />
        <MaintenanceGate>{children}</MaintenanceGate>
        <SiteFooter />
      </body>
    </html>
  )
}
