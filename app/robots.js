export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usa-sights.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/login', '/register', '/reset-password', '/admin'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
