// SettingsPage — Tasks 28.3, 28.4, 28.5, 28.6
// Requirements: 22.1–22.7, 25.1–25.5, 29.1–29.5, 30.1–30.5
//
// Tabbed settings page with sections:
//   Business Info, Receipt, Tax, Theme, Printer, Users & Roles (Admin only), Backup
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Branch, IpcResult, Role, User } from '../../../src/types'
import { useSessionStore } from '../store/sessionStore'
import { useThemeStore } from '../store/themeStore'

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputCls = `
  w-full min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  disabled:opacity-50
`

interface FieldLabelProps { htmlFor: string; children: React.ReactNode }
function FieldLabel({ htmlFor, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
    </label>
  )
}

interface SectionCardProps { title: string; children: React.ReactNode }
function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'business' | 'receipt' | 'tax' | 'theme' | 'printer' | 'users' | 'backup' | 'branch'

interface Tab { id: TabId; label: string; adminOnly?: boolean }
const TABS: Tab[] = [
  { id: 'business', label: 'Business Info' },
  { id: 'receipt',  label: 'Receipt' },
  { id: 'tax',      label: 'Tax' },
  { id: 'theme',    label: 'Theme' },
  { id: 'printer',  label: 'Printer' },
  { id: 'users',    label: 'Users & Roles', adminOnly: true },
  { id: 'backup',   label: 'Backup' },
  { id: 'branch',   label: 'Branch', adminOnly: true },
]

// ─── BranchSection (Task 33.6) ───────────────────────────────────────────────

