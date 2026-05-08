import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('expenses', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('category_id').unsigned().notNullable()
    table.specificType('amount', 'DECIMAL(15,4)').notNullable()
    table.date('expense_date').notNullable()
    table.text('description').nullable()
    table.integer('recorded_by').unsigned().notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('category_id').references('id').inTable('expense_categories')
    table.foreign('recorded_by').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('expenses')
}
