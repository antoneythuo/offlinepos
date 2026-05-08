import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transaction_payments', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('transaction_id').unsigned().notNullable()
    table.enu('method', ['cash', 'card', 'mobile_money']).notNullable()
    table.specificType('amount', 'DECIMAL(15,4)').notNullable()

    table.foreign('transaction_id').references('id').inTable('transactions')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transaction_payments')
}
