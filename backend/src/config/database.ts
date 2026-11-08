import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
});

// A dropped idle connection must not crash the process. The health check and
// every query handle their own errors; this listener only logs the pool event.
pool.on('error', (error) => {
  console.error('Unexpected error on idle PostgreSQL client:', error.message);
});

export async function testConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected at', result.rows[0].now);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
