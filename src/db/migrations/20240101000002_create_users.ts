import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').unsigned().primary()
    table.string('username', 50).notNullable().unique()
    table.string('pin_hash', 255).notNullable()
    table.string('full_name', 100).notNullable()
    table.integer('role_id').unsigned().notNullable()
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('role_id').references('id').inTable('roles')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users')
}
