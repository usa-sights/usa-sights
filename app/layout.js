import './globals.css'
import NavBar from '@/components/NavBar'
import SiteFooter from '@/components/SiteFooter'
import MaintenanceGate from '@/components/MaintenanceGate'

export const metadata = {
  title: 'USA Sights',
  description: 'POIs auf Karte mit Community und Admin-Freigabe',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <NavBar />
        <MaintenanceGate>{children}</MaintenanceGate>
        <SiteFooter />
      </body>
    </html>
  )
}
