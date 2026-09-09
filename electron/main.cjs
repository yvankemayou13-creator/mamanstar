const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { SCHEMA_SQL } = require('./schema.cjs')

let mainWindow = null
let db = null
let backupInterval = null

// ---- Database ----
async function initDb() {
  if (db) return db
  const { PGlite } = require('@electric-sql/pglite')
  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'database')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, 'erp-pgi')
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true })

  db = new PGlite(dbPath)
  await db.waitReady
  await db.exec(SCHEMA_SQL)
  await seedDefaults(db)
  console.log('DB prête sur:', dbPath)
  return db
}

async function seedDefaults(db) {
  let { rows } = await db.query('SELECT COUNT(*) as cnt FROM company_settings')
  if (Number(rows[0].cnt) === 0) {
    await db.query(
      `INSERT INTO company_settings (id, company_name, invoice_counter, order_counter, updated_at)
       VALUES ($1, $2, 1, 1, now()::text)`,
      [crypto.randomUUID(), 'Maman Star'],
    )
  }

  let pRows = (await db.query('SELECT COUNT(*) as cnt FROM profiles')).rows
  if (Number(pRows[0].cnt) === 0) {
    const adminId = crypto.randomUUID()
    await db.query(
      `INSERT INTO profiles (id, email, username, full_name, role, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now()::text)`,
      [adminId, 'admin@mamanstar.local', 'admin', 'Administrateur', 'admin', 'admin123'],
    )
  }

  let sRows = (await db.query('SELECT COUNT(*) as cnt FROM secret_codes')).rows
  if (Number(sRows[0].cnt) === 0) {
    const defaults = {
      reset_password: 'admin',
      stock_access: 'admin',
      users_access: 'admin',
      sales_reset: 'admin',
      sales_edit: 'admin', // NOUVEAU: pour modifier une vente
      sales_delete: 'admin', // NOUVEAU: pour supprimer une vente
      accounting_edit: 'admin',
      admin_access: 'admin',
    }
    for (const [key, value] of Object.entries(defaults)) {
      await db.query(
        `INSERT INTO secret_codes (key, value, updated_at) VALUES ($1, $2, now()::text)`,
        [key, value],
      )
    }
  } else {
    // Si les codes existent déjà, on ajoute les 2 nouveaux s'ils manquent
    for (const k of ['sales_edit', 'sales_delete']) {
      const { rows } = await db.query('SELECT key FROM secret_codes WHERE key=$1', [k])
      if (rows.length === 0) {
        await db.query('INSERT INTO secret_codes (key, value, updated_at) VALUES ($1, $2, now()::text)', [k, 'admin'])
      }
    }
  }
}

// ---- Sauvegarde permanente ----
async function checkpoint() {
  if (!db) return
  try { await db.exec('CHECKPOINT;') } catch(e) { console.log('checkpoint error', e) }
}

function backupJournalier() {
  try {
    const userDataPath = app.getPath('userData')
    const dbSource = path.join(userDataPath, 'database', 'erp-pgi')
    const backupRoot = path.join(userDataPath, 'backups')
    if (!fs.existsSync(backupRoot)) fs.mkdirSync(backupRoot, { recursive: true })
    const now = new Date()
    const date = now.toISOString().slice(0,10)
    const heure = now.toTimeString().slice(0,5).replace(':','h')
    const dest = path.join(backupRoot, `backup-${date}-${heure}${Math.floor(Math.random()*100)}`)
    fs.cpSync(dbSource, dest, { recursive: true, force: true })
    console.log('Backup créé:', dest)
    return dest
  } catch(e) {
    console.error('Backup erreur', e)
    return null
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 700,
    title: 'Maman Star ERP',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const isDev =!!process.env.VITE_DEV_SERVER_URL
  if (isDev) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

Menu.setApplicationMenu(null)

// ---- IPC ----
ipcMain.handle('db:query', async (_event, sql, params) => {
  if (!db) await initDb()
  const result = await db.query(sql, params || [])
  if (sql.toLowerCase().includes('insert into') || sql.toLowerCase().includes('update')) {
    await checkpoint()
  }
  return { rows: result.rows, affectedRows: result.affectedRows }
})

ipcMain.handle('db:exec', async (_event, sql) => {
  if (!db) await initDb()
  await db.exec(sql)
  await checkpoint()
  return true
})

ipcMain.handle('db:getPath', async () => {
  if (!db) await initDb()
  return path.join(app.getPath('userData'), 'database', 'erp-pgi')
})

ipcMain.handle('db:backupNow', async () => {
  await checkpoint()
  const p = backupJournalier()
  if (p) dialog.showMessageBoxSync(mainWindow, { message: `Sauvegarde réussie!\n${p}`, type: 'info' })
  return p
})

// NOUVEAU: Vérification du code secret admin pour les ventes
ipcMain.handle('secret:verify', async (_event, key, inputValue) => {
  if (!db) await initDb()
  try {
    const { rows } = await db.query('SELECT value FROM secret_codes WHERE key=$1', [key])
    if (rows.length === 0) return false
    return rows[0].value === inputValue
  } catch { return false }
})

ipcMain.handle('secret:getAll', async () => {
  if (!db) await initDb()
  const { rows } = await db.query('SELECT key, value FROM secret_codes ORDER BY key')
  return rows
})

ipcMain.handle('secret:update', async (_event, key, value) => {
  if (!db) await initDb()
  await db.query('UPDATE secret_codes SET value=$1, updated_at=now()::text WHERE key=$2', [value, key])
  await checkpoint()
  return true
})

app.whenReady().then(async () => {
  await initDb()
  createWindow()
  backupInterval = setInterval(async () => {
    await checkpoint()
    backupJournalier()
  }, 30 * 60 * 1000)
})

app.on('window-all-closed', () => {
  if (process.platform!== 'darwin') app.quit()
})

app.on('before-quit', async (e) => {
  if (db) {
    e.preventDefault()
    if (backupInterval) clearInterval(backupInterval)
    await checkpoint()
    backupJournalier()
    app.exit(0)
  }
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
