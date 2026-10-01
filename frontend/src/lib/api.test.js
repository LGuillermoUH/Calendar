import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError } from '../lib/api'

describe('api', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('getAvailability llama al endpoint público sin token', async () => {
    const data = [{ date: '2026-09-10', reserved: true }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => data,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.getAvailability(2026, 9)
    expect(result).toEqual(data)
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('getEvents adjunta el Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.getEvents(2026, 9, 'abc123')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer abc123')
  })

  it('traduce 401 a error en español', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getEvents(2026, 9, 'x')).rejects.toMatchObject({
      status: 401,
    })
    await expect(api.getEvents(2026, 9, 'x')).rejects.toBeInstanceOf(ApiError)
  })

  it('devuelve null en 204 (delete)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    const result = await api.deleteEvent('id', 'token')
    expect(result).toBeNull()
  })
})
