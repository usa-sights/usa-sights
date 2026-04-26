export function dispatchAppDataChanged(detail = {}) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent('app-data-changed', {
      detail,
    })
  )
}
