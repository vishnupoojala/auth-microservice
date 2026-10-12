import sequelize from '../src/config/database.js';
import { createUmzug } from '../src/migrations/umzug.js';

const command = process.argv[2] || 'status';

async function main() {
  const umzug = await createUmzug(sequelize);

  switch (command) {
    case 'up':
      await umzug.up();
      console.log('Migrations applied successfully.');
      break;
    case 'down':
      await umzug.down();
      console.log('Last migration reverted successfully.');
      break;
    case 'status': {
      const executed = await umzug.executed();
      const pending = await umzug.pending();
      console.log(`\nExecuted migrations (${executed.length}):`);
      executed.forEach((migration) => console.log(`  [x] ${migration.name ?? migration}`));
      console.log(`\nPending migrations (${pending.length}):`);
      pending.forEach((migration) => console.log(`  [ ] ${migration.name ?? migration}`));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: node scripts/db.mjs <up|down|status>');
      process.exit(1);
  }

  await sequelize.close();
}

main().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await sequelize.close();
  process.exit(1);
});