 const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendeur',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  designation TEXT NOT NULL,
  barcode TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 10,
  category TEXT DEFAULT 'Général',
  created_at TEXT NOT NULL DEFAULT (now()::text),
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT,
  order_id TEXT,
  user_id TEXT,
  invoice_date TEXT NOT NULL DEFAULT (now()::text),
  total_ht REAL NOT NULL DEFAULT 0,
  tva_rate REAL NOT NULL DEFAULT 0,
  tva_amount REAL NOT NULL DEFAULT 0,
  total_ttc REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'en_attente',
  payment_method TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT,
  designation TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_deletions (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT,
  total_ttc REAL DEFAULT 0,
  justification TEXT DEFAULT '',
  admin_id TEXT,
  admin_email TEXT,
  vendeur_id TEXT,
  vendeur_email TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS daily_closures (
  id TEXT PRIMARY KEY,
  vendeur_id TEXT,
  vendeur_name TEXT,
  closure_date TEXT NOT NULL,
  total_invoices INTEGER DEFAULT 0,
  total_ttc REAL DEFAULT 0,
  total_ht REAL DEFAULT 0,
  tva_amount REAL DEFAULT 0,
  especes_count INTEGER DEFAULT 0,
  carte_count INTEGER DEFAULT 0,
  virement_count INTEGER DEFAULT 0,
  cheque_count INTEGER DEFAULT 0,
  especes_amount REAL DEFAULT 0,
  carte_amount REAL DEFAULT 0,
  virement_amount REAL DEFAULT 0,
  cheque_amount REAL DEFAULT 0,
  invoice_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'ferme',
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS accounting_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL DEFAULT (now()::text),
  account_number TEXT DEFAULT '',
  account_label TEXT DEFAULT '',
  label TEXT NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  invoice_id TEXT,
  source TEXT NOT NULL DEFAULT 'manuel',
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY,
  company_name TEXT DEFAULT 'Maman Star',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  siret TEXT DEFAULT '',
  invoice_counter INTEGER DEFAULT 1,
  order_counter INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS secret_codes (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);
';

module.exports = { SCHEMA_SQL };
