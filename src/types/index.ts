// Shared TypeScript interfaces used across main process and renderer
// These types are the single source of truth for data shapes

// ─── Auth / Users ────────────────────────────────────────────────────────────

export interface SessionUser {
  id: number
  username: string
  fullName: string
  roleId: number
  roleName: string
  permissions: Record<string, boolean>
}

export interface User {
  id: number
  username: string
  fullName: string
  roleId: number
  isActive: boolean
  createdAt: string
}

export interface Role {
  id: number
  name: string
  permissions: Record<string, boolean>
  isSystem: boolean
  createdAt: string
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface Category {
  id: number
  name: string
  description?: string
  createdAt: string
}

export interface Brand {
  id: number
  name: string
  description?: string
  createdAt: string
}

export interface UnitOfMeasure {
  id: number
  name: string
  abbreviation?: string
  createdAt: string
}

export interface Product {
  id: number
  sku: string
  name: string
  categoryId: number
  categoryName?: string
  brandId?: number
  brandName?: string
  unitId: number
  unitName?: string
  costPrice: number
  sellingPrice: number
  taxRate: number
  taxInclusive: boolean
  reorderPoint: number
  quantityOnHand: number
  barcode?: string
  batchTracking: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductBatch {
  id: number
  productId: number
  batchNumber: string
  expiryDate: string
  quantity: number
  createdAt: string
}

export interface Supplier {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
  isActive: boolean
  createdAt: string
}

export interface StockAdjustment {
  id: number
  productId: number
  adjustedBy: number
  type: 'damaged' | 'lost' | 'returned' | 'correction'
  quantity: number
  reason: string
  createdAt: string
}

// ─── Cart / Sales ─────────────────────────────────────────────────────────────

export interface CartItem {
  productId: number
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  costPrice?: number
  discountType: 'none' | 'percent' | 'fixed'
  discountValue: number
  taxRate: number
  taxInclusive: boolean
}

export interface DiscountEntry {
  type: 'none' | 'percent' | 'fixed'
  value: number
}

export interface CartSummary {
  subtotal: number
  itemDiscountTotal: number
  receiptDiscountAmount: number
  taxTotal: number
  grandTotal: number
}

export interface PaymentEntry {
  method: 'cash' | 'card' | 'mobile_money'
  amount: number
}

export interface CreateSalePayload {
  cartItems: CartItem[]
  payments: PaymentEntry[]
  customerId?: number
  discountType: 'none' | 'percent' | 'fixed'
  discountValue: number
  isCredit: boolean
  creditDueDate?: string
  cashierId: number
  /** Optional branch ID — populated when multi-branch mode is enabled (Req 31.1) */
  branchId?: number
}

export interface SaleResult {
  transactionId: number
  receiptData: ReceiptData
  changeAmount: number
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: number
  transactionRef: string
  cashierId: number
  cashierName?: string
  customerId?: number
  customerName?: string
  status: 'completed' | 'credit' | 'refunded' | 'held'
  subtotal: number
  discountType: 'none' | 'percent' | 'fixed'
  discountValue: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  creditDueDate?: string
  creditBalance?: number
  notes?: string
  createdAt: string
}

export interface TransactionItem {
  id: number
  transactionId: number
  productId: number
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discountType: 'none' | 'percent' | 'fixed'
  discountValue: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

export interface ReceiptData {
  transactionRef: string
  dateTime: string
  cashierName: string
  customerName?: string
  items: ReceiptLineItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  payments: PaymentEntry[]
  changeAmount: number
  businessName: string
  businessAddress?: string
  receiptHeader?: string
  receiptFooter?: string
  isDuplicate?: boolean
}

export interface ReceiptLineItem {
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
}

// ─── Credit ───────────────────────────────────────────────────────────────────

export interface RecordCreditPaymentPayload {
  creditTransactionId: number
  amount: number
  method: 'cash' | 'card' | 'mobile_money'
  note?: string
  cashierId: number
}

export interface CreditBalance {
  transactionId: number
  outstandingBalance: number
  status: 'credit' | 'settled'
}

export interface CreditPayment {
  id: number
  transactionId: number
  recordedBy: number
  amount: number
  method: 'cash' | 'card' | 'mobile_money'
  note?: string
  balanceAfterPayment: number
  createdAt: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
  creditLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: number
  name: string
  createdAt: string
}

export interface Expense {
  id: number
  categoryId: number
  categoryName?: string
  amount: number
  expenseDate: string
  description?: string
  recordedBy: number
  createdAt: string
}

// ─── Shifts / Z Report ────────────────────────────────────────────────────────

export interface Shift {
  id: number
  cashierId: number
  openingFloat: number
  closingFloat?: number
  expectedCash?: number
  variance?: number
  openedAt: string
  closedAt?: string
  zReportId?: number
}

export interface ZReport {
  id: number
  reportDate: string
  generatedBy: number
  totalSales: number
  totalRefunds: number
  totalDiscounts: number
  totalTax: number
  totalExpenses: number
  cashSales: number
  cardSales: number
  mobileMoneySales: number
  openingFloat: number
  expectedCash: number
  actualCash?: number
  variance?: number
  reportData: Record<string, unknown>
  createdAt: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  userId?: number
  action: string
  entityType: string
  entityId?: number
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
}

export interface AuditLog extends AuditEntry {
  id: number
  createdAt: string
}

// ─── IPC Envelope ─────────────────────────────────────────────────────────────

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string }

// ─── Branches ─────────────────────────────────────────────────────────────────

export interface Branch {
  id: number
  name: string
  address?: string
  phone?: string
  isActive: boolean
  createdAt: string
}

// ─── Cross-Branch Reporting ───────────────────────────────────────────────────

/**
 * Per-branch summary row returned by ReportService.crossBranchSummary().
 * A null branchId / branchName row represents transactions with no branch
 * assignment (unassigned).
 * Requirements 31.2
 */
export interface CrossBranchSummary {
  branchId: number | null
  branchName: string | null
  totalTransactions: number
  totalRevenue: number
  totalRefunds: number
  netSales: number
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark'

export interface AppSettings {
  businessName: string
  businessAddress?: string
  businessPhone?: string
  receiptHeader?: string
  receiptFooter?: string
  taxMode: 'inclusive' | 'exclusive'
  returnWindowDays: number
  idleTimeoutMinutes: number
  theme: ThemeMode
  printerName?: string
  backupScheduleTime?: string
  creditLimitEnforcement: boolean
}
