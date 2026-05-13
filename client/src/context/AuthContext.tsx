import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type Role = 'chairman' | 'lead' | 'analyst' | 'viewer'

type User = { username: string; role: Role; displayName: string }

type AuthState = {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  logout: () => void
  canWrite: boolean
  canViewAudit: boolean
}

const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEY = 'ooi_command_centre_token'
const STORAGE_USER = 'ooi_command_centre_user'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readUser(): User | null {
  const raw = readStorage(STORAGE_USER)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStorage(STORAGE_KEY))
  const [user, setUser] = useState<User | null>(() => readUser())

  const setSession = useCallback((t: string, u: User) => {
    try {
      localStorage.setItem(STORAGE_KEY, t)
      localStorage.setItem(STORAGE_USER, JSON.stringify(u))
    } catch {
      /* private mode / quota */
    }
    setToken(t)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_USER)
    } catch {
      /* ignore */
    }
    setToken(null)
    setUser(null)
  }, [])

  const canWrite = useMemo(() => user?.role === 'lead' || user?.role === 'analyst', [user])
  const canViewAudit = useMemo(() => user != null && user.role !== 'viewer', [user])

  const value = useMemo(
    () => ({ token, user, setSession, logout, canWrite, canViewAudit }),
    [token, user, setSession, logout, canWrite, canViewAudit]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
