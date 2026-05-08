import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.bigIncrements('id').unsigned().primary()
    table.integer('user_id').unsigned().nullable()
    table.string('action', 100).notNullable()
    table.string('entity_type', 50).notNullable()
    table.integer('entity_id').unsigned().nullable()
    table.json('before_state').nullable()
    table.json('after_state').nullable()
    table.string('ip_address', 45).nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Indexes for efficient filtering
    table.index(['user_id'], 'idx_audit_user')
    table.index(['action'], 'idx_audit_action')
    table.index(['created_at'], 'idx_audit_created')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs')
}
