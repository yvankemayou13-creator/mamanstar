import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getCompanySettings, updateCompanySettings, getAppSettings, upsertAppSetting,
  exportAllData, getAllSecretCodes, updateSecretCode, verifySecretCode,
} from '../lib/api'
import {
  Settings as SettingsIcon, Save, Building, SlidersHorizontal,
  Download, RefreshCw, CheckCircle2, Monitor, KeyRound, Lock, Eye, EyeOff, ShieldCheck
} from 'lucide-react'
import type { CompanySettings } from '../types'

const secretCodeLabels: Record<string, string> = {
  reset_password: 'Réinitialisation (page de connexion)',
  stock_access: 'Accès au stock',
  users_access: 'Accès aux utilisateurs',
  sales_reset: 'Suppression des ventes',
  sales_edit: 'Modification des ventes',
  sales_delete: 'Suppression des ventes',
  accounting_edit: 'Modification comptabilité',
  admin_access: 'Accès Paramètres (code admin)',
}

export default function Settings() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [appSettings, setAppSettings] = useState<Record<string, string>>({} as Record<string, string>)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingApp, setSavingApp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [appSuccess, setAppSuccess] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'company' | 'app' | 'secrets' | 'updates'>('company')

  const [secretCodes, setSecretCodes] = useState<{ key: string; value: string }[]>([])
  const [secretEdits, setSecretEdits] = useState<Record<string, string>>({} as Record<string, string>)
  const [secretAdminPw, setSecretAdminPw] = useState('')
  const [secretSaving, setSecretSaving] = useState(false)
  const [secretSuccess, setSecretSuccess] = useState(false)
  const [secretError, setSecretError] = useState<string | null>(null)
  const [showValues, setShowValues] = useState<Record<string, boolean>>({} as Record<string, boolean>)

  const [hasAccess, setHasAccess] = useState(false)
  const [accessPassword, setAccessPassword] = useState('')
  const [accessError, setAccessError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [settingsRes, appRes, secretRes] = await Promise.all([
      getCompanySettings(),
      getAppSettings(),
      getAllSecretCodes(),
    ])
    setSettings(settingsRes.data as CompanySettings | null)
    setAppSettings((appRes.data || {}) as Record<string, string>)
    const codes = secretRes.data || []
    setSecretCodes(codes)
    const editsMap: Record<string, string> = {} as Record<string, string>
    for (const c of codes) editsMap[c.key] = c.value
    setSecretEdits(editsMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (profile?.role === 'admin' && hasAccess) {
      load()
    } else if (profile?.role === 'admin' &&!hasAccess) {
      setLoading(false)
    }
  }, [hasAccess])

  useEffect(() => {
    if (hasAccess) load()
  }, [hasAccess, load])

  if (profile?.role!== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4"><SettingsIcon className="w-8 h-8 text-red-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-500">Seuls les administrateurs peuvent modifier les paramètres.</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold">Paramètres sécurisés</h1>
            <p className="text-sm text-gray-500 mt-2">Entre le code <b>admin</b> pour accéder</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const ok = await verifySecretCode('admin_access', accessPassword)
            if (!ok) {
              setAccessError('Code incorrect. Par défaut: admin')
              return
            }
            setHasAccess(true)
          }} className="space-y-4">
            <div>
              <label className="label">Mot de passe Admin</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="password" value={accessPassword} onChange={e => setAccessPassword(e.target.value)} className="input pl-10" placeholder="••••••••" autoFocus />
              </div>
            </div>
            {accessError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{accessError}</div>}
            <button type="submit" className="btn-primary w-full"><ShieldCheck className="w-4 h-4" /> Déverrouiller</button>
            <p className="text-[11px] text-center text-gray-400">Code par défaut: admin</p>
          </form>
        </div>
      </div>
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setError(null)
    setSuccess(false)
    setSaving(true)
    const { error } = await updateCompanySettings(settings.id, {
      company_name: settings.company_name,
      address: settings.address,
      city: settings.city,
      postal_code: settings.postal_code,
      phone: settings.phone,
      email: settings.email,
      siret: settings.siret,
    })
    if (error) setError(error.message)
    else setSuccess(true)
    setSaving(false)
  }

  const handleSaveAppSettings = async () => {
    setSavingApp(true)
    setAppSuccess(false)
    setError(null)
    for (const [key, value] of Object.entries(appSettings)) {
      await upsertAppSetting(key, value)
    }
    setAppSuccess(true)
    setSavingApp(false)
  }

  const handleSaveSecrets = async (e: React.FormEvent) => {
    e.preventDefault()
    setSecretError(null)
    setSecretSuccess(false)
    setSecretSaving(true)
    const valid = await verifySecretCode('admin_access', secretAdminPw)
    if (!valid) {
      setSecretError('Mot de passe administrateur incorrect')
      setSecretSaving(false)
      return
    }
    for (const code of secretCodes) {
      const newVal = secretEdits[code.key]
      if (newVal!== code.value) {
        await updateSecretCode(code.key, newVal)
      }
    }
    setSecretSuccess(true)
    setSecretAdminPw('')
    setShowValues({} as Record<string, boolean>)
    load()
    setSecretSaving(false)
  }

  const checkForUpdates = async () => {
    setCheckingUpdate(true)
    setUpdateInfo(null)
    await new Promise(r => setTimeout(r, 1500))
    const currentVersion = appSettings['app_version'] || '1.0.0'
    setUpdateInfo(`Votre application est en version ${currentVersion}. Vous êtes à jour.`)
    await upsertAppSetting('last_update_check', new Date().toISOString().split('T')[0])
    setCheckingUpdate(false)
  }

  const exportData = async () => {
    const { data } = await exportAllData()
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(),...data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sauvegarde_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
  }

  if (!settings) {
    return <p className="text-gray-400">Paramètres introuvables</p>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Configuration de l'application et de l'entreprise</p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit flex-wrap">
        <button onClick={() => setActiveSection('company')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${activeSection === 'company'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}><Building className="w-4 h-4" />Entreprise</button>
        <button onClick={() => setActiveSection('app')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${activeSection === 'app'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}><SlidersHorizontal className="w-4 h-4" />Application</button>
        <button onClick={() => setActiveSection('secrets')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${activeSection === 'secrets'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}><KeyRound className="w-4 h-4" />Mots de passe secrets</button>
        <button onClick={() => setActiveSection('updates')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 ${activeSection === 'updates'? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}><RefreshCw className="w-4 h-4" />Mises à jour</button>
      </div>

      {activeSection === 'company' && (
        <form onSubmit={handleSave} className="card space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><Building className="w-5 h-5 text-primary-600" /></div>
            <h2 className="text-lg font-semibold text-gray-900">Informations de l'entreprise</h2>
          </div>
          <div><label className="label">Nom de l'entreprise</label><input type="text" value={settings.company_name} onChange={e => setSettings({...settings, company_name: e.target.value })} className="input" /></div>
          <div><label className="label">Adresse</label><input type="text" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Code postal</label><input type="text" value={settings.postal_code} onChange={e => setSettings({...settings, postal_code: e.target.value })} className="input" /></div>
            <div><label className="label">Ville</label><input type="text" value={settings.city} onChange={e => setSettings({...settings, city: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Téléphone</label><input type="text" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Email</label><input type="email" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value })} className="input" /></div>
          </div>
          <div><label className="label">SIRET</label><input type="text" value={settings.siret} onChange={e => setSettings({...settings, siret: e.target.value })} className="input" /></div>
          {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{error}</div>}
          {success && <div className="text-sm text-accent-600 bg-accent-50 border border-accent-200 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Paramètres enregistrés</div>}
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save className="w-4 h-4" /> Enregistrer</>}</button>
        </form>
      )}

      {activeSection === 'app' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><SlidersHorizontal className="w-5 h-5 text-primary-600" /></div>
            <h2 className="text-lg font-semibold text-gray-900">Configuration de l'application</h2>
          </div>
          <div><label className="label">Nom de l'application</label><input type="text" value={appSettings['app_name'] || ''} onChange={e => setAppSettings({...appSettings, app_name: e.target.value })} className="input" /></div>
          <div><label className="label">Préfixe des factures</label><input type="text" value={appSettings['invoice_prefix'] || ''} onChange={e => setAppSettings({...appSettings, invoice_prefix: e.target.value })} className="input" placeholder="FAC" /></div>
          <div><label className="label">Pied de page des factures</label><input type="text" value={appSettings['invoice_footer'] || ''} onChange={e => setAppSettings({...appSettings, invoice_footer: e.target.value })} className="input" placeholder="Merci de votre confiance" /></div>
          <div><label className="label">Monnaie</label><input type="text" value={appSettings['currency'] || ''} onChange={e => setAppSettings({...appSettings, currency: e.target.value })} className="input" placeholder="FCFA" /></div>
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Données & Sauvegarde</h3>
            <div className="flex gap-3"><button onClick={exportData} className="btn-secondary flex-1"><Download className="w-4 h-4" /> Exporter les données</button></div>
          </div>
          {appSuccess && <div className="text-sm text-accent-600 bg-accent-50 border border-accent-200 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Configuration enregistrée</div>}
          <button onClick={handleSaveAppSettings} disabled={savingApp} className="btn-primary w-full">{savingApp? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save className="w-4 h-4" /> Enregistrer</>}</button>
        </div>
      )}

      {activeSection === 'secrets' && (
        <form onSubmit={handleSaveSecrets} className="card space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><KeyRound className="w-5 h-5 text-primary-600" /></div>
            <div><h2 className="text-lg font-semibold text-gray-900">Mots de passe secrets</h2><p className="text-sm text-gray-500">Masqués par défaut - clique sur l'oeil</p></div>
          </div>

          <div className="space-y-3">
            {secretCodes.map(code => (
              <div key={code.key}>
                <label className="label">{secretCodeLabels[code.key] || code.key}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showValues[code.key]? "text" : "password"}
                    value={secretEdits[code.key] || ''}
                    onChange={e => setSecretEdits({...secretEdits, [code.key]: e.target.value })}
                    className="input pl-10 pr-10 font-mono"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowValues(prev => ({...prev, [code.key]:!prev[code.key]}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showValues[code.key]? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="label">Mot de passe administrateur (confirmation) *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="password" required value={secretAdminPw} onChange={e => { setSecretAdminPw(e.target.value); setSecretError(null) }} className="input pl-10" placeholder="Confirme avec le code admin_access" />
            </div>
          </div>

          {secretError && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-3">{secretError}</div>}
          {secretSuccess && <div className="text-sm text-accent-600 bg-accent-50 border border-accent-200 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Mots de passe mis à jour</div>}

          <button type="submit" disabled={secretSaving} className="btn-primary w-full">
            {secretSaving? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save className="w-4 h-4" /> Enregistrer les mots de passe</>}
          </button>
        </form>
      )}

      {activeSection === 'updates' && (
        <div className="card space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><Monitor className="w-5 h-5 text-primary-600" /></div>
            <div><h2 className="text-lg font-semibold text-gray-900">Mises à jour</h2><p className="text-sm text-gray-500">Vérifiez et installez les mises à jour</p></div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">Version actuelle</span><span className="text-lg font-bold text-gray-900">{appSettings['app_version'] || '1.0.0'}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Dernière vérification</span><span className="text-sm text-gray-700">{appSettings['last_update_check'] || 'Jamais'}</span></div>
          </div>
          {updateInfo && <div className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-lg p-4 flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-accent-600 flex-shrink-0 mt-0.5" /><span>{updateInfo}</span></div>}
          <button onClick={checkForUpdates} disabled={checkingUpdate} className="btn-primary w-full">
            {checkingUpdate? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Vérification...</> : <><RefreshCw className="w-4 h-4" /> Vérifier les mises à jour</>}
          </button>
        </div>
      )}
    </div>
  )
}
