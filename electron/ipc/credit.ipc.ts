// IPC handlers for credit management — Task 13
// Channels: credit:pay, credit:statement, credit:listOpen
// Requirements: 19.1–19.5, 20.1–20.6

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { CreditService } from '../../src/services/CreditService'
import type { CreditBalance, RecordCreditPaymentPayload, Transaction } from '../../src/types/index'

export function registerCreditHandlers(): void {
  const service = new CreditService()

  registerHandler<CreditBalance>('credit:pay', async (payload) => {
    requirePermission('credit')
    return service.recordPayment(payload as RecordCreditPaymentPayload)
  })

  registerHandler<{ transactions: Transaction[]; payments: unknown[] }>('credit:statement', async (payload) => {
    requirePermission('credit_view')
    const { customerId, dateRange } = payload as {
      customerId: number
      dateRange?: { from: string; to: string }
    }
    return service.getCustomerStatement(customerId, dateRange)
  })

  registerHandler<Transaction[]>('credit:listOpen', async (payload) => {
    requirePermission('credit_view')
    const { customerId } = (payload ?? {}) as { customerId?: number }
    return service.listOpen(customerId)
  })
}
