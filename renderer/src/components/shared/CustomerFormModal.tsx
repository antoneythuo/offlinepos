// CustomerFormModal — Task 26.2
// Requirements: 21.1
//
// Create or edit a customer. When `customer` prop is null, runs in create mode;
// otherwise pre-fills fields for editing.
// Fields: name (required), phone, email, address, credit limit
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useEffect, useRef, useState } from 'react'
import type { Customer, IpcResult } from '../../../../src/types'

export interface CustomerFormModalProps {
  /** null = create mode, non-null = edit mode */
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  name: string
  phone: string
  email: string
  address: string
}

function emptyForm(): FormState {
  return { name: '', phone: '', email: '', address: '' }
}

function customerToForm(c: Customer): FormState {
  return {
    name: c.name,
    phone: c.phone ?? '',
    email: c.email ?? '',
    address: c.address ?? '',
  }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerFormModal({ customer, onClose, onSaved }: CustomerFormModalProps) {
  const isEdit = customer !== null
  const firstInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>(() =>
    isEdit ? customerToForm(customer!) : emptyForm()
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Focus first field on mount
  useEffect(() => { firstInputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Enter a valid email address'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      creditLimit: 0,
    }

    try {
      let result: IpcResult<Customer>
      if (isEdit) {
        result = await window.api.invoke<IpcResult<Customer>>('customers:update', {
          id: customer!.id,
          ...payload,
        })
      } else {
        result = await window.api.invoke<IpcResult<Customer>>('customers:create', payload)
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
      aria-label={isEdit ? 'Edit customer' : 'Add customer'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        w-full max-w-lg max-h-[90vh] flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              min-w-[44px] min-h-[44px] flex items-center justify-center
              rounded-lg text-gray-400 dark:text-gray-500
              hover:bg-gray-100 dark:hover:bg-gray-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              transition-colors
            "
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-6 py-4">
          {submitError && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Name */}
            <div>
              <Label htmlFor="cf-name" required>Full Name</Label>
              <input
                ref={firstInputRef}
                id="cf-name"
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Jane Doe"
                className={inputCls}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'cf-name-err' : undefined}
              />
              {errors.name && <p id="cf-name-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="cf-phone">Phone Number</Label>
              <input
                id="cf-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="e.g. +254 700 000 000"
                className={inputCls}
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="cf-email">Email Address</Label>
              <input
                id="cf-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="e.g. jane@example.com"
                className={inputCls}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'cf-email-err' : undefined}
              />
              {errors.email && <p id="cf-email-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="cf-address">Address</Label>
              <textarea
                id="cf-address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Street, city, postal code…"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              disabled:opacity-50 transition-colors
            "
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-blue-600 hover:bg-blue-700
              text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              disabled:opacity-50 transition-colors
            "
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
