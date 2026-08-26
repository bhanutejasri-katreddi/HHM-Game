import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:3001';

async function runTests() {
  console.log("🚀 Starting comprehensive backend DB & API verification...\n");

  let adminCookie = null;

  // 1. ADMIN AUTHENTICATION
  console.log("--- Testing Admin Auth ---");
  const testAdminUser = `admin_test_${Date.now()}`;
  const testAdminPass = 'Password123!';

  // Admin Signup
  const signupRes = await fetch(`${BASE_URL}/api/admin/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testAdminUser, password: testAdminPass })
  });
  assert.strictEqual(signupRes.status, 200, "Signup should return 200");
  const signupData = await signupRes.json();
  assert.strictEqual(signupData.success, true, "Signup success should be true");
  assert.ok(signupData.token, "Signup must return JWT token for cross-domain auth");
  
  // Extract cookie from response header
  const rawCookie = signupRes.headers.get('set-cookie');
  if (rawCookie) {
    adminCookie = rawCookie.split(';')[0];
  }
  console.log("✅ Admin Signup passed (returned JWT token & cookie)");

  // Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testAdminUser, password: testAdminPass })
  });
  assert.strictEqual(loginRes.status, 200, "Login should return 200");
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true, "Login success should be true");
  assert.ok(loginData.token, "Login must return JWT token for cross-domain auth");
  const authToken = loginData.token;
  console.log("✅ Admin Login passed (returned JWT token & cookie)");

  // Admin Me (Header-based auth test, simulating cross-origin browser)
  const meHeaderRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(meHeaderRes.status, 200, "/api/admin/me with Bearer token should return 200");
  const meHeaderData = await meHeaderRes.json();
  assert.strictEqual(meHeaderData.username, testAdminUser, "Username should match");
  console.log("✅ Admin Me passed via Authorization Bearer header");

  // Admin Me (Cookie-based auth test)
  const meCookieRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(meCookieRes.status, 200, "/api/admin/me with Cookie should return 200");
  console.log("✅ Admin Me passed via Cookie");

  // 2. HOUSE MANAGER CRUD & PIN OPERATIONS
  console.log("\n--- Testing House Manager ---");
  // List houses (using Bearer header)
  const housesRes = await fetch(`${BASE_URL}/api/admin/houses`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(housesRes.status, 200);
  const initialHouses = await housesRes.json();
  assert.ok(Array.isArray(initialHouses) && initialHouses.length >= 5, "Initial houses should exist");
  console.log(`✅ Loaded ${initialHouses.length} houses`);

  // Create house
  const newHouseId = `test_house_${Date.now()}`;
  const createHouseRes = await fetch(`${BASE_URL}/api/admin/houses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      name: 'House Test',
      color: '#ff00ff',
      icon: 'Star',
      loginCode: '9999'
    })
  });
  assert.strictEqual(createHouseRes.status, 200);
  const createHouseData = await createHouseRes.json();
  const createdHouseId = createHouseData.id;
  assert.ok(createdHouseId, "Created house should have ID");
  console.log(`✅ Created test house with ID: ${createdHouseId}`);

  // Update house
  const updateHouseRes = await fetch(`${BASE_URL}/api/admin/houses/${createdHouseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      name: 'House Test Updated',
      color: '#00ffff',
      icon: 'Zap'
    })
  });
  assert.strictEqual(updateHouseRes.status, 200);
  console.log("✅ Updated test house details");

  // Update Custom PIN
  const customPinRes = await fetch(`${BASE_URL}/api/admin/houses/${createdHouseId}/custom-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ loginCode: '8888' })
  });
  assert.strictEqual(customPinRes.status, 200);
  const customPinData = await customPinRes.json();
  assert.strictEqual(customPinData.newCode, '8888');
  console.log("✅ Set custom PIN to 8888");

  // Regenerate PIN
  const regenPinRes = await fetch(`${BASE_URL}/api/admin/houses/${createdHouseId}/regenerate-code`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(regenPinRes.status, 200);
  const regenPinData = await regenPinRes.json();
  assert.ok(regenPinData.newCode && regenPinData.newCode.length === 4);
  console.log(`✅ Regenerated PIN: ${regenPinData.newCode}`);

  // Delete House
  const deleteHouseRes = await fetch(`${BASE_URL}/api/admin/houses/${createdHouseId}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(deleteHouseRes.status, 200);
  console.log("✅ Deleted test house");

  // 3. QUESTION BANK CRUD, RESET, AND IMPORT
  console.log("\n--- Testing Question Bank ---");
  // List Questions
  const questionsRes = await fetch(`${BASE_URL}/api/admin/questions`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(questionsRes.status, 200);
  const initialQuestions = await questionsRes.json();
  assert.ok(Array.isArray(initialQuestions));
  console.log(`✅ Loaded ${initialQuestions.length} questions`);

  // Create Question
  const createQRes = await fetch(`${BASE_URL}/api/admin/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      clue_letters: 'RRR',
      hero_name: 'NTR & Ram Charan',
      heroine_name: 'Alia Bhatt',
      movie_name: 'RRR',
      points: 15
    })
  });
  assert.strictEqual(createQRes.status, 200);
  const createQData = await createQRes.json();
  const createdQId = createQData.id;
  assert.ok(createdQId, "Created question ID");
  console.log(`✅ Created question with ID: ${createdQId}`);

  // Update Question
  const updateQRes = await fetch(`${BASE_URL}/api/admin/questions/${createdQId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      clue_letters: 'RRR2',
      hero_name: 'NTR & Ram Charan',
      heroine_name: 'Alia Bhatt',
      movie_name: 'RRR Reloaded',
      points: 20
    })
  });
  assert.strictEqual(updateQRes.status, 200);
  console.log("✅ Updated question");

  // Import CSV questions (Standard header)
  const csvContent = "Clue,Hero,Heroine,Movie,Points\nBB,Prabhas,Anushka,Baahubali,10\nPK,Pawan Kalyan,Ileana,Jalsa,10";
  const importQRes = await fetch(`${BASE_URL}/api/admin/questions/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ csvData: csvContent })
  });
  assert.strictEqual(importQRes.status, 200);
  const importQData = await importQRes.json();
  assert.strictEqual(importQData.count, 2, "Should import 2 questions");
  console.log("✅ Imported 2 CSV questions (standard headers)");

  // Import CSV with alternative headers and quotes
  const csvWithQuotes = `"clue_letters","hero_name","heroine_name","movie_name","points"\n"RRR","NTR, Ram Charan","Alia Bhatt, Olivia Morris","RRR",20\n"AVPL","Allu Arjun","Pooja Hegde","Ala Vaikunthapurramuloo",15`;
  const importQuotesRes = await fetch(`${BASE_URL}/api/admin/questions/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ csvData: csvWithQuotes })
  });
  assert.strictEqual(importQuotesRes.status, 200);
  const importQuotesData = await importQuotesRes.json();
  assert.strictEqual(importQuotesData.count, 2, "Should import 2 questions with quotes and alt headers");
  console.log("✅ Imported 2 CSV questions (quotes & alias headers)");

  // Import pre-parsed questions array
  const importArrayRes = await fetch(`${BASE_URL}/api/admin/questions/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({
      questions: [
        { clue_letters: 'MSD', hero_name: 'Mahesh Babu', heroine_name: 'Samantha', movie_name: 'Dookudu', points: 10 },
        { clue_letters: 'DJ', hero_name: 'Allu Arjun', heroine_name: 'Pooja Hegde', movie_name: 'DJ', points: 10 }
      ]
    })
  });
  assert.strictEqual(importArrayRes.status, 200);
  const importArrayData = await importArrayRes.json();
  assert.strictEqual(importArrayData.count, 2, "Should import 2 questions from questions array");
  console.log("✅ Imported 2 questions from pre-parsed JSON payload");

  // Reorder Questions
  const allQuestionsRes = await fetch(`${BASE_URL}/api/admin/questions`, {
    headers: { 'Cookie': adminCookie }
  });
  const allQs = await allQuestionsRes.json();
  if (allQs.length >= 2) {
    const reversedIds = allQs.map(q => q.id).reverse();
    const reorderRes = await fetch(`${BASE_URL}/api/admin/questions/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ orderedIds: reversedIds })
    });
    assert.strictEqual(reorderRes.status, 200);

    const reorderedQsRes = await fetch(`${BASE_URL}/api/admin/questions`, {
      headers: { 'Cookie': adminCookie }
    });
    const reorderedQs = await reorderedQsRes.json();
    assert.strictEqual(reorderedQs[0].id, reversedIds[0], "First question should match new order");
    console.log("✅ Question reordering verified successfully");
  }

  // Reset Used questions
  const resetUsedRes = await fetch(`${BASE_URL}/api/admin/questions/reset-used`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(resetUsedRes.status, 200);
  console.log("✅ Reset all questions used status");

  // Delete Question
  const deleteQRes = await fetch(`${BASE_URL}/api/admin/questions/${createdQId}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(deleteQRes.status, 200);
  console.log("✅ Deleted test question");

  // 4. STUDENT LOGIN & BUZZER FLOW
  console.log("\n--- Testing Student Login & Buzzer Flow ---");
  // Public houses endpoint
  const pubHousesRes = await fetch(`${BASE_URL}/api/houses`);
  assert.strictEqual(pubHousesRes.status, 200);
  const pubHouses = await pubHousesRes.json();
  assert.ok(pubHouses.length > 0);
  assert.strictEqual(pubHouses[0].login_code, undefined, "Public endpoint must not leak login_code");
  console.log("✅ Public houses fetched securely");

  // Student login
  const studentLoginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      houseId: 'house_1',
      loginCode: 'AAKASH28',
      studentName: 'Alex Tester',
      deviceId: 'dev_alex_123'
    })
  });
  assert.strictEqual(studentLoginRes.status, 200);
  const studentData = await studentLoginRes.json();
  assert.strictEqual(studentData.success, true);
  console.log("✅ Student login & device registration successful");

  // Admin starts round
  const startRoundRes = await fetch(`${BASE_URL}/api/admin/start-round`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({})
  });
  assert.strictEqual(startRoundRes.status, 200);
  const startRoundData = await startRoundRes.json();
  assert.strictEqual(startRoundData.success, true);
  console.log(`✅ Started round with question: ${startRoundData.question.clue_letters}`);

  // Student buzzes in
  const buzzRes = await fetch(`${BASE_URL}/api/buzz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      houseId: 'house_1',
      deviceId: 'dev_alex_123',
      clientTimestampMs: Date.now()
    })
  });
  assert.strictEqual(buzzRes.status, 200);
  const buzzData = await buzzRes.json();
  assert.strictEqual(buzzData.success, true, "Buzzer lock should succeed");
  console.log("✅ Buzzer lock acquired by house_1");

  // Duplicate buzz should fail
  const duplicateBuzzRes = await fetch(`${BASE_URL}/api/buzz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      houseId: 'house_2',
      deviceId: 'dev_other_456',
      clientTimestampMs: Date.now()
    })
  });
  const duplicateBuzzData = await duplicateBuzzRes.json();
  assert.strictEqual(duplicateBuzzData.success, false, "Second buzz should be rejected");
  console.log("✅ Duplicate buzzer correctly rejected");

  // Admin judges round (Correct)
  const judgeRes = await fetch(`${BASE_URL}/api/admin/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    body: JSON.stringify({ correct: true, points: 10 })
  });
  assert.strictEqual(judgeRes.status, 200);
  console.log("✅ Judged round as correct (+10 pts)");

  // 5. ROUND LOGS & LEADERBOARD RESET
  console.log("\n--- Testing Round Logging & Leaderboard ---");
  const recentRoundsRes = await fetch(`${BASE_URL}/api/admin/recent-rounds`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(recentRoundsRes.status, 200);
  const recentRounds = await recentRoundsRes.json();
  assert.ok(recentRounds.length > 0, "Recent rounds should have entries");
  assert.strictEqual(recentRounds[0].result, 'CORRECT');
  console.log(`✅ Verified logged round: ${recentRounds[0].house_name} awarded ${recentRounds[0].points_awarded} pts`);

  // Reset leaderboard
  const resetLbRes = await fetch(`${BASE_URL}/api/admin/reset-leaderboard`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(resetLbRes.status, 200);
  
  // Verify scores are reset to 0
  const verifyHousesRes = await fetch(`${BASE_URL}/api/admin/houses`, {
    headers: { 'Cookie': adminCookie }
  });
  const verifiedHouses = await verifyHousesRes.json();
  assert.ok(verifiedHouses.every(h => h.score === 0), "All house scores should be 0 after reset");
  console.log("✅ Leaderboard reset verified (all scores 0)");

  // 6. DEFAULT PROTECTED ADMIN
  console.log("\n--- Testing Default Protected Admin ---");
  const defaultLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'b77x.io', password: '777777' })
  });
  assert.strictEqual(defaultLoginRes.status, 200, "Default admin b77x.io should be able to login");
  const defaultLoginData = await defaultLoginRes.json();
  assert.strictEqual(defaultLoginData.success, true);
  assert.strictEqual(defaultLoginData.username, 'b77x.io');
  console.log("✅ Default admin b77x.io login works");

  const deleteProtectedRes = await fetch(`${BASE_URL}/api/admin/admin_default_b77x`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(deleteProtectedRes.status, 403, "Deleting protected default admin should be blocked");
  const deleteProtectedData = await deleteProtectedRes.json();
  assert.match(deleteProtectedData.error, /default admin account and cannot be deleted/i);
  console.log("✅ Protected default admin cannot be deleted");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Database and backend are fully operational with Prisma + Neon Postgres.");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
