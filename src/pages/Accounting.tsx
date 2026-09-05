import { useEffect, useState, useCallback } from 'react'
import { getAccountingEntries, getInvoiceDeletions, getDailyClosures, updateDailyClosure, verifySecretCode } from '../lib/api'
import { BookOpen, TrendingUp, TrendingDown, Scale, Download, AlertTriangle, ClipboardCheck, Lock, X, Pencil } from 'lucide-react'
import type { AccountingEntry, InvoiceDeletion, DailyClosure } from '../types'

type SubTab = 'journal' | 'deletions' | 'closures'

export default function Accounting() {
  const [subTab, setSubTab] = useState<SubTab>('journal')
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [deletions, setDeletions] = useState<InvoiceDeletion[]>([])
  const [closures, setClosures] = useState<DailyClosure[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Edit closure state
  const [showEditClosure, setShowEditClosure] = useState(false)
  const [editClosure, setEditClosure] = useState<DailyClosure | null>(null)
  const [closureAdminPw, setClosureAdminPw] = useState('')
  const [closureEditError, setClosureEditError] = useState<string | null>(null)
  const [savingClosure, setSavingClosure] = useState(false)
  const [closureForm, setClosureForm] = useState({
    total_invoices: 0,
    total_ttc: 0,
    especes_amount: 0,
    carte_amount: 0,
    virement_amount: 0,
    cheque_amount: 0,
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [entriesRes, delRes, closRes] = await Promise.all([
      getAccountingEntries(dateFrom || undefined, dateTo || undefined),
      getInvoiceDeletions(),
      getDailyClosures(),
    ])

    setEntries((entriesRes.data || []) as AccountingEntry[])
    setDeletions((delRes.data || []) as InvoiceDeletion[])
    setClosures((closRes.data || []) as DailyClosure[])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0)
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0)
  const balance = totalDebit - totalCredit

  const sourceConfig: Record<string, { label: string; color: string }> = {
    vente: { label: 'Vente', color: 'bg-accent-100 text-accent-700' },
    achat: { label: 'Achat', color: 'bg-primary-100 text-primary-700' },
    manuel: { label: 'Manuel', color: 'bg-gray-100 text-gray-700' },
    stock: { label: 'Stock', color: 'bg-warning-100 text-warning-700' },
  }

  const exportCSV = () => {
    const headers = ['Date', 'N° Compte', 'Libellé compte', 'Libellé', 'Débit', 'Crédit', 'Source']
    const rows = entries.map(e => [e.entry_date, e.account_number, e.account_label, e.label, e.debit, e.credit, sourceConfig[e.source]?.label || e.source])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `journal_comptable_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalDeletions = deletions.reduce((s, d) => s + Number(d.total_ttc), 0)
  const totalClosures = closures.reduce((s, c) => s + Number(c.total_ttc), 0)

  const openEditClosure = (closure: DailyClosure) => {
    setEditClosure(closure)
    setClosureForm({
      total_invoices: closure.total_invoices,
      total_ttc: Number(closure.total_ttc),
      especes_amount: Number(closure.especes_amount),
      carte_amount: Number(closure.carte_amount),
      virement_amount: Number(closure.virement_amount),
      cheque_amount: Number(closure.cheque_amount),
    })
    setClosureAdminPw('')
    setClosureEditError(null)
    setShowEditClosure(true)
  }

  const handleEditClosureSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClosure) return
    setClosureEditError(null)
    setSavingClosure(true)

    try {
      const valid = await verifySecretCode('accounting_edit', closureAdminPw)
      if (!valid) {
        setClosureEditError('Mot de passe administrateur incorrect')
        setSavingClosure(false)
        return
      }

      const { error: updateError } = await updateDailyClosure(editClosure.id, {
        total_invoices: closureForm.total_invoices,
        total_ttc: closureForm.total_ttc,
        especes_amount: closureForm.especes_amount,
        carte_amount: closureForm.carte_amount,
        virement_amount: closureForm.virement_amount,
        cheque_amount: closureForm.cheque_amount,
      })

      if (updateError) {
        setClosureEditError('Erreur: ' + updateError.message)
        setSavingClosure(false)
        return
      }

      setShowEditClosure(false)
      load()
    } catch {
      setClosureEditError('Erreur lors de la modification')
    }
    setSavingClosure(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 mt-1">Journal comptable, suppressions et clôtures</p>
        </div>
        {subTab === 'journal' && (
          <button onClick={exportCSV} className="btn-secondary">
            <Download className="w-4 h-4" />
            Exporter TXT
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit flex-wrap">
        <button
          onClick={() => setSubTab('journal')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'journal' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen className="w-4 h-4" />Journal
        </button>
        <button
          onClick={() => setSubTab('deletions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'deletions' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <AlertTriangle className="w-4 h-4" />Suppressions
          {deletions.length > 0 && <span className="ml-1 bg-danger-100 text-danger-700 text-xs font-medium px-1.5 py-0.5 rounded-full">{deletions.length}</span>}
        </button>
        <button
          onClick={() => setSubTab('closures')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'closures' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardCheck className="w-4 h-4" />Clôtures
          {closures.length > 0 && <span className="ml-1 bg-accent-100 text-accent-700 text-xs font-medium px-1.5 py-0.5 rounded-full">{closures.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
      ) : subTab === 'journal' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><TrendingUp className="w-6 h-6" /></div>
              <div><p className="text-sm text-gray-500">Total Débit</p><p className="text-xl font-bold text-gray-900">{totalDebit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</p></div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-danger-50 text-danger-600 flex items-center justify-center"><TrendingDown className="w-6 h-6" /></div>
              <div><p className="text-sm text-gray-500">Total Crédit</p><p className="text-xl font-bold text-gray-900">{totalCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</p></div>
            </div>
            <div className="card flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${balance === 0 ? 'bg-accent-50 text-accent-600' : 'bg-warning-50 text-warning-600'}`}><Scale className="w-6 h-6" /></div>
              <div><p className="text-sm text-gray-500">Équilibre</p><p className={`text-xl font-bold ${balance === 0 ? 'text-accent-600' : 'text-warning-600'}`}>{balance === 0 ? 'Équilibré' : 'Déséquilibré'}</p></div>
            </div>
          </div>

          <div className="card flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="label">Date début</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="label">Date fin</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
            </div>
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="btn-secondary">Réinitialiser</button>
          </div>

          <div className="card">
            {entries.length === 0 ? (
              <div className="text-center py-12"><BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucune écriture comptable</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Compte</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Libellé</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Débit</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Crédit</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm text-gray-600">{new Date(entry.entry_date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 px-2"><p className="text-sm font-medium text-gray-900">{entry.account_number}</p><p className="text-xs text-gray-400">{entry.account_label}</p></td>
                        <td className="py-3 px-2 text-sm text-gray-600 hidden sm:table-cell">{entry.label}</td>
                        <td className="py-3 px-2 text-right text-sm font-medium text-primary-700">{Number(entry.debit) > 0 ? `${Number(entry.debit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA` : '—'}</td>
                        <td className="py-3 px-2 text-right text-sm font-medium text-danger-600">{Number(entry.credit) > 0 ? `${Number(entry.credit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA` : '—'}</td>
                        <td className="py-3 px-2 text-center hidden md:table-cell"><span className={`badge ${sourceConfig[entry.source]?.color || 'bg-gray-100 text-gray-700'}`}>{sourceConfig[entry.source]?.label || entry.source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : subTab === 'deletions' ? (
        <>
          {deletions.length > 0 && (
            <div className="card flex items-center gap-4 bg-danger-50 border-danger-200">
              <div className="w-12 h-12 rounded-xl bg-danger-100 text-danger-600 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
              <div><p className="text-sm text-danger-700">Total des ventes supprimées</p><p className="text-xl font-bold text-danger-900">{totalDeletions.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</p></div>
            </div>
          )}
          <div className="card">
            {deletions.length === 0 ? (
              <div className="text-center py-12"><AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucune suppression de vente</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Facture</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Montant</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Justificatif</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Autorisé par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deletions.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm text-gray-600">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 px-2 text-sm font-medium text-gray-900">{d.invoice_number}</td>
                        <td className="py-3 px-2 text-right text-sm font-semibold text-danger-600">{Number(d.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</td>
                        <td className="py-3 px-2 text-sm text-gray-600 hidden sm:table-cell">{d.justification}</td>
                        <td className="py-3 px-2 text-sm text-gray-500 hidden md:table-cell">{d.admin_email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {closures.length > 0 && (
            <div className="card flex items-center gap-4 bg-accent-50 border-accent-200">
              <div className="w-12 h-12 rounded-xl bg-accent-100 text-accent-600 flex items-center justify-center"><ClipboardCheck className="w-6 h-6" /></div>
              <div><p className="text-sm text-accent-700">Total des clôtures</p><p className="text-xl font-bold text-accent-900">{totalClosures.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</p></div>
            </div>
          )}
          <div className="card">
            {closures.length === 0 ? (
              <div className="text-center py-12"><ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucune clôture de journée enregistrée</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Vendeur</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Ventes</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Montant</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Espèces</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Carte</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {closures.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm text-gray-600">{new Date(c.closure_date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 px-2 text-sm font-medium text-gray-900 hidden sm:table-cell">{c.vendeur_name}</td>
                        <td className="py-3 px-2 text-center text-sm text-gray-900">{c.total_invoices}</td>
                        <td className="py-3 px-2 text-right text-sm font-semibold text-gray-900">{Number(c.total_ttc).toLocaleString('fr-FR')} FCFA</td>
                        <td className="py-3 px-2 text-right text-sm text-accent-600 hidden md:table-cell">{Number(c.especes_amount).toLocaleString('fr-FR')} FCFA</td>
                        <td className="py-3 px-2 text-right text-sm text-accent-600 hidden md:table-cell">{Number(c.carte_amount).toLocaleString('fr-FR')} FCFA</td>
                        <td className="py-3 px-2 text-center">
                          <button onClick={() => openEditClosure(c)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Modifier (mot de passe admin requis)">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit closure modal — requires admin password */}
      {showEditClosure && editClosure && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Modifier la clôture</h2>
              <button onClick={() => setShowEditClosure(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-warning-700">
                Clôture du <strong>{new Date(editClosure.closure_date).toLocaleDateString('fr-FR')}</strong> par <strong>{editClosure.vendeur_name}</strong>.
              </p>
              <p className="text-xs text-warning-600 mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Mot de passe administrateur requis pour modifier.</p>
            </div>

            <form onSubmit={handleEditClosureSave} className="space-y-4">
              <div>
                <label className="label">Mot de passe administrateur *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={closureAdminPw}
                    onChange={e => { setClosureAdminPw(e.target.value); setClosureEditError(null) }}
                    className="input pl-10"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <label className="label">Nombre de ventes</label>
                  <input type="number" value={closureForm.total_invoices} onChange={e => setClosureForm({ ...closureForm, total_invoices: parseInt(e.target.value) || 0 })} className="input" />
                </div>
                <div>
                  <label className="label">Montant total (FCFA)</label>
                  <input type="number" step="0.01" value={closureForm.total_ttc} onChange={e => setClosureForm({ ...closureForm, total_ttc: parseFloat(e.target.value) || 0 })} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Espèces</label>
                    <input type="number" step="0.01" value={closureForm.especes_amount} onChange={e => setClosureForm({ ...closureForm, especes_amount: parseFloat(e.target.value) || 0 })} className="input" />
                  </div>
                  <div>
                    <label className="label">Carte</label>
                    <input type="number" step="0.01" value={closureForm.carte_amount} onChange={e => setClosureForm({ ...closureForm, carte_amount: parseFloat(e.target.value) || 0 })} className="input" />
                  </div>
                  <div>
                    <label className="label">Virement</label>
                    <input type="number" step="0.01" value={closureForm.virement_amount} onChange={e => setClosureForm({ ...closureForm, virement_amount: parseFloat(e.target.value) || 0 })} className="input" />
                  </div>
                  <div>
                    <label className="label">Chèque</label>
                    <input type="number" step="0.01" value={closureForm.cheque_amount} onChange={e => setClosureForm({ ...closureForm, cheque_amount: parseFloat(e.target.value) || 0 })} className="input" />
                  </div>
                </div>
              </div>

              {closureEditError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{closureEditError}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditClosure(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={savingClosure} className="btn-primary flex-1">
                  {savingClosure ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
