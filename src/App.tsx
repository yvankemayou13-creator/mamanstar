import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SalesInvoices from './pages/SalesInvoices'
import Stock from './pages/Stock'
import Accounting from './pages/Accounting'
import Users from './pages/Users'
import Settings from './pages/Settings'
import type { UserRole } from './types'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    )
  }
  if (!profile) return <Navigate to="/login" replace />
  return <>{children}</>
}

const homePath: Record<UserRole, string> = {
  admin: '/stock',
  comptable: '/',
  vendeur: '/sales',
}

function RoleRoute({ allowed, children }: { allowed: UserRole[]; children: React.ReactNode }) {
  const { profile } = useAuth()
  if (!profile) return <Navigate to="/login" replace />
  if (!allowed.includes(profile.role)) {
    return <Navigate to={homePath[profile.role]} replace />
  }
  return <>{children}</>
}

export default function App() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={homePath[profile.role]} replace />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<RoleRoute allowed={['comptable']}><Dashboard /></RoleRoute>} />
        <Route path="sales" element={<RoleRoute allowed={['admin', 'vendeur']}><SalesInvoices /></RoleRoute>} />
        <Route path="stock" element={<RoleRoute allowed={['admin', 'comptable']}><Stock /></RoleRoute>} />
        <Route path="accounting" element={<RoleRoute allowed={['comptable']}><Accounting /></RoleRoute>} />
        <Route path="users" element={<RoleRoute allowed={['admin']}><Users /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute allowed={['admin']}><Settings /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={homePath[profile.role]} replace />} />
    </Routes>
  )
}
