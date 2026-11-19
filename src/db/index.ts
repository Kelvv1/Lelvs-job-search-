import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function hasDatabaseConfig(): boolean {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return true;
  }
  return Boolean(
    process.env.SQL_HOST &&
      process.env.SQL_HOST.trim().length > 0 &&
      process.env.SQL_DB_NAME &&
      process.env.SQL_DB_NAME.trim().length > 0
  );
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const timeoutMs = isServerless ? 4000 : 15000;

    if (connectionString) {
      const useSsl =
        !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
      global._postgresPool = new Pool({
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        max: isServerless ? 3 : 10,
        connectionTimeoutMillis: timeoutMs,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST || '127.0.0.1',
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: isServerless ? 3 : 10,
        connectionTimeoutMillis: timeoutMs,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

let cachedDbReady: { ok: boolean; checkedAt: number } | null = null;
const DB_CHECK_TTL_MS = 60 * 1000;

export async function isDatabaseReady(): Promise<boolean> {
  if (!hasDatabaseConfig()) {
    return false;
  }
  const now = Date.now();
  if (cachedDbReady && now - cachedDbReady.checkedAt < DB_CHECK_TTL_MS) {
    return cachedDbReady.ok;
  }
  try {
    await pool.query('SELECT 1');
    cachedDbReady = { ok: true, checkedAt: now };
    return true;
  } catch (err) {
    console.warn('PostgreSQL unavailable, using live stateless fallback:', (err as Error)?.message);
    cachedDbReady = { ok: false, checkedAt: now };
    return false;
  }
}
