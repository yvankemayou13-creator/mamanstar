import { getDb, genId } from './database'
import type {
  Profile, Product, StockMovement, Invoice, InvoiceLine,
  AccountingEntry, CompanySettings, InvoiceDeletion, DailyClosure,
} from '../types'

// ===================================================
// UTILS
// ===================================================
interface QueryResult<T> { data: T | null; error: { message: string } | null }
function ok<T>(data: T): QueryResult<T> { return { data, error: null } }
function err<T>(msg: string): QueryResult<T> { return { data: null, error: { message: msg } } }

// ===================================================
// 1. AUTH & USERS
// ===================================================
export async function authenticateUser(username: string, password: string, expectedRole?: string): Promise<QueryResult<Profile>> {
  try {
    const db = await getDb()
    const { rows } = await db.query('SELECT * FROM profiles WHERE username=$1 LIMIT 1', [username])
    if (!rows.length) return err('Utilisateur introuvable')
    const user = rows[0] as Profile & { password_hash: string }
    if (user.password_hash!== password) return err('Mot de passe incorrect')
    if (expectedRole && user.role!== expectedRole) return err(`Ce compte n'est pas de type "${expectedRole}"`)
    const { password_hash,...profile } = user
    return ok(profile as Profile)
  } catch (e) { return err((e as Error).message) }
}

export async function getAllProfiles() {
  try { const db = await getDb(); const { rows } = await db.query('SELECT * FROM profiles ORDER BY created_at DESC'); return ok(rows as any) }
  catch (e) { return err((e as Error).message) }
}

export async function getProfiles(): Promise<QueryResult<Profile[]>> {
  try { const db = await getDb(); const { rows } = await db.query('SELECT id, email, username, full_name, role, created_at FROM profiles ORDER BY full_name'); return ok(rows as Profile[]) }
  catch (e) { return err((e as Error).message) }
}

export async function createUser(data: { username: string; password: string; full_name: string; role: string }) {
  try {
    const db = await getDb(); const id = genId(); const email = `${data.username}@mamanstar.local`
    await db.query(`INSERT INTO profiles (id, email, username, full_name, role, password_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6, now()::text)`, [id, email, data.username, data.full_name, data.role, data.password])
    const { rows } = await db.query('SELECT * FROM profiles WHERE id=$1', [id])
    const { password_hash,...profile } = rows[0] as any
    return ok(profile as Profile)
  } catch (e) { return err((e as Error).message) }
}

export async function updateUser(data: { userId: string; username?: string; password?: string; full_name?: string; role?: string }) {
  try {
    const db = await getDb(); const fields: string[] = []; const values: any[] = []; let idx = 1
    if (data.username!== undefined) { fields.push(`username=$${idx++}`); values.push(data.username) }
    if (data.full_name!== undefined) { fields.push(`full_name=$${idx++}`); values.push(data.full_name) }
    if (data.role!== undefined) { fields.push(`role=$${idx++}`); values.push(data.role) }
    if (data.password) { fields.push(`password_hash=$${idx++}`); values.push(data.password) }
    if (data.username) { fields.push(`email=$${idx++}`); values.push(`${data.username}@mamanstar.local`) }
    values.push(data.userId)
    if (fields.length) await db.query(`UPDATE profiles SET ${fields.join(',')} WHERE id=$${idx}`, values)
    const { rows } = await db.query('SELECT * FROM profiles WHERE id=$1', [data.userId])
    const { password_hash,...profile } = rows[0] as any
    return ok(profile as Profile)
  } catch (e) { return err((e as Error).message) }
}

export async function deleteUser(userId: string) {
  try { const db = await getDb(); await db.query('DELETE FROM profiles WHERE id=$1', [userId]); return ok(true) }
  catch (e) { return err((e as Error).message) }
}

export async function verifyUserPassword(userId: string, password: string) {
  const db = await getDb(); const { rows } = await db.query('SELECT password_hash FROM profiles WHERE id=$1', [userId])
  if (!rows.length) return false
  return (rows[0] as any).password_hash === password
}

// ===================================================
// 2. CODES SECRETS - MASQUES PAR DEFAUT + ACCES ADMIN
// ===================================================
// Keys utilisées aujourd'hui:
// - admin_access: accès page Paramètres (défaut: admin)
// - sales_edit: modifier vente (défaut: admin)
// - sales_reset / sales_delete: supprimer vente (défaut: admin)
// - stock_access: accès stock
// - users_access: accès utilisateurs
// - reset_password: page connexion
// - accounting_edit: modif compta

export async function getSecretCode(key: string): Promise<string> {
  try { const db = await getDb(); const { rows } = await db.query('SELECT value FROM secret_codes WHERE key=$1', [key]); return rows.length? (rows[0] as any).value : '' }
  catch { return '' }
}

