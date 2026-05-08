import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('units_of_measure', (table) => {
    table.increments('id').unsigned().primary()
    table.string('name', 50).notNullable().unique()
    table.string('abbreviation', 10).nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('units_of_measure')
}
