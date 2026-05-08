import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('held_transactions', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('cashier_id').unsigned().notNullable()
    table.json('cart_data').notNullable()
    table.timestamp('held_at').defaultTo(knex.fn.now())

    table.foreign('cashier_id').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('held_transactions')
}