export async function getAllSecretCodes(): Promise<QueryResult<{ key: string; value: string }[]>> {
  try { const db = await getDb(); const { rows } = await db.query('SELECT key, value FROM secret_codes ORDER BY key'); return ok(rows as any) }
  catch (e) { return err((e as Error).message) }
}

export async function updateSecretCode(key: string, value: string) {
  try {
    const db = await getDb()
    await db.query(`INSERT INTO secret_codes (key, value, updated_at) VALUES ($1,$2, now()::text) ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=now()::text`, [key, value])
    return ok(true)
  } catch (e) { return err((e as Error).message) }
}

export async function verifySecretCode(key: string, value: string): Promise<boolean> {
  const code = await getSecretCode(key)
  return code === value
}

// ===================================================
// 3. PRODUITS & STOCK - ENTREE = ACHAT (CAISSE COUPEE)
// ===================================================
export async function getProducts(): Promise<QueryResult<Product[]>> {
  try { const db = await getDb(); const { rows } = await db.query('SELECT * FROM products ORDER BY designation'); return ok(rows as Product[]) }
  catch (e) { return err((e as Error).message) }
}

export async function insertProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const db = await getDb(); const id = genId()
    await db.query(`INSERT INTO products (id, designation, barcode, purchase_price, sale_price, quantity_in_stock, alert_threshold, category, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()::text, now()::text)`, [id, data.designation, data.barcode, data.purchase_price, data.sale_price, data.quantity_in_stock, data.alert_threshold, data.category])
    const { rows } = await db.query('SELECT * FROM products WHERE id=$1', [id])
    return ok(rows[0] as Product)
  } catch (e) { return err((e as Error).message) }
}

export async function updateProduct(id: string, data: Partial<Product>) {
  try {
    const db = await getDb(); const fields: string[] = []; const values: any[] = []; let idx = 1
    for (const [k, v] of Object.entries(data)) { if (['id', 'created_at'].includes(k)) continue; fields.push(`${k}=$${idx++}`); values.push(v) }
    fields.push(`updated_at=now()::text`); values.push(id)
    await db.query(`UPDATE products SET ${fields.join(',')} WHERE id=$${idx}`, values)
    return ok(true)
  } catch (e) { return err((e as Error).message) }
}

export async function deleteProduct(id: string) {
  try { const db = await getDb(); await db.query('DELETE FROM products WHERE id=$1', [id]); return ok(true) }
  catch (e) { return err((e as Error).message) }
}

export async function getStockMovements(): Promise<QueryResult<StockMovement[]>> {
  try {
    const db = await getDb()
    const { rows } = await db.query(`SELECT sm.*, p.designation as product_designation, p.category as product_category, p.purchase_price, p.sale_price FROM stock_movements sm LEFT JOIN products p ON sm.product_id=p.id ORDER BY sm.created_at DESC`)
    const movements = rows.map((r: any) => ({...r, product: r.product_designation? { id: r.product_id, designation: r.product_designation, category: r.product_category } : undefined }))
    return ok(movements as StockMovement[])
  } catch (e) { return err((e as Error).message) }
}

// MODIF DU JOUR: entrée = achat = argent sort de la caisse
export async function addStockMovement(data: { product_id: string; type: string; quantity: number; reason: string; user_id: string | null }) {
  try {
    const db = await getDb(); const id = genId()
    const delta = data.type === 'entree'? data.quantity : -data.quantity

    await db.query(`INSERT INTO stock_movements (id, product_id, type, quantity, reason, user_id, created_at) VALUES ($1,$2,$3,$4,$5,$6, now()::text)`, [id, data.product_id, data.type, data.quantity, data.reason, data.user_id])
    await db.query('UPDATE products SET quantity_in_stock=quantity_in_stock+$1, updated_at=now()::text WHERE id=$2', [delta, data.product_id])

    if (data.type === 'entree') {
      const prodRes = await db.query('SELECT designation, purchase_price FROM products WHERE id=$1', [data.product_id])
      if (prodRes.rows.length) {
        const prod = prodRes.rows[0] as any
        const coutTotal = Number(prod.purchase_price) * data.quantity
        await db.query(`INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, source, user_id, created_at) VALUES ($1, now()::text, '607', 'Achats de marchandises', $2, $3, 0, 'achat', $4, now()::text)`, [genId(), `Achat ${prod.designation} x${data.quantity} - ${data.reason}`, coutTotal, data.user_id])
        await db.query(`INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, source, user_id, created_at) VALUES ($1, now()::text, '530', 'Caisse', $2, 0, $3, 'achat', $4, now()::text)`, [genId(), `Paiement achat ${prod.designation}`, coutTotal, data.user_id])
      }
    }
    return ok(true)
  } catch (e) { return err((e as Error).message) }
}

export async function getStockAlerts() {
  try { const db = await getDb(); const { rows } = await db.query(`SELECT *, CASE WHEN quantity_in_stock<=0 THEN 'rupture' WHEN quantity_in_stock<=alert_threshold THEN 'alerte' ELSE 'ok' END as stock_status FROM products WHERE quantity_in_stock<=alert_threshold ORDER BY designation`); return ok(rows as any) }
  catch (e) { return err((e as Error).message) }
}

