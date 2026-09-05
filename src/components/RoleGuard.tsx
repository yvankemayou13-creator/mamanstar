import { useState } from 'react'
import { Shield, Lock, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { verifySecretCode } from '../lib/api'
import type { UserRole } from '../types'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: React.ReactNode
  title?: string
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  vendeur: 'Vendeur',
  comptable: 'Comptable',
}

export function RoleGuard({ allowedRoles, children, title = 'Accès refusé' }: RoleGuardProps) {
  const { profile } = useAuth()
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  if (!profile) return null

  if (allowedRoles.includes(profile.role) || unlocked) {
    return <>{children}</>
  }

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const valid = await verifySecretCode('admin_access', adminPassword)
    if (!valid) {
      setError('Mot de passe administrateur incorrect')
      setLoading(false)
      return
    }

    setUnlocked(true)
    setShowPasswordPrompt(false)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-danger-100 rounded-2xl mb-4">
          <Lock className="w-8 h-8 text-danger-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 mb-1">Droits insuffisants pour accéder à cette section.</p>
        <p className="text-sm text-gray-400 mb-6">
          Votre rôle : <span className="font-medium text-gray-600">{roleLabels[profile.role]}</span>
          <br />
          Requis : <span className="font-medium text-gray-600">
            {allowedRoles.map(r => roleLabels[r]).join(' ou ')}
          </span>
        </p>
        <button
          onClick={() => setShowPasswordPrompt(true)}
          className="btn-primary"
        >
          <Shield className="w-4 h-4" />
          S'authentifier en tant qu'administrateur
        </button>
      </div>

      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Authentification administrateur</h3>
              <button
                onClick={() => { setShowPasswordPrompt(false); setError(null) }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Saisissez le mot de passe administrateur pour débloquer l'accès.
            </p>
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label className="label">Mot de passe administrateur</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Déverrouiller l'accès"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
