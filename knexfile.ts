import { join } from 'path'
import { loadDbConfig } from './src/db/knex'

const config = loadDbConfig(join(__dirname, 'config.json'))

export default {
  client: 'mysql2',
  connection: {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    timezone: '+00:00',
  },
  migrations: {
    directory: join(__dirname, 'src/db/migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: join(__dirname, 'src/db/seeds'),
    extension: 'ts',
  },
}
