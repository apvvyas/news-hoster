import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { loadConfig } from '../config/configuration.js';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

export function dataSourceOptions(
  databaseUrl = loadConfig().databaseUrl,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
  };
}

/** Used by the TypeORM CLI (see the migration:* scripts in package.json). */
export default new DataSource(dataSourceOptions());
