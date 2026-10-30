import { describe, expect, it, vi } from 'vitest'
import { cleanComment, COMMENT_MAX, sendFeedback, type Feedback } from '../src/feedback'

const FB: Feedback = { helpful: 'yes', comment: '  Clear   and short  ', journey: 'term', device: 'phone', sessionId: 'abcdef123456', surface: 'web' }
const URL = 'https://script.google.com/macros/s/x/exec'
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

describe('what a person writes is tidied before it is sent', () => {
  it('trims, collapses runs of spaces and blank lines, and drops control characters', () => {
    expect(cleanComment('  hello \t  world \n\n\n\n next\u0000 ')).toBe('hello world \n\n next')
  })
  it('caps the length', () => {
    expect(cleanComment('a'.repeat(COMMENT_MAX + 400))).toHaveLength(COMMENT_MAX)
  })
  it('keeps the rupee sign, Indian-language text and emoji intact', () => {
    expect(cleanComment('₹50 lakh ठीक है 👍')).toBe('₹50 lakh ठीक है 👍')
  })
  it('an empty comment stays empty', () => {
    expect(cleanComment('   \n ')).toBe('')
  })
})

describe('sending feedback', () => {
  it('posts the rating, tidied words, journey, device and session, and nothing else', async () => {
    const f = vi.fn(() => reply({ ok: true }))
    expect(await sendFeedback(FB, URL, f as unknown as typeof fetch)).toBe('sent')
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/text\/plain/)
    expect(JSON.parse(init.body as string)).toEqual({ ...FB, comment: 'Clear and short' })
  })
  it('never carries anything the person told the guide about themselves', async () => {
    const f = vi.fn(() => reply({ ok: true }))
    await sendFeedback(FB, URL, f as unknown as typeof fetch)
    const keys = Object.keys(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).sort()
    expect(keys).toEqual(['comment', 'device', 'helpful', 'journey', 'sessionId', 'surface'])
  })
  it('does nothing and says so when no web app is set up', async () => {
    const f = vi.fn()
    expect(await sendFeedback(FB, undefined, f as unknown as typeof fetch)).toBe('skipped')
    expect(f).not.toHaveBeenCalled()
  })
  it('throws when the server answers with an error, so the person can try again', async () => {
    const f = vi.fn(() => reply({}, 500))
    await expect(sendFeedback(FB, URL, f as unknown as typeof fetch)).rejects.toThrow()
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('throws when the sheet says no', async () => {
    const f = vi.fn(() => reply({ ok: false, error: 'server' }))
    await expect(sendFeedback(FB, URL, f as unknown as typeof fetch)).rejects.toThrow('server')
  })
  it('when the browser blocks reading the reply, it sends once more without reading it, and counts as sent', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response(null))
    expect(await sendFeedback(FB, URL, f as unknown as typeof fetch)).toBe('sent')
    expect(f).toHaveBeenCalledTimes(2)
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[1].mode).toBe('no-cors')
  })
  it('throws when there is no connection at all', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(sendFeedback(FB, URL, f as unknown as typeof fetch)).rejects.toThrow()
  })
  it('gives up after the timeout instead of hanging', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => { init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))) }))
    await expect(sendFeedback(FB, URL, f as unknown as typeof fetch, 30)).rejects.toThrow('aborted')
  })
})
