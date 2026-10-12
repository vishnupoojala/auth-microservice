import bcrypt from 'bcryptjs';
import sequelize from '../src/config/database.js';
import env from '../src/config/environment.js';
import User from '../src/models/User.js';
import { createUmzug } from '../src/migrations/umzug.js';

function readVar(name) {
  const value = process.env[name];
  if (!value || (name === 'ADMIN_PASSWORD' && value.length < 8)) {
    console.error(`[seed-admin] Missing or invalid ${name}.`);
    console.error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in your environment or .env file.');
    process.exit(1);
  }
  return value;
}

async function main() {
  const name = readVar('ADMIN_NAME');
  const email = readVar('ADMIN_EMAIL');
  const password = readVar('ADMIN_PASSWORD');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('[seed-admin] ADMIN_EMAIL is not a valid email address.');
    process.exit(1);
  }

  await sequelize.authenticate();
  console.log('[seed-admin] Database connection OK.');

  const umzug = await createUmzug(sequelize);
  const pending = await umzug.pending();
  if (pending.length > 0) {
    console.log(`[seed-admin] Running ${pending.length} pending migration(s) first...`);
    await umzug.up();
  }

  const [user, created] = await User.findOrCreate({
    where: { email: email.trim().toLowerCase() },
    defaults: {
      name,
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, env.bcryptSaltRounds),
      role: 'ADMIN',
      isActive: true,
    },
  });

  if (created) {
    if (user.role !== 'ADMIN') {
      user.role = 'ADMIN';
      await user.save();
    }
    console.log(`[seed-admin] Administrator created: ${user.email} (id: ${user.id})`);
  } else {
    if (user.role !== 'ADMIN') {
      user.role = 'ADMIN';
      await user.save();
      console.log(`[seed-admin] Existing user ${user.email} promoted to ADMIN.`);
    } else {
      console.log(`[seed-admin] Administrator already exists: ${user.email} (id: ${user.id})`);
    }
  }

  await sequelize.close();
}

main().catch(async (error) => {
  console.error('[seed-admin] Failed:', error.message);
  await sequelize.close();
  process.exit(1);
});