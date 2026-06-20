import knex, { Knex } from 'knex';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { runMigrations } from './migrations';

let dbInstance: Knex | null = null;

export async function getDb(): Promise<Knex> {
  if (dbInstance) {
    return dbInstance;
  }

  // Load environment variables (Next.js automatically loads .env.local and .env)
  const pgConnectionString = process.env.DATABASE_URL;
  const pgHost = process.env.PGHOST || process.env.DB_HOST;
  const pgUser = process.env.PGUSER || process.env.DB_USER;
  const pgPassword = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  const pgDatabase = process.env.PGDATABASE || process.env.DB_NAME;
  const pgPort = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10);

  const isPostgres = !!(pgConnectionString || (pgHost && pgUser && pgPassword && pgDatabase));
  let config: Knex.Config;

  if (isPostgres) {
    console.log('Connecting to PostgreSQL database...');
    config = {
      client: 'pg',
      connection: pgConnectionString || {
        host: pgHost,
        user: pgUser,
        password: pgPassword,
        database: pgDatabase,
        port: pgPort,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      },
      pool: { min: 2, max: 10 }
    };
  } else {
    // Fallback to local SQLite file
    const sqlitePath = path.join(process.cwd(), 'peaje.db');
    console.log(`Connecting to local SQLite database at: ${sqlitePath}...`);
    config = {
      client: 'sqlite3',
      connection: {
        filename: sqlitePath
      },
      useNullAsDefault: true,
      pool: {
        afterCreate: (conn: any, cb: any) => {
          conn.run('PRAGMA foreign_keys = ON', cb);
        }
      }
    };
  }

  const conn = knex(config);

  try {
    // Verify connection
    await conn.raw(isPostgres ? 'SELECT 1' : 'PRAGMA user_version');
    console.log('Database connection verified successfully.');

    // Run migrations
    console.log('Running database migrations...');
    await runMigrations(conn);
    console.log('Database migrations completed.');

    // Seed data
    await seedDefaultData(conn);

    dbInstance = conn;
    return conn;
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    await conn.destroy();
    throw error;
  }
}

async function seedDefaultData(conn: Knex): Promise<void> {
  // 1. Seed default station 'LA PUNTA'
  const stations = await conn('stations').select('id');
  let stationId = '';
  if (stations.length === 0) {
    stationId = crypto.randomUUID();
    await conn('stations').insert({
      id: stationId,
      name: 'LA PUNTA'
    });
    console.log('Seeded default station: LA PUNTA');
  } else {
    stationId = stations[0].id;
  }

  // 2. Seed default users
  const users = await conn('users').select('id');
  if (users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    
    // Admin
    const adminId = crypto.randomUUID();
    const adminHash = await bcrypt.hash('admin123', salt);
    await conn('users').insert({
      id: adminId,
      username: 'admin',
      password_hash: adminHash,
      role: 'ADMIN',
      name: 'Administrador de Interventoría'
    });

    // Operador
    const operadorId = crypto.randomUUID();
    const operadorHash = await bcrypt.hash('operador123', salt);
    await conn('users').insert({
      id: operadorId,
      username: 'operador',
      password_hash: operadorHash,
      role: 'OPERADOR',
      name: 'Operador de Peaje'
    });

    // Interventor
    const interventorId = crypto.randomUUID();
    const interventorHash = await bcrypt.hash('interventor123', salt);
    await conn('users').insert({
      id: interventorId,
      username: 'interventor',
      password_hash: interventorHash,
      role: 'INTERVENTOR',
      name: 'Interventor de Vía'
    });

    console.log('Seeded default user accounts (admin, operador, interventor).');
  }

  // 3. Seed default global settings
  const settings = await conn('global_settings').select('id');
  if (settings.length === 0) {
    const defaultSettings = [
      {
        id: crypto.randomUUID(),
        setting_key: 'email_atencion',
        setting_value: 'peajelapunta@santander.gov.co',
        label: 'Correo de Atención al Usuario',
        description: 'Correo electrónico mostrado en el cabezote y en reportes PDF.'
      },
      {
        id: crypto.randomUUID(),
        setting_key: 'tel_emergencia',
        setting_value: '(+57) 317 513 2240',
        label: 'Línea de Emergencia',
        description: 'Número de teléfono de emergencias.'
      },
      {
        id: crypto.randomUUID(),
        setting_key: 'tel_whatsapp',
        setting_value: '573175132240',
        label: 'Número de WhatsApp',
        description: 'Número con código de país (ej. 573175132240) para el enlace directo.'
      },
      {
        id: crypto.randomUUID(),
        setting_key: 'nombre_peaje',
        setting_value: 'PEAJE LA PUNTA',
        label: 'Nombre de la Estación',
        description: 'Nombre visible en los reportes estadísticos.'
      },
      {
        id: crypto.randomUUID(),
        setting_key: 'logo_base64',
        setting_value: '',
        label: 'Logo de la Estación (Base64)',
        description: 'Logo institucional. Si se deja en blanco se usa el escudo por defecto.'
      }
    ];
    await conn('global_settings').insert(defaultSettings);
    console.log('Seeded default global settings.');
  }
}

// Export a helper to query db easily
export async function queryDb<T = any>(callback: (knex: Knex) => Promise<T>): Promise<T> {
  const conn = await getDb();
  return callback(conn);
}
