import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

const ACCESS_KEY = 'salon.access'
const REFRESH_KEY = 'salon.refresh'
const EXPIRES_KEY = 'salon.access_expires'

function loadStored() {
  try {
    return {
      access: localStorage.getItem(ACCESS_KEY),
      refresh: localStorage.getItem(REFRESH_KEY),
      expiresAt: localStorage.getItem(EXPIRES_KEY),
    }
  } catch {
    return { access: null, refresh: null, expiresAt: null }
  }
}

function persist({ accessToken, refreshToken, accessExpiresAt }) {
  try {
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    localStorage.setItem(EXPIRES_KEY, accessExpiresAt)
  } catch {
    // almacenamiento no disponible: se mantiene solo en memoria (refs)
  }
}

function clearStored() {
  try {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null) // 'admin' | 'viewer' | null
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Tokens en refs: getToken lee de aquí sin re-render en cada refresco.
  const accessRef = useRef(null)
  const refreshRef = useRef(null)
  const expiresRef = useRef(null) // ms epoch

  const applyTokens = useCallback((res) => {
    accessRef.current = res.accessToken
    refreshRef.current = res.refreshToken
    expiresRef.current = new Date(res.accessExpiresAt).getTime()
    persist(res)
  }, [])

  const clearAuth = useCallback(() => {
    accessRef.current = null
    refreshRef.current = null
    expiresRef.current = null
    clearStored()
    setRole(null)
    setIsAuthenticated(false)
  }, [])

  const resolveRole = useCallback(async () => {
    const token = accessRef.current
    if (!token) {
      setRole(null)
      return
    }
    try {
      const me = await api.getMe(token)
      setRole(me?.role ?? 'viewer')
    } catch {
      setRole('viewer')
    }
  }, [])

  // Refresca el access token si caducó o está por caducar (margen 30s).
  const ensureFreshToken = useCallback(async () => {
    const refresh = refreshRef.current
    if (!refresh) return null

    const expires = expiresRef.current ?? 0
    if (accessRef.current && Date.now() < expires - 30_000) {
      return accessRef.current
    }

    try {
      const res = await api.refresh(refresh)
      applyTokens(res)
      return res.accessToken
    } catch {
      clearAuth()
      return null
    }
  }, [applyTokens, clearAuth])

  // Al montar: intenta rehidratar la sesión desde localStorage.
  useEffect(() => {
    const stored = loadStored()
    accessRef.current = stored.access
    refreshRef.current = stored.refresh
    expiresRef.current = stored.expiresAt ? new Date(stored.expiresAt).getTime() : null

    ;(async () => {
      if (refreshRef.current) {
        const token = await ensureFreshToken()
        if (token) {
          setIsAuthenticated(true)
          await resolveRole()
        }
      }
      setLoading(false)
    })()
  }, [ensureFreshToken, resolveRole])

  const login = useCallback(async (email, password) => {
    let res
    try {
      res = await api.login(email, password)
    } catch {
      throw new Error('Correo o contraseña incorrectos.')
    }
    applyTokens(res)
    setIsAuthenticated(true)
    await resolveRole()
  }, [applyTokens, resolveRole])

  const logout = useCallback(async () => {
    const refresh = refreshRef.current
    const token = accessRef.current
    try {
      if (refresh) await api.logout(refresh, token)
    } catch {
      // aunque falle en el servidor, limpiamos localmente
    }
    clearAuth()
  }, [clearAuth])

  // Estable: devuelve un access token vigente (refrescando si hace falta).
  const getToken = useCallback(() => ensureFreshToken(), [ensureFreshToken])

  const value = {
    role,
    isAuthenticated,
    isAdmin: role === 'admin',
    loading,
    login,
    logout,
    getToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
