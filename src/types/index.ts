export type UserRole = 'admin' | 'vendeur' | 'comptable'

export interface Profile {
  id: string
  email: string
  username: string | null
  full_name: string
  role: UserRole
  created_at: string
}

export interface Product {
  id: string
  designation: string
  barcode: string | null
  purchase_price: number
  sale_price: number
  quantity_in_stock: number
  alert_threshold: number
  category: string
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  type: 'entree' | 'sortie' | 'retour'
  quantity: number
  reason: string
  user_id: string | null
  created_at: string
  product?: Product
}

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  notes: string
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  client_id: string | null
  status: 'en_attente' | 'confirmee' | 'livree' | 'annulee'
  total_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  user_id: string | null
  created_at: string
  updated_at: string
  client?: Client
}

export interface OrderLine {
  id: string
  order_id: string
  product_id: string | null
  designation: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Invoice {
  id: string
  invoice_number: string
  client_id: string | null
  order_id: string | null
  user_id: string | null
  invoice_date: string
  total_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  payment_status: 'paye' | 'en_attente' | 'partiel'
  payment_method: 'especes' | 'carte' | 'virement' | 'cheque' | null
  created_at: string
  client?: Client
  invoice_lines?: InvoiceLine[]
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  product_id: string | null
  designation: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface AccountingEntry {
  id: string
  entry_date: string
  account_number: string
  account_label: string
  label: string
  debit: number
  credit: number
  invoice_id: string | null
  source: 'vente' | 'achat' | 'manuel' | 'stock'
  user_id: string | null
  created_at: string
}

export interface CompanySettings {
  id: string
  company_name: string
  address: string
  city: string
  postal_code: string
  phone: string
  email: string
  siret: string
  invoice_counter: number
  order_counter: number
  updated_at: string
}

export interface AppSetting {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface InvoiceDeletion {
  id: string
  invoice_id: string
  invoice_number: string
  total_ttc: number
  justification: string
  admin_id: string
  admin_email: string
  vendeur_id: string | null
  vendeur_email: string | null
  created_at: string
}

export interface DailyClosure {
  id: string
  vendeur_id: string | null
  vendeur_name: string
  closure_date: string
  total_invoices: number
  total_ttc: number
  total_ht: number
  tva_amount: number
  especes_count: number
  carte_count: number
  virement_count: number
  cheque_count: number
  especes_amount: number
  carte_amount: number
  virement_amount: number
  cheque_amount: number
  invoice_ids: string[]
  status: string
  created_at: string
}
