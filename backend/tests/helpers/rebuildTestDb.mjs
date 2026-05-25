// tests/helpers/testDb.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../../src/config/index.js';
import * as db from '../../src/db/db.js';

function assertTestDbRebuildSafety() {
  if (config.env !== 'test') {
    throw new Error('Cannot rebuild database outside of the test environment.');
  }

  if (!config.databaseUrl.includes('test')) {
    throw new Error(
      'DATABASE_URL must point to a test database in order to rebuild it.',
    );
  }
}

// This works without async, but async makes the file read intent obvious.
async function readSql(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  // Puts the content of the entire file into this.
  return readFile(absolutePath, 'utf8');
}

async function resetTestDb() {
  const resetSql = await readSql('db/dev/reset.sql');
  await db.query(resetSql);
}

async function runSchemaSql() {
  const schemaSql = await readSql('db/schema.sql');
  await db.query(schemaSql);
}

async function seedTestDb() {
  const usersSeedSql = await readSql('db/seeds/01-users.sql');
  await db.query(usersSeedSql);

  const resourcesSeedSql = await readSql('db/seeds/02-resources.sql');
  await db.query(resourcesSeedSql);

  const windowsSeedSql = await readSql('db/seeds/03-availability-windows.sql');
  await db.query(windowsSeedSql);

  const durationsSeedSql = await readSql(
    'db/seeds/04-availability-window-allowed-durations.sql',
  );
  await db.query(durationsSeedSql);

  const reservationsSeedSql = await readSql('db/seeds/05-reservations.sql');
  await db.query(reservationsSeedSql);
}

async function runFunctions() {
  const functionsSql = await readSql('db/functions.sql');
  await db.query(functionsSql);
}

async function runTriggers() {
  const triggersSql = await readSql('db/triggers.sql');
  await db.query(triggersSql);
}

async function closeTestDbPool() {
  await db.closePool();
}

async function rebuildTestDb() {
  // Keep this outside the try/catch so safety-check failures are not treated
  // like rebuild failures and do not trigger the cleanup reset.
  assertTestDbRebuildSafety();

  try {
    await resetTestDb();
    await runSchemaSql();
    await seedTestDb();
    await runFunctions();
    await runTriggers();
  } catch (error) {
    // This try/catch is needed in order to avoid hiding the original error if reset fails.
    try {
      await resetTestDb();
    } catch (cleanupError) {
      console.error('Test database cleanup reset failed:', cleanupError);
    }

    // This still runs even if reset fails.
    throw new Error('Test database rebuild failed.', { cause: error });
  }
}

export { closeTestDbPool, rebuildTestDb };
