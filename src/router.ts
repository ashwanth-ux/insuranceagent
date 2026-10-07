import { useCallback, useEffect, useState } from 'react'

export interface Route {
  path: string[]
  q: URLSearchParams
}

const parse = (): Route => {
  const raw = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '')
  const [p, qs] = raw.split('?')
  return { path: p.split('/').filter(Boolean), q: new URLSearchParams(qs ?? '') }
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((to: string) => {
    const next = `#/${to.replace(/^#?\/?/, '')}`
    if (location.hash === next) setRoute(parse())
    else location.hash = next
  }, [])
  return { route, go }
}
