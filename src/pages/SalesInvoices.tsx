import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getInvoices, getProducts, getDailyClosures, getCompanySettings,
  incrementInvoiceCounter, insertInvoice, getInvoiceLines, updateInvoice,
  replaceInvoiceLines, deleteInvoice, insertInvoiceDeletion,
  insertDailyClosure, verifySecretCode,
} from '../lib/api'
import {
  Plus, X, FileText, Eye, Trash2, Printer,
  Wallet, Receipt, CreditCard,
  ClipboardCheck, Lock, AlertTriangle, CalendarCheck, Pencil,
  EyeOff, ShieldAlert
} from 'lucide-react'
import type { Invoice, Product, InvoiceLine, DailyClosure, CompanySettings } from '../types'

type SubTab = 'ventes' | 'bilan' | 'closures'

export default function SalesInvoices() {
  const { profile } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('ventes')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [closures, setClosures] = useState<DailyClosure[]>([])
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<{ invoice: Invoice; lines: InvoiceLine[] } | null>(null)
  const [form, setForm] = useState({
    payment_status: 'en_attente' as 'paye' | 'en_attente' | 'partiel',
    payment_method: 'especes' as 'especes' | 'carte' | 'virement' | 'cheque',
    lines: [] as { product_id: string; designation: string; quantity: number; unit_price: number }[],
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [editLines, setEditLines] = useState<InvoiceLine[]>([])
  const [editForm, setEditForm] = useState({
    payment_status: 'en_attente' as 'paye' | 'en_attente' | 'partiel',
    payment_method: 'especes' as 'especes' | 'carte' | 'virement' | 'cheque',
    lines: [] as { id?: string; product_id: string; designation: string; quantity: number; unit_price: number }[],
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [deleteJustification, setDeleteJustification] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // NOUVEAU: Prompt code secret pour edit
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [secretError, setSecretError] = useState<string | null>(null)
  const [secretAction, setSecretAction] = useState<(() => void) | null>(null)
  const [secretKey, setSecretKey] = useState('sales_edit')

  const [bilanDate, setBilanDate] = useState(new Date().toISOString().split('T')[0])
  const [closingDay, setClosingDay] = useState(false)
  const [closureError, setClosureError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes, prodRes, closRes, settingsRes] = await Promise.all([
      getInvoices(), getProducts(), getDailyClosures(), getCompanySettings(),
    ])
    setInvoices(invRes.data || [])
    setProducts(prodRes.data || [])
    setClosures(closRes.data || [])
    setCompanySettings(settingsRes.data || null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // --- NOUVEAU: Filtrage des ventes par vendeur ---
  const displayedInvoices = profile?.role === 'vendeur'
   ? invoices.filter(inv => inv.user_id === profile?.id)
    : invoices

  // --- NOUVEAU: Demande code secret ---
  const askSecretCode = (key: string, action: () => void) => {
    if (profile?.role === 'admin') {
      action()
      return
    }
    setSecretKey(key)
    setSecretAction(() => action)
    setSecretInput('')
    setSecretError(null)
    setShowSecretModal(true)
  }

  const verifySecretAndProceed = async () => {
    const valid = await verifySecretCode(secretKey, secretInput)
    if (!valid) {
      setSecretError('Code secret incorrect! Demande à l\'admin')
      return
    }
    setShowSecretModal(false)
    if (secretAction) secretAction()
  }

  const addLine = () => {
    setForm({...form, lines: [...form.lines, { product_id: '', designation: '', quantity: 1, unit_price: 0 }] })
  }

  const updateLine = (index: number, field: string, value: string) => {
    const lines = [...form.lines]
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      lines[index] = {...lines[index], product_id: value, designation: product?.designation || '', unit_price: product?.sale_price || 0 }
    } else if (field === 'quantity') {
      lines[index].quantity = parseFloat(value) || 0.5
    } else if (field === 'unit_price') {
      lines[index].unit_price = parseFloat(value) || 0
    }
    setForm({...form, lines })
  }

  const removeLine = (index: number) => {
    setForm({...form, lines: form.lines.filter((_, i) => i!== index) })
  }

  const totalAmount = form.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)

  const openNewSale = () => {
    setForm({ payment_status: 'en_attente', payment_method: 'especes', lines: [] })
    setError(null)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.lines.length === 0) { setError('Ajoutez au moins une ligne'); return }
    setSaving(true)
    const { data: counterVal } = await incrementInvoiceCounter()
    const invCounter = counterVal || 1
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(invCounter).padStart(5, '0')}`
    const { data: invoiceData, error: invError } = await insertInvoice({
      invoice_number: invoiceNumber,
      user_id: profile?.id || null,
      total_ht: totalAmount, tva_rate: 0, tva_amount: 0, total_ttc: totalAmount,
      payment_status: form.payment_status, payment_method: form.payment_method,
      lines: form.lines.map(l => ({
        product_id: l.product_id || null, designation: l.designation,
        quantity: l.quantity, unit_price: l.unit_price, line_total: l.quantity * l.unit_price,
      })),
    })
    if (invError) { setError(invError.message); setSaving(false); return }
    setShowModal(false)
    if (!invoiceData) { setSaving(false); return }
    const { data: savedLines } = await getInvoiceLines(invoiceData.id)
    setViewInvoice({ invoice: invoiceData, lines: savedLines || [] })
    load()
    setSaving(false)
  }

  const viewInvoiceDetails = async (invoice: Invoice) => {
    const { data } = await getInvoiceLines(invoice.id)
    setViewInvoice({ invoice, lines: data || [] })
  }

  const updatePaymentStatus = async (invoiceId: string, status: Invoice['payment_status']) => {
    const doUpdate = async () => {
      await updateInvoice(invoiceId, { payment_status: status })
      load()
    }
    // Si vendeur, demande code secret
    if (profile?.role === 'vendeur') {
      askSecretCode('sales_edit', doUpdate)
    } else {
      doUpdate()
    }
  }

  const openEditModal = async (invoice: Invoice) => {
    const doOpen = async () => {
      const { data } = await getInvoiceLines(invoice.id)
      const lines = data || []
      setEditInvoice(invoice)
      setEditLines(lines)
      setEditForm({
        payment_status: invoice.payment_status,
        payment_method: (invoice.payment_method || 'especes') as 'especes' | 'carte' | 'virement' | 'cheque',
        lines: lines.map(l => ({
          id: l.id, product_id: l.product_id || '', designation: l.designation,
          quantity: l.quantity, unit_price: Number(l.unit_price),
        })),
      })
      setEditError(null)
      setShowEditModal(true)
    }
    askSecretCode('sales_edit', doOpen)
  }

  const addEditLine = () => {
    setEditForm({...editForm, lines: [...editForm.lines, { product_id: '', designation: '', quantity: 1, unit_price: 0 }] })
  }

  const updateEditLine = (index: number, field: string, value: string) => {
    const lines = [...editForm.lines]
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      lines[index] = {...lines[index], product_id: value, designation: product?.designation || '', unit_price: product?.sale_price || 0 }
    } else if (field === 'quantity') {
      lines[index].quantity = parseFloat(value) || 0.5
    } else if (field === 'unit_price') {
      lines[index].unit_price = parseFloat(value) || 0
    }
    setEditForm({...editForm, lines })
  }

  const removeEditLine = (index: number) => {
    setEditForm({...editForm, lines: editForm.lines.filter((_, i) => i!== index) })
  }

  const editTotalAmount = editForm.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInvoice) return
    setEditError(null)
    if (editForm.lines.length === 0) { setEditError('Ajoutez au moins une ligne'); return }
    setSavingEdit(true)
    const { error: invError } = await updateInvoice(editInvoice.id, {
      total_ttc: editTotalAmount, total_ht: editTotalAmount, tva_amount: 0,
      payment_status: editForm.payment_status, payment_method: editForm.payment_method,
    })
    if (invError) { setEditError(invError.message); setSavingEdit(false); return }
    const { error: linesError } = await replaceInvoiceLines(editInvoice.id, editForm.lines.map(l => ({
      product_id: l.product_id || null, designation: l.designation,
      quantity: l.quantity, unit_price: l.unit_price, line_total: l.quantity * l.unit_price,
    })))
    if (linesError) { setEditError(linesError.message); setSavingEdit(false); return }
    setShowEditModal(false)
    load()
    setSavingEdit(false)
  }

  const openDeleteModal = (invoice: Invoice) => {
    setDeleteTarget(invoice)
    setAdminPassword('')
    setDeleteJustification('')
    setDeleteError(null)
    setShowDeleteModal(true)
  }

  const handleDeleteInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deleteTarget) return
    setDeleteError(null)
    setDeleting(true)
    try {
      const valid = await verifySecretCode('sales_reset', adminPassword)
      if (!valid) { setDeleteError('Mot de passe administrateur incorrect'); setDeleting(false); return }
      const { error: logError } = await insertInvoiceDeletion({
        invoice_id: deleteTarget.id, invoice_number: deleteTarget.invoice_number,
        total_ttc: Number(deleteTarget.total_ttc), justification: deleteJustification,
        admin_id: profile?.id || '', admin_email: profile?.email || '',
        vendeur_id: deleteTarget.user_id || null, vendeur_email: null,
      })
      if (logError) { setDeleteError('Erreur justificatif: ' + logError.message); setDeleting(false); return }
      const { error: delError } = await deleteInvoice(deleteTarget.id)
      if (delError) { setDeleteError('Erreur suppression: ' + delError.message); setDeleting(false); return }
      setShowDeleteModal(false)
      load()
    } catch { setDeleteError('Erreur lors de la suppression') }
    setDeleting(false)
  }

  const todayInvoices = displayedInvoices.filter(inv => new Date(inv.invoice_date).toISOString().split('T')[0] === bilanDate)
  const bilanStats = {
    total: todayInvoices.length,
    totalAmount: todayInvoices.reduce((s, i) => s + Number(i.total_ttc), 0),
    paye: todayInvoices.filter(i => i.payment_status === 'paye'),
    enAttente: todayInvoices.filter(i => i.payment_status === 'en_attente'),
    especes: todayInvoices.filter(i => i.payment_method === 'especes'),
    carte: todayInvoices.filter(i => i.payment_method === 'carte'),
    virement: todayInvoices.filter(i => i.payment_method === 'virement'),
    cheque: todayInvoices.filter(i => i.payment_method === 'cheque'),
  }
  const paidRevenue = bilanStats.paye.reduce((s, i) => s + Number(i.total_ttc), 0)
  const alreadyClosedToday = closures.some(c => {
    const cDate = typeof c.closure_date === 'string'? c.closure_date : new Date(c.closure_date).toISOString().split('T')[0]
    return cDate === new Date().toISOString().split('T')[0] && c.vendeur_id === profile?.id
  })
  const handleEndOfDay = async () => {
    if (todayInvoices.length === 0) { setClosureError('Aucune vente à clôturer'); return }
    if (!confirm('Confirmer la clôture?')) return
    setClosingDay(true)
    setClosureError(null)
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const todaysInvoices = displayedInvoices.filter(inv => new Date(inv.invoice_date).toISOString().split('T')[0] === todayStr)
      const { error: closError } = await insertDailyClosure({
        vendeur_id: profile?.id || null,
        vendeur_name: profile?.full_name || profile?.username || profile?.email || 'Vendeur',
        closure_date: todayStr,
        total_invoices: todaysInvoices.length,
        total_ttc: todaysInvoices.reduce((s, i) => s + Number(i.total_ttc), 0),
        total_ht: todaysInvoices.reduce((s, i) => s + Number(i.total_ttc), 0),
        tva_amount: 0,
        especes_count: todaysInvoices.filter(i => i.payment_method === 'especes').length,
        carte_count: todaysInvoices.filter(i => i.payment_method === 'carte').length,
        virement_count: todaysInvoices.filter(i => i.payment_method === 'virement').length,
        cheque_count: todaysInvoices.filter(i => i.payment_method === 'cheque').length,
        especes_amount: todaysInvoices.filter(i => i.payment_method === 'especes').reduce((s, i) => s + Number(i.total_ttc), 0),
        carte_amount: todaysInvoices.filter(i => i.payment_method === 'carte').reduce((s, i) => s + Number(i.total_ttc), 0),
        virement_amount: todaysInvoices.filter(i => i.payment_method === 'virement').reduce((s, i) => s + Number(i.total_ttc), 0),
        cheque_amount: todaysInvoices.filter(i => i.payment_method === 'cheque').reduce((s, i) => s + Number(i.total_ttc), 0),
        invoice_ids: todaysInvoices.map(i => i.id), status: 'cloture',
      })
      if (closError) { setClosureError('Erreur: ' + closError.message); setClosingDay(false); return }
      load()
    } catch { setClosureError('Erreur lors de la clôture') }
    setClosingDay(false)
  }

  const statusConfig = {
    paye: { label: 'Payé', color: 'bg-accent-100 text-accent-700' },
    en_attente: { label: 'En attente', color: 'bg-warning-100 text-warning-700' },
    partiel: { label: 'Partiel', color: 'bg-primary-100 text-primary-700' },
  }
  const totalRevenue = displayedInvoices.filter(i => i.payment_status === 'paye').reduce((sum, i) => sum + Number(i.total_ttc), 0)
  const pendingCount = displayedInvoices.filter(i => i.payment_status === 'en_attente').length
  const companyName = companySettings?.company_name || 'Maman Star'
  const companyAddress = [companySettings?.address, companySettings?.city].filter(Boolean).join(', ')
  const companyPhone = companySettings?.phone || ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventes & Factures</h1>
          <p className="text-gray-500 mt-1">
            {profile?.role === 'vendeur'? 'Mes ventes uniquement' : 'Toutes les ventes'}
            {profile?.role === 'vendeur' && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">🔒 Vendeur: {profile.full_name}</span>}
          </p>
        </div>
        <button onClick={openNewSale} className="btn-primary"><Plus className="w-4 h-4" />Nouvelle vente</button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit flex-wrap">
        <button onClick={() => setSubTab('ventes')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'ventes'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><FileText className="w-4 h-4" />Ventes</button>
        <button onClick={() => setSubTab('bilan')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'bilan'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><ClipboardCheck className="w-4 h-4" />Bilan</button>
        <button onClick={() => setSubTab('closures')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'closures'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><CalendarCheck className="w-4 h-4" />Clôtures</button>
      </div>

      {subTab === 'ventes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center"><Wallet className="w-6 h-6" /></div><div><p className="text-sm text-gray-500">CA encaissé</p><p className="text-xl font-bold text-gray-900">{totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</p></div></div>
          <div className="card flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center"><Receipt className="w-6 h-6" /></div><div><p className="text-sm text-gray-500">Factures en attente</p><p className="text-xl font-bold text-gray-900">{pendingCount}</p></div></div>
        </div>
      )}

      {loading? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div> : subTab === 'ventes'? (
        <div className="card">
          {displayedInvoices.length === 0? <div className="text-center py-12"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">{profile?.role === 'vendeur'? 'Tu n\'as pas encore de ventes aujourd\'hui' : 'Aucune facture'}</p></div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-200"><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">N° Facture</th><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Date</th><th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Montant</th><th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Paiement</th><th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedInvoices.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                      <td className="py-3 px-2 text-sm text-gray-500 hidden md:table-cell">{new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-3 px-2 text-right text-sm font-semibold text-gray-900">{Number(invoice.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</td>
                      <td className="py-3 px-2 text-center">
                        <select value={invoice.payment_status} onChange={e => updatePaymentStatus(invoice.id, e.target.value as Invoice['payment_status'])} className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${statusConfig[invoice.payment_status].color}`}>
                          {Object.entries(statusConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-2 text-right"><div className="flex items-center justify-end gap-1">
                        <button onClick={() => viewInvoiceDetails(invoice)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEditModal(invoice)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg" title="Code admin requis"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => openDeleteModal(invoice)} className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg" title="Code admin requis"><Trash2 className="w-4 h-4" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : subTab === 'bilan'? (
        <div className="space-y-6">
          <div className="card flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]"><label className="label">Date du bilan</label><input type="date" value={bilanDate} onChange={e => setBilanDate(e.target.value)} className="input" /></div>
            <button onClick={handleEndOfDay} disabled={closingDay || alreadyClosedToday} className="btn-primary">{closingDay? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><CalendarCheck className="w-4 h-4" /> Fin de journée</>}</button>
          </div>
          {closureError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{closureError}</div>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><FileText className="w-6 h-6" /></div><div><p className="text-sm text-gray-500">Ventes</p><p className="text-xl font-bold text-gray-900">{bilanStats.total}</p></div></div>
            <div className="card flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center"><Wallet className="w-6 h-6" /></div><div><p className="text-sm text-gray-500">CA total</p><p className="text-xl font-bold text-gray-900">{bilanStats.totalAmount.toLocaleString('fr-FR')} FCFA</p></div></div>
            <div className="card flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center"><CreditCard className="w-6 h-6" /></div><div><p className="text-sm text-gray-500">Encaissé</p><p className="text-xl font-bold text-gray-900">{paidRevenue.toLocaleString('fr-FR')} FCFA</p></div></div>
            <div className="card flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center"><Receipt className="w-6 h-6" /></div><div><p className="text-sm text-gray-500">En attente</p><p className="text-xl font-bold text-gray-900">{bilanStats.enAttente.length}</p></div></div>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique des clôtures</h2>
          {closures.length === 0? <div className="text-center py-12"><CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucune clôture</p></div> : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200"><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Date</th><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Vendeur</th><th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Ventes</th><th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Montant</th></tr></thead><tbody className="divide-y divide-gray-100">{closures.map(c => (<tr key={c.id} className="hover:bg-gray-50"><td className="py-3 px-2 text-sm text-gray-600">{new Date(c.closure_date).toLocaleDateString('fr-FR')}</td><td className="py-3 px-2 text-sm font-medium text-gray-900 hidden sm:table-cell">{c.vendeur_name}</td><td className="py-3 px-2 text-center text-sm text-gray-900">{c.total_invoices}</td><td className="py-3 px-2 text-right text-sm font-semibold text-gray-900">{Number(c.total_ttc).toLocaleString('fr-FR')} FCFA</td></tr>))}</tbody></table></div>
          )}
        </div>
      )}

      {/* MODAL CODE SECRET POUR MODIFICATION */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-orange-600" /></div>
              <div><h3 className="font-semibold">Code Admin requis</h3><p className="text-xs text-gray-500">Pour modifier les ventes</p></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Code secret (admin)</label>
                <input type="password" value={secretInput} onChange={e => setSecretInput(e.target.value)} className="input" placeholder="••••" autoFocus onKeyDown={e => e.key === 'Enter' && verifySecretAndProceed()} />
              </div>
              {secretError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{secretError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowSecretModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button onClick={verifySecretAndProceed} className="btn-primary flex-1 bg-orange-600 hover:bg-orange-700">Valider</button>
              </div>
              <p className="text-[11px] text-gray-400 text-center">Code par défaut: admin (changeable dans Paramètres)</p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">Nouvelle vente / facture</h2><button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button></div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Statut paiement</label><select value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value as any })} className="input"><option value="en_attente">En attente</option><option value="paye">Payé</option><option value="partiel">Partiel</option></select></div>
                <div><label className="label">Mode de paiement</label><select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value as any })} className="input"><option value="especes">Espèces</option><option value="carte">Carte</option><option value="virement">Virement</option><option value="cheque">Chèque</option></select></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="label mb-0">Articles</label><button type="button" onClick={addLine} className="btn-ghost text-sm text-primary-600"><Plus className="w-4 h-4" /> Ajouter</button></div>
                {form.lines.length === 0? <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">Cliquez sur Ajouter</p> : (
                  <div className="space-y-2">
                    {form.lines.map((line, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select value={line.product_id} onChange={e => updateLine(index, 'product_id', e.target.value)} className="input flex-1"><option value="">Produit</option>{products.map(p => <option key={p.id} value={p.id}>{p.designation} ({p.sale_price}FCFA)</option>)}</select>
                        <input type="number" min="0.5" step="0.5" value={line.quantity} onChange={e => updateLine(index, 'quantity', e.target.value)} className="input w-20" placeholder="Qté" />
                        <input type="number" step="0.01" value={line.unit_price} onChange={e => updateLine(index, 'unit_price', e.target.value)} className="input w-24" placeholder="Prix" />
                        <span className="text-sm font-medium text-gray-700 w-24 text-right">{(line.quantity * line.unit_price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</span>
                        <button type="button" onClick={() => removeLine(index)} className="p-2 text-gray-400 hover:text-danger-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.lines.length > 0 && <div className="bg-gray-50 rounded-lg p-4"><div className="flex justify-between text-base font-bold"><span>Total</span><span className="text-primary-700">{totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</span></div></div>}
              {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{error}</div>}
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" disabled={saving} className="btn-primary flex-1">{saving? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><CreditCard className="w-4 h-4" /> Encaisser</>}</button></div>
            </form>
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-semibold">{viewInvoice.invoice.invoice_number}</h2><div className="flex gap-2"><button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4" /> Imprimer</button><button onClick={() => setViewInvoice(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div></div>
            <div className="mb-6 pb-4 border-b-2 border-gray-800"><h1 className="text-2xl font-bold">{companyName}</h1><p className="text-sm text-gray-600">{companyAddress}</p></div>
            <table className="w-full mb-4"><thead><tr className="border-b-2 border-gray-300"><th className="text-left text-xs font-semibold py-2">Désignation</th><th className="text-center text-xs font-semibold py-2">Qté</th><th className="text-right text-xs font-semibold py-2">Total</th></tr></thead><tbody>{viewInvoice.lines.map(line => (<tr key={line.id} className="border-b border-gray-100"><td className="py-2 text-sm">{line.designation}</td><td className="py-2 text-sm text-center">{line.quantity}</td><td className="py-2 text-sm text-right font-medium">{Number(line.line_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</td></tr>))}</tbody></table>
            <div className="flex justify-between text-base font-bold pt-2 border-t-2"><span>Total</span><span>{Number(viewInvoice.invoice.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</span></div>
          </div>
        </div>
      )}

      {showEditModal && editInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Modifier {editInvoice.invoice_number}</h2><button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Statut</label><select value={editForm.payment_status} onChange={e => setEditForm({...editForm, payment_status: e.target.value as any })} className="input"><option value="en_attente">En attente</option><option value="paye">Payé</option><option value="partiel">Partiel</option></select></div>
                <div><label className="label">Mode</label><select value={editForm.payment_method} onChange={e => setEditForm({...editForm, payment_method: e.target.value as any })} className="input"><option value="especes">Espèces</option><option value="carte">Carte</option><option value="virement">Virement</option><option value="cheque">Chèque</option></select></div>
              </div>
              <div className="space-y-2">
                {editForm.lines.map((line, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select value={line.product_id} onChange={e => updateEditLine(index, 'product_id', e.target.value)} className="input flex-1"><option value="">Produit</option>{products.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}</select>
                    <input type="number" min="0.5" step="0.5" value={line.quantity} onChange={e => updateEditLine(index, 'quantity', e.target.value)} className="input w-20" />
                    <input type="number" step="0.01" value={line.unit_price} onChange={e => updateEditLine(index, 'unit_price', e.target.value)} className="input w-24" />
                    <span className="text-sm font-medium w-24 text-right">{(line.quantity * line.unit_price).toLocaleString('fr-FR')} FCFA</span>
                    <button type="button" onClick={() => removeEditLine(index)} className="p-2 text-gray-400 hover:text-danger-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              {editError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{editError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" disabled={savingEdit} className="btn-primary flex-1">{savingEdit? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Enregistrer'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-danger-600" />Supprimer</h2><button onClick={() => setShowDeleteModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleDeleteInvoice} className="space-y-4">
              <div>
                <label className="label">Mot de passe admin *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={showAdminPassword? "text" : "password"} required value={adminPassword} onChange={e => { setAdminPassword(e.target.value); setDeleteError(null) }} className="input pl-10 pr-10" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showAdminPassword? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div><label className="label">Justificatif *</label><textarea required value={deleteJustification} onChange={e => { setDeleteJustification(e.target.value); setDeleteError(null) }} className="input min-h-[80px]" placeholder="Raison de la suppression..." /></div>
              {deleteError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{deleteError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" disabled={deleting} className="btn-danger flex-1">{deleting? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Trash2 className="w-4 h-4" /> Supprimer</>}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
