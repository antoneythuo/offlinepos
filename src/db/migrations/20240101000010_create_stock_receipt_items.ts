import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stock_receipt_items', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('stock_receipt_id').unsigned().notNullable()
    table.integer('product_id').unsigned().notNullable()
    table.specificType('quantity', 'DECIMAL(15,4)').notNullable()
    table.specificType('cost_price', 'DECIMAL(15,4)').notNullable()
    table.boolean('update_cost').defaultTo(false)

    table.foreign('stock_receipt_id').references('id').inTable('stock_receipts')
    table.foreign('product_id').references('id').inTable('products')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stock_receipt_items')
}
