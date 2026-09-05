import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllProfiles, createUser, updateUser, deleteUser, verifySecretCode } from '../lib/api'
import { Shield, UserCog, UserPlus, X, Lock, User, Pencil, Trash2 } from 'lucide-react'
import type { Profile, UserRole } from '../types'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  vendeur: 'Vendeur',
  comptable: 'Comptable',
}

const roleColors: Record<UserRole, string> = {
  admin: 'bg-primary-100 text-primary-700',
  vendeur: 'bg-accent-100 text-accent-700',
  comptable: 'bg-warning-100 text-warning-700',
}

export default function Users() {
  const { profile, refreshProfile } = useAuth()
  const [unlocked, setUnlocked] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'vendeur' as UserRole })
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ userId: '', username: '', password: '', full_name: '', role: 'vendeur' as UserRole })
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getAllProfiles()
    const profiles = (data || []).map(p => {
      const { password_hash: _ph, ...rest } = p
      return rest as Profile
    })
    setUsers(profiles)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-danger-100 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-danger-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-500">Seuls les administrateurs peuvent gérer les utilisateurs.</p>
        </div>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accès aux utilisateurs protégé</h2>
          <p className="text-gray-500 mb-6">Saisissez le mot de passe pour accéder à la gestion des utilisateurs.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setChecking(true)
              const valid = await verifySecretCode('users_access', pwInput)
              if (valid) { setUnlocked(true); setPwError(null) }
              else setPwError('Mot de passe incorrect')
              setChecking(false)
            }}
            className="space-y-4"
          >
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="password" value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(null) }} className="input pl-10" placeholder="Mot de passe" autoFocus />
            </div>
            {pwError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{pwError}</div>}
            <button type="submit" disabled={checking} className="btn-primary w-full">
              {checking ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Lock className="w-4 h-4" /> Déverrouiller</>}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const openAdd = () => {
    setForm({ username: '', password: '', full_name: '', role: 'vendeur' })
    setModalError(null)
    setShowModal(true)
  }

  const openEdit = (user: Profile) => {
    setEditForm({ userId: user.id, username: user.username || '', password: '', full_name: user.full_name, role: user.role })
    setEditError(null)
    setShowEditModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    setSaving(true)

    if (form.password.length < 6) {
      setModalError('Le mot de passe doit contenir au moins 6 caractères')
      setSaving(false)
      return
    }

    const { error: createError } = await createUser({
      username: form.username,
      password: form.password,
      full_name: form.full_name,
      role: form.role,
    })

    if (createError) {
      setModalError(createError.message)
      setSaving(false)
      return
    }

    setShowModal(false)
    load()
    setSaving(false)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError(null)
    setSavingEdit(true)

    if (editForm.password && editForm.password.length < 6) {
      setEditError('Le mot de passe doit contenir au moins 6 caractères')
      setSavingEdit(false)
      return
    }

    const { error: updateError } = await updateUser({
      userId: editForm.userId,
      username: editForm.username,
      password: editForm.password || undefined,
      full_name: editForm.full_name,
      role: editForm.role,
    })

    if (updateError) {
      setEditError(updateError.message)
      setSavingEdit(false)
      return
    }

    setShowEditModal(false)
    load()
    if (editForm.userId === profile.id) refreshProfile()
    setSavingEdit(false)
  }

  const handleDelete = async (user: Profile) => {
    if (user.id === profile.id) {
      setError('Vous ne pouvez pas supprimer votre propre compte')
      return
    }
    if (!confirm(`Supprimer l'utilisateur "${user.full_name || user.username}" ? Cette action est irréversible.`)) return

    const { error: deleteError } = await deleteUser(user.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-gray-500 mt-1">Gérez les comptes, rôles et accès des utilisateurs</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Ajouter un utilisateur
        </button>
      </div>

      {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Utilisateur</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Nom d'utilisateur</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Rôle</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 text-sm font-medium">
                          {user.full_name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.full_name || 'Sans nom'}</p>
                          <p className="text-xs text-gray-400 sm:hidden">{user.username || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-600 hidden sm:table-cell">{user.username || '—'}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`badge ${roleColors[user.role]}`}>{roleLabels[user.role]}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(user)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all" title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(user)} className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card bg-primary-50 border-primary-200">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <UserCog className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Gestion des rôles (RBAC)</h3>
            <ul className="text-sm text-gray-600 mt-2 space-y-1">
              <li><strong>Administrateur</strong> : Stock, ventes, utilisateurs et paramètres</li>
              <li><strong>Comptable</strong> : Tableau de bord, stock sécurisé et comptabilité</li>
              <li><strong>Vendeur</strong> : Ventes, bilan de journée et clôtures uniquement</li>
            </ul>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Ajouter un utilisateur</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nom complet *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input pl-10" placeholder="Jean Dupont" />
                </div>
              </div>

              <div>
                <label className="label">Nom d'utilisateur *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="input pl-10" placeholder="jdupont" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Utilisé pour la connexion</p>
              </div>

              <div>
                <label className="label">Mot de passe *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input pl-10" placeholder="••••••••" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Minimum 6 caractères</p>
              </div>

              <div>
                <label className="label">Rôle *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(roleLabels) as [UserRole, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, role: key })}
                      className={`py-3 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        form.role === key ? `${roleColors[key]} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {modalError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{modalError}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Créer l\'utilisateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Modifier l'utilisateur</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="label">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="input pl-10" placeholder="Nom complet" />
                </div>
              </div>

              <div>
                <label className="label">Nom d'utilisateur</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} className="input pl-10" placeholder="jdupont" />
                </div>
              </div>

              <div>
                <label className="label">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} className="input pl-10" placeholder="Laisser vide pour ne pas changer" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Laisser vide pour conserver l'ancien. Minimum 6 caractères.</p>
              </div>

              <div>
                <label className="label">Rôle</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(roleLabels) as [UserRole, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, role: key })}
                      className={`py-3 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        editForm.role === key ? `${roleColors[key]} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {editError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{editError}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={savingEdit} className="btn-primary flex-1">
                  {savingEdit ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
