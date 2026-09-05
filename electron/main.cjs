const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { SCHEMA_SQL } = require('./schema.cjs')

let mainWindow = null
let db = null

// ---- Database (PGlite on filesystem) ----
async function initDb() {
  if (db) return db

  const { PGlite } = require('@electric-sql/pglite')

  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'database')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, 'erp-pgi')
  db = new PGlite(dbPath)

  await db.exec(SCHEMA_SQL)
  await seedDefaults(db)

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Maman Star ERP',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = !!process.env.VITE_DEV_SERVER_URL

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

Menu.setApplicationMenu(null)

// ---- IPC: database bridge ----
ipcMain.handle('db:query', async (_event, sql, params) => {
  if (!db) await initDb()
  const result = await db.query(sql, params || [])
  return { rows: result.rows, affectedRows: result.affectedRows }
})

ipcMain.handle('db:exec', async (_event, sql) => {
  if (!db) await initDb()
  await db.exec(sql)
  return true
})

ipcMain.handle('db:getPath', async () => {
  if (!db) await initDb()
  return db ? path.join(app.getPath('userData'), 'database') : null
})

app.whenReady().then(async () => {
  await initDb()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
