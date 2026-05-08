import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('expense_categories', (table) => {
    table.increments('id').unsigned().primary()
    table.string('name', 100).notNullable().unique()
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('expense_categories')
}
