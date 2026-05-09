import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import knex from '../src/db/knex'
import { seed } from '../src/db/seeds/01_roles_and_admin'

// IPC handler registrations
import { registerAuthHandlers } from './ipc/auth.ipc'
import { registerInventoryHandlers } from './ipc/inventory.ipc'
import { registerSalesHandlers } from './ipc/sales.ipc'
import { registerReceiptHandlers } from './ipc/receipt.ipc'
import { registerReportHandlers } from './ipc/reports.ipc'
import { registerZReportHandlers } from './ipc/zreport.ipc'
import { registerSettingsHandlers } from './ipc/settings.ipc'
import { registerDbHandlers } from './ipc/db.ipc'
import { registerBranchHandlers } from './ipc/branches.ipc'
import { registerCustomerHandlers } from './ipc/customers.ipc'
import { registerCreditHandlers } from './ipc/credit.ipc'
import { registerExpenseHandlers } from './ipc/expenses.ipc'
import { registerPrintHandlers } from './ipc/print.ipc'

// Register custom app:// protocol so renderer assets resolve correctly on all platforms
// (file:// relative paths break on Windows when loaded from deep nested paths)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  // Open external links in the default browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    // Development: load from Vite dev server
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Production: use app:// protocol to serve renderer files
    // This ensures relative asset paths (./assets/) resolve correctly on Windows
    mainWindow.loadURL('app://localhost/index.html')
  }
}

app.whenReady().then(async () => {
  // Run migrations and seed on every startup — safe because both are idempotent
  try {
    await knex.migrate.latest()
    await seed(knex)
  } catch (err) {
    console.error('DB setup failed:', err)
  }

  // Serve renderer files via app:// protocol
  const rendererDir = join(__dirname, '../dist-renderer')
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const urlPath = pathname === '/' || pathname === '' ? 'index.html' : pathname.replace(/^\//, '')
    return net.fetch(pathToFileURL(join(rendererDir, urlPath)).href)
  })

  // Register all IPC handlers before creating the window
  registerAuthHandlers()
  registerInventoryHandlers()
  registerSalesHandlers()
  registerReceiptHandlers()
  registerReportHandlers()
  registerZReportHandlers()
  registerSettingsHandlers()
  registerDbHandlers()
  registerBranchHandlers()
  registerCustomerHandlers()
  registerCreditHandlers()
  registerExpenseHandlers()
  registerPrintHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
