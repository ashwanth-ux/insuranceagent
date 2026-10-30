/**
 * Embedded mode: the guide is shown inside another app, so it drops its own header, footer and landing chrome.
 * Turn it on with `embed=1` in the address (`?embed=1` or `#/health?embed=1`). It stays on for the browser session; `embed=0` turns it off.
 */
const flag = (): boolean | null => {
  try {
    const hash = location.hash.split('?')[1] ?? ''
    for (const qs of [location.search, hash]) {
      const v = new URLSearchParams(qs).get('embed')
      if (v === '1') return true
      if (v === '0') return false
    }
  } catch { /* no location (tests) */ }
  return null
}

export const embedded = (): boolean => {
  const f = flag()
  try {
    if (f === true) sessionStorage.setItem('kyfr.embed', '1')
    else if (f === false) sessionStorage.removeItem('kyfr.embed')
    else return sessionStorage.getItem('kyfr.embed') === '1'
  } catch { return f === true }
  return f === true
}
