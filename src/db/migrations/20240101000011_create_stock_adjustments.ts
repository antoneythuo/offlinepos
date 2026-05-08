import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stock_adjustments', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('product_id').unsigned().notNullable()
    table.integer('adjusted_by').unsigned().notNullable()
    table.enu('type', ['damaged', 'lost', 'returned', 'correction']).notNullable()
    table.specificType('quantity', 'DECIMAL(15,4)').notNullable()
    table.text('reason').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('product_id').references('id').inTable('products')
    table.foreign('adjusted_by').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stock_adjustments')
}
