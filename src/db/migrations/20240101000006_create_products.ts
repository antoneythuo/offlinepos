import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('products', (table) => {
    table.increments('id').unsigned().primary()
    table.string('sku', 100).notNullable().unique()
    table.string('name', 200).notNullable()
    table.integer('category_id').unsigned().notNullable()
    table.integer('brand_id').unsigned().nullable()
    table.integer('unit_id').unsigned().notNullable()
    table.specificType('cost_price', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.specificType('selling_price', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.specificType('tax_rate', 'DECIMAL(5,2)').notNullable().defaultTo(0)
    table.boolean('tax_inclusive').defaultTo(false)
    table.integer('reorder_point').unsigned().defaultTo(0)
    table.specificType('quantity_on_hand', 'DECIMAL(15,4)').notNullable().defaultTo(0)
    table.string('barcode', 100).nullable()
    table.boolean('batch_tracking').defaultTo(false)
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

    table.foreign('category_id').references('id').inTable('categories')
    table.foreign('brand_id').references('id').inTable('brands')
    table.foreign('unit_id').references('id').inTable('units_of_measure')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('products')
}
