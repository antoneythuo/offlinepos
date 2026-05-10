// print:html IPC handler
// Creates a hidden BrowserWindow, loads receipt HTML, triggers native print dialog

import { BrowserWindow } from 'electron'
import { registerHandler } from '../../src/ipc/registerHandler'

export function registerPrintHandlers(): void {
  registerHandler<{ printed: boolean }>('print:html', async (payload) => {
    const { html } = payload as { html: string }

    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 400,
        height: 600,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })

      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; font-size:11px; width:80mm; margin:0 auto; padding:4mm; color:#000; background:#fff; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .row { display:flex; justify-content:space-between; margin:2px 0; }
  hr { border:none; border-top:1px dashed #000; margin:5px 0; }
  @media print { @page { size:80mm auto; margin:0; } body { width:80mm; } }
</style></head><body>${html}</body></html>`

      let printed = false

      win.webContents.once('did-finish-load', () => {
        if (printed) return
        printed = true

        // Small delay to ensure the renderer has fully painted before printing
        setTimeout(() => {
          win.webContents.print(
            { silent: false, printBackground: true, deviceName: '' },
            (success) => {
              win.destroy()
              resolve({ printed: success })
            }
          )
        }, 200)
      })

      win.webContents.once('did-fail-load', () => {
        win.destroy()
        reject(new Error('Failed to load receipt for printing'))
      })

      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    })
  })
}
