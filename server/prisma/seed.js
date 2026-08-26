import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Default houses (idempotent — only inserted when missing, never overwritten)
const DEFAULT_HOUSES = [
  { id: 'house_1', name: 'House Aakash', color: '#0ea5e9', icon: 'Cloud', login_code: 'AAKASH28' },
  { id: 'house_2', name: 'House Vayu', color: '#94a3b8', icon: 'Wind', login_code: 'VAYU65' },
  { id: 'house_3', name: 'House Agni', color: '#ef4444', icon: 'Flame', login_code: 'AGNI39' },
  { id: 'house_4', name: 'House Prudhvi', color: '#22c55e', icon: 'TreePine', login_code: 'PRUDHVI17' },
  { id: 'house_5', name: 'House Jal', color: '#3b82f6', icon: 'Droplets', login_code: 'JAL45' }
];

// Starter question (idempotent)
const DEFAULT_QUESTIONS = [
  {
    id: 'q_1',
    clue_letters: 'RKG',
    hero_name: 'Ram Charan',
    heroine_name: 'Kiara Advani',
    movie_name: 'Game Changer',
    points: 1,
    order_index: 1
  }
];

// Protected default admin. Credentials are NEVER overwritten if the account
// already exists (so a changed password survives re-seeds / restarts).
const DEFAULT_ADMIN_USERNAME = 'b77x.io';
const DEFAULT_ADMIN_PASSWORD = '777777';

async function main() {
  for (const house of DEFAULT_HOUSES) {
    const exists = await prisma.house.findUnique({ where: { id: house.id } });
    if (!exists) {
      await prisma.house.create({ data: house });
      console.log(`Seeded house: ${house.name} (${house.login_code})`);
    }
  }

  for (const question of DEFAULT_QUESTIONS) {
    const exists = await prisma.question.findUnique({ where: { id: question.id } });
    if (!exists) {
      await prisma.question.create({ data: question });
      console.log(`Seeded question: ${question.id}`);
    }
  }

  const adminExists = await prisma.admin.findUnique({ where: { username: DEFAULT_ADMIN_USERNAME } });
  if (!adminExists) {
    const password_hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await prisma.admin.create({
      data: {
        id: 'admin_default_b77x',
        username: DEFAULT_ADMIN_USERNAME,
        password_hash,
        is_protected: true
      }
    });
    console.log(`Seeded protected default admin: ${DEFAULT_ADMIN_USERNAME}`);
  } else if (!adminExists.is_protected) {
    // Only enforce the protection flag — never touch credentials of an existing account.
    await prisma.admin.update({ where: { username: DEFAULT_ADMIN_USERNAME }, data: { is_protected: true } });
    console.log(`Existing default admin found — marked as protected (credentials untouched).`);
  } else {
    console.log('Default admin already exists — skipping.');
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
