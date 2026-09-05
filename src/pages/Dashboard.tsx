import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProducts, getInvoices, getProfiles, getStockAlerts } from '../lib/api'
import {
  Package, FileText, AlertTriangle,
  Wallet, ArrowUpRight, ArrowDownRight, ShoppingCart, User,
} from 'lucide-react'
import type { Product, Invoice, Profile } from '../types'

interface SellerStat {
  profile: Profile
  invoiceCount: number
  totalRevenue: number
  paidRevenue: number
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile && profile.role !== 'comptable') {
      const home: Record<string, string> = { admin: '/stock', vendeur: '/sales', comptable: '/' }
      navigate(home[profile.role], { replace: true })
    }
  }, [profile, navigate])

  const [stats, setStats] = useState({
    productCount: 0,
    invoiceCount: 0,
    clientCount: 0,
    totalRevenue: 0,
    lowStockCount: 0,
    pendingInvoices: 0,
  })
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [sellerStats, setSellerStats] = useState<SellerStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [productsRes, invoicesRes, lowStockRes, profilesRes] = await Promise.all([
        getProducts(),
        getInvoices(),
        getStockAlerts(),
        getProfiles(),
      ])

      const products = productsRes.data || []
      const invoices = invoicesRes.data || []
      const profiles = profilesRes.data || []
      const lowStock = lowStockRes.data || []

      const totalRevenue = invoices
        .filter(i => i.payment_status === 'paye')
        .reduce((sum, i) => sum + Number(i.total_ttc), 0)

      const pendingInvoices = invoices.filter(i => i.payment_status === 'en_attente').length

      setStats({
        productCount: products.length,
        invoiceCount: invoices.length,
        clientCount: 0,
        totalRevenue,
        lowStockCount: lowStock.length,
        pendingInvoices,
      })
      setRecentInvoices(invoices.slice(0, 5))
      setLowStockProducts(lowStock)

      const sellerMap: Record<string, SellerStat> = {}
      for (const p of profiles) {
        sellerMap[p.id] = { profile: p, invoiceCount: 0, totalRevenue: 0, paidRevenue: 0 }
      }
      for (const inv of invoices) {
        const uid = inv.user_id
        if (!uid || !sellerMap[uid]) continue
        sellerMap[uid].invoiceCount++
        sellerMap[uid].totalRevenue += Number(inv.total_ttc)
        if (inv.payment_status === 'paye') {
          sellerMap[uid].paidRevenue += Number(inv.total_ttc)
        }
      }
      setSellerStats(Object.values(sellerMap).filter(s => s.invoiceCount > 0))

      setLoading(false)
    })()
  }, [])

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {profile?.full_name || profile?.username || 'Utilisateur'}
        </h1>
        <p className="text-gray-500 mt-1">Voici un aperçu de l'activité de tous les vendeurs</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Chiffre d'affaires (payé)" value={`${stats.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA`} icon={Wallet} color="accent" trend="up" />
        <StatCard label="Factures émises" value={stats.invoiceCount.toString()} icon={FileText} color="primary" subText={`${stats.pendingInvoices} en attente`} />
        <StatCard label="Produits en stock" value={stats.productCount.toString()} icon={Package} color="primary" subText={`${stats.lowStockCount} en alerte`} />
        <StatCard label="Factures impayées" value={stats.pendingInvoices.toString()} icon={AlertTriangle} color={stats.pendingInvoices > 0 ? 'warning' : 'accent'} />
        <StatCard label="Alertes de stock" value={stats.lowStockCount.toString()} icon={AlertTriangle} color={stats.lowStockCount > 0 ? 'danger' : 'accent'} />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          Performance des vendeurs
        </h2>
        {sellerStats.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun vendeur pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Vendeur</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Rôle</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Factures</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">CA total</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">CA encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sellerStats.map(s => (
                  <tr key={s.profile.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-medium">
                          {s.profile.full_name?.charAt(0)?.toUpperCase() || s.profile.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.profile.full_name || 'Sans nom'}</p>
                          <p className="text-xs text-gray-400">@{s.profile.username || s.profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 hidden sm:table-cell">
                      <span className={`badge ${
                        s.profile.role === 'admin' ? 'bg-primary-100 text-primary-700'
                        : s.profile.role === 'comptable' ? 'bg-warning-100 text-warning-700'
                        : 'bg-accent-100 text-accent-700'
                      }`}>
                        {s.profile.role === 'admin' ? 'Admin' : s.profile.role === 'comptable' ? 'Comptable' : 'Vendeur'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-sm font-medium text-gray-900">{s.invoiceCount}</td>
                    <td className="py-3 px-2 text-right text-sm font-semibold text-gray-900">
                      {s.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA
                    </td>
                    <td className="py-3 px-2 text-right text-sm font-medium text-accent-600 hidden sm:table-cell">
                      {s.paidRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dernières factures</h2>
          {recentInvoices.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune facture pour le moment</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map(invoice => {
                const invAny = invoice as Invoice & { user_full_name?: string }
                return (
                  <div key={invoice.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}
                        {invAny.user_full_name && ` · ${invAny.user_full_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {Number(invoice.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA
                      </p>
                      <span className={`badge ${
                        invoice.payment_status === 'paye'
                          ? 'bg-accent-100 text-accent-700'
                          : invoice.payment_status === 'partiel'
                          ? 'bg-warning-100 text-warning-700'
                          : 'bg-danger-100 text-danger-700'
                      }`}>
                        {invoice.payment_status === 'paye' ? 'Payé' : invoice.payment_status === 'partiel' ? 'Partiel' : 'En attente'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertes de stock</h2>
          {lowStockProducts.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune alerte de stock</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      product.quantity_in_stock === 0 ? 'bg-danger-500' : 'bg-warning-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{product.designation}</p>
                      <p className="text-xs text-gray-500">
                        Stock : {product.quantity_in_stock} / Seuil : {product.alert_threshold}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${
                    product.quantity_in_stock === 0
                      ? 'bg-danger-100 text-danger-700'
                      : 'bg-warning-100 text-warning-700'
                  }`}>
                    {product.quantity_in_stock === 0 ? 'Rupture' : 'Alerte'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, color, subText, trend,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: 'primary' | 'accent' | 'warning' | 'danger'
  subText?: string
  trend?: 'up' | 'down'
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
  }

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-xs">
          {trend === 'up' ? (
            <><ArrowUpRight className="w-3.5 h-3.5 text-accent-600" /><span className="text-accent-600">Tendance positive</span></>
          ) : (
            <><ArrowDownRight className="w-3.5 h-3.5 text-danger-600" /><span className="text-danger-600">En baisse</span></>
          )}
        </div>
      )}
    </div>
  )
}
