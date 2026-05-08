import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('suppliers', (table) => {
    table.increments('id').unsigned().primary()
    table.string('name', 200).notNullable()
    table.string('phone', 30).nullable()
    table.string('email', 150).nullable()
    table.text('address').nullable()
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('suppliers')
}
