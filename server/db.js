import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, 'buzzer.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

export const initDb = () => new Promise((resolve, reject) => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS houses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT DEFAULT 'Circle',
        login_code TEXT NOT NULL,
        score INTEGER DEFAULT 0
      )
    `);

    // Ensure icon column exists if table was created in an older version
    db.run("ALTER TABLE houses ADD COLUMN icon TEXT DEFAULT 'Circle'", (err) => {
      // Ignore error if column already exists
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        house_id TEXT NOT NULL,
        student_name TEXT,
        last_seen_at INTEGER,
        FOREIGN KEY (house_id) REFERENCES houses(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        clue_letters TEXT NOT NULL,
        hero_name TEXT NOT NULL,
        heroine_name TEXT NOT NULL,
        movie_name TEXT NOT NULL,
        points INTEGER DEFAULT 10,
        used BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
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
      )
    `);

    let pendingChecks = 2;
    const checkDone = () => {
      pendingChecks--;
      if (pendingChecks === 0) resolve();
    };

    db.get("SELECT COUNT(*) AS count FROM houses", (err, row) => {
      if (row && row.count === 0) {
        db.serialize(() => {
          const stmt = db.prepare("INSERT INTO houses (id, name, color, icon, login_code) VALUES (?, ?, ?, ?, ?)");
          stmt.run('house_1', 'House Aakash', '#0ea5e9', 'Cloud', '1234');
          stmt.run('house_2', 'House Vayu', '#94a3b8', 'Wind', '2345');
          stmt.run('house_3', 'House Agni', '#ef4444', 'Flame', '3456');
          stmt.run('house_4', 'House Prudhvi', '#22c55e', 'TreePine', '4567');
          stmt.run('house_5', 'House Jal', '#3b82f6', 'Droplets', '5678');
          stmt.finalize(checkDone);
          console.log('Seeded houses.');
        });
      } else {
        checkDone();
      }
    });

    db.get("SELECT COUNT(*) AS count FROM questions", (err, row) => {
      if (row && row.count === 0) {
        db.serialize(() => {
          const stmt = db.prepare("INSERT INTO questions (id, clue_letters, hero_name, heroine_name, movie_name) VALUES (?, ?, ?, ?, ?)");
          stmt.run('q_1', 'MSD', 'Mahesh Babu', 'Samantha', 'Dookudu');
          stmt.run('q_2', 'VVR', 'Ram Charan', 'Kiara', 'Vinaya Vidheya Rama');
          stmt.run('q_3', 'KGF', 'Yash', 'Srinidhi', 'KGF');
          stmt.finalize(checkDone);
          console.log('Seeded questions.');
        });
      } else {
        checkDone();
      }
    });
  });
});

