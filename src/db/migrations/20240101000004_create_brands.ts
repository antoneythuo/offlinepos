import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('brands', (table) => {
    table.increments('id').unsigned().primary()
    table.string('name', 100).notNullable().unique()
    table.text('description').nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('brands')
}
