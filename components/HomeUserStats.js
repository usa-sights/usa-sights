'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Link as LinkIcon, MapPinned } from 'lucide-react'
import { useAppDataRefresh } from '@/hooks/useAppDataRefresh'

function AnimatedNumber({ value, startToken }) {
  const [display, setDisplay] = useState(0)
  const animationFrameRef = useRef(null)

  useEffect(() => {
    const target = Number(value || 0)

    if (!startToken) {
      setDisplay(0)
      return undefined
    }

    if (!Number.isFinite(target) || target <= 0) {
      setDisplay(Math.max(0, target || 0))
      return undefined
    }

    const duration = 1200
    let startTime = null

    function step(timestamp) {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * easedProgress))

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step)
        return
      }

      setDisplay(target)
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    setDisplay(0)
    animationFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [startToken, value])

  return <span>{Number(display || 0).toLocaleString('de-DE')}</span>
}

async function fetchStats(signal) {
  const response = await fetch(`/api/public/stats?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  })

  const payload = await response.json()
  if (payload?.error) throw new Error(payload.error)
  return payload
}

export default function HomeUserStats() {
  const containerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const [statsResponse, setStatsResponse] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [startToken, setStartToken] = useState(0)

  const loadStats = useCallback(async () => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const payload = await fetchStats(controller.signal)
      setStatsResponse(payload)
    } catch (error) {
      if (error?.name !== 'AbortError') {
        // Silent fail: hero stats should never break the page.
      }
    }
  }, [])

  useAppDataRefresh(loadStats)

  useEffect(() => {
    loadStats()
    return () => abortControllerRef.current?.abort()
  }, [loadStats])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadStats()
    }, 45000)
    return () => window.clearInterval(timer)
  }, [loadStats])
  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setIsVisible(true)
        observer.disconnect()
      },
      { threshold: 0.15 }
    )

    observer.observe(element)
    const fallbackTimer = window.setTimeout(() => setIsVisible(true), 900)

    return () => {
      window.clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [])

  const quickFacts = useMemo(() => {
    const stats = statsResponse?.stats
    if (!stats) return []

    return [
      { icon: MapPinned, label: 'POIs', value: stats.pois },
      { icon: ImageIcon, label: 'Bilder', value: stats.images },
      { icon: LinkIcon, label: 'Links', value: stats.links },
    ]
  }, [statsResponse])

  const statsSignature = quickFacts.map((item) => `${item.label}:${item.value || 0}`).join('|')

  useEffect(() => {
    if (!isVisible || !quickFacts.length) return
    setStartToken((current) => current + 1)
  }, [isVisible, quickFacts.length, statsSignature])

  return (
    <div ref={containerRef} className="hero-quickfacts" aria-label="Quick Facts">
      {quickFacts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="hero-quickfact-column">
          <div className="hero-quickfact-icon">
            <Icon size={24} />
          </div>
          <div className="hero-quickfact-value">
            <AnimatedNumber value={value} startToken={startToken} />
          </div>
          <div className="hero-quickfact-label">{label}</div>
        </div>
      ))}
    </div>
  )
}
