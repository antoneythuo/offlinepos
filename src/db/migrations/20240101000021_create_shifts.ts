import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shifts', (table) => {
    table.increments('id').unsigned().primary()
    table.integer('cashier_id').unsigned().notNullable()
    table.specificType('opening_float', 'DECIMAL(15,4)').notNullable()
    table.specificType('closing_float', 'DECIMAL(15,4)').nullable()
    table.specificType('expected_cash', 'DECIMAL(15,4)').nullable()
    table.specificType('variance', 'DECIMAL(15,4)').nullable()
    table.timestamp('opened_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('closed_at').nullable()
    table.integer('z_report_id').unsigned().nullable()

    table.foreign('cashier_id').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shifts')
}
