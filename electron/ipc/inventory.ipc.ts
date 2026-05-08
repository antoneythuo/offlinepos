// IPC handlers for inventory operations
// Channels: inventory:product:*, inventory:category:*, inventory:brand:*, inventory:unit:*
//           inventory:adjust, inventory:receipt:*, inventory:lowstock:list
//           inventory:barcode:generate, inventory:csv:*

import { dialog } from 'electron'
import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { inventoryService } from '../../src/services/InventoryService'
import { categoryService, brandService, unitService } from '../../src/services/CatalogService'
import { stockAdjustmentService } from '../../src/services/StockAdjustmentService'
import { stockReceiptService } from '../../src/services/StockReceiptService'
import { csvImportService } from '../../src/services/CsvImportService'
import { csvExportService } from '../../src/services/CsvExportService'
import { sessionManager } from '../../src/services/SessionManager'
import { generateBarcode } from '../../src/utils/barcode'
import type { Product, Category, Brand, UnitOfMeasure } from '../../src/types/index'
import type { CreateProductData } from '../../src/repositories/ProductRepository'
import type {
  CreateCategoryData,
  CreateBrandData,
  CreateUnitData,
} from '../../src/services/CatalogService'
import type { AdjustPayload, AdjustResult } from '../../src/services/StockAdjustmentService'
import type { ReceivePayload, StockReceipt, ReceiptListFilters } from '../../src/services/StockReceiptService'
import type { ImportResult } from '../../src/services/CsvImportService'

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface ProductCreatePayload extends CreateProductData {}

interface ProductUpdatePayload {
  id: number
  data: Partial<CreateProductData>
}

interface ProductDeletePayload {
  id: number
}

interface ProductSearchPayload {
  query: string
  categoryId?: number
}

interface ProductFindByIdPayload {
  id: number
}

interface CategoryCreatePayload extends CreateCategoryData {}

interface CategoryUpdatePayload {
  id: number
  data: Partial<CreateCategoryData>
}

interface CategoryDeletePayload {
  id: number
}

interface BrandCreatePayload extends CreateBrandData {}

interface BrandUpdatePayload {
  id: number
  data: Partial<CreateBrandData>
}

interface BrandDeletePayload {
  id: number
}

interface UnitCreatePayload extends CreateUnitData {}

interface UnitUpdatePayload {
  id: number
  data: Partial<CreateUnitData>
}

interface UnitDeletePayload {
  id: number
}

interface BarcodeGeneratePayload {
  sku: string
}

interface LowStockProduct extends Product {
  // Product already has quantityOnHand and reorderPoint
}