// ===================================================
// 4. VENTES / FACTURES - VENDEUR VOIT QUE SES VENTES
// ===================================================
export async function getInvoices(): Promise<QueryResult<Invoice[]>> {
  try { const db = await getDb(); const { rows } = await db.query(`SELECT i.*, p.full_name as user_full_name, p.username as user_username FROM invoices i LEFT JOIN profiles p ON i.user_id=p.id ORDER BY i.created_at DESC`); return ok(rows as Invoice[]) }
  catch (e) { return err((e as Error).message) }
}

export async function getInvoiceLines(invoiceId: string): Promise<QueryResult<InvoiceLine[]>> {
  try { const db = await getDb(); const { rows } = await db.query('SELECT * FROM invoice_lines WHERE invoice_id=$1', [invoiceId]); return ok(rows as InvoiceLine[]) }
  catch (e) { return err((e as Error).message) }
}

export async function insertInvoice(data: any): Promise<QueryResult<Invoice>> {
  try {
    const db = await getDb(); const id = genId()
    await db.query(`INSERT INTO invoices (id, invoice_number, user_id, invoice_date, total_ht, tva_rate, tva_amount, total_ttc, payment_status, payment_method, created_at, updated_at) VALUES ($1,$2,$3, now()::text,$4,$5,$6,$7,$8,$9, now()::text, now()::text)`, [id, data.invoice_number, data.user_id, data.total_ht, data.tva_rate, data.tva_amount, data.total_ttc, data.payment_status, data.payment_method])
    for (const line of data.lines) {
      await db.query(`INSERT INTO invoice_lines (id, invoice_id, product_id, designation, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [genId(), id, line.product_id, line.designation, line.quantity, line.unit_price, line.line_total])
      if (line.product_id) await db.query('UPDATE products SET quantity_in_stock=quantity_in_stock-$1, updated_at=now()::text WHERE id=$2', [line.quantity, line.product_id])
    }
    // Compta vente
    await db.query(`INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, invoice_id, source, created_at) VALUES ($1, now()::text,'411','Clients',$2,$3,0,$4,'vente', now()::text)`, [genId(), `Facture ${data.invoice_number}`, data.total_ttc, id])
    await db.query(`INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, invoice_id, source, created_at) VALUES ($1, now()::text,'707','Ventes de marchandises',$2,0,$3,$4,'vente', now()::text)`, [genId(), `Facture ${data.invoice_number}`, data.total_ht, id])
    if (data.tva_amount > 0) await db.query(`INSERT INTO accounting_entries (id, entry_date, account_number, account_label, label, debit, credit, invoice_id, source, created_at) VALUES ($1, now()::text,'4457','TVA collectée',$2,0,$3,$4,'vente', now()::text)`, [genId(), `TVA Facture ${data.invoice_number}`, data.tva_amount, id])
    const { rows } = await db.query('SELECT * FROM invoices WHERE id=$1', [id])
    return ok(rows[0] as Invoice)
  } catch (e) { return err((e as Error).message) }
}

export async function updateInvoice(id: string, data: any) {
  try { const db = await getDb(); const fields = Object.keys(data).map((k, i) => `${k}=$${i + 1}`).join(','); const vals = [...Object.values(data), id]; await db.query(`UPDATE invoices SET ${fields}, updated_at=now()::text WHERE id=$${vals.length}`, vals); return ok(true) }
  catch (e) { return err((e as Error).message) }
}

export async function replaceInvoiceLines(invoiceId: string, lines: any[]) {
  try { const db = await getDb(); await db.query('DELETE FROM invoice_lines WHERE invoice_id=$1', [invoiceId]); for (const line of lines) { await db.query(`INSERT INTO invoice_lines (id, invoice_id, product_id, designation, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [genId(), invoiceId, line.product_id, line.designation, line.quantity, line.unit_price, line.line_total]) } return ok(true) }
  catch (e) { return err((e as Error).message) }
}

export async function deleteInvoice(id: string) {
  try { const db = await getDb(); await db.query('DELETE FROM invoice_lines WHERE invoice_id=$1', [id]); await db.query('DELETE FROM invoices WHERE id=$1', [id]); return ok(true) }
  catch (e) { return err((e as Error).message) }
}

export async function insertInvoiceDeletion(data: any) {
  try { const db = await getDb(); await db.query(`INSERT INTO invoice_deletions (id, invoice_id, invoice_number, total_ttc, justification, admin_id, admin_email, vendeur_id, vendeur_email, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now()::text)`, [genId(), data.invoice_id, data.invoice_number, data.total_ttc, data.justification, data.admin_id, data.admin_email, data.vendeur_id, data.vendeur_email]); return ok(true) }
  catch (e) { return err((e as Error).message) }
}

export async function get
