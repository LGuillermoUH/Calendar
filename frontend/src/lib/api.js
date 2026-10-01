// En producción, nginx del frontend hace proxy de /api al backend (mismo origen),
// así que la base es relativa (''). En desarrollo fuera de Docker, VITE_API_URL
// apunta al backend local (p. ej. http://localhost:5080).
const API_URL = import.meta.env.VITE_API_URL ?? ''

/** Error de API con estado HTTP y mensaje en español. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(res) {
  let detail = ''
  try {
    const body = await res.json()
    if (Array.isArray(body?.errors)) detail = body.errors.join(' ')
    else if (body?.error) detail = body.error
  } catch {
    // sin cuerpo JSON
  }
  if (res.status === 401 || res.status === 403)
    return new ApiError('No autorizado. Inicia sesión de nuevo.', res.status)
  if (res.status === 400)
    return new ApiError(detail || 'Datos inválidos.', res.status)
  if (res.status === 404)
    return new ApiError('No se encontró el recurso.', res.status)
  if (res.status === 503)
    return new ApiError('La base de datos no está disponible. Intenta más tarde.', res.status)
  return new ApiError(detail || 'Error de conexión con el servidor.', res.status)
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.', 0)
  }

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getConfig: () => request('/api/config'),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),

  refresh: (refreshToken) =>
    request('/api/auth/refresh', { method: 'POST', body: { refreshToken } }),

  logout: (refreshToken, token) =>
    request('/api/auth/logout', { method: 'POST', body: { refreshToken }, token }),

  getMe: (token) => request('/api/me', { token }),

  getAvailability: (year, month) =>
    request(`/api/availability?year=${year}&month=${month}`),

  getEvents: (year, month, token) =>
    request(`/api/events?year=${year}&month=${month}`, { token }),

  createEvent: (payload, token) =>
    request('/api/events', { method: 'POST', body: payload, token }),

  updateEvent: (id, payload, token) =>
    request(`/api/events/${id}`, { method: 'PUT', body: payload, token }),

  deleteEvent: (id, token) =>
    request(`/api/events/${id}`, { method: 'DELETE', token }),
}
