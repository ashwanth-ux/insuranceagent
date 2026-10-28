/**
 * Messages out to the host app, so it can follow the flow without reading our screens.
 * Delivered to a React Native WebView, an iOS WKWebView handler named `kyfr`, or a parent window (to the origin that embedded us).
 * Nothing personal is sent: only the product, the step, and the cover and premium shown.
 */
export interface BridgeMessage {
  type: 'step' | 'outcome' | 'done'
  [key: string]: unknown
}

type HostWindow = Window & { ReactNativeWebView?: { postMessage: (m: string) => void }; webkit?: { messageHandlers?: { kyfr?: { postMessage: (m: unknown) => void } } } }

export function emit(msg: BridgeMessage): void {
  const data = { source: 'kyfr-insurance', ...msg }
  try {
    const w = window as HostWindow
    w.ReactNativeWebView?.postMessage(JSON.stringify(data))
    w.webkit?.messageHandlers?.kyfr?.postMessage(data)
    if (window.parent !== window && document.referrer) window.parent.postMessage(data, new URL(document.referrer).origin)
  } catch { /* the host is optional */ }
}