function BranchSection(): React.ReactElement {
  const [multiBranchMode, setMultiBranchMode] = useState(false)
  const [currentBranchId, setCurrentBranchId] = useState<string>('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load current settings
  useEffect(() => {
    window.api
      .invoke<IpcResult<Record<string, string>>>('settings:getAll', {})
      .then((r) => {
        if (r.success) {
          setMultiBranchMode(r.data['multi_branch_mode'] === 'true')
          setCurrentBranchId(r.data['current_branch_id'] ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [])

  // Load branches when multi-branch mode is enabled
  useEffect(() => {
    if (!multiBranchMode) return
    setLoadingBranches(true)
    window.api
      .invoke<IpcResult<Branch[]>>('branches:list', {})
      .then((r) => {
        if (r.success) setBranches(r.data)
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false))
  }, [multiBranchMode])

  const handleToggleMultiBranch = async (enabled: boolean) => {
    setMultiBranchMode(enabled)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const r = await window.api.invoke<IpcResult<void>>('settings:set', {
        key: 'multi_branch_mode',
        value: String(enabled),
      })
      if (!r.success) setSaveError(r.error)
    } catch {
      setSaveError('Failed to save setting.')
    }
  }

  const handleSaveBranch = async () => {
    if (!currentBranchId) {
      setSaveError('Please select a branch for this terminal.')
      return
    }
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const r = await window.api.invoke<IpcResult<void>>('settings:set', {
        key: 'current_branch_id',
        value: currentBranchId,
      })
      if (r.success) {
        setSaveMsg('Branch assignment saved.')
        setTimeout(() => setSaveMsg(null), 3000)
      } else {
        setSaveError(r.error)
      }
    } catch {
      setSaveError('Failed to save branch assignment.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingSettings) {
    return (
      <SectionCard title="Branch">
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Branch">
      <div className="flex flex-col gap-5">
        {/* Multi-branch mode toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Multi-Branch Mode
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enable to associate transactions and inventory with specific branches.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={multiBranchMode}
            onClick={() => handleToggleMultiBranch(!multiBranchMode)}
            aria-label={multiBranchMode ? 'Disable multi-branch mode' : 'Enable multi-branch mode'}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[44px] min-h-[44px] ${multiBranchMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${multiBranchMode ? 'translate-x-8' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* Branch selector — only shown when multi-branch mode is enabled */}
        {multiBranchMode && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <FieldLabel htmlFor="s-branch">Terminal Branch Assignment</FieldLabel>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Select the branch this terminal belongs to. All transactions on this terminal will be
              associated with the selected branch.
            </p>
            {loadingBranches ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Loading branches…</p>
            ) : (
              <>
                <select
                  id="s-branch"
                  value={currentBranchId}
                  onChange={(e) => {
                    setCurrentBranchId(e.target.value)
                    setSaveMsg(null)
                    setSaveError(null)
                  }}
                  className={inputCls}
                >
                  <option value="">Select branch…</option>
                  {branches
                    .filter((b) => b.isActive)
                    .map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                        {b.address ? ` — ${b.address}` : ''}
                      </option>
                    ))}
                </select>
                {branches.filter((b) => b.isActive).length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    No active branches found. Please create a branch first.
                  </p>
                )}
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    disabled={saving || !currentBranchId}
                    onClick={handleSaveBranch}
                    className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save Branch Assignment'}
                  </button>
                </div>
              </>
            )}
            {saveMsg && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">{saveMsg}</p>
            )}
            {saveError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── BackupSection (Task 28.6) ────────────────────────────────────────────────

function BackupSection(): React.ReactElement {
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [scheduleTime, setScheduleTime] = useState('02:00')
  const [backingUp, setBackingUp] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .invoke<IpcResult<Record<string, string>>>('settings:getAll', {})
      .then((r) => {
        if (r.success) {
          setLastBackup(r.data['last_backup'] ?? null)
          if (r.data['backup_schedule_time']) setScheduleTime(r.data['backup_schedule_time'])
        }
      })
      .catch(() => {})
  }, [])

  const handleBackupNow = async () => {
    setBackingUp(true)
    setBackupMsg(null)
    setBackupError(null)
    try {
      const r = await window.api.invoke<IpcResult<{ filePath: string }>>('backup:create', {})
      if (r.success) {
        setBackupMsg(`Backup saved to: ${r.data.filePath}`)
        setLastBackup(new Date().toISOString())
      } else {
        setBackupError(r.error)
      }
    } catch {
      setBackupError('Backup failed. Please try again.')
    } finally {
      setBackingUp(false)
    }
  }

  const handleScheduleSave = async () => {
    setScheduleSaving(true)
    setScheduleMsg(null)
    try {
      const r = await window.api.invoke<IpcResult<void>>('backup:schedule', { time: scheduleTime })
      if (r.success) {
        setScheduleMsg('Schedule saved.')
        await window.api.invoke('settings:set', { key: 'backup_schedule_time', value: scheduleTime })
      }
    } catch {
      // ignore
    } finally {
      setScheduleSaving(false)
    }
  }

  const handleRestore = async () => {
    setShowRestoreConfirm(false)
    setRestoring(true)
    setRestoreError(null)
    try {
      const r = await window.api.invoke<IpcResult<void>>('backup:restore', { confirm: true })
      if (!r.success) setRestoreError(r.error)
    } catch {
      setRestoreError('Restore failed. Please try again.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <SectionCard title="Backup & Restore">
      <div className="flex flex-col gap-5">
        {/* Last backup */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Last backup</p>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {lastBackup
                ? new Date(lastBackup).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Backup Now */}
        <div>
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={backingUp}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {backingUp ? 'Backing up…' : 'Backup Now'}
          </button>
          {backupMsg && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{backupMsg}</p>}
          {backupError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{backupError}</p>}
        </div>

        {/* Schedule */}
        <div>
          <FieldLabel htmlFor="backup-time">Daily Backup Time</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              id="backup-time"
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className={`${inputCls} max-w-[160px]`}
            />
            <button
              type="button"
              onClick={handleScheduleSave}
              disabled={scheduleSaving}
              className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 transition-colors"
            >
              {scheduleSaving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
          {scheduleMsg && <p className="mt-1 text-sm text-green-600 dark:text-green-400">{scheduleMsg}</p>}
        </div>

        {/* Restore */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Restore the database from a backup file. This will overwrite all current data.
          </p>
          <button
            type="button"
            onClick={() => setShowRestoreConfirm(true)}
            disabled={restoring}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 transition-colors"
          >
            {restoring ? 'Restoring…' : 'Restore from File'}
          </button>
          {restoreError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{restoreError}</p>}
        </div>
      </div>

      {/* Restore confirmation dialog */}
      {showRestoreConfirm && (
        <div role="alertdialog" aria-modal="true" aria-label="Confirm restore"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Restore database?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This will overwrite all current data with the backup. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowRestoreConfirm(false)}
                className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleRestore}
                className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors">
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── RoleManagementSection (Task 28.5) ───────────────────────────────────────

const ALL_PERMISSIONS = [
  { key: 'sales',            label: 'Sales' },
  { key: 'inventory_view',   label: 'Inventory (View)' },
  { key: 'inventory',        label: 'Inventory (Edit)' },
  { key: 'reports',          label: 'Reports' },
  { key: 'audit_logs',       label: 'Audit Log' },
  { key: 'user_management',  label: 'User Management' },
  { key: 'credit_view',      label: 'Credit (View)' },
  { key: 'credit',           label: 'Credit (Manage)' },
  { key: 'customers',        label: 'Customers' },
  { key: 'expenses',         label: 'Expenses' },
  { key: 'settings',         label: 'Settings' },
]

interface RoleFormState {
  name: string
  permissions: Record<string, boolean>
}

function emptyRoleForm(): RoleFormState {
  return {
    name: '',
    permissions: Object.fromEntries(ALL_PERMISSIONS.map((p) => [p.key, false])),
  }
}

function roleToForm(role: Role): RoleFormState {
  return {
    name: role.name,
    permissions: Object.fromEntries(
      ALL_PERMISSIONS.map((p) => [p.key, !!role.permissions[p.key]])
    ),
  }
}

function RoleManagementSection(): React.ReactElement {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Role | null>(null)
  const [form, setForm] = useState<RoleFormState>(emptyRoleForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const r = await window.api.invoke<IpcResult<Role[]>>('auth:roles:list', {})
      if (r.success) setRoles(r.data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadRoles() }, [loadRoles])

  useEffect(() => {
    if (showCreate || editTarget) setTimeout(() => nameRef.current?.focus(), 50)
  }, [showCreate, editTarget])

  const togglePerm = (key: string) => {
    setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }))
  }

  const openEdit = (role: Role) => {
    setEditTarget(role)
    setForm(roleToForm(role))
    setFormError(null)
    setShowCreate(false)
  }

  const closeForm = () => {
    setShowCreate(false)
    setEditTarget(null)
    setForm(emptyRoleForm())
    setFormError(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Role name is required'); return }
    setSaving(true)
    setFormError(null)
    try {
      let r: IpcResult<Role>
      if (editTarget) {
        r = await window.api.invoke<IpcResult<Role>>('auth:roles:update', {
          id: editTarget.id,
          name: form.name.trim(),
          permissions: form.permissions,
        })
      } else {
        r = await window.api.invoke<IpcResult<Role>>('auth:roles:create', {
          name: form.name.trim(),
          permissions: form.permissions,
        })
      }
      if (r.success) { closeForm(); loadRoles() }
      else setFormError(r.error)
    } catch { setFormError('Failed to save role.') }
    finally { setSaving(false) }
  }

  const permSummary = (perms: Record<string, boolean>) =>
    ALL_PERMISSIONS.filter((p) => perms[p.key]).map((p) => p.label).join(', ') || 'No permissions'

  const isFormOpen = showCreate || editTarget !== null

  return (
    <SectionCard title="Role Management">
      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading roles…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Role Name</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Permissions</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {roles.map((role) => (
                  <tr key={role.id} className={`bg-white dark:bg-gray-800 ${editTarget?.id === role.id ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{role.name}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-[300px]">
                      <span className="line-clamp-2">{permSummary(role.permissions)}</span>
                    </td>
                    <td className="px-4 py-2">
                      {role.isSystem
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">System</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Custom</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openEdit(role)}
                        aria-label={`Edit ${role.name}`}
                        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create / Edit form */}
        {!isFormOpen ? (
          <button type="button" onClick={() => { setShowCreate(true); setForm(emptyRoleForm()); setFormError(null) }}
            className="self-start inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Role
          </button>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 bg-gray-50 dark:bg-gray-700/30">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editTarget ? `Edit Role — ${editTarget.name}` : 'New Role'}
            </h3>
            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
            <div>
              <FieldLabel htmlFor="role-name">Role Name</FieldLabel>
              <input ref={nameRef} id="role-name" type="text" value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Supervisor" className={inputCls} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm.key} className="flex items-center gap-2 cursor-pointer min-h-[44px] px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <input type="checkbox" checked={!!form.permissions[perm.key]} onChange={() => togglePerm(perm.key)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeForm}
                className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── UserManagementSection (Task 28.4) ───────────────────────────────────────

interface UserFormState {
  username: string
  fullName: string
  pin: string
  roleId: string
}

function emptyUserForm(): UserFormState {
  return { username: '', fullName: '', pin: '', roleId: '' }
}

function userToForm(u: User): UserFormState {
  return { username: u.username, fullName: u.fullName, pin: '', roleId: String(u.roleId) }
}

interface UserModalProps {
  user: User | null
  roles: Role[]
  onClose: () => void
  onSaved: () => void
}

function UserModal({ user, roles, onClose, onSaved }: UserModalProps): React.ReactElement {
  const isEdit = user !== null
  const [form, setForm] = useState<UserFormState>(() => isEdit ? userToForm(user!) : emptyUserForm())
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { firstRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function setField<K extends keyof UserFormState>(key: K, val: UserFormState[K]) {
    setForm((p) => ({ ...p, [key]: val }))
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof UserFormState, string>> = {}
    if (!form.username.trim()) errs.username = 'Username is required'
    if (!form.fullName.trim()) errs.fullName = 'Full name is required'
    if (!isEdit && !form.pin.trim()) errs.pin = 'PIN is required'
    if (form.pin && !/^\d{4,8}$/.test(form.pin)) errs.pin = 'PIN must be 4–8 digits'
    if (!form.roleId) errs.roleId = 'Role is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)
    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      roleId: parseInt(form.roleId, 10),
    }
    if (form.pin.trim()) payload.pin = form.pin.trim()
    try {
      let r: IpcResult<User>
      if (isEdit) {
        r = await window.api.invoke<IpcResult<User>>('auth:users:update', { id: user!.id, ...payload })
      } else {
        r = await window.api.invoke<IpcResult<User>>('auth:users:create', payload)
      }
      if (r.success) onSaved()
      else setSubmitError(r.error)
    } catch {
      setSubmitError('An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit user' : 'Add user'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="px-6 py-4 flex flex-col gap-4">
          {submitError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">{submitError}</div>
          )}
          <div>
            <FieldLabel htmlFor="um-username">Username</FieldLabel>
            <input ref={firstRef} id="um-username" type="text" value={form.username}
              onChange={(e) => setField('username', e.target.value)} placeholder="e.g. jdoe"
              className={inputCls} aria-invalid={!!errors.username} />
            {errors.username && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.username}</p>}
          </div>
          <div>
            <FieldLabel htmlFor="um-fullname">Full Name</FieldLabel>
            <input id="um-fullname" type="text" value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)} placeholder="e.g. Jane Doe"
              className={inputCls} aria-invalid={!!errors.fullName} />
            {errors.fullName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.fullName}</p>}
          </div>
          <div>
            <FieldLabel htmlFor="um-pin">{isEdit ? 'New PIN (leave blank to keep current)' : 'PIN'}</FieldLabel>
            <input id="um-pin" type="password" inputMode="numeric" value={form.pin}
              onChange={(e) => setField('pin', e.target.value)} placeholder="4–8 digits"
              className={inputCls} aria-invalid={!!errors.pin} />
            {errors.pin && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.pin}</p>}
          </div>
          <div>
            <FieldLabel htmlFor="um-role">Role</FieldLabel>
            <select id="um-role" value={form.roleId} onChange={(e) => setField('roleId', e.target.value)}
              className={inputCls} aria-invalid={!!errors.roleId}>
              <option value="">Select role…</option>
              {roles.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
            </select>
            {errors.roleId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.roleId}</p>}
          </div>
        </form>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} disabled={saving}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UserManagementSection(): React.ReactElement {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ur, rr] = await Promise.all([
        window.api.invoke<IpcResult<User[]>>('auth:users:list', {}),
        window.api.invoke<IpcResult<Role[]>>('auth:roles:list', {}),
      ])
      if (ur.success) setUsers(ur.data)
      if (rr.success) setRoles(rr.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleToggleActive = async (user: User) => {
    setActionError(null)
    try {
      const r = await window.api.invoke<IpcResult<User>>('auth:users:update', {
        id: user.id,
        isActive: !user.isActive,
      })
      if (r.success) loadData()
      else setActionError(r.error)
    } catch {
      setActionError('Failed to update user.')
    }
  }

  const roleName = (roleId: number) => roles.find((r) => r.id === roleId)?.name ?? `Role ${roleId}`

  return (
    <SectionCard title="User Management">
      <div className="flex flex-col gap-4">
        {actionError && (
          <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
            {actionError}
            <button type="button" onClick={() => setActionError(null)} className="ml-3 underline hover:no-underline">Dismiss</button>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading users…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Username</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Full Name</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="bg-white dark:bg-gray-800">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{user.username}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{user.fullName}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{roleName(user.roleId)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${user.isActive ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => setEditTarget(user)} title="Edit user" aria-label="Edit user"
                          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => handleToggleActive(user)}
                          title={user.isActive ? 'Deactivate user' : 'Activate user'}
                          aria-label={user.isActive ? 'Deactivate user' : 'Activate user'}
                          className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg focus:outline-none focus-visible:ring-2 transition-colors ${user.isActive ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 focus-visible:ring-amber-500' : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 focus-visible:ring-green-500'}`}>
                          {user.isActive ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" onClick={() => setShowAddModal(true)}
          className="self-start inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add User
        </button>
      </div>
      {showAddModal && (
        <UserModal user={null} roles={roles} onClose={() => setShowAddModal(false)} onSaved={() => { setShowAddModal(false); loadData() }} />
      )}
      {editTarget && (
        <UserModal user={editTarget} roles={roles} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); loadData() }} />
      )}
    </SectionCard>
  )
}

// ─── Main SettingsPage component (Task 28.3) ─────────────────────────────────

interface SettingsState {
  businessName: string
  businessAddress: string
  businessPhone: string
  receiptHeader: string
  receiptFooter: string
  taxMode: string
  taxRate: string
  printerName: string
}

function emptySettings(): SettingsState {
  return {
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    receiptHeader: '',
    receiptFooter: '',
    taxMode: 'exclusive',
    taxRate: '0',
    printerName: '',
  }
}

export default function SettingsPage(): React.ReactElement {
  const { currentUser, hasPermission } = useSessionStore()
  const { theme, toggleTheme } = useThemeStore()

  const [activeTab, setActiveTab] = useState<TabId>('business')
  const [settings, setSettings] = useState<SettingsState>(emptySettings)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isAdmin = currentUser?.roleName === 'Administrator' || hasPermission('users')

  // ── Load settings ──────────────────────────────────────────────────────────
  useEffect(() => {
    window.api
      .invoke<IpcResult<Record<string, string>>>('settings:getAll', {})
      .then((r) => {
        if (r.success) {
          const d = r.data
          setSettings({
            businessName:    d['business_name']    ?? '',
            businessAddress: d['business_address'] ?? '',
            businessPhone:   d['business_phone']   ?? '',
            receiptHeader:   d['receipt_header']   ?? '',
            receiptFooter:   d['receipt_footer']   ?? '',
            taxMode:         d['tax_mode']         ?? 'exclusive',
            taxRate:         d['default_tax_rate'] ?? '0',
            printerName:     d['printer_name']     ?? '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [])

  // ── Save a group of settings ───────────────────────────────────────────────
  const saveSettings = async (pairs: Array<[string, string]>) => {
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      for (const [key, value] of pairs) {
        const r = await window.api.invoke<IpcResult<void>>('settings:set', { key, value })
        if (!r.success) { setSaveError(r.error); return }
      }
      setSaveMsg('Settings saved.')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof SettingsState>(key: K, val: SettingsState[K]) {
    setSettings((prev) => ({ ...prev, [key]: val }))
    setSaveMsg(null)
    setSaveError(null)
  }

  // ── Visible tabs (hide Users & Roles for non-admins) ──────────────────────
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin)

  // ── Render tab content ─────────────────────────────────────────────────────
  const renderContent = () => {
    if (loadingSettings && activeTab !== 'users' && activeTab !== 'backup') {
      return <p className="text-sm text-gray-400 dark:text-gray-500">Loading settings…</p>
    }

    switch (activeTab) {
      case 'business':
        return (
          <SectionCard title="Business Information">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel htmlFor="s-bname">Business Name</FieldLabel>
                <input id="s-bname" type="text" value={settings.businessName}
                  onChange={(e) => setField('businessName', e.target.value)}
                  placeholder="e.g. My Shop" className={inputCls} />
              </div>
              <div>
                <FieldLabel htmlFor="s-baddr">Address</FieldLabel>
                <textarea id="s-baddr" value={settings.businessAddress}
                  onChange={(e) => setField('businessAddress', e.target.value)}
                  placeholder="Street, city, postal code…" rows={2}
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <FieldLabel htmlFor="s-bphone">Phone</FieldLabel>
                <input id="s-bphone" type="tel" value={settings.businessPhone}
                  onChange={(e) => setField('businessPhone', e.target.value)}
                  placeholder="e.g. +254 700 000 000" className={inputCls} />
              </div>
              <div className="flex justify-end">
                <button type="button" disabled={saving} onClick={() => saveSettings([
                  ['business_name', settings.businessName],
                  ['business_address', settings.businessAddress],
                  ['business_phone', settings.businessPhone],
                ])}
                  className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </SectionCard>
        )

      case 'receipt':
        return (
          <SectionCard title="Receipt Settings">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel htmlFor="s-rheader">Receipt Header</FieldLabel>
                <textarea id="s-rheader" value={settings.receiptHeader}
                  onChange={(e) => setField('receiptHeader', e.target.value)}
                  placeholder="Text shown at the top of the receipt…" rows={3}
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <FieldLabel htmlFor="s-rfooter">Receipt Footer</FieldLabel>
                <textarea id="s-rfooter" value={settings.receiptFooter}
                  onChange={(e) => setField('receiptFooter', e.target.value)}
                  placeholder="e.g. Thank you for shopping with us!" rows={3}
                  className={`${inputCls} resize-none`} />
              </div>
              <div className="flex justify-end">
                <button type="button" disabled={saving} onClick={() => saveSettings([
                  ['receipt_header', settings.receiptHeader],
                  ['receipt_footer', settings.receiptFooter],
                ])}
                  className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </SectionCard>
        )

      case 'tax':
        return (
          <SectionCard title="Tax Settings">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel htmlFor="s-taxmode">Tax Mode</FieldLabel>
                <select id="s-taxmode" value={settings.taxMode}
                  onChange={(e) => setField('taxMode', e.target.value)}
                  className={inputCls}>
                  <option value="exclusive">Tax Exclusive (tax added on top)</option>
                  <option value="inclusive">Tax Inclusive (tax included in price)</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="s-taxrate">Default Tax Rate (%)</FieldLabel>
                <input id="s-taxrate" type="number" min="0" max="100" step="0.01"
                  value={settings.taxRate}
                  onChange={(e) => setField('taxRate', e.target.value)}
                  className={inputCls} />
              </div>
              <div className="flex justify-end">
                <button type="button" disabled={saving} onClick={() => saveSettings([
                  ['tax_mode', settings.taxMode],
                  ['default_tax_rate', settings.taxRate],
                ])}
                  className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </SectionCard>
        )

      case 'theme':
        return (
          <SectionCard title="Theme">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Switch between dark and light interface themes.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  toggleTheme()
                  const newTheme = theme === 'dark' ? 'light' : 'dark'
                  await window.api.invoke('settings:set', { key: 'theme', value: newTheme }).catch(() => {})
                }}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-[44px] min-h-[44px] ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
          </SectionCard>
        )

      case 'printer':
        return (
          <SectionCard title="Printer">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel htmlFor="s-printer">Printer Name</FieldLabel>
                <input id="s-printer" type="text" value={settings.printerName}
                  onChange={(e) => setField('printerName', e.target.value)}
                  placeholder="e.g. POS-80 Thermal Printer" className={inputCls} />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter the exact printer name as it appears in your system's printer list.
                </p>
              </div>
              <div className="flex justify-end">
                <button type="button" disabled={saving} onClick={() => saveSettings([
                  ['printer_name', settings.printerName],
                ])}
                  className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </SectionCard>
        )

      case 'users':
        return (
          <div className="flex flex-col gap-6">
            <UserManagementSection />
            <RoleManagementSection />
          </div>
        )

      case 'backup':
        return <BackupSection />

      case 'branch':
        return <BranchSection />

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        <nav className="shrink-0 w-48 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto py-2" aria-label="Settings sections">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setSaveMsg(null); setSaveError(null) }}
              className={`w-full text-left min-h-[44px] px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Save feedback */}
          {saveMsg && (
            <div role="status" className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
              {saveMsg}
            </div>
          )}
          {saveError && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {saveError}
              <button type="button" onClick={() => setSaveError(null)} className="ml-3 underline hover:no-underline">Dismiss</button>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
