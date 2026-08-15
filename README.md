# HHM Game — Real-Time Buzzer Quiz System

A real-time multiplayer buzzer quiz game built for live events. Players are split into house-based teams, join on their own devices, and race to buzz in first to answer. The host runs the entire show from a single admin dashboard.

## About

HHM stands for **Hero Heroine Movie** — a fast-paced round format where a 3-letter clue (e.g. "MSD") is shown, and the first team to buzz in has to identify the Hero, Heroine, and Movie it stands for (e.g. Mahesh Babu, Samantha, Dookudu).

Originally built for a college event with 180 students split into 5 houses, but works for any live buzzer-based quiz.

## How It Works

1. The host loads a question from the admin dashboard. A clue appears on every player's screen.
2. Players buzz in from their phone. The first house to buzz wins the round and gets locked in.
3. That house stands up and answers out loud to the host — no typing involved.
4. The host marks the answer Correct or Wrong. Correct is +1 point, Wrong is -1 point.
5. The host loads the next question and the cycle repeats.

## Houses

- Jal
- Aakash
- Vayu
- Prudhvi
- Agni

Each house has its own logo and a login PIN that any student on that team can use to join from their own device.

## Features

- Real-time buzzer with fair, server-timestamp-based first-buzz detection
- Synced 15-second countdown timer visible to both players and the host
- Admin dashboard to manage questions, houses, live game flow, and the leaderboard
- Secure admin login, separate from the student join screen
- Works across 180+ devices at once over WiFi
- Clean, responsive UI with dark and light mode

## Getting Started

```bash
# clone the repo
git clone <repo-url>
cd hhm-game

# install dependencies
npm install

# start the app
npm run dev
```