// =======================
// HOUSE HELPERS
// =======================
export const getHouses = () => new Promise((resolve, reject) => {
  db.all("SELECT * FROM houses ORDER BY score DESC", (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

export const getHouseByLoginCode = (code) => new Promise((resolve, reject) => {
  db.get("SELECT * FROM houses WHERE login_code = ?", [code], (err, row) => {
    if (err) reject(err); else resolve(row);
  });
});

export const updateHouseScore = (houseId, points) => new Promise((resolve, reject) => {
  db.run("UPDATE houses SET score = score + ? WHERE id = ?", [points, houseId], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const resetLeaderboard = () => new Promise((resolve, reject) => {
  db.run("UPDATE houses SET score = 0", [], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const createHouse = (id, name, color, icon, loginCode) => new Promise((resolve, reject) => {
  db.run("INSERT INTO houses (id, name, color, icon, login_code) VALUES (?, ?, ?, ?, ?)", 
    [id, name, color, icon, loginCode], function(err) {
    if (err) reject(err); else resolve(this.lastID);
  });
});

export const updateHouse = (id, name, color, icon) => new Promise((resolve, reject) => {
  db.run("UPDATE houses SET name = ?, color = ?, icon = ? WHERE id = ?", 
    [name, color, icon, id], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const updateHouseLoginCode = (id, loginCode) => new Promise((resolve, reject) => {
  db.run("UPDATE houses SET login_code = ? WHERE id = ?", [loginCode, id], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const deleteHouse = (id) => new Promise((resolve, reject) => {
  db.run("DELETE FROM houses WHERE id = ?", [id], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

// =======================
// QUESTION HELPERS
// =======================
export const getQuestions = () => new Promise((resolve, reject) => {
  db.all("SELECT * FROM questions", (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

export const getUnusedQuestions = () => new Promise((resolve, reject) => {
  db.all("SELECT * FROM questions WHERE used = 0", (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

export const markQuestionUsed = (questionId) => new Promise((resolve, reject) => {
  db.run("UPDATE questions SET used = 1 WHERE id = ?", [questionId], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const resetAllQuestions = () => new Promise((resolve, reject) => {
  db.run("UPDATE questions SET used = 0", [], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const createQuestion = (id, clue, hero, heroine, movie, points) => new Promise((resolve, reject) => {
  db.run("INSERT INTO questions (id, clue_letters, hero_name, heroine_name, movie_name, points) VALUES (?, ?, ?, ?, ?, ?)", 
    [id, clue, hero, heroine, movie, points], function(err) {
    if (err) reject(err); else resolve(this.lastID);
  });
});

export const updateQuestion = (id, clue, hero, heroine, movie, points) => new Promise((resolve, reject) => {
  db.run("UPDATE questions SET clue_letters = ?, hero_name = ?, heroine_name = ?, movie_name = ?, points = ? WHERE id = ?", 
    [clue, hero, heroine, movie, points, id], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

export const deleteQuestion = (id) => new Promise((resolve, reject) => {
  db.run("DELETE FROM questions WHERE id = ?", [id], function(err) {
    if (err) reject(err); else resolve(this.changes);
  });
});

// =======================
// ADMIN HELPERS
// =======================
export const getAdminByUsername = (username) => new Promise((resolve, reject) => {
  db.get("SELECT * FROM admins WHERE username = ?", [username], (err, row) => {
    if (err) reject(err); else resolve(row);
  });
});

export const getAdminById = (id) => new Promise((resolve, reject) => {
  db.get("SELECT * FROM admins WHERE id = ?", [id], (err, row) => {
    if (err) reject(err); else resolve(row);
  });
});

export const createAdmin = (id, username, passwordHash) => new Promise((resolve, reject) => {
  db.run("INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)", 
    [id, username, passwordHash], function(err) {
    if (err) reject(err); else resolve(this.lastID);
  });
});

// =======================
// DEVICE & LOG HELPERS
// =======================
export const registerDevice = (deviceId, houseId, studentName) => new Promise((resolve, reject) => {
  db.run("INSERT OR REPLACE INTO devices (id, house_id, student_name, last_seen_at) VALUES (?, ?, ?, ?)", 
    [deviceId, houseId, studentName, Date.now()], function(err) {
    if (err) reject(err); else resolve(this.lastID);
  });
});

export const getDeviceById = (id) => new Promise((resolve, reject) => {
  db.get("SELECT * FROM devices WHERE id = ?", [id], (err, row) => {
    if (err) reject(err); else resolve(row);
  });
});

export const logRound = (id, questionId, houseId, deviceId, result, points) => new Promise((resolve, reject) => {
  db.run("INSERT INTO rounds (id, question_id, locked_house_id, locked_device_id, locked_at, result, points_awarded) VALUES (?, ?, ?, ?, ?, ?, ?)", 
    [id, questionId, houseId, deviceId, Date.now(), result, points], function(err) {
    if (err) reject(err); else resolve(this.lastID);
  });
});

export const getRecentRounds = (limit = 5) => new Promise((resolve, reject) => {
  db.all(`
    SELECT r.*, q.clue_letters, q.hero_name, q.heroine_name, q.movie_name, 
           h.name as house_name, h.color as house_color, h.icon as house_icon,
           d.student_name
    FROM rounds r
    LEFT JOIN questions q ON r.question_id = q.id
    LEFT JOIN houses h ON r.locked_house_id = h.id
    LEFT JOIN devices d ON r.locked_device_id = d.id
    ORDER BY r.locked_at DESC
    LIMIT ?
  `, [limit], (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

