import { getUnusedQuestions, getQuestions, markQuestionUsed } from './db.js';

async function test() {
  console.log("All questions:", await getQuestions());
  console.log("Unused questions before:", await getUnusedQuestions());
  await markQuestionUsed('q_3');
  console.log("Unused questions after:", await getUnusedQuestions());
}

test().catch(console.error);
