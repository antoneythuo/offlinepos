import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('product_batches', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('product_id').unsigned().notNullable()
    table.string('batch_number', 100).notNullable()
    table.date('expiry_date').notNullable()
    table.specificType('quantity', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('product_id').references('id').inTable('products')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_batches')
}
