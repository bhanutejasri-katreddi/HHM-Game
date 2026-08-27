import { PrismaClient } from '@prisma/client';

// Prisma singleton — one client per process, safe for concurrent use.
// Reads DATABASE_URL from the environment (loaded via dotenv in server.js).
export const prisma = new PrismaClient();

const toMillis = (value) => (value === null || value === undefined ? null : Number(value));

export const initDb = async () => {
  // Idempotent seed: guarantees the starter question and the
  // protected default admin always exist (e.g. after a DB reset/redeploy).
  await seedDefaults();
};

const seedDefaults = async () => {
  // House seeding removed; houses are created per session.

  const questionCount = await prisma.question.count();
  if (questionCount === 0) {
    await prisma.question.create({
      data: {
        id: 'q_1',
        clue_letters: 'RKG',
        hero_name: 'Ram Charan',
        heroine_name: 'Kiara Advani',
        movie_name: 'Game Changer',
        points: 1,
        order_index: 1
      }
    });
    console.log('Seeded questions.');
  }

  const username = process.env.DEFAULT_ADMIN_USERNAME || 'b77x.io';
  const adminExists = await prisma.admin.findUnique({ where: { username } });
  if (!adminExists) {
    const { default: bcrypt } = await import('bcrypt');
    const password_hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || '777777', 10);
    await prisma.admin.create({
      data: { id: 'admin_default_b77x', username, password_hash, is_protected: true }
    });
    console.log(`Seeded protected default admin (${username}).`);
  } else if (!adminExists.is_protected) {
    await prisma.admin.update({ where: { username }, data: { is_protected: true } });
  }
};

// =======================
// SESSION HELPERS
// =======================
export const getActiveSession = async () => {
  return prisma.session.findFirst({ where: { status: 'ACTIVE' }, orderBy: { created_at: 'desc' } });
};

export const createSession = async (name) => {
  const id = 'session_' + Date.now();
  await prisma.session.create({ data: { id, name, status: 'ACTIVE' } });
  
  // Create default houses for this session
  await prisma.house.createMany({
    data: [
      { id: `house_1_${id}`, name: 'House Aakash', color: '#0ea5e9', icon: 'Cloud', login_code: 'AAKASH28', session_id: id },
      { id: `house_2_${id}`, name: 'House Vayu', color: '#94a3b8', icon: 'Wind', login_code: 'VAYU65', session_id: id },
      { id: `house_3_${id}`, name: 'House Agni', color: '#ef4444', icon: 'Flame', login_code: 'AGNI39', session_id: id },
      { id: `house_4_${id}`, name: 'House Prudhvi', color: '#22c55e', icon: 'TreePine', login_code: 'PRUDHVI17', session_id: id },
      { id: `house_5_${id}`, name: 'House Jal', color: '#3b82f6', icon: 'Droplets', login_code: 'JAL45', session_id: id }
    ]
  });
  return id;
};

export const endSession = async (sessionId) => {
  await prisma.$transaction(async (tx) => {
    // Session constraints are set to CASCADE in schema, but we can do it explicitly just in case or let Prisma handle via cascade.
    // We already added onDelete: Cascade in the Prisma schema for session_id. 
    // Just delete the houses, devices, rounds for this session, then mark session as ended.
    await tx.device.deleteMany({ where: { session_id: sessionId } });
    await tx.round.deleteMany({ where: { session_id: sessionId } });
    await tx.house.deleteMany({ where: { session_id: sessionId } });
    await tx.session.update({ where: { id: sessionId }, data: { status: 'ENDED', ended_at: new Date() } });
    await tx.question.updateMany({ data: { used: false } }); // Reset questions for next session
  });
  return true;
};

// =======================
// HOUSE HELPERS
// =======================
export const getHouses = async (sessionId) => {
  if (!sessionId) return [];
  return prisma.house.findMany({ where: { session_id: sessionId }, orderBy: [{ score: 'desc' }, { name: 'asc' }] });
};

export const getHouseByLoginCode = async (code, sessionId) => {
  if (!code || !sessionId) return null;
  const clean = String(code).trim();
  if (!clean) return null;
  const houses = await prisma.house.findMany({ where: { session_id: sessionId } });
  return (
    houses.find((h) => String(h.login_code || '').trim().toLowerCase() === clean.toLowerCase()) || null
  );
};

export const updateHouseScore = async (houseId, points) => {
  const result = await prisma.house.update({
    where: { id: houseId },
    data: { score: { increment: points } }
  });
  return result ? 1 : 0;
};

export const resetLeaderboard = async () => {
  const result = await prisma.house.updateMany({ data: { score: 0 } });
  return result.count;
};

export const createHouse = async (id, name, color, icon, loginCode, sessionId) => {
  await prisma.house.create({ data: { id, name, color, icon, login_code: loginCode, session_id: sessionId } });
  return id;
};

export const updateHouse = async (id, name, color, icon) => {
  const result = await prisma.house.updateMany({
    where: { id },
    data: { name, color, icon }
  });
  return result.count;
};

export const updateHouseLoginCode = async (id, loginCode) => {
  const result = await prisma.house.updateMany({
    where: { id },
    data: { login_code: loginCode }
  });
  return result.count;
};

