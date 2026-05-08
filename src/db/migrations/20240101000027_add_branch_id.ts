import type { Knex } from 'knex'

/**
 * Adds a nullable `branch_id` foreign key column to the `transactions`,
 * `users`, and `products` tables.
 *
 * The column is nullable so that existing records without a branch assignment
 * remain valid after the migration runs.
 */
export async function up(knex: Knex): Promise<void> {
  // transactions.branch_id
  await knex.schema.alterTable('transactions', (table) => {
    table.integer('branch_id').unsigned().nullable().references('id').inTable('branches')
  })

  // users.branch_id
  await knex.schema.alterTable('users', (table) => {
    table.integer('branch_id').unsigned().nullable().references('id').inTable('branches')
  })

  // products.branch_id
  await knex.schema.alterTable('products', (table) => {
    table.integer('branch_id').unsigned().nullable().references('id').inTable('branches')
  })
}

export async function down(knex: Knex): Promise<void> {
  // Drop FK constraints and columns in reverse order

  await knex.schema.alterTable('products', (table) => {
    table.dropForeign(['branch_id'])
    table.dropColumn('branch_id')
  })

  await knex.schema.alterTable('users', (table) => {
    table.dropForeign(['branch_id'])
    table.dropColumn('branch_id')
  })

  await knex.schema.alterTable('transactions', (table) => {
    table.dropForeign(['branch_id'])
    table.dropColumn('branch_id')
  })
}
