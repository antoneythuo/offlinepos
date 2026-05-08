import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transaction_items', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('transaction_id').unsigned().notNullable()
    table.integer('product_id').unsigned().notNullable()
    table.string('product_name', 200).notNullable()
    table.string('sku', 100).notNullable()
    table.specificType('quantity', 'DECIMAL(15,4)').notNullable()
    table.specificType('unit_price', 'DECIMAL(15,4)').notNullable()
    table.enu('discount_type', ['none', 'percent', 'fixed']).defaultTo('none')
    table.specificType('discount_value', 'DECIMAL(15,4)').defaultTo(0)
    table.specificType('discount_amount', 'DECIMAL(15,4)').defaultTo(0)
    table.specificType('tax_rate', 'DECIMAL(5,2)').notNullable().defaultTo(0)
    table.specificType('tax_amount', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.specificType('line_total', 'DECIMAL(15,4)').notNullable()

    table.foreign('transaction_id').references('id').inTable('transactions')
    table.foreign('product_id').references('id').inTable('products')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transaction_items')
}
