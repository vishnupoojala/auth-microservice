import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import mysql from 'mysql2/promise';

const command = process.argv[2] || 'up';

function runDocker(args) {
  const result = spawnSync('docker', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error('[dev-db] Failed to run docker:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

async function waitForDatabase(url, attempts = 30) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let connection;
    try {
      connection = await mysql.createConnection(url);
      await connection.query('SELECT 1');
      console.log('[dev-db] Database is ready.');
      return;
    } catch {
      console.log(`[dev-db] Waiting for database... (${attempt}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      if (connection) {
        await connection.end().catch(() => {});
      }
    }
  }
  console.error('[dev-db] Database did not become ready in time.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL || 'mysql://root@127.0.0.1:3306/auth_microservice_db';

async function main() {
  switch (command) {
    case 'up':
    case 'start':
      console.log('[dev-db] Starting MySQL container...');
      runDocker(['compose', 'up', '-d', 'db']);
      await waitForDatabase(databaseUrl);
      break;
    case 'down':
    case 'stop':
      console.log('[dev-db] Stopping MySQL container...');
      runDocker(['compose', 'down']);
      break;
    case 'status':
      runDocker(['compose', 'ps']);
      break;
    case 'reset':
      console.log('[dev-db] Resetting MySQL container and volume...');
      runDocker(['compose', 'down', '-v']);
      runDocker(['compose', 'up', '-d', 'db']);
      await waitForDatabase(databaseUrl);
      break;
    default:
      console.error('Usage: node scripts/dev-db.mjs <up|down|status|reset>');
      process.exit(1);
  }
}

main();
