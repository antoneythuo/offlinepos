import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('credit_payments', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('transaction_id').unsigned().notNullable()
    table.integer('recorded_by').unsigned().notNullable()
    table.specificType('amount', 'DECIMAL(15,4)').notNullable()
    table.enu('method', ['cash', 'card', 'mobile_money']).notNullable()
    table.text('note').nullable()
    table.specificType('balance_after_payment', 'DECIMAL(15,4)').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('transaction_id').references('id').inTable('transactions')
    table.foreign('recorded_by').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('credit_payments')
}
