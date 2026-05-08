import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').unsigned().primary()
    table.string('name', 200).notNullable()
    table.string('phone', 30).nullable()
    table.string('email', 150).nullable()
    table.text('address').nullable()
    table.specificType('credit_limit', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customers')
}
