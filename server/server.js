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
  createQuestion, updateQuestion, deleteQuestion, resetAllQuestions, logRound, getRecentRounds,
  getDeviceById, resetLeaderboard, initDb
} from './db.js';

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

// Auth Middleware
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await getAdminById(decoded.id);
    if (!admin) throw new Error();
    req.admin = admin;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
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
    const existing = await getAdminByUsername(username);
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const id = 'admin_' + Date.now();
    await createAdmin(id, username, hash);
    
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 3600000, sameSite: 'lax' });
    res.json({ success: true, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await getAdminByUsername(username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 3600000, sameSite: 'lax' });
    res.json({ success: true, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
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
    if (!loginCode || loginCode.length < 4 || /\s/.test(loginCode)) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters with no spaces.' });
    }
    const houses = await getHouses();
    const isDuplicate = houses.some(h => h.id !== req.params.id && h.login_code === loginCode);
    if (isDuplicate) {
      return res.status(400).json({ error: 'This PIN is already used by another house.' });
    }
    await updateHouseLoginCode(req.params.id, loginCode);
    broadcastLeaderboard();
    res.json({ success: true, newCode: loginCode });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ==========================
// Question Manager API
// ==========================
app.post('/api/admin/questions', authenticateAdmin, async (req, res) => {
  try {
    const { clue_letters, hero_name, heroine_name, movie_name, points } = req.body;
    const id = 'q_' + Date.now();
    await createQuestion(id, clue_letters, hero_name, heroine_name, movie_name, points);
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

app.post('/api/admin/questions/import', authenticateAdmin, async (req, res) => {
  try {
    const { csvData } = req.body; // Expecting plain text CSV string
    const lines = csvData.split('\\n');
    let imported = 0;
    
    // Skip header row if exists, simplistic parsing
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.toLowerCase().startsWith('clue')) continue;
      
      const parts = line.split(',');
      if (parts.length >= 4) {
        const clue = parts[0].trim();
        const hero = parts[1].trim();
        const heroine = parts[2].trim();
        const movie = parts[3].trim();
        const points = parseInt(parts[4]) || 10;
        await createQuestion('q_' + Date.now() + '_' + i, clue, hero, heroine, movie, points);
        imported++;
      }
    }
    res.json({ success: true, count: imported });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
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
    const house = await getHouseByLoginCode(loginCode);
    if (!house || house.id !== houseId) {
      return res.status(401).json({ error: 'Invalid login code for this house.' });
    }
    await registerDevice(deviceId, houseId, studentName);
    res.json({ success: true, house });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
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
  getHouses().then(houses => socket.emit('leaderboard:update', houses));
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
