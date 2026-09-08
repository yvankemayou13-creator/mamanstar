import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getProducts, getStockMovements, insertProduct, updateProduct,
  deleteProduct, addStockMovement, verifySecretCode,
} from '../lib/api'
import {
  Plus, ArrowDownCircle, ArrowUpCircle, RotateCcw, X,
  Package, AlertTriangle, Search, ClipboardList, Boxes, ArrowLeftRight,
  Lock, Pencil, Trash2, Barcode, Tag, Eye, EyeOff,
} from 'lucide-react'
import type { StockMovement, Product } from '../types'

type SubTab = 'produits' | 'etat' | 'mouvements'

export default function Stock() {
  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [showStockPassword, setShowStockPassword] = useState(false)

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accès au Stock protégé</h2>
          <p className="text-gray-500 mb-6">Saisissez le mot de passe pour accéder à la gestion du stock.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setChecking(true)
              const valid = await verifySecretCode('stock_access', passwordInput)
              if (valid) {
                setUnlocked(true)
                setPwError(null)
              } else {
                setPwError('Mot de passe incorrect')
              }
              setChecking(false)
            }}
            className="space-y-4"
          >
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showStockPassword? "text" : "password"}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPwError(null) }}
                className="input pl-10 pr-10"
                placeholder="Mot de passe"
                autoFocus
              />
              <button type="button" onClick={() => setShowStockPassword(!showStockPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showStockPassword? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {pwError && (
              <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">
                {pwError}
              </div>
            )}
            <button type="submit" disabled={checking} className="btn-primary w-full">
              {checking? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Lock className="w-4 h-4" /> Déverrouiller</>}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <StockContent />
}

function StockContent() {
  const { profile } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('produits')
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState({
    designation: '', barcode: '', purchase_price: '', sale_price: '',
    quantity_in_stock: '', alert_threshold: '10', category: 'Général',
  })
  const [productError, setProductError] = useState<string | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)

  const [showMovModal, setShowMovModal] = useState(false)
  const [movForm, setMovForm] = useState({ product_id: '', type: 'entree', quantity: '', reason: '' })
  const [movError, setMovError] = useState<string | null>(null)
  const [savingMov, setSavingMov] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [prodRes, movRes] = await Promise.all([
      getProducts(),
      getStockMovements(),
    ])
    setProducts(prodRes.data || [])
    setMovements(movRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()

  const typeConfig = {
    entree: { label: 'Entrée', icon: ArrowDownCircle, color: 'text-accent-600', bg: 'bg-accent-100' },
    sortie: { label: 'Sortie', icon: ArrowUpCircle, color: 'text-danger-600', bg: 'bg-danger-100' },
    retour: { label: 'Retour', icon: RotateCcw, color: 'text-warning-600', bg: 'bg-warning-100' },
  }

  const openAddProduct = () => {
    setEditingProduct(null)
    setProductForm({ designation: '', barcode: '', purchase_price: '', sale_price: '', quantity_in_stock: '', alert_threshold: '10', category: 'Général' })
    setProductError(null)
    setShowProductModal(true)
  }

  const openEditProduct = (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      designation: product.designation,
      barcode: product.barcode || '',
      purchase_price: product.purchase_price.toString(),
      sale_price: product.sale_price.toString(),
      quantity_in_stock: product.quantity_in_stock.toString(),
      alert_threshold: product.alert_threshold.toString(),
      category: product.category,
    })
    setProductError(null)
    setShowProductModal(true)
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setProductError(null)
    setSavingProduct(true)

    // MODIF DEMI-CASIER : parseFloat au lieu de parseInt
    const data = {
      designation: productForm.designation,
      barcode: productForm.barcode || null,
      purchase_price: parseFloat(productForm.purchase_price) || 0,
      sale_price: parseFloat(productForm.sale_price) || 0,
      quantity_in_stock: parseFloat(productForm.quantity_in_stock) || 0,
      alert_threshold: parseFloat(productForm.alert_threshold) || 10,
      category: productForm.category,
    }

    if (editingProduct) {
      const { error } = await updateProduct(editingProduct.id, data)
      if (error) setProductError(error.message)
      else { setShowProductModal(false); load() }
    } else {
      const { error } = await insertProduct(data)
      if (error) setProductError(error.message)
      else { setShowProductModal(false); load() }
    }
    setSavingProduct(false)
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit?')) return
    await deleteProduct(id)
    load()
  }

  const handleSaveMov = async (e: React.FormEvent) => {
    e.preventDefault()
    setMovError(null)
    setSavingMov(true)

    // MODIF DEMI-CASIER : parseFloat
    const qty = parseFloat(movForm.quantity) || 0
    if (qty <= 0) { setMovError('La quantité doit être supérieure à 0'); setSavingMov(false); return }

    const product = products.find(p => p.id === movForm.product_id)
    if (!product) { setMovError('Sélectionnez un produit'); setSavingMov(false); return }

    const { error: movErr } = await addStockMovement({
      product_id: movForm.product_id,
      type: movForm.type,
      quantity: qty,
      reason: movForm.reason,
      user_id: profile?.id || null,
    })

    if (movErr) { setMovError(movErr.message); setSavingMov(false); return }

    setShowMovModal(false)
    setMovForm({ product_id: '', type: 'entree', quantity: '', reason: '' })
    load()
    setSavingMov(false)
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.designation.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search)
    if (!matchesSearch) return false
    if (categoryFilter!== 'all' && p.category!== categoryFilter) return false
    if (stockFilter === 'low') return p.quantity_in_stock <= p.alert_threshold && p.quantity_in_stock > 0
    if (stockFilter === 'out') return p.quantity_in_stock === 0
    return true
  })

  const categoryStats = categories.map(cat => {
    const catProducts = products.filter(p => p.category === cat)
    return {
      category: cat,
      productCount: catProducts.length,
      totalQuantity: catProducts.reduce((sum, p) => sum + p.quantity_in_stock, 0),
      totalValue: catProducts.reduce((sum, p) => sum + p.quantity_in_stock * p.purchase_price, 0),
      lowCount: catProducts.filter(p => p.quantity_in_stock <= p.alert_threshold && p.quantity_in_stock > 0).length,
      outCount: catProducts.filter(p => p.quantity_in_stock === 0).length,
    }
  })

  const totalProducts = products.length
  const lowStockCount = products.filter(p => p.quantity_in_stock <= p.alert_threshold && p.quantity_in_stock > 0).length
  const outOfStockCount = products.filter(p => p.quantity_in_stock === 0).length
  const totalStockValue = products.reduce((sum, p) => sum + p.quantity_in_stock * p.purchase_price, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits & Stock</h1>
          <p className="text-gray-500 mt-1">Gérez votre catalogue produits et votre inventaire</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAddProduct} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouveau produit
          </button>
          <button
            onClick={() => { setMovForm({ product_id: '', type: 'entree', quantity: '', reason: '' }); setMovError(null); setShowMovModal(true) }}
            className="btn-secondary"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Mouvement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><Boxes className="w-6 h-6" /></div>
          <div><p className="text-sm text-gray-500">Total produits</p><p className="text-xl font-bold text-gray-900">{totalProducts}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center"><Package className="w-6 h-6" /></div>
          <div><p className="text-sm text-gray-500">Valeur du stock</p><p className="text-xl font-bold text-gray-900">{totalStockValue.toLocaleString('fr-FR')} FCFA</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
          <div><p className="text-sm text-gray-500">Stock faible</p><p className="text-xl font-bold text-gray-900">{lowStockCount}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-danger-50 text-danger-600 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
          <div><p className="text-sm text-gray-500">Ruptures</p><p className="text-xl font-bold text-gray-900">{outOfStockCount}</p></div>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit flex-wrap">
        <button onClick={() => setSubTab('produits')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'produits'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Package className="w-4 h-4" />Produits</button>
        <button onClick={() => setSubTab('etat')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'etat'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><ClipboardList className="w-4 h-4" />État du stock</button>
        <button onClick={() => setSubTab('mouvements')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${subTab === 'mouvements'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><ArrowLeftRight className="w-4 h-4" />Mouvements</button>
      </div>

      {loading? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
      ) : subTab === 'produits'? (
        <div className="card">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder="Rechercher par désignation ou code-barres..." />
          </div>
          {filteredProducts.length === 0? (
            <div className="text-center py-12"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucun produit trouvé</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Désignation</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Code-barres</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden md:table-cell">Catégorie</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Prix achat</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Prix vente</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Stock</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2 hidden sm:table-cell">Seuil</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Statut</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(product => {
                    const isLow = product.quantity_in_stock <= product.alert_threshold && product.quantity_in_stock > 0
                    const isOut = product.quantity_in_stock === 0
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2">
                          <p className="text-sm font-medium text-gray-900">{product.designation}</p>
                          <p className="text-xs text-gray-400 md:hidden">{product.barcode || '—'}</p>
                          <p className="text-xs text-gray-400 md:hidden">{product.category}</p>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell"><span className="text-sm text-gray-600 flex items-center gap-1"><Barcode className="w-3.5 h-3.5 text-gray-400" />{product.barcode || '—'}</span></td>
                        <td className="py-3 px-2 hidden md:table-cell"><span className="badge bg-gray-100 text-gray-600">{product.category}</span></td>
                        <td className="py-3 px-2 text-right text-sm text-gray-600">{product.purchase_price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</td>
                        <td className="py-3 px-2 text-right text-sm font-medium text-gray-900">{product.sale_price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</td>
                        <td className="py-3 px-2 text-center"><span className={`text-sm font-medium ${isOut? 'text-danger-600' : isLow? 'text-warning-600' : 'text-gray-900'}`}>{product.quantity_in_stock}</span></td>
                        <td className="py-3 px-2 text-center text-sm text-gray-500 hidden sm:table-cell">{product.alert_threshold}</td>
                        <td className="py-3 px-2 text-center">{isOut? <span className="badge bg-danger-100 text-danger-700">Rupture</span> : isLow? <span className="badge bg-warning-100 text-warning-700"><AlertTriangle className="w-3 h-3 mr-1" />Alerte</span> : <span className="badge bg-accent-100 text-accent-700">OK</span>}</td>
                        <td className="py-3 px-2 text-right"><div className="flex items-center justify-end gap-1"><button onClick={() => openEditProduct(product)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"><Pencil className="w-4 h-4" /></button><button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : subTab === 'etat'? (
        <div className="space-y-6">
          {/*... le reste de ton code etat ne change pas... */}
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder="Rechercher un produit..." /></div>
              <select value={stockFilter} onChange={e => setStockFilter(e.target.value as 'all' | 'low' | 'out')} className="input sm:w-40"><option value="all">Tous les stocks</option><option value="low">Stock faible</option><option value="out">Ruptures</option></select>
            </div>
            {filteredProducts.length === 0? (
              <div className="text-center py-12"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucun produit trouvé</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-200"><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Désignation</th><th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Quantité</th><th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Statut</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map(product => {
                      const isLow = product.quantity_in_stock <= product.alert_threshold && product.quantity_in_stock > 0
                      const isOut = product.quantity_in_stock === 0
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-2"><p className="text-sm font-medium text-gray-900">{product.designation}</p></td>
                          <td className="py-3 px-2 text-center"><span className={`text-sm font-semibold ${isOut? 'text-danger-600' : isLow? 'text-warning-600' : 'text-gray-900'}`}>{product.quantity_in_stock}</span></td>
                          <td className="py-3 px-2 text-center">{isOut? <span className="badge bg-danger-100 text-danger-700">Rupture</span> : isLow? <span className="badge bg-warning-100 text-warning-700">Alerte</span> : <span className="badge bg-accent-100 text-accent-700">OK</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          {movements.length === 0? (
            <div className="text-center py-12"><ArrowLeftRight className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">Aucun mouvement</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-200"><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Date</th><th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">Produit</th><th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-2">Type</th><th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-2">Quantité</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map(m => {
                    const cfg = typeConfig[m.type] || typeConfig.entree
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2 text-sm text-gray-600">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 px-2 text-sm font-medium text-gray-900">{m.product?.designation || '—'}</td>
                        <td className="py-3 px-2 text-center"><span className={`badge ${cfg.bg} ${cfg.color}`}><cfg.icon className="w-3 h-3 mr-1" />{cfg.label}</span></td>
                        <td className="py-3 px-2 text-right"><span className={`text-sm font-semibold ${m.type === 'sortie'? 'text-danger-600' : 'text-accent-600'}`}>{m.type === 'sortie'? '-' : '+'}{m.quantity}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editingProduct? 'Modifier le produit' : 'Nouveau produit'}</h2>
              <button onClick={() => setShowProductModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div><label className="label">Désignation *</label><input type="text" required value={productForm.designation} onChange={e => setProductForm({...productForm, designation: e.target.value })} className="input" placeholder="Nom du produit" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Code-barres</label><input type="text" value={productForm.barcode} onChange={e => setProductForm({...productForm, barcode: e.target.value })} className="input" placeholder="3 760 123..." /></div>
                <div><label className="label">Catégorie / Marque</label><input type="text" list="category-list" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value })} className="input" placeholder="Général" /><datalist id="category-list">{categories.map(cat => <option key={cat} value={cat} />)}</datalist></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Prix d'achat (FCFA) *</label><input type="number" step="0.01" required value={productForm.purchase_price} onChange={e => setProductForm({...productForm, purchase_price: e.target.value })} className="input" placeholder="0.00" /></div>
                <div><label className="label">Prix de vente (FCFA) *</label><input type="number" step="0.01" required value={productForm.sale_price} onChange={e => setProductForm({...productForm, sale_price: e.target.value })} className="input" placeholder="0.00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantité en stock (demi-casier possible)</label>
                  <input type="number" step="0.5" min="0" value={productForm.quantity_in_stock} onChange={e => setProductForm({...productForm, quantity_in_stock: e.target.value })} className="input" placeholder="Ex: 10.5" />
                  <p className="text-xs text-gray-400 mt-1">Tu peux mettre 0.5 = demi</p>
                </div>
                <div><label className="label">Seuil d'alerte</label><input type="number" step="0.5" min="0" value={productForm.alert_threshold} onChange={e => setProductForm({...productForm, alert_threshold: e.target.value })} className="input" placeholder="10" /></div>
              </div>
              {productError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{productError}</div>}
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowProductModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" disabled={savingProduct} className="btn-primary flex-1">{savingProduct? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Enregistrer'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showMovModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">Nouveau mouvement</h2><button onClick={() => setShowMovModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button></div>
            <form onSubmit={handleSaveMov} className="space-y-4">
              <div><label className="label">Produit *</label><select required value={movForm.product_id} onChange={e => setMovForm({...movForm, product_id: e.target.value })} className="input"><option value="">Sélectionner un produit</option>{products.map(p => <option key={p.id} value={p.id}>{p.designation} (Stock: {p.quantity_in_stock})</option>)}</select></div>
              <div><label className="label">Type de mouvement *</label><div className="grid grid-cols-3 gap-2">{Object.entries(typeConfig).map(([key, cfg]) => (<button key={key} type="button" onClick={() => setMovForm({...movForm, type: key })} className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg border-2 transition-all ${movForm.type === key? `${cfg.bg} border-current ${cfg.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}><cfg.icon className="w-5 h-5" /><span className="text-xs font-medium">{cfg.label}</span></button>))}</div></div>
              <div>
                <label className="label">Quantité * (0.5 = demi-casier)</label>
                <input type="number" required min="0.5" step="0.5" value={movForm.quantity} onChange={e => setMovForm({...movForm, quantity: e.target.value })} className="input" placeholder="Ex: 0.5" />
              </div>
              <div><label className="label">Motif</label><input type="text" value={movForm.reason} onChange={e => setMovForm({...movForm, reason: e.target.value })} className="input" placeholder="Raison du mouvement" /></div>
              {movError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{movError}</div>}
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowMovModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" disabled={savingMov} className="btn-primary flex-1">{savingMov? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Enregistrer'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