export const deleteHouse = async (id) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.device.deleteMany({ where: { house_id: id } });
    await tx.round.deleteMany({ where: { locked_house_id: id } });
    return tx.house.deleteMany({ where: { id } });
  });
  return deleted.count;
};

// =======================
// QUESTION HELPERS
// =======================
export const getQuestions = async () => {
  return prisma.question.findMany({ orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }] });
};

export const getUnusedQuestions = async () => {
  return prisma.question.findMany({
    where: { used: false },
    orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }]
  });
};

export const markQuestionUsed = async (questionId) => {
  const result = await prisma.question.updateMany({
    where: { id: questionId },
    data: { used: true }
  });
  return result.count;
};

export const resetAllQuestions = async () => {
  const result = await prisma.question.updateMany({ data: { used: false } });
  return result.count;
};

export const createQuestion = async (id, clue, hero, heroine, movie, points = 1, orderIndex = null) => {
  if (orderIndex === null || orderIndex === undefined) {
    const maxRow = await prisma.question.aggregate({ _max: { order_index: true } });
    orderIndex = (maxRow._max.order_index || 0) + 1;
  }
  const pts = parseInt(points) || 1;
  await prisma.question.create({
    data: {
      id,
      clue_letters: clue,
      hero_name: hero,
      heroine_name: heroine,
      movie_name: movie,
      points: pts,
      order_index: orderIndex
    }
  });
  return id;
};

export const updateQuestion = async (id, clue, hero, heroine, movie, points) => {
  const result = await prisma.question.updateMany({
    where: { id },
    data: {
      clue_letters: clue,
      hero_name: hero,
      heroine_name: heroine,
      movie_name: movie,
      points: parseInt(points) || 1
    }
  });
  return result.count;
};

export const reorderQuestions = async (orderedIds) => {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.question.update({ where: { id }, data: { order_index: index + 1 } })
    )
  );
  return true;
};

export const deleteQuestion = async (id) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.round.deleteMany({ where: { question_id: id } });
    return tx.question.deleteMany({ where: { id } });
  });
  return deleted.count;
};

// =======================
// ADMIN HELPERS
// =======================
export const getAdminByUsername = async (username) => {
  if (!username) return null;
  return prisma.admin.findUnique({ where: { username } });
};

export const getAdminById = async (id) => {
  return prisma.admin.findUnique({ where: { id } });
};

export const createAdmin = async (id, username, passwordHash) => {
  await prisma.admin.create({ data: { id, username, password_hash: passwordHash } });
  return id;
};

export const deleteAdmin = async (id) => {
  const existing = await prisma.admin.findUnique({ where: { id } });
  if (!existing) return 0;
  if (existing.is_protected) {
    const err = new Error('This is the default admin account and cannot be deleted');
    err.code = 'PROTECTED_ADMIN';
    throw err;
  }
  await prisma.admin.delete({ where: { id } });
  return 1;
};

// =======================
// DEVICE & LOG HELPERS
// =======================
export const registerDevice = async (deviceId, houseId, studentName, sessionId) => {
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { house_id: houseId, student_name: studentName, last_seen_at: BigInt(Date.now()), session_id: sessionId },
    create: { id: deviceId, house_id: houseId, student_name: studentName, last_seen_at: BigInt(Date.now()), session_id: sessionId }
  });
  return deviceId;
};

export const getDeviceById = async (id) => {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return null;
  return { ...device, last_seen_at: toMillis(device.last_seen_at) };
};

export const logRound = async (id, questionId, houseId, deviceId, result, points, sessionId) => {
  await prisma.round.create({
    data: {
      id,
      question_id: questionId,
      locked_house_id: houseId,
      locked_device_id: deviceId,
      locked_at: BigInt(Date.now()),
      result,
      points_awarded: points,
      session_id: sessionId
    }
  });
  return id;
};

export const getRecentRounds = async (sessionId, limit = 5) => {
  if (!sessionId) return [];
  const rounds = await prisma.round.findMany({
    where: { session_id: sessionId },
    orderBy: { locked_at: 'desc' },
    take: limit,
    include: { question: true, house: true }
  });

  // Resolve student names from devices (no FK between rounds.locked_device_id and devices).
  const deviceIds = [...new Set(rounds.map((r) => r.locked_device_id).filter(Boolean))];
  const devices = deviceIds.length
    ? await prisma.device.findMany({ where: { id: { in: deviceIds } } })
    : [];
  const deviceNameById = Object.fromEntries(devices.map((d) => [d.id, d.student_name]));

  // Flatten to the exact shape the old SQL JOIN produced.
  return rounds.map((r) => ({
    ...r,
    locked_at: toMillis(r.locked_at),
    clue_letters: r.question?.clue_letters ?? null,
    hero_name: r.question?.hero_name ?? null,
    heroine_name: r.question?.heroine_name ?? null,
    movie_name: r.question?.movie_name ?? null,
    house_name: r.house?.name ?? null,
    house_color: r.house?.color ?? null,
    house_icon: r.house?.icon ?? null,
    student_name: r.locked_device_id ? deviceNameById[r.locked_device_id] ?? null : null,
    question: undefined,
    house: undefined
  }));
};
