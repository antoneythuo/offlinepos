import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

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
    // Production: load from built files
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
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
    // On macOS, re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS, keep app running until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('second-instance', () => {
  // Focus the existing window if a second instance is launched
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
