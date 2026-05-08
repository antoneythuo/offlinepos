import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('return_items', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('return_transaction_id').unsigned().notNullable()
    table.integer('product_id').unsigned().notNullable()
    table.specificType('quantity', 'DECIMAL(15,4)').notNullable()
    table.specificType('unit_price', 'DECIMAL(15,4)').notNullable()
    table.specificType('refund_amount', 'DECIMAL(15,4)').notNullable()

    table.foreign('return_transaction_id').references('id').inTable('return_transactions')
    table.foreign('product_id').references('id').inTable('products')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('return_items')
}
