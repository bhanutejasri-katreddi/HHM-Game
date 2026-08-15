import { initDb, getUnusedQuestions, getQuestions, markQuestionUsed } from './db.js';

async function test() {
  await initDb();
  console.log("All questions:", getQuestions());
  console.log("Unused questions before:", getUnusedQuestions());
  markQuestionUsed('q_3');
  console.log("Unused questions after:", getUnusedQuestions());
}

test().catch(console.error);
