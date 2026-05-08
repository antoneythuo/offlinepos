import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', (table) => {
    table.increments('id').unsigned().primary()
    table.string('transaction_ref', 30).notNullable().unique()
    table.integer('cashier_id').unsigned().notNullable()
    table.integer('customer_id').unsigned().nullable()
    table.enu('status', ['completed', 'credit', 'refunded', 'held']).notNullable()
    table.specificType('subtotal', 'DECIMAL(15,4)').notNullable()
    table.enu('discount_type', ['none', 'percent', 'fixed']).defaultTo('none')
    table.specificType('discount_value', 'DECIMAL(15,4)').defaultTo(0)
    table.specificType('discount_amount', 'DECIMAL(15,4)').defaultTo(0)
    table.specificType('tax_amount', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.specificType('grand_total', 'DECIMAL(15,4)').notNullable()
    table.date('credit_due_date').nullable()
    table.specificType('credit_balance', 'DECIMAL(15,4)').defaultTo(0)
    table.text('notes').nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('cashier_id').references('id').inTable('users')
    table.foreign('customer_id').references('id').inTable('customers')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions')
}
