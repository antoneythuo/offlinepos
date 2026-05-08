import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('settings', (table) => {
    table.string('key_name', 100).primary()
    table.text('value').notNullable()
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings')
}
