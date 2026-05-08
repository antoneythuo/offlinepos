// IPC handlers for expense tracking — Task 16
// Channels: expenses:list, expenses:create, expenses:delete, expenses:categories:list
// Requirements: 25.1–25.5

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { ExpenseService } from '../../src/services/ExpenseService'
import { sessionManager } from '../../src/services/SessionManager'
import type { Expense, ExpenseCategory } from '../../src/types/index'

export function registerExpenseHandlers(): void {
  const service = new ExpenseService()

  registerHandler<ExpenseCategory[]>('expenses:categories:list', async () => {
    requirePermission('expenses')
    return service.listCategories()
  })

  registerHandler<ExpenseCategory>('expenses:categories:create', async (payload) => {
    requirePermission('expenses')
    const { name } = payload as { name: string }
    return service.createCategory(name)
  })

  registerHandler<Expense[]>('expenses:list', async (payload) => {
    requirePermission('expenses')
    const { dateFrom, dateTo, categoryId } = (payload ?? {}) as {
      dateFrom?: string
      dateTo?: string
      categoryId?: number
    }
    return service.list({ dateFrom, dateTo, categoryId })
  })

  registerHandler<Expense>('expenses:create', async (payload) => {
    requirePermission('expenses')
    const session = sessionManager.getSession()
    const p = payload as Omit<Parameters<ExpenseService['create']>[0], 'recordedBy'>
    return service.create({ ...p, recordedBy: session?.id ?? 0 })
  })

  registerHandler<void>('expenses:delete', async (payload) => {
    requirePermission('expenses')
    const session = sessionManager.getSession()
    const { id } = payload as { id: number }
    return service.delete(id, session?.id ?? 0)
  })
}
