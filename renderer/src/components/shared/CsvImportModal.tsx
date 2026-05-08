// CsvImportModal — Task 25.5
// Requirements: 8.1–8.4
//
// Triggers the Electron file-picker dialog via `inventory:csv:import` IPC,
// shows import progress, and displays a table of rejected rows with row
// numbers and error messages (Req 8.2).

import React, { useEffect, useState } from 'react'
import type { IpcResult } from '../../../../src/types'

export interface CsvImportModalProps {
  onClose: () => void
  onImported: () => void
}

type ImportState = 'idle' | 'importing' | 'done' | 'error'

interface ImportError {
  row: number
  message: string
}

export default function CsvImportModal({ onClose, onImported }: CsvImportModalProps) {
  const [state, setState] = useState<ImportState>('idle')
  const [importedCount, setImportedCount] = useState(0)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [fatalError, setFatalError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleImport() {
    setState('importing')
    setFatalError(null)
    setImportErrors([])
    setImportedCount(0)

    try {
      const result = await window.api.invoke<IpcResult<{ imported: number; errors: ImportError[] }>>(
        'inventory:csv:import',
        {}
      )

      if (result.success) {
        setImportedCount(result.data.imported)
        setImportErrors(result.data.errors ?? [])
        setState('done')
        if (result.data.imported > 0) {
          onImported()
        }
      } else {
        setFatalError(result.error)
        setState('error')
      }
    } catch {
      setFatalError('An unexpected error occurred. Please try again.')
      setState('error')
    }
  }

  const hasErrors = importErrors.length > 0
  const isDone = state === 'done'
  const isImporting = state === 'importing'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import CSV"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isImporting) onClose() }}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        w-full max-w-2xl max-h-[85vh] flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Products from CSV</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            aria-label="Close"
            className="
              min-w-[44px] min-h-[44px] flex items-center justify-center
              rounded-lg text-gray-400 dark:text-gray-500
              hover:bg-gray-100 dark:hover:bg-gray-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              disabled:opacity-50 transition-colors
            "
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Idle / instructions */}
          {state === 'idle' && (
            <div className="space-y-4">
              <div className="
                flex flex-col items-center justify-center gap-3
                px-6 py-8 rounded-xl
                border-2 border-dashed border-gray-300 dark:border-gray-600
                bg-gray-50 dark:bg-gray-700/30
              ">
                <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Click "Choose File" to open the file picker
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Accepts CSV files with columns: sku, name, category, unit, cost_price, selling_price
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Required columns:</p>
                <p className="font-mono text-xs">sku, name, category, unit, cost_price, selling_price</p>
                <p className="mt-1 text-xs">Optional: brand, tax_rate, reorder_point, barcode, batch_tracking</p>
              </div>
            </div>
          )}

          {/* Importing — progress indicator */}
          {isImporting && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Importing products…</p>
            </div>
          )}

          {/* Fatal error */}
          {state === 'error' && fatalError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {fatalError}
            </div>
          )}

          {/* Done — results */}
          {isDone && (
            <div className="space-y-4">
              {/* Success summary */}
              <div className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border text-sm
                ${importedCount > 0
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                  : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }
              `}>
                {importedCount > 0 ? (
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                )}
                <span>
                  <strong>{importedCount}</strong> product{importedCount !== 1 ? 's' : ''} imported successfully.
                  {hasErrors && (
                    <span className="ml-1">
                      <strong>{importErrors.length}</strong> row{importErrors.length !== 1 ? 's' : ''} rejected.
                    </span>
                  )}
                </span>
              </div>

              {/* Error table (Req 8.2) */}
              {hasErrors && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Rejected Rows ({importErrors.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-red-200 dark:border-red-800">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                          <th scope="col" className="px-4 py-2.5 font-semibold text-red-700 dark:text-red-300 whitespace-nowrap w-20">
                            Row #
                          </th>
                          <th scope="col" className="px-4 py-2.5 font-semibold text-red-700 dark:text-red-300">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                        {importErrors.map((err, i) => (
                          <tr key={i} className="bg-white dark:bg-gray-800">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {err.row}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                              {err.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              disabled:opacity-50 transition-colors
            "
          >
            {isDone ? 'Close' : 'Cancel'}
          </button>

          {(state === 'idle' || state === 'error') && (
            <button
              type="button"
              onClick={handleImport}
              className="
                inline-flex items-center gap-2
                min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
                bg-blue-600 hover:bg-blue-700
                text-white
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                transition-colors
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Choose File &amp; Import
            </button>
          )}

          {isDone && importErrors.length > 0 && (
            <button
              type="button"
              onClick={() => { setState('idle'); setImportErrors([]); setImportedCount(0) }}
              className="
                min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
                bg-blue-600 hover:bg-blue-700
                text-white
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                transition-colors
              "
            >
              Import Another File
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
