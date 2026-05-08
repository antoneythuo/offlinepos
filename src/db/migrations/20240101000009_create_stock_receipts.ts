import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stock_receipts', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('supplier_id').unsigned().notNullable()
    table.integer('received_by').unsigned().notNullable()
    table.date('receipt_date').notNullable()
    table.text('notes').nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('supplier_id').references('id').inTable('suppliers')
    table.foreign('received_by').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stock_receipts')
}
