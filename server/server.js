import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { 
  db, getHouses, getQuestions, getUnusedQuestions, updateHouseScore, markQuestionUsed, 
  getHouseByLoginCode, registerDevice, getAdminByUsername, getAdminById, createAdmin,
  createHouse, updateHouse, deleteHouse, updateHouseLoginCode,
  createQuestion, updateQuestion, deleteQuestion, resetAllQuestions, reorderQuestions,
  logRound, getRecentRounds, getDeviceById, resetLeaderboard, initDb
} from './db.js';
import { parseQuestionsFromCSV } from './csvParser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_hhm_quiz_admin';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Auth Middleware - supports both Cookie and Authorization Bearer header
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = req.cookies.admin_token || bearerToken || req.headers['x-admin-token'];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = getAdminById(decoded.id);
    if (!admin) throw new Error('Admin not found');
    req.admin = admin;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER) || Boolean(process.env.DB_PATH);
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 3600000
  };
};

// Game State
let gameState = {
  status: 'IDLE', // IDLE, CLUE_SHOWN, LOCKED, JUDGED
  currentQuestion: null,
  currentRoundId: null,
  buzzersOpen: false,
  lockedHouseId: null,
  lockedByDeviceId: null,
  lockedStudentName: null,
  lockedOutHouses: [],
  timerSeconds: 0
};

let timerInterval = null;
const connectedDevices = {}; // socket.id -> houseId

// Helper to broadcast state
const broadcastState = () => {
  io.to('game:main').emit('state:update', gameState);
};

const broadcastLeaderboard = async () => {
  const houses = await getHouses();
  io.to('game:main').emit('leaderboard:update', houses);
};

const broadcastDevices = () => {
  const houseCounts = {};
  Object.values(connectedDevices).forEach(houseId => {
    if (houseId) houseCounts[houseId] = (houseCounts[houseId] || 0) + 1;
  });
  io.to('game:main').emit('devices:update', houseCounts);
};

