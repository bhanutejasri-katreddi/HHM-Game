import { io } from 'socket.io-client';

const NUM_CLIENTS = 180;
const SERVER_URL = 'http://localhost:3001';

console.log(`Starting load test with ${NUM_CLIENTS} concurrent connections...`);

let connectedClients = 0;
const sockets = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  const socket = io(SERVER_URL);
  
  socket.on('connect', () => {
    connectedClients++;
    if (connectedClients === NUM_CLIENTS) {
      console.log(`All ${NUM_CLIENTS} clients connected.`);
      runBuzzTest();
    }
  });
  
  sockets.push({
    id: `device_${i}`,
    houseId: `house_${(i % 4) + 1}`, // Distribute across 4 houses
    socket
  });
}

async function runBuzzTest() {
  console.log('Simulating Host opening buzzers...');
  
  // Set state to CLUE_SHOWN manually via API (admin)
  await fetch(`${SERVER_URL}/api/admin/start-round`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: 'q_1' })
  });

  console.log('Buzzers open! Simulating 180 simultaneous buzzes...');
  
  const buzzPromises = sockets.map(client => {
    return fetch(`${SERVER_URL}/api/buzz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        houseId: client.houseId,
        deviceId: client.id,
        clientTimestampMs: Date.now()
      })
    }).then(res => res.json());
  });

  const results = await Promise.all(buzzPromises);
  const successCount = results.filter(r => r.success).length;
  
  console.log(`Test Results:`);
  console.log(`- Total requests sent: ${NUM_CLIENTS}`);
  console.log(`- Successful locks acquired: ${successCount} (Should be EXACTLY 1)`);
  
  if (successCount === 1) {
    console.log('✅ Race condition test PASSED. Only one house locked.');
  } else {
    console.error('❌ Race condition test FAILED. Multiple or zero locks acquired.');
  }
  
  process.exit(0);
}
