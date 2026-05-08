// ProductFormModal — Task 25.2
// SKU auto-generated. Category, Brand, Reorder Point removed from UI.

import React, { useEffect, useRef, useState } from 'react'
import type { IpcResult, Product, UnitOfMeasure } from '../../../../src/types'

export interface ProductFormModalProps {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  name: string
  sku: string
  unitId: string
  costPrice: string
  sellingPrice: string
  taxRate: string
  taxInclusive: boolean
  batchTracking: boolean
  barcode: string
  quantityOnHand: string
}

function emptyForm(): FormState {
  return {
    name: '',
    sku: '1',
    unitId: '',
    costPrice: '0',
    sellingPrice: '0',
    taxRate: '0',
    taxInclusive: false,
    batchTracking: false,
    barcode: '',
    quantityOnHand: '0',
  }
}

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    sku: p.sku,
    unitId: String(p.unitId),
    costPrice: String(p.costPrice),
    sellingPrice: String(p.sellingPrice),
    taxRate: String(p.taxRate),
    taxInclusive: p.taxInclusive,
    batchTracking: p.batchTracking,
    barcode: p.barcode ?? '',
    quantityOnHand: String(p.quantityOnHand),
  }
}

interface LabelProps { htmlFor: string; children: React.ReactNode; required?: boolean }
function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
    </label>
  )
}

const inputCls = `
  w-full min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  disabled:opacity-50
`

export default function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const isEdit = product !== null
  const firstInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>(() =>
    isEdit ? productToForm(product!) : emptyForm()
  )
  const [units, setUnits] = useState<UnitOfMeasure[]>([])
  const [defaultCategoryId, setDefaultCategoryId] = useState<number>(1)
  const [defaultUnitId, setDefaultUnitId] = useState<number>(1)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.invoke<IpcResult<UnitOfMeasure[]>>('inventory:unit:list', {}).then((r) => {
      if (r.success && r.data.length > 0) {
        setUnits(r.data)
        setDefaultUnitId(r.data[0].id)
        if (!isEdit) setForm((prev) => ({ ...prev, unitId: String(r.data[0].id) }))
      }
    }).catch(() => {})

    window.api.invoke<IpcResult<{ id: number; name: string }[]>>('inventory:category:list', {}).then((r) => {
      if (r.success && r.data.length > 0) {
        // Prefer "General" category, fall back to first
        const general = r.data.find((c) => c.name === 'General') ?? r.data[0]
        setDefaultCategoryId(general.id)
      }
    }).catch(() => {})

    if (!isEdit) {
      window.api.invoke<IpcResult<{ sku: string }>>('inventory:product:nextSku', {}).then((r) => {
        if (r.success) setForm((prev) => ({ ...prev, sku: r.data.sku }))
      }).catch(() => {})
    }
  }, [isEdit])

  useEffect(() => { firstInputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    const cost = parseFloat(form.costPrice)
    if (isNaN(cost) || cost < 0) errs.costPrice = 'Cost price must be ≥ 0'
    const sell = parseFloat(form.sellingPrice)
    if (isNaN(sell) || sell < 0) errs.sellingPrice = 'Selling price must be ≥ 0'
    if (!isNaN(cost) && !isNaN(sell) && sell < cost) errs.sellingPrice = `Selling price must be ≥ cost price (${cost})`
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)

    const resolvedUnitId = form.unitId ? Number(form.unitId) : defaultUnitId
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      categoryId: defaultCategoryId,
      unitId: resolvedUnitId,
      costPrice: parseFloat(form.costPrice),
      sellingPrice: parseFloat(form.sellingPrice),
      taxRate: parseFloat(form.taxRate) || 0,
      taxInclusive: form.taxInclusive,
      reorderPoint: 0,
      quantityOnHand: parseFloat(form.quantityOnHand) || 0,
      batchTracking: form.batchTracking,
      barcode: form.barcode.trim() || undefined,
    }

    try {
      let result: IpcResult<Product>
      if (isEdit) {
        result = await window.api.invoke<IpcResult<Product>>('inventory:product:update', { id: product!.id, ...payload })
      } else {
        result = await window.api.invoke<IpcResult<Product>>('inventory:product:create', payload)
      }
      if (result.success) {
        onSaved()
      } else {
        setSubmitError(result.error)
      }
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit product' : 'Add product'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-6 py-4">
          {submitError && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <Label htmlFor="pf-name" required>Product Name</Label>
              <input ref={firstInputRef} id="pf-name" type="text" value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Mineral Water 500ml"
                className={inputCls} aria-invalid={!!errors.name} />
              {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

            {/* SKU — auto-generated, read-only on create */}
            <div>
              <Label htmlFor="pf-sku">SKU</Label>
              <input id="pf-sku" type="text" value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                readOnly={!isEdit}
                className={`${inputCls} ${!isEdit ? 'bg-gray-50 dark:bg-gray-700/50 cursor-default' : ''}`} />
            </div>

            {/* Barcode */}
            <div>
              <Label htmlFor="pf-barcode">Barcode</Label>
              <input id="pf-barcode" type="text" value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                placeholder="Scan or enter barcode"
                className={inputCls} />
            </div>

            {/* Unit — only shown when multiple units exist */}
            {units.length > 1 && (
              <div className="sm:col-span-2">
                <Label htmlFor="pf-unit">Unit of Measure</Label>
                <select id="pf-unit" value={form.unitId}
                  onChange={(e) => set('unitId', e.target.value)}
                  className={inputCls}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cost Price */}
            <div>
              <Label htmlFor="pf-cost" required>Cost Price</Label>
              <input id="pf-cost" type="number" min="0" step="0.01" value={form.costPrice}
                onChange={(e) => set('costPrice', e.target.value)}
                className={inputCls} aria-invalid={!!errors.costPrice} />
              {errors.costPrice && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.costPrice}</p>}
            </div>

            {/* Selling Price */}
            <div>
              <Label htmlFor="pf-sell" required>Selling Price</Label>
              <input id="pf-sell" type="number" min="0" step="0.01" value={form.sellingPrice}
                onChange={(e) => set('sellingPrice', e.target.value)}
                className={inputCls} aria-invalid={!!errors.sellingPrice} />
              {errors.sellingPrice && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.sellingPrice}</p>}
            </div>

            {/* Quantity in Stock */}
            <div>
              <Label htmlFor="pf-qty">Quantity in Stock</Label>
              <input id="pf-qty" type="number" min="0" step="1" value={form.quantityOnHand}
                onChange={(e) => set('quantityOnHand', e.target.value)}
                className={inputCls} />
            </div>

            {/* Tax Rate */}
            <div>
              <Label htmlFor="pf-tax">Tax Rate (%)</Label>
              <input id="pf-tax" type="number" min="0" max="100" step="0.01" value={form.taxRate}
                onChange={(e) => set('taxRate', e.target.value)}
                className={inputCls} />
            </div>

            {/* Tax Inclusive */}
            <div className="flex items-center gap-3 min-h-[44px]">
              <button type="button" role="switch" aria-checked={form.taxInclusive}
                onClick={() => set('taxInclusive', !form.taxInclusive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${form.taxInclusive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${form.taxInclusive ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Tax Inclusive</span>
            </div>

            {/* Batch Tracking */}
            <div className="flex items-center gap-3 min-h-[44px]">
              <button type="button" role="switch" aria-checked={form.batchTracking}
                onClick={() => set('batchTracking', !form.batchTracking)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${form.batchTracking ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${form.batchTracking ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Batch Tracking</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button type="button" onClick={onClose} disabled={saving}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} onClick={handleSubmit}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
