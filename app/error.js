'use client'
export default function GlobalError({ error, reset }) {
  return <main className="container"><div className="error-box"><h1>Es ist ein Fehler aufgetreten</h1><p>{error?.message || 'Unbekannter Fehler'}</p><button className="btn" onClick={() => reset()}>Erneut versuchen</button></div></main>
}
