'use client'

import { useCallback, useEffect } from 'react'

export function useAppDataRefresh(refresh, { listenVisibility = true } = {}) {
  const runRefresh = useCallback(() => {
    if (typeof refresh === 'function') refresh()
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    function handleVisibilityChange() {
      if (!listenVisibility || document.visibilityState !== 'visible') return
      runRefresh()
    }

    window.addEventListener('app-data-changed', runRefresh)
    window.addEventListener('focus', runRefresh)
    if (listenVisibility) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      window.removeEventListener('app-data-changed', runRefresh)
      window.removeEventListener('focus', runRefresh)
      if (listenVisibility) {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [listenVisibility, runRefresh])
}
