import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('z_reports', (table) => {
    table.increments('id').unsigned().primary()
    table.date('report_date').notNullable().unique()
    table.integer('generated_by').unsigned().notNullable()
    table.specificType('total_sales', 'DECIMAL(15,4)').notNullable()
    table.specificType('total_refunds', 'DECIMAL(15,4)').notNullable()
    table.specificType('total_discounts', 'DECIMAL(15,4)').notNullable()
    table.specificType('total_tax', 'DECIMAL(15,4)').notNullable()
    table.specificType('total_expenses', 'DECIMAL(15,4)').notNullable()
    table.specificType('cash_sales', 'DECIMAL(15,4)').notNullable()
    table.specificType('card_sales', 'DECIMAL(15,4)').notNullable()
    table.specificType('mobile_money_sales', 'DECIMAL(15,4)').notNullable()
    table.specificType('opening_float', 'DECIMAL(15,4)').notNullable()
    table.specificType('expected_cash', 'DECIMAL(15,4)').notNullable()
    table.specificType('actual_cash', 'DECIMAL(15,4)').nullable()
    table.specificType('variance', 'DECIMAL(15,4)').nullable()
    table.json('report_data').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.foreign('generated_by').references('id').inTable('users')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('z_reports')
}
