// IPC handlers for customer management — Task 14
// Channels: customers:list, customers:create, customers:update, customers:delete,
//           customers:history, customers:debt
// Requirements: 21.1–21.5

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { CustomerService } from '../../src/services/CustomerService'
import type { Customer, Transaction } from '../../src/types/index'

export function registerCustomerHandlers(): void {
  const service = new CustomerService()

  registerHandler<Customer[]>('customers:list', async (payload) => {
    requirePermission('customers')
    const { query } = (payload ?? {}) as { query?: string }
    return service.list(query)
  })

  registerHandler<Customer>('customers:create', async (payload) => {
    requirePermission('customers')
    return service.create(payload as Parameters<CustomerService['create']>[0])
  })

  registerHandler<Customer>('customers:update', async (payload) => {
    requirePermission('customers')
    const { id, ...rest } = payload as { id: number } & Parameters<CustomerService['update']>[1]
    return service.update(id, rest)
  })

  registerHandler<void>('customers:delete', async (payload) => {
    requirePermission('customers')
    const { id } = payload as { id: number }
    return service.delete(id)
  })

  registerHandler<Transaction[]>('customers:history', async (payload) => {
    requirePermission('customers')
    const { customerId } = payload as { customerId: number }
    return service.getPurchaseHistory(customerId)
  })

  registerHandler<{ outstandingDebt: number; creditLimit: number }>('customers:debt', async (payload) => {
    requirePermission('customers')
    const { customerId } = payload as { customerId: number }
    return service.getOutstandingDebt(customerId)
  })
}
