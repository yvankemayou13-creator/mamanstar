import { PGlite } from '@electric-sql/pglite'
import { IdbFs } from '@electric-sql/pglite/fs'
// ---------- Shared DB interface ----------
export interface DbResult {
  rows: unknown[]
  affectedRows?: number
}

export interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<DbResult>
  exec: (sql: string) => Promise<void>
}

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
`

// ---------- Client implementations ----------

// Electron IPC proxy — database lives on filesystem in main process
class ElectronDbClient implements DbClient {
  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    return window.electronDB!.query(sql, params)
  }
  async exec(sql: string): Promise<void> {
    await window.electronDB!.exec(sql)
  }
}

// Browser PGlite — database lives in IndexedDB (for future web version)
class BrowserDbClient implements DbClient {
  private pglite: PGlite

  constructor(pglite: PGlite) {
    this.pglite = pglite
  }

  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    const result = await this.pglite.query(sql, params || [])
    return { rows: result.rows, affectedRows: result.affectedRows }
  }

  async exec(sql: string): Promise<void> {
    await this.pglite.exec(sql)
  }
}

// ---------- Singleton ----------

let dbInstance: DbClient | null = null
let initPromise: Promise<DbClient> | null = null

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronDB
}

export async function getDb(): Promise<DbClient> {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    let client: DbClient

    if (isElectron()) {
      // Electron: database is on filesystem, main process already initialized schema + seeds
      client = new ElectronDbClient()
    } else {
      // Browser: PGlite in IndexedDB
      const pglite = new PGlite({ fs: new IdbFs('erp-pgi'), dataDir: 'idb://erp-pgi' })
      await pglite.exec(SCHEMA_SQL)
      client = new BrowserDbClient(pglite)
      await seedDefaults(client)
    }

    dbInstance = client
    return client
  })()

  return initPromise
}

async function seedDefaults(db: DbClient): Promise<void> {
  const { rows } = await db.query('SELECT COUNT(*) as cnt FROM company_settings')
  if (Number((rows[0] as { cnt: string | number }).cnt) === 0) {
    await db.query(
      `INSERT INTO company_settings (id, company_name, invoice_counter, order_counter, updated_at)
       VALUES ($1, $2, 1, 1, now()::text)`,
      [crypto.randomUUID(), 'Maman Star'],
    )
  }

  const { rows: pRows } = await db.query('SELECT COUNT(*) as cnt FROM profiles')
  if (Number((pRows[0] as { cnt: string | number }).cnt) === 0) {
    const adminId = crypto.randomUUID()
    await db.query(
      `INSERT INTO profiles (id, email, username, full_name, role, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now()::text)`,
      [adminId, 'admin@mamanstar.local', 'admin', 'Administrateur', 'admin', 'admin123'],
    )
  }

  const { rows: sRows } = await db.query('SELECT COUNT(*) as cnt FROM secret_codes')
  if (Number((sRows[0] as { cnt: string | number }).cnt) === 0) {
    const defaults: Record<string, string> = {
      reset_password: 'admin',
      stock_access: 'admin',
      users_access: 'admin',
      sales_reset: 'admin',
      accounting_edit: 'admin',
      admin_access: 'admin',
    }
    for (const [key, value] of Object.entries(defaults)) {
      await db.query(
        `INSERT INTO secret_codes (key, value, updated_at) VALUES ($1, $2, now()::text)`,
        [key, value],
      )
    }
  }
}

export function genId(): string {
  return crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}
