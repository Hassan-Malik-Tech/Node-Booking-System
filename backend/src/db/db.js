import { pool } from './pool.js';

// values is defaulted to [] to avoid it being undefined in queries that have no placeholders.
export async function query(sql, values = []) {
  return pool.query(sql, values);
}

// getClient is clearer and more explicit than connect.
export async function getClient() {
  return pool.connect();
}

export async function closePool() {
  await pool.end();
}

