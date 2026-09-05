import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authenticateUser } from '../lib/api'
import { getDb } from '../lib/database'
import type { Profile, UserRole } from '../types'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  signIn: (username: string, password: string, expectedRole?: UserRole) => Promise<{ error: string | null }>
  signOut: () => void
  hasRole: (roles: UserRole[]) => boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'erp_auth_user_id'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        await getDb()
        const storedId = localStorage.getItem(STORAGE_KEY)
        if (storedId) {
          const db = await getDb()
          const { rows } = await db.query(
            'SELECT id, email, username, full_name, role, created_at FROM profiles WHERE id = $1',
            [storedId],
          )
          if (mounted && rows.length > 0) {
            setProfile(rows[0] as Profile)
          }
        }
      } catch {
        // ignore
      }
      if (mounted) setLoading(false)
    }

    init()

    return () => { mounted = false }
  }, [])

  const signIn = async (username: string, password: string, expectedRole?: UserRole) => {
    const { data, error } = await authenticateUser(username, password, expectedRole)
    if (error) return { error: error.message }
    if (data) {
      localStorage.setItem(STORAGE_KEY, data.id)
      setProfile(data)
    }
    return { error: null }
  }

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY)
    setProfile(null)
  }

  const refreshProfile = async () => {
    const storedId = localStorage.getItem(STORAGE_KEY)
    if (!storedId) return
    const db = await getDb()
    const { rows } = await db.query(
      'SELECT id, email, username, full_name, role, created_at FROM profiles WHERE id = $1',
      [storedId],
    )
    if (rows.length > 0) {
      setProfile(rows[0] as Profile)
    }
  }

  const hasRole = (roles: UserRole[]) => {
    if (!profile) return false
    return roles.includes(profile.role)
  }

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut, hasRole, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
