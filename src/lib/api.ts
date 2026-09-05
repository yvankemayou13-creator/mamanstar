import { getDb, genId, now } from './database'
import type {
  Profile, Product, StockMovement, Invoice, InvoiceLine,
  AccountingEntry, CompanySettings, AppSetting, InvoiceDeletion,
  DailyClosure,
} from '../types'

// ---------- Types ----------
interface QueryResult<T> {
  data: T | null
  error: { message: string } | null
}

function ok<T>(data: T): QueryResult<T> {
  return { data, error: null }
}
function err<T>(message: string): QueryResult<T> {
  return { data: null, error: { message } }
}

// ---------- Auth ----------
export async function authenticateUser(
  username: string,
  password: string,
  expectedRole?: string,
): Promise<QueryResult<Profile>> {
  try {
    const db = await getDb()
    const { rows } = await db.query(
      'SELECT * FROM profiles WHERE username = $1 LIMIT 1',
      [username],
    )
    if (rows.length === 0) return err('Utilisateur introuvable')
    const user = rows[0] as Profile & { password_hash: string }
    if (user.password_hash !== password) return err('Mot de passe incorrect')
    if (expectedRole && user.role !== expectedRole) {
      return err(`Ce compte n'est pas de type "${expectedRole}"`)
    }
    const { password_hash, ...profile } = user
    return ok(profile as Profile)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getAllProfiles(): Promise<QueryResult<(Profile & { password_hash: string })[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM profiles ORDER BY created_at DESC')
    return ok(rows as (Profile & { password_hash: string })[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function createUser(data: {
  username: string
  password: string
  full_name: string
  role: string
}): Promise<QueryResult<Profile>> {
  try {
    const db = await getDb()
    const id = genId()
    const email = `${data.username}@mamanstar.local`
    await db.query(
      `INSERT INTO profiles (id, email, username, full_name, role, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now()::text)`,
      [id, email, data.username, data.full_name, data.role, data.password],
    )
    const { rows } = await db.query('SELECT * FROM profiles WHERE id = $1', [id])
    const { password_hash, ...profile } = rows[0] as Profile & { password_hash: string }
    return ok(profile as Profile)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateUser(data: {
  userId: string
  username?: string
  password?: string
  full_name?: string
  role?: string
}): Promise<QueryResult<Profile>> {
  try {
    const db = await getDb()
    const fields: string[] = []
    const values: (string | undefined)[] = []
    let idx = 1

    if (data.username !== undefined) { fields.push(`username = $${idx++}`); values.push(data.username) }
    if (data.full_name !== undefined) { fields.push(`full_name = $${idx++}`); values.push(data.full_name) }
    if (data.role !== undefined) { fields.push(`role = $${idx++}`); values.push(data.role) }
    if (data.password !== undefined && data.password !== '') { fields.push(`password_hash = $${idx++}`); values.push(data.password) }
    fields.push(`email = $${idx++}`)
    values.push(`${data.username || ''}@mamanstar.local`)

    values.push(data.userId)

    if (fields.length > 0) {
      await db.query(
        `UPDATE profiles SET ${fields.join(', ')} WHERE id = $${idx}`,
        values,
      )
    }
    const { rows } = await db.query('SELECT * FROM profiles WHERE id = $1', [data.userId])
    const { password_hash, ...profile } = rows[0] as Profile & { password_hash: string }
    return ok(profile as Profile)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteUser(userId: string): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    await db.query('DELETE FROM profiles WHERE id = $1', [userId])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const db = await getDb()
  const { rows } = await db.query('SELECT password_hash FROM profiles WHERE id = $1', [userId])
  if (rows.length === 0) return false
  return (rows[0] as { password_hash: string }).password_hash === password
}

// ---------- Secret Codes ----------
export async function getSecretCode(key: string): Promise<string> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT value FROM secret_codes WHERE key = $1', [key])
    return rows.length > 0 ? (rows[0] as { value: string }).value : ''
  } catch {
    return ''
  }
}

export async function updateSecretCode(key: string, value: string): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    await db.query(
      `INSERT INTO secret_codes (key, value, updated_at) VALUES ($1, $2, now()::text)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()::text`,
      [key, value],
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getAllSecretCodes(): Promise<QueryResult<{ key: string; value: string }[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT key, value FROM secret_codes ORDER BY key')
    return ok(rows as { key: string; value: string }[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function verifySecretCode(key: string, value: string): Promise<boolean> {
  const code = await getSecretCode(key)
  return code === value
}

// ---------- Products ----------
export async function getProducts(): Promise<QueryResult<Product[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM products ORDER BY designation')
    return ok(rows as Product[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<QueryResult<Product>> {
  try {
    const db = await getDb()
    const id = genId()
    await db.query(
      `INSERT INTO products (id, designation, barcode, purchase_price, sale_price, quantity_in_stock, alert_threshold, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()::text, now()::text)`,
      [id, data.designation, data.barcode, data.purchase_price, data.sale_price, data.quantity_in_stock, data.alert_threshold, data.category],
    )
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [id])
    return ok(rows[0] as Product)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []
    let idx = 1
    for (const [key, val] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue
      fields.push(`${key} = $${idx++}`)
      values.push(val as string | number | null)
    }
    fields.push(`updated_at = now()::text`)
    values.push(id)
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteProduct(id: string): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    await db.query('DELETE FROM products WHERE id = $1', [id])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Stock Movements ----------
export async function getStockMovements(): Promise<QueryResult<StockMovement[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query(`
      SELECT sm.*, p.designation as product_designation, p.category as product_category
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      ORDER BY sm.created_at DESC
    `)
    const movements = rows.map(r => {
      const row = r as Record<string, unknown>
      return {
        ...row,
        product: row.product_designation ? {
          id: row.product_id,
          designation: row.product_designation,
          category: row.product_category,
        } as Product : undefined,
      } as StockMovement
    })
    return ok(movements)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function addStockMovement(data: {
  product_id: string
  type: string
  quantity: number
  reason: string
  user_id: string | null
}): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const id = genId()
    const delta = data.type === 'entree' ? data.quantity : data.type === 'sortie' ? -data.quantity : data.quantity
    await db.query(
      `INSERT INTO stock_movements (id, product_id, type, quantity, reason, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now()::text)`,
      [id, data.product_id, data.type, data.quantity, data.reason, data.user_id],
    )
    await db.query(
      'UPDATE products SET quantity_in_stock = quantity_in_stock + $1, updated_at = now()::text WHERE id = $2',
      [delta, data.product_id],
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Invoices ----------
export async function getInvoices(): Promise<QueryResult<Invoice[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query(`
      SELECT i.*, p.full_name as user_full_name, p.username as user_username
      FROM invoices i
      LEFT JOIN profiles p ON i.user_id = p.id
      ORDER BY i.created_at DESC
    `)
    return ok(rows as Invoice[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertInvoice(data: {
  invoice_number: string
  user_id: string | null
  total_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  payment_status: string
  payment_method: string | null
  lines: Array<{
    product_id: string | null
    designation: string
    quantity: number
    unit_price: number
    line_total: number
  }>
}): Promise<QueryResult<Invoice>> {
  try {
    const db = await getDb()
    const id = genId()
    await db.query(
      `INSERT INTO invoices (id, invoice_number, user_id, invoice_date, total_ht, tva_rate, tva_amount, total_ttc, payment_status, payment_method, created_at, updated_at)
       VALUES ($1, $2, $3, now()::text, $4, $5, $6, $7, $8, $9, now()::text, now()::text)`,
      [id, data.invoice_number, data.user_id, data.total_ht, data.tva_rate, data.tva_amount, data.total_ttc, data.payment_status, data.payment_method],
    )
    for (const line of data.lines) {
      const lineId = genId()
      await db.query(
        `INSERT INTO invoice_lines (id, invoice_id, product_id, designation, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [lineId, id, line.product_id, line.designation, line.quantity, line.unit_price, line.line_total],
      )
      if (line.product_id) {
        await db.query(
          'UPDATE products SET quantity_in_stock = quantity_in_stock - $1, updated_at = now()::text WHERE id = $2',
          [line.quantity, line.product_id],
        )
      }
    }
    // Generate accounting entries for the sale
    await db.query(
      `INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, invoice_id, source, created_at)
       VALUES ($1, now()::text, '411', 'Clients', $2, $3, 0, $4, 'vente', now()::text)`,
      [genId(), `Facture ${data.invoice_number}`, data.total_ttc, id],
    )
    await db.query(
      `INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, invoice_id, source, created_at)
       VALUES ($1, now()::text, '707', 'Ventes de marchandises', $2, 0, $3, $4, 'vente', now()::text)`,
      [genId(), `Facture ${data.invoice_number}`, data.total_ht, id],
    )
    if (data.tva_amount > 0) {
      await db.query(
        `INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, invoice_id, source, created_at)
         VALUES ($1, now()::text, '4457', 'TVA collectée', $2, 0, $3, $4, 'vente', now()::text)`,
        [genId(), `TVA Facture ${data.invoice_number}`, data.tva_amount, id],
      )
    }

    const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1', [id])
    return ok(rows[0] as Invoice)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateInvoice(id: string, data: {
  total_ttc?: number
  total_ht?: number
  tva_amount?: number
  payment_status?: string
  payment_method?: string | null
}): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []
    let idx = 1
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = $${idx++}`)
      values.push(val as string | number | null)
    }
    fields.push(`updated_at = now()::text`)
    values.push(id)
    await db.query(`UPDATE invoices SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteInvoice(id: string): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    await db.query('DELETE FROM invoices WHERE id = $1', [id])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getInvoiceLines(invoiceId: string): Promise<QueryResult<InvoiceLine[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM invoice_lines WHERE invoice_id = $1', [invoiceId])
    return ok(rows as InvoiceLine[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function replaceInvoiceLines(invoiceId: string, lines: Array<{
  product_id: string | null
  designation: string
  quantity: number
  unit_price: number
  line_total: number
}>): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    await db.query('DELETE FROM invoice_lines WHERE invoice_id = $1', [invoiceId])
    for (const line of lines) {
      const lineId = genId()
      await db.query(
        `INSERT INTO invoice_lines (id, invoice_id, product_id, designation, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [lineId, invoiceId, line.product_id, line.designation, line.quantity, line.unit_price, line.line_total],
      )
    }
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Invoice Deletions ----------
export async function insertInvoiceDeletion(data: {
  invoice_id: string
  invoice_number: string
  total_ttc: number
  justification: string
  admin_id: string
  admin_email: string
  vendeur_id: string | null
  vendeur_email: string | null
}): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const id = genId()
    await db.query(
      `INSERT INTO invoice_deletions (id, invoice_id, invoice_number, total_ttc, justification, admin_id, admin_email, vendeur_id, vendeur_email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()::text)`,
      [id, data.invoice_id, data.invoice_number, data.total_ttc, data.justification, data.admin_id, data.admin_email, data.vendeur_id, data.vendeur_email],
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getInvoiceDeletions(): Promise<QueryResult<InvoiceDeletion[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM invoice_deletions ORDER BY created_at DESC')
    return ok(rows as InvoiceDeletion[])
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Daily Closures ----------
export async function getDailyClosures(): Promise<QueryResult<DailyClosure[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM daily_closures ORDER BY closure_date DESC')
    return ok(rows as DailyClosure[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertDailyClosure(data: Omit<DailyClosure, 'id' | 'created_at'>): Promise<QueryResult<DailyClosure>> {
  try {
    const db = await getDb()
    const id = genId()
    await db.query(
      `INSERT INTO daily_closures (id, vendeur_id, vendeur_name, closure_date, total_invoices, total_ttc, total_ht, tva_amount,
        especes_count, carte_count, virement_count, cheque_count, especes_amount, carte_amount, virement_amount, cheque_amount,
        invoice_ids, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now()::text)`,
      [id, data.vendeur_id, data.vendeur_name, data.closure_date, data.total_invoices, data.total_ttc, data.total_ht, data.tva_amount,
       data.especes_count, data.carte_count, data.virement_count, data.cheque_count,
       data.especes_amount, data.carte_amount, data.virement_amount, data.cheque_amount,
       data.invoice_ids, data.status],
    )
    const { rows: resultRows } = await db.query('SELECT * FROM daily_closures WHERE id = $1', [id])
    return ok(resultRows[0] as DailyClosure)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateDailyClosure(id: string, data: Partial<DailyClosure>): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []
    let idx = 1
    for (const [key, val] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue
      fields.push(`${key} = $${idx++}`)
      values.push(val as string | number | null)
    }
    values.push(id)
    if (fields.length > 0) {
      await db.query(`UPDATE daily_closures SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    }
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Accounting Entries ----------
export async function getAccountingEntries(dateFrom?: string, dateTo?: string): Promise<QueryResult<AccountingEntry[]>> {
  try {
    const db = await getDb()
    let query = 'SELECT * FROM accounting_entries'
    const conditions: string[] = []
    const params: string[] = []
    if (dateFrom) { conditions.push(`entry_date >= $${params.length + 1}`); params.push(dateFrom) }
    if (dateTo) { conditions.push(`entry_date <= $${params.length + 1}`); params.push(dateTo) }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ')
    query += ' ORDER BY entry_date DESC, created_at DESC'
    const { rows } = await db.query(query, params)
    return ok(rows as AccountingEntry[])
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertAccountingEntry(data: {
  label: string
  debit: number
  credit: number
  account_number: string
  account_label: string
  source: string
  user_id: string | null
}): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const id = genId()
    await db.query(
      `INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, source, user_id, created_at)
       VALUES ($1, now()::text, $2, $3, $4, $5, $6, $7, $8, now()::text)`,
      [id, data.account_number, data.account_label, data.label, data.debit, data.credit, data.source, data.user_id],
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Company Settings ----------
export async function getCompanySettings(): Promise<QueryResult<CompanySettings>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM company_settings LIMIT 1')
    if (rows.length === 0) return err('No company settings found')
    return ok(rows[0] as CompanySettings)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateCompanySettings(id: string, data: Partial<CompanySettings>): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []
    let idx = 1
    for (const [key, val] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue
      fields.push(`${key} = $${idx++}`)
      values.push(val as string | number | null)
    }
    fields.push(`updated_at = now()::text`)
    values.push(id)
    await db.query(`UPDATE company_settings SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function incrementInvoiceCounter(): Promise<QueryResult<number>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT id, invoice_counter FROM company_settings LIMIT 1')
    if (rows.length === 0) return err('No company settings')
    const settingsRow = rows[0] as { id: string; invoice_counter: string | number }
    const settingsId = settingsRow.id
    const current = Number(settingsRow.invoice_counter)
    await db.query('UPDATE company_settings SET invoice_counter = $1, updated_at = now()::text WHERE id = $2', [current + 1, settingsId])
    return ok(current)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- App Settings ----------
export async function getAppSettings(): Promise<QueryResult<Record<string, string>>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT key, value FROM app_settings')
    const map: Record<string, string> = {}
    for (const r of rows) {
      const row = r as { key: string; value: string }
      map[row.key] = row.value
    }
    return ok(map)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function upsertAppSetting(key: string, value: string): Promise<QueryResult<boolean>> {
  try {
    const db = await getDb()
    const id = genId()
    await db.query(
      `INSERT INTO app_settings (id, key, value, updated_at) VALUES ($1, $2, $3, now()::text)
       ON CONFLICT (key) DO UPDATE SET value = $3, updated_at = now()::text`,
      [id, key, value],
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Profiles (for Dashboard) ----------
export async function getProfiles(): Promise<QueryResult<Profile[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT id, email, username, full_name, role, created_at FROM profiles ORDER BY full_name')
    return ok(rows as Profile[])
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Stock Alerts ----------
export async function getStockAlerts(): Promise<QueryResult<Array<Product & { stock_status: string }>>> {
  try {
    const db = await getDb()
    const { rows } = await db.query(`
      SELECT *,
        CASE
          WHEN quantity_in_stock <= 0 THEN 'rupture'
          WHEN quantity_in_stock <= alert_threshold THEN 'alerte'
          ELSE 'ok'
        END as stock_status
      FROM products
      WHERE quantity_in_stock <= alert_threshold
      ORDER BY designation
    `)
    return ok(rows as Array<Product & { stock_status: string }>)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ---------- Data Export ----------
export async function exportAllData(): Promise<QueryResult<Record<string, unknown[]>>> {
  try {
    const db = await getDb()
    const [invoices, products, closures] = await Promise.all([
      db.query('SELECT * FROM invoices ORDER BY created_at'),
      db.query('SELECT * FROM products ORDER BY designation'),
      db.query('SELECT * FROM daily_closures ORDER BY closure_date'),
    ])
    return ok({
      invoices: invoices.rows,
      products: products.rows,
      daily_closures: closures.rows,
    })
  } catch (e) {
    return err((e as Error).message)
  }
}