interface LowStockListPayload {
  // no filters needed — returns all products where qty <= reorder_point
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerInventoryHandlers(): void {
  // ── Product handlers ────────────────────────────────────────────────────────

  /**
   * inventory:product:create
   *
   * Creates a new product. Requires `inventory` permission.
   *
   * Payload:  `CreateProductData`
   * Response: `IpcResult<Product>`
   */
  registerHandler<Product>('inventory:product:create', async (payload) => {
    requirePermission('inventory')
    const session = sessionManager.getSession()!
    const data = payload as ProductCreatePayload
    return inventoryService.createProduct(data, session.id)
  })

  /**
   * inventory:product:update
   *
   * Updates an existing product. Requires `inventory` permission.
   *
   * Payload:  `{ id: number, data: Partial<CreateProductData> }`
   * Response: `IpcResult<Product>`
   */
  registerHandler<Product>('inventory:product:update', async (payload) => {
    requirePermission('inventory')
    const session = sessionManager.getSession()!
    const { id, data } = payload as ProductUpdatePayload
    return inventoryService.updateProduct(id, data, session.id)
  })

  /**
   * inventory:product:delete
   *
   * Soft-deletes a product. Requires `inventory` permission.
   * Rejects if the product has associated transactions.
   *
   * Payload:  `{ id: number }`
   * Response: `IpcResult<void>`
   */
  registerHandler<void>('inventory:product:delete', async (payload) => {
    requirePermission('inventory')
    const session = sessionManager.getSession()!
    const { id } = payload as ProductDeletePayload
    return inventoryService.deleteProduct(id, session.id)
  })

  /**
   * inventory:product:search
   *
   * Searches active products by name, SKU, or barcode.
   * Requires `inventory_view` permission.
   *
   * Payload:  `{ query: string, categoryId?: number }`
   * Response: `IpcResult<Product[]>`
   */
  registerHandler<Product[]>('inventory:product:search', async (payload) => {
    requirePermission('inventory_view')
    const { query, categoryId } = payload as ProductSearchPayload
    return inventoryService.searchProducts(query, categoryId)
  })

  /**
   * inventory:product:nextSku
   * Returns the next available numeric SKU based on max product ID + 1.
   * Using MAX(id) ensures the SKU is always unique and never reused.
   */
  registerHandler<{ sku: string }>('inventory:product:nextSku', async () => {
    requirePermission('inventory_view')
    const db = (await import('../../src/db/knex')).default
    const row = await db('products')
      .max('id as max_id')
      .first() as { max_id: number | null }
    const next = (row?.max_id ?? 0) + 1
    return { sku: String(next) }
  })

  /**
   * inventory:product:findById
   *
   * Retrieves a single product by ID.
   * Requires `inventory_view` permission.
   *
   * Payload:  `{ id: number }`
   * Response: `IpcResult<Product>`
   */
  registerHandler<Product>('inventory:product:findById', async (payload) => {
    requirePermission('inventory_view')
    const { id } = payload as ProductFindByIdPayload
    return inventoryService.getProduct(id)
  })

  // ── Category handlers ───────────────────────────────────────────────────────

  /**
   * inventory:category:list
   *
   * Returns all categories. Requires `inventory_view` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<Category[]>`
   */
  registerHandler<Category[]>('inventory:category:list', async () => {
    requirePermission('inventory_view')
    return categoryService.list()
  })

  /**
   * inventory:category:create
   *
   * Creates a new category. Requires `inventory` permission.
   *
   * Payload:  `{ name: string, description?: string }`
   * Response: `IpcResult<Category>`
   */
  registerHandler<Category>('inventory:category:create', async (payload) => {
    requirePermission('inventory')
    const data = payload as CategoryCreatePayload
    return categoryService.create(data)
  })

  /**
   * inventory:category:update
   *
   * Updates an existing category. Requires `inventory` permission.
   *
   * Payload:  `{ id: number, data: Partial<CreateCategoryData> }`
   * Response: `IpcResult<Category>`
   */
  registerHandler<Category>('inventory:category:update', async (payload) => {
    requirePermission('inventory')
    const { id, data } = payload as CategoryUpdatePayload
    return categoryService.update(id, data)
  })

  /**
   * inventory:category:delete
   *
   * Deletes a category. Requires `inventory` permission.
   * Rejects if any active product references this category.
   *
   * Payload:  `{ id: number }`
   * Response: `IpcResult<void>`
   */
  registerHandler<void>('inventory:category:delete', async (payload) => {
    requirePermission('inventory')
    const { id } = payload as CategoryDeletePayload
    return categoryService.delete(id)
  })

  // ── Brand handlers ──────────────────────────────────────────────────────────

  /**
   * inventory:brand:list
   *
   * Returns all brands. Requires `inventory_view` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<Brand[]>`
   */
  registerHandler<Brand[]>('inventory:brand:list', async () => {
    requirePermission('inventory_view')
    return brandService.list()
  })

  /**
   * inventory:brand:create
   *
   * Creates a new brand. Requires `inventory` permission.
   *
   * Payload:  `{ name: string, description?: string }`
   * Response: `IpcResult<Brand>`
   */
  registerHandler<Brand>('inventory:brand:create', async (payload) => {
    requirePermission('inventory')
    const data = payload as BrandCreatePayload
    return brandService.create(data)
  })

  /**
   * inventory:brand:update
   *
   * Updates an existing brand. Requires `inventory` permission.
   *
   * Payload:  `{ id: number, data: Partial<CreateBrandData> }`
   * Response: `IpcResult<Brand>`
   */
  registerHandler<Brand>('inventory:brand:update', async (payload) => {
    requirePermission('inventory')
    const { id, data } = payload as BrandUpdatePayload
    return brandService.update(id, data)
  })

  /**
   * inventory:brand:delete
   *
   * Deletes a brand. Requires `inventory` permission.
   * Rejects if any active product references this brand.
   *
   * Payload:  `{ id: number }`
   * Response: `IpcResult<void>`
   */
  registerHandler<void>('inventory:brand:delete', async (payload) => {
    requirePermission('inventory')
    const { id } = payload as BrandDeletePayload
    return brandService.delete(id)
  })

  // ── Unit of measure handlers ────────────────────────────────────────────────

  /**
   * inventory:unit:list
   *
   * Returns all units of measure. Requires `inventory_view` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<UnitOfMeasure[]>`
   */
  registerHandler<UnitOfMeasure[]>('inventory:unit:list', async () => {
    requirePermission('inventory_view')
    return unitService.list()
  })

  /**
   * inventory:unit:create
   *
   * Creates a new unit of measure. Requires `inventory` permission.
   *
   * Payload:  `{ name: string, abbreviation?: string }`
   * Response: `IpcResult<UnitOfMeasure>`
   */
  registerHandler<UnitOfMeasure>('inventory:unit:create', async (payload) => {
    requirePermission('inventory')
    const data = payload as UnitCreatePayload
    return unitService.create(data)
  })

  /**
   * inventory:unit:update
   *
   * Updates an existing unit of measure. Requires `inventory` permission.
   *
   * Payload:  `{ id: number, data: Partial<CreateUnitData> }`
   * Response: `IpcResult<UnitOfMeasure>`
   */
  registerHandler<UnitOfMeasure>('inventory:unit:update', async (payload) => {
    requirePermission('inventory')
    const { id, data } = payload as UnitUpdatePayload
    return unitService.update(id, data)
  })

  /**
   * inventory:unit:delete
   *
   * Deletes a unit of measure. Requires `inventory` permission.
   * Rejects if any active product references this unit.
   *
   * Payload:  `{ id: number }`
   * Response: `IpcResult<void>`
   */
  registerHandler<void>('inventory:unit:delete', async (payload) => {
    requirePermission('inventory')
    const { id } = payload as UnitDeletePayload
    return unitService.delete(id)
  })

  // ── Barcode handler ─────────────────────────────────────────────────────────

  /**
   * inventory:barcode:generate
   *
   * Generates a Code128 barcode SVG string for the given product SKU.
   * Requires `inventory_view` permission.
   *
   * Payload:  `{ sku: string }`
   * Response: `IpcResult<string>` — the SVG markup as a string
   */
  registerHandler<string>('inventory:barcode:generate', async (payload) => {
    requirePermission('inventory_view')
    const { sku } = payload as BarcodeGeneratePayload
    return generateBarcode(sku)
  })

  // ── Stock adjustment handler ─────────────────────────────────────────────────

  /**
   * inventory:adjust
   *
   * Applies a stock adjustment (damaged, lost, returned, correction).
   * Requires `inventory` permission.
   *
   * If the adjustment would result in negative stock and `forceNegative` is
   * not set, returns `{ requiresConfirmation: true }` without modifying the DB.
   *
   * Payload:  `AdjustPayload`
   * Response: `IpcResult<AdjustResult>`
   */
  registerHandler<AdjustResult>('inventory:adjust', async (payload) => {
    requirePermission('inventory')
    const adjustPayload = payload as AdjustPayload
    return stockAdjustmentService.adjust(adjustPayload)
  })

  // ── Stock receipt handlers ───────────────────────────────────────────────────

  /**
   * inventory:receipt:create
   *
   * Records a new stock receipt from a supplier.
   * Requires `inventory` permission.
   *
   * Payload:  `ReceivePayload`
   * Response: `IpcResult<{ receiptId: number }>`
   */
  registerHandler<{ receiptId: number }>('inventory:receipt:create', async (payload) => {
    requirePermission('inventory')
    const receivePayload = payload as ReceivePayload
    return stockReceiptService.receive(receivePayload)
  })

  /**
   * inventory:receipt:list
   *
   * Lists stock receipts with optional supplier and date filters.
   * Requires `inventory_view` permission.
   *
   * Payload:  `ReceiptListFilters` (all fields optional)
   * Response: `IpcResult<StockReceipt[]>`
   */
  registerHandler<StockReceipt[]>('inventory:receipt:list', async (payload) => {
    requirePermission('inventory_view')
    const filters = (payload ?? {}) as ReceiptListFilters
    return stockReceiptService.list(filters)
  })

  // ── Low stock handler ────────────────────────────────────────────────────────

  /**
   * inventory:lowstock:list
   *
   * Returns all active products where `quantity_on_hand <= reorder_point`.
   * Requires `inventory_view` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<Product[]>`
   *
   * Requirements 4.2, 4.3, 24.1
   */
  registerHandler<LowStockProduct[]>('inventory:lowstock:list', async () => {
    requirePermission('inventory_view')

    // Import knex here to avoid circular dependency issues at module load time
    const { default: knex } = await import('../../src/db/knex')

    const rows = await knex('products as p')
      .select(
        'p.id',
        'p.sku',
        'p.name',
        'p.category_id as categoryId',
        'c.name as categoryName',
        'p.brand_id as brandId',
        'b.name as brandName',
        'p.unit_id as unitId',
        'u.name as unitName',
        'p.cost_price as costPrice',
        'p.selling_price as sellingPrice',
        'p.tax_rate as taxRate',
        'p.tax_inclusive as taxInclusive',
        'p.reorder_point as reorderPoint',
        'p.quantity_on_hand as quantityOnHand',
        'p.barcode',
        'p.batch_tracking as batchTracking',
        'p.is_active as isActive',
        'p.created_at as createdAt',
        'p.updated_at as updatedAt'
      )
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('brands as b', 'p.brand_id', 'b.id')
      .leftJoin('units_of_measure as u', 'p.unit_id', 'u.id')
      .where('p.is_active', 1)
      .whereRaw('p.quantity_on_hand <= p.reorder_point')
      .orderBy('p.quantity_on_hand', 'asc')

    return rows as LowStockProduct[]
  })

  // ── CSV import/export handlers ───────────────────────────────────────────────

  /**
   * inventory:csv:import
   *
   * Opens a file picker dialog for the user to select a CSV file, then imports
   * the products from that file. Returns row-level errors for invalid rows.
   * Requires `inventory` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<ImportResult | { cancelled: true }>`
   *
   * Requirements 8.1, 8.2
   */
  registerHandler<ImportResult | { cancelled: true }>('inventory:csv:import', async () => {
    requirePermission('inventory')

    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select CSV file to import',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    })

    if (canceled || filePaths.length === 0) {
      return { cancelled: true }
    }

    const filePath = filePaths[0]
    return csvImportService.importProducts(filePath)
  })

  /**
   * inventory:csv:export
   *
   * Opens a save dialog for the user to choose the export file location, then
   * exports all active products to that CSV file.
   * Requires `inventory` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<{ success: true; filePath: string } | { cancelled: true }>`
   *
   * Requirements 8.3
   */
  registerHandler<{ success: true; filePath: string } | { cancelled: true }>(
    'inventory:csv:export',
    async () => {
      requirePermission('inventory')

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export products to CSV',
        defaultPath: 'products_export.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      })

      if (canceled || !filePath) {
        return { cancelled: true }
      }

      await csvExportService.exportProducts(filePath)
      return { success: true, filePath }
    }
  )

  /**
   * inventory:csv:template
   *
   * Returns a CSV template string with the required column headers and one
   * example row. No file dialog needed.
   * Requires `inventory_view` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<string>`
   *
   * Requirements 8.4
   */
  registerHandler<string>('inventory:csv:template', async () => {
    requirePermission('inventory_view')
    return csvExportService.getTemplate()
  })
}
