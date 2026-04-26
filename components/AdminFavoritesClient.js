'use client'
import { useEffect, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'
export default function AdminFavoritesClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    authFetchJson('/api/admin/favorites').then((d)=> d.error ? setMessage(d.error) : setItems(d.items || [])).catch((e)=>setMessage(e.message))
  }, [])
  return <main className="container admin-editor-container"><h1>Admin / Favoriten</h1>{message ? <div className="notice">{message}</div> : null}<div className="card admin-table-wrap"><table className="admin-poi-table"><thead><tr><th>Datum</th><th>POI</th><th>User</th></tr></thead><tbody>{items.map((item)=><tr key={item.id}><td>{String(item.created_at).slice(0,10)}</td><td>{item.pois?.title || '-'}</td><td>{item.user_id}</td></tr>)}</tbody></table></div></main>
}
