import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'
import {
  LayoutDashboard, ShoppingCart,
  BookOpen, Settings as SettingsIcon, LogOut, Building2,
  Menu, X, ChevronDown, Wrench, Boxes, Save, HardDrive
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[]
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['comptable'] },
  { to: '/sales', label: 'Ventes & Factures', icon: ShoppingCart, roles: ['admin', 'vendeur'] },
  { to: '/stock', label: 'Produits & Stock', icon: Boxes, roles: ['admin', 'comptable'] },
  { to: '/users', label: 'Utilisateurs', icon: Wrench, adminOnly: true },
  { to: '/accounting', label: 'Comptabilité', icon: BookOpen, roles: ['comptable'] },
  { to: '/settings', label: 'Paramètres', icon: SettingsIcon, adminOnly: true },
]

export default function Layout() {
  const { profile, signOut, hasRole } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [backupState, setBackupState] = useState<'idle'|'saving'|'saved'>('idle')

  if (!profile) return null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // --- SAUVEGARDE PERMANENTE ---
  const handleBackupNow = async () => {
    try {
      setBackupState('saving')
      // @ts-ignore
      const path = await window.electronDB?.backupNow()
      setBackupState('saved')
      setTimeout(() => setBackupState('idle'), 2000)
      if (path) {
        console.log('Backup:', path)
      }
    } catch (e) {
      console.error(e)
      setBackupState('idle')
      alert('Erreur sauvegarde')
    }
  }

  // Sauvegarde auto visuelle toutes les 30 min
  useEffect(() => {
    const interval = setInterval(() => {
      handleBackupNow()
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly) return profile.role === 'admin'
    if (item.roles) return item.roles.includes(profile.role)
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-64 bg-gray-900 text-gray-300 z-40
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-800">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Maman Star</p>
            <p className="text-xs text-gray-500">Gestion Intégrée</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {/* BOUTON SAUVEGARDE DANS SIDEBAR */}
          <div className="pt-6 mt-6 border-t border-gray-800">
            <button
              onClick={handleBackupNow}
              disabled={backupState === 'saving'}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${backupState === 'saved' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}
              `}
            >
              {backupState === 'saving' ? <HardDrive className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
              {backupState === 'saving' ? 'Sauvegarde...' : backupState === 'saved' ? '✅ Sauvegardé !' : 'Sauvegarder jour'}
            </button>
            <p className="text-[10px] text-gray-500 mt-2 px-3">Auto toutes les 30 min</p>
          </div>
        </nav>

        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {profile.full_name?.charAt(0)?.toUpperCase() || profile.username?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {profile.full_name || 'Utilisateur'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-16 flex items-center px-4 lg:px-6 gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1" />

          {/* BOUTON SAUVEGARDE DANS HEADER - Visible pour tous */}
          <button
            onClick={handleBackupNow}
            disabled={backupState === 'saving'}
            className={`
              hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all
              ${backupState === 'saved' 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
            `}
            title="Sauvegarde permanente des ventes du jour"
          >
            <Save className={`w-4 h-4 ${backupState === 'saving' ? 'animate-pulse' : ''}`} />
            {backupState === 'saving' ? 'Sauvegarde...' : backupState === 'saved' ? '✅ Sauvé' : 'Sauvegarder'}
          </button>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-medium">
                {profile.full_name?.charAt(0)?.toUpperCase() || profile.username?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {profile.full_name || profile.username || 'Utilisateur'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{profile.full_name || 'Utilisateur'}</p>
                    <p className="text-xs text-gray-500">@{profile.username || profile.email}</p>
                    <div className="mt-3">
                      <button
                        onClick={handleBackupNow}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:bg-black"
                      >
                        <Save className="w-4 h-4" />
                        Sauvegarder ventes
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
