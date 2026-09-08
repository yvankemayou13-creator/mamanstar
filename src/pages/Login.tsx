import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { verifySecretCode } from '../lib/api'
import { getDb } from '../lib/database'
import {
  Building2, Lock, User, KeyRound, CheckCircle2,
  ArrowLeft, ShoppingCart, BookOpen, Shield,
  Eye, EyeOff,
} from 'lucide-react'
import type { UserRole } from '../types'

interface RoleOption {
  role: UserRole
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  borderColor: string
}

const roleOptions: RoleOption[] = [
  {
    role: 'admin',
    label: 'Administrateur',
    description: "Gestion du stock, ventes, utilisateurs et paramètres",
    icon: Shield,
    color: 'text-primary-600',
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-200 hover:border-primary-400',
  },
  {
    role: 'vendeur',
    label: 'Vendeur',
    description: 'Saisie des ventes, bilan de journée et clôtures',
    icon: ShoppingCart,
    color: 'text-accent-600',
    bgColor: 'bg-accent-50',
    borderColor: 'border-accent-200 hover:border-accent-400',
  },
  {
    role: 'comptable',
    label: 'Comptable',
    description: 'Tableau de bord, stock sécurisé et rapports comptables',
    icon: BookOpen,
    color: 'text-warning-600',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200 hover:border-warning-400',
  },
]

type Mode = 'signin' | 'reset-admin' | 'reset-success'

export default function Login() {
  const { signIn } = useAuth()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  // Reset state
  const [resetUsername, setResetUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const selectedOption = roleOptions.find(r => r.role === selectedRole)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(username, password, selectedRole || undefined)
    if (error) setError(error)
    setLoading(false)
  }

  const handleResetAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    if (newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères')
      setLoading(false)
      return
    }
    try {
      const valid = await verifySecretCode('reset_password', adminPassword)
      if (!valid) {
        setError('Mot de passe administrateur incorrect')
        setLoading(false)
        return
      }
      const db = await getDb()
      const { rows } = await db.query('SELECT * FROM profiles WHERE username = $1 AND role = $2', [resetUsername, 'admin'])
      if (rows.length === 0) {
        setError("Cet utilisateur administrateur n'existe pas")
        setLoading(false)
        return
      }
      await db.query('UPDATE profiles SET password_hash = $1 WHERE username = $2', [newPassword, resetUsername])
      setMode('reset-success')
    } catch {
      setError('Erreur lors de la réinitialisation')
    }
    setLoading(false)
  }

  const goBackToRoles = () => {
    setSelectedRole(null)
    setError(null)
    setUsername('')
    setPassword('')
    setMode('signin')
  }

  const goBackToSignIn = () => {
    setMode('signin')
    setError(null)
    setAdminPassword('')
    setNewPassword('')
    setResetUsername('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Maman Star</h1>
          <p className="text-gray-400 mt-1">Progiciel de Gestion Intégré</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!selectedRole ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">Choisissez votre profil</h2>
              <p className="text-sm text-gray-500 text-center mb-6">Sélectionnez le type d'utilisateur pour vous connecter</p>
              <div className="space-y-3">
                {roleOptions.map(option => (
                  <button
                    key={option.role}
                    onClick={() => { setSelectedRole(option.role); setError(null); setMode('signin') }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${option.borderColor} ${option.bgColor} transition-all hover:shadow-md text-left group`}
                  >
                    <div className={`w-12 h-12 rounded-xl ${option.bgColor} ${option.color} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <option.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${option.color}`}>{option.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className={`w-10 h-10 rounded-lg ${selectedOption?.bgColor} ${selectedOption?.color} flex items-center justify-center flex-shrink-0`}>
                  {selectedOption && <selectedOption.icon className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${selectedOption?.color}`}>{selectedOption?.label}</p>
                </div>
                <button onClick={goBackToRoles} className="p-2 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all" title="Retour">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

              {mode === 'signin' && (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="label">Nom d'utilisateur</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input pl-10" placeholder="votre nom d'utilisateur" required autoFocus />
                      </div>
                    </div>

                    <div>
                      <label className="label">Mot de passe</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="input pl-10 pr-10"
                          placeholder="••••••••"
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{error}</div>}

                    <button type="submit" disabled={loading} className="btn-primary w-full">
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Lock className="w-4 h-4" /> Se connecter</>}
                    </button>
                  </form>

                  {selectedRole === 'admin' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button onClick={() => { setMode('reset-admin'); setError(null); setResetUsername(''); setAdminPassword(''); setNewPassword('') }} className="flex items-center justify-center gap-2 w-full text-sm text-primary-600 hover:text-primary-700 font-medium transition-all">
                        <KeyRound className="w-4 h-4" /> Réinitialiser le mot de passe
                      </button>
                    </div>
                  )}
                </>
              )}

              {mode === 'reset-admin' && (
                <>
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-xl mb-3"><KeyRound className="w-6 h-6 text-primary-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-900">Réinitialisation</h2>
                    <p className="text-sm text-gray-500 mt-1">Saisissez le mot de passe administrateur pour réinitialiser.</p>
                  </div>
                  <form onSubmit={handleResetAdmin} className="space-y-4">
                    <div>
                      <label className="label">Nom d'utilisateur administrateur</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} className="input pl-10" placeholder="admin" required autoFocus />
                      </div>
                    </div>
                    <div>
                      <label className="label">Mot de passe administrateur</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type={showAdminPassword ? "text" : "password"} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="input pl-10 pr-10" placeholder="••••••••" required />
                        <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showAdminPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="label">Nouveau mot de passe</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input pl-10 pr-10" placeholder="••••••••" required />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Minimum 6 caractères</p>
                    </div>
                    {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{error}</div>}
                    <button type="submit" disabled={loading} className="btn-primary w-full">
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Lock className="w-4 h-4" /> Réinitialiser</>}
                    </button>
                  </form>
                  <button onClick={goBackToSignIn} className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 font-medium mt-4"><ArrowLeft className="w-4 h-4" /> Retour à la connexion</button>
                </>
              )}

              {mode === 'reset-success' && (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-100 rounded-2xl mb-4"><CheckCircle2 className="w-8 h-8 text-accent-600" /></div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Mot de passe réinitialisé</h2>
                  <p className="text-sm text-gray-500 mb-6">Votre mot de passe a été modifié avec succès.</p>
                  <button onClick={goBackToSignIn} className="btn-primary w-full"><Lock className="w-4 h-4" /> Se connecter</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
