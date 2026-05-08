import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('return_transactions', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('original_transaction_id').unsigned().notNullable()
    table.integer('processed_by').unsigned().notNullable()
    table.enu('refund_method', ['cash', 'card', 'mobile_money', 'store_credit']).notNullable()
    table.specificType('total_refund', 'DECIMAL(15,4)').notNullable()
    table.text('notes').nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('original_transaction_id').references('id').inTable('transactions')
    table.foreign('processed_by').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('return_transactions')
}
