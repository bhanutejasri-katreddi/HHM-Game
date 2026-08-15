import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, 'buzzer.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export const initDb = async () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT DEFAULT 'Circle',
      login_code TEXT NOT NULL,
      score INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL,
      student_name TEXT,
      last_seen_at INTEGER,
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      clue_letters TEXT NOT NULL,
      hero_name TEXT NOT NULL,
      heroine_name TEXT NOT NULL,
      movie_name TEXT NOT NULL,
      points INTEGER DEFAULT 10,
      used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      locked_house_id TEXT,
      locked_device_id TEXT,
      locked_at INTEGER,
      answers TEXT,
      result TEXT,
      points_awarded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (locked_house_id) REFERENCES houses(id)
    );
  `);

  // Ensure icon column exists if table was created in an older version
  const tableInfo = db.pragma('table_info(houses)');
  const hasIcon = tableInfo.some(col => col.name === 'icon');
  if (!hasIcon) {
    try {
      db.exec("ALTER TABLE houses ADD COLUMN icon TEXT DEFAULT 'Circle'");
    } catch (err) {
      // Column may already exist
    }
  }

  // Seed default houses if table is empty
  const houseCountRow = db.prepare("SELECT COUNT(*) AS count FROM houses").get();
  if (!houseCountRow || houseCountRow.count === 0) {
    const insertHouse = db.prepare("INSERT INTO houses (id, name, color, icon, login_code) VALUES (?, ?, ?, ?, ?)");
    const seedHouses = db.transaction(() => {
      insertHouse.run('house_1', 'House Aakash', '#0ea5e9', 'Cloud', '1234');
      insertHouse.run('house_2', 'House Vayu', '#94a3b8', 'Wind', '2345');
      insertHouse.run('house_3', 'House Agni', '#ef4444', 'Flame', '3456');
      insertHouse.run('house_4', 'House Prudhvi', '#22c55e', 'TreePine', '4567');
      insertHouse.run('house_5', 'House Jal', '#3b82f6', 'Droplets', '5678');
    });
    seedHouses();
    console.log('Seeded houses.');
  }

  // Seed default questions if table is empty
  const questionCountRow = db.prepare("SELECT COUNT(*) AS count FROM questions").get();
  if (!questionCountRow || questionCountRow.count === 0) {
    const insertQuestion = db.prepare("INSERT INTO questions (id, clue_letters, hero_name, heroine_name, movie_name) VALUES (?, ?, ?, ?, ?)");
    const seedQuestions = db.transaction(() => {
      insertQuestion.run('q_1', 'MSD', 'Mahesh Babu', 'Samantha', 'Dookudu');
      insertQuestion.run('q_2', 'VVR', 'Ram Charan', 'Kiara', 'Vinaya Vidheya Rama');
      insertQuestion.run('q_3', 'KGF', 'Yash', 'Srinidhi', 'KGF');
    });
    seedQuestions();
    console.log('Seeded questions.');
  }
};

// =======================
// HOUSE HELPERS
// =======================
export const getHouses = () => {
  return db.prepare("SELECT * FROM houses ORDER BY score DESC").all();
};

export const getHouseByLoginCode = (code) => {
  return db.prepare("SELECT * FROM houses WHERE login_code = ?").get(code);
};

export const updateHouseScore = (houseId, points) => {
  return db.prepare("UPDATE houses SET score = score + ? WHERE id = ?").run(points, houseId).changes;
};

export const resetLeaderboard = () => {
  return db.prepare("UPDATE houses SET score = 0").run().changes;
};

export const createHouse = (id, name, color, icon, loginCode) => {
  return db.prepare("INSERT INTO houses (id, name, color, icon, login_code) VALUES (?, ?, ?, ?, ?)").run(id, name, color, icon, loginCode).lastInsertRowid;
};

export const updateHouse = (id, name, color, icon) => {
  return db.prepare("UPDATE houses SET name = ?, color = ?, icon = ? WHERE id = ?").run(name, color, icon, id).changes;
};

export const updateHouseLoginCode = (id, loginCode) => {
  return db.prepare("UPDATE houses SET login_code = ? WHERE id = ?").run(loginCode, id).changes;
};

export const deleteHouse = (id) => {
  return db.prepare("DELETE FROM houses WHERE id = ?").run(id).changes;
};

// =======================
// QUESTION HELPERS
// =======================
export const getQuestions = () => {
  return db.prepare("SELECT * FROM questions").all();
};

export const getUnusedQuestions = () => {
  return db.prepare("SELECT * FROM questions WHERE used = 0").all();
};

export const markQuestionUsed = (questionId) => {
  return db.prepare("UPDATE questions SET used = 1 WHERE id = ?").run(questionId).changes;
};

export const resetAllQuestions = () => {
  return db.prepare("UPDATE questions SET used = 0").run().changes;
};

export const createQuestion = (id, clue, hero, heroine, movie, points) => {
  return db.prepare("INSERT INTO questions (id, clue_letters, hero_name, heroine_name, movie_name, points) VALUES (?, ?, ?, ?, ?, ?)").run(id, clue, hero, heroine, movie, points).lastInsertRowid;
};

export const updateQuestion = (id, clue, hero, heroine, movie, points) => {
  return db.prepare("UPDATE questions SET clue_letters = ?, hero_name = ?, heroine_name = ?, movie_name = ?, points = ? WHERE id = ?").run(clue, hero, heroine, movie, points, id).changes;
};

export const deleteQuestion = (id) => {
  return db.prepare("DELETE FROM questions WHERE id = ?").run(id).changes;
};

// =======================
// ADMIN HELPERS
// =======================
export const getAdminByUsername = (username) => {
  return db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
};

export const getAdminById = (id) => {
  return db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
};

export const createAdmin = (id, username, passwordHash) => {
  return db.prepare("INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)").run(id, username, passwordHash).lastInsertRowid;
};

// =======================
// DEVICE & LOG HELPERS
// =======================
export const registerDevice = (deviceId, houseId, studentName) => {
  return db.prepare("INSERT OR REPLACE INTO devices (id, house_id, student_name, last_seen_at) VALUES (?, ?, ?, ?)").run(deviceId, houseId, studentName, Date.now()).lastInsertRowid;
};

export const getDeviceById = (id) => {
  return db.prepare("SELECT * FROM devices WHERE id = ?").get(id);
};

export const logRound = (id, questionId, houseId, deviceId, result, points) => {
  return db.prepare("INSERT INTO rounds (id, question_id, locked_house_id, locked_device_id, locked_at, result, points_awarded) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, questionId, houseId, deviceId, Date.now(), result, points).lastInsertRowid;
};

export const getRecentRounds = (limit = 5) => {
  return db.prepare(`
    SELECT r.*, q.clue_letters, q.hero_name, q.heroine_name, q.movie_name, 
           h.name as house_name, h.color as house_color, h.icon as house_icon,
           d.student_name
    FROM rounds r
    LEFT JOIN questions q ON r.question_id = q.id
    LEFT JOIN houses h ON r.locked_house_id = h.id
    LEFT JOIN devices d ON r.locked_device_id = d.id
    ORDER BY r.locked_at DESC
    LIMIT ?
  `).all(limit);
};