// ==========================
// Admin Auth API
// ==========================
app.post('/api/admin/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = getAdminByUsername(username);
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const id = 'admin_' + Date.now();
    createAdmin(id, username, hash);
    
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, getCookieOptions());
    res.json({ success: true, username, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = getAdminByUsername(username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, getCookieOptions());
    res.json({ success: true, username: admin.username, token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token', getCookieOptions());
  res.json({ success: true });
});

app.get('/api/admin/me', authenticateAdmin, (req, res) => {
  res.json({ success: true, username: req.admin.username });
});

app.get('/api/admin/houses', authenticateAdmin, async (req, res) => {
  try {
    const houses = await getHouses();
    res.json(houses);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/questions', authenticateAdmin, async (req, res) => {
  try {
    const questions = await getQuestions();
    res.json(questions);
  } catch (e) {
    console.error('Error fetching questions:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/recent-rounds', authenticateAdmin, async (req, res) => {
  try {
    const rounds = await getRecentRounds(10);
    res.json(rounds);
  } catch (e) {
    console.error('Error fetching recent rounds:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================
// House Manager API
// ==========================
app.post('/api/admin/houses', authenticateAdmin, async (req, res) => {
  try {
    const { name, color, icon, loginCode } = req.body;
    const id = 'house_' + Date.now();
    await createHouse(id, name, color, icon, loginCode);
    broadcastLeaderboard();
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/houses/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    await updateHouse(req.params.id, name, color, icon);
    broadcastLeaderboard();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/houses/:id', authenticateAdmin, async (req, res) => {
  try {
    await deleteHouse(req.params.id);
    broadcastLeaderboard();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/houses/:id/regenerate-code', authenticateAdmin, async (req, res) => {
  try {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    await updateHouseLoginCode(req.params.id, newCode);
    broadcastLeaderboard();
    res.json({ success: true, newCode });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/houses/:id/custom-code', authenticateAdmin, async (req, res) => {
  try {
    const { loginCode } = req.body;
    const clean = String(loginCode || '').trim();
    if (!clean || clean.length < 3 || /\s/.test(clean)) {
      return res.status(400).json({ error: 'Code must be at least 3 characters with no spaces.' });
    }
    const houses = await getHouses();
    const isDuplicate = houses.some(h => h.id !== req.params.id && h.login_code?.toLowerCase() === clean.toLowerCase());
    if (isDuplicate) {
      return res.status(400).json({ error: 'This Code is already used by another house.' });
    }
    await updateHouseLoginCode(req.params.id, clean);
    broadcastLeaderboard();
    res.json({ success: true, newCode: clean });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ==========================
// Question Manager API
// ==========================
app.post('/api/admin/questions', authenticateAdmin, async (req, res) => {
  try {
    const { clue_letters, hero_name, heroine_name, movie_name, points } = req.body;
    const id = 'q_' + Date.now();
    const pts = parseInt(points) || 1;
    await createQuestion(id, clue_letters, hero_name, heroine_name, movie_name, pts);
    res.json({ success: true, id });
  } catch (e) { 
    console.error("Error creating question:", e);
    res.status(500).json({ error: e.message || 'Server error' }); 
  }
});

app.put('/api/admin/questions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { clue_letters, hero_name, heroine_name, movie_name, points } = req.body;
    await updateQuestion(req.params.id, clue_letters, hero_name, heroine_name, movie_name, points);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/questions/:id', authenticateAdmin, async (req, res) => {
  try {
    await deleteQuestion(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/questions/reset-used', authenticateAdmin, async (req, res) => {
  try {
    await resetAllQuestions();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/questions/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array of question IDs' });
    }
    await reorderQuestions(orderedIds);
    res.json({ success: true });
  } catch (e) { 
    console.error('Error reordering questions:', e);
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/admin/questions/import', authenticateAdmin, async (req, res) => {
  try {
    const { csvData, questions: preParsedQuestions } = req.body;
    let questionsToImport = [];
    let skipped = 0;
    let total = 0;

    if (Array.isArray(preParsedQuestions) && preParsedQuestions.length > 0) {
      questionsToImport = preParsedQuestions;
      total = preParsedQuestions.length;
    } else if (csvData && typeof csvData === 'string') {
      const parseResult = parseQuestionsFromCSV(csvData);
      questionsToImport = parseResult.questions;
      skipped = parseResult.skipped;
      total = parseResult.total;
    } else {
      return res.status(400).json({ error: 'No CSV data or questions payload provided' });
    }

    if (questionsToImport.length === 0) {
      return res.status(400).json({ 
        error: 'No valid questions found. Ensure the file contains required columns: Clue, Hero, Heroine, Movie.' 
      });
    }

    let imported = 0;
    const now = Date.now();
    for (let i = 0; i < questionsToImport.length; i++) {
      const q = questionsToImport[i];
      const clue = (q.clue_letters || q.clue || '').trim();
      const hero = (q.hero_name || q.hero || '').trim();
      const heroine = (q.heroine_name || q.heroine || '').trim();
      const movie = (q.movie_name || q.movie || '').trim();
      const points = parseInt(q.points) || 1;

      if (clue && hero && heroine && movie) {
        const uniqueId = `q_${now}_${i}_${Math.random().toString(36).substring(2, 7)}`;
        await createQuestion(uniqueId, clue, hero, heroine, movie, points);
        imported++;
      } else {
        skipped++;
      }
    }

    res.json({ 
      success: true, 
      count: imported, 
      skipped, 
      total: total || imported + skipped 
    });
  } catch (e) { 
    console.error('Error importing questions:', e);
    res.status(500).json({ error: e.message || 'Server error' }); 
  }
});


// ==========================
// Student API
// ==========================
app.get('/api/houses', async (req, res) => {
  try {
    const houses = await getHouses();
    const publicHouses = houses.map(h => ({ id: h.id, name: h.name, color: h.color, icon: h.icon }));
    res.json(publicHouses);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { houseId, loginCode, studentName, deviceId } = req.body;
  try {
    const cleanHouseId = String(houseId || '').trim();
    const cleanCode = String(loginCode || '').trim();
    const cleanStudentName = String(studentName || '').trim();
    const cleanDeviceId = String(deviceId || 'dev_' + Date.now()).trim();

    if (!cleanHouseId || !cleanCode || !cleanStudentName) {
      return res.status(400).json({ error: 'Please select a House, enter the Login Code, and enter your Name.' });
    }

    const house = getHouseByLoginCode(cleanCode);
    if (!house || house.id.toLowerCase() !== cleanHouseId.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid login code' });
    }

    await registerDevice(cleanDeviceId, house.id, cleanStudentName);
    broadcastDevices();
    
    res.json({ 
      success: true, 
      house: {
        id: house.id,
        name: house.name,
        color: house.color,
        icon: house.icon,
        score: house.score
      }
    });
  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post('/api/buzz', async (req, res) => {
  const serverTimestampMs = Date.now();
  const { houseId, deviceId, clientTimestampMs } = req.body;

  if (!gameState.buzzersOpen || gameState.status !== 'CLUE_SHOWN') {
    return res.json({ success: false, reason: 'Buzzers closed' });
  }

  if (gameState.lockedOutHouses.includes(houseId)) {
    return res.json({ success: false, reason: 'House is locked out for this round' });
  }

  if (gameState.lockedHouseId) {
    return res.json({ success: false, reason: 'Already locked' });
  }

  let studentName = null;
  try {
    const device = await getDeviceById(deviceId);
    if (device && device.student_name && device.student_name.trim() !== '') {
      studentName = device.student_name.trim();
    }
  } catch(e) {}

  // Lock the buzzer synchronously
  gameState.buzzersOpen = false;
  gameState.status = 'LOCKED';
  gameState.lockedHouseId = houseId;
  gameState.lockedByDeviceId = deviceId;
  gameState.lockedStudentName = studentName;
  gameState.lockedAt = serverTimestampMs;
  gameState.buzzElapsedMs = gameState.roundStartedAt ? (serverTimestampMs - gameState.roundStartedAt) : null;
  gameState.timerSeconds = 15;

  // Emit lock event immediately
  io.to('game:main').emit('buzzer:locked', {
    houseId,
    deviceId,
    studentName,
    serverTimestampMs,
    buzzElapsedMs: gameState.buzzElapsedMs
  });
  broadcastState();

  // Start Server Timer (15s countdown)
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    gameState.timerSeconds -= 1;
    io.to('game:main').emit('timer:tick', { seconds: gameState.timerSeconds });

    if (gameState.timerSeconds <= 0) {
      clearInterval(timerInterval);
      io.to('game:main').emit('timer:expired');
    }
  }, 1000);

  res.json({ success: true, serverTimestampMs });
});

// ==========================
// Admin Game Controls API (Protected)
// ==========================
app.post('/api/admin/start-round', authenticateAdmin, async (req, res) => {
  const { questionId } = req.body;
  const questions = await getQuestions();
  let question = questions.find(q => q.id === questionId);
  
  // If no specific question is requested, load next unused
  if (!question) {
    const unused = await getUnusedQuestions();
    if (unused.length === 0) {
      return res.status(400).json({ error: 'No unused questions left in question bank' });
    }
    question = unused[0]; // sequential
  }

  // Immediately mark question as used so next click loads next distinct question
  await markQuestionUsed(question.id);

  gameState = {
    status: 'CLUE_SHOWN',
    currentQuestion: { ...question, used: true },
    currentRoundId: `round_${Date.now()}`,
    buzzersOpen: true,
    lockedHouseId: null,
    lockedByDeviceId: null,
    lockedStudentName: null,
    lockedOutHouses: [],
    timerSeconds: 0,
    roundStartedAt: Date.now(),
    buzzElapsedMs: null
  };

  if (timerInterval) clearInterval(timerInterval);
  
  io.to('game:main').emit('clue:show', { question: gameState.currentQuestion });
  broadcastState();
  res.json({ success: true, question: gameState.currentQuestion });
});

app.post('/api/admin/judge', authenticateAdmin, async (req, res) => {
  const { correct, points } = req.body;
  
  if (timerInterval) clearInterval(timerInterval);
  
  const pointsDelta = correct ? (points !== undefined ? points : 1) : (points !== undefined ? -points : -1);
  const currentLockedHouseId = gameState.lockedHouseId;

  if (currentLockedHouseId) {
    await updateHouseScore(currentLockedHouseId, pointsDelta);
  }

  await logRound(
    'r_' + Date.now(), 
    gameState.currentQuestion?.id || 'q_manual', 
    currentLockedHouseId, 
    gameState.lockedByDeviceId, 
    correct ? 'CORRECT' : 'WRONG', 
    pointsDelta
  );

  if (correct) {
    gameState.status = 'JUDGED';
    if (gameState.currentQuestion) {
      await markQuestionUsed(gameState.currentQuestion.id);
    }
    io.to('game:main').emit('answer:result', { correct: true, houseId: currentLockedHouseId, points: pointsDelta });
    broadcastLeaderboard();
  } else {
    // Lockout logic: Add this house to locked out list
    if (currentLockedHouseId && !gameState.lockedOutHouses.includes(currentLockedHouseId)) {
       gameState.lockedOutHouses.push(currentLockedHouseId);
    }

    // Reopen buzzers if wrong
    gameState.status = 'CLUE_SHOWN';
    gameState.lockedHouseId = null;
    gameState.lockedByDeviceId = null;
    gameState.lockedStudentName = null;
    gameState.buzzersOpen = true;
    io.to('game:main').emit('answer:result', { correct: false, houseId: currentLockedHouseId });
    broadcastLeaderboard();
  }
  
  broadcastState();
  res.json({ success: true });
});

app.post('/api/admin/reset-buzzers', authenticateAdmin, (req, res) => {
  if (timerInterval) clearInterval(timerInterval);
  gameState.status = 'CLUE_SHOWN';
  gameState.lockedHouseId = null;
  gameState.lockedByDeviceId = null;
  gameState.lockedStudentName = null;
  gameState.buzzersOpen = true;
  gameState.timerSeconds = 0;
  // Does NOT clear lockedOutHouses, only start-round does that
  
  broadcastState();
  res.json({ success: true });
});

app.post('/api/admin/idle', authenticateAdmin, (req, res) => {
  if (timerInterval) clearInterval(timerInterval);
  gameState = {
    status: 'IDLE',
    currentQuestion: null,
    currentRoundId: null,
    buzzersOpen: false,
    lockedHouseId: null,
    lockedByDeviceId: null,
    lockedStudentName: null,
    lockedOutHouses: [],
    timerSeconds: 0
  };
  broadcastState();
  res.json({ success: true });
});

app.post('/api/admin/score', authenticateAdmin, async (req, res) => {
  const { houseId, pointsDelta } = req.body;
  await updateHouseScore(houseId, pointsDelta);
  broadcastLeaderboard();
  res.json({ success: true });
});

app.post('/api/admin/reset-leaderboard', authenticateAdmin, async (req, res) => {
  try {
    await resetLeaderboard();
    broadcastLeaderboard();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================
// Public APIs
// ==========================
app.get('/api/houses', async (req, res) => {
  try {
    const houses = await getHouses();
    // Strip login_code for public endpoint
    const safeHouses = houses.map(({ login_code, ...rest }) => rest);
    res.json(safeHouses);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/questions', authenticateAdmin, async (req, res) => {
  try {
    const questions = await getQuestions();
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/recent-rounds', authenticateAdmin, async (req, res) => {
  try {
    const rounds = await getRecentRounds(5);
    res.json(rounds);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  socket.join('game:main');
  
  socket.emit('state:update', gameState);
  socket.emit('leaderboard:update', getHouses());
  socket.emit('devices:update', getDeviceCounts());

  socket.on('join_house', (houseId) => {
    connectedDevices[socket.id] = houseId;
    broadcastDevices();
  });

  socket.on('disconnect', () => {
    if (connectedDevices[socket.id]) {
      delete connectedDevices[socket.id];
      broadcastDevices();
    }
  });
  
  socket.on('answer:submit', (data) => {
    io.to('game:main').emit('answer:submit', data);
  });
});

function getDeviceCounts() {
  const houseCounts = {};
  Object.values(connectedDevices).forEach(houseId => {
    if (houseId) houseCounts[houseId] = (houseCounts[houseId] || 0) + 1;
  });
  return houseCounts;
}

const PORT = process.env.PORT || 3001;
initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
