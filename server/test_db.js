import { initDb, getUnusedQuestions, getQuestions, markQuestionUsed } from './db.js';

async function test() {
  await initDb();
  console.log('All questions:', await getQuestions());
  console.log('Unused questions before:', await getUnusedQuestions());
  await markQuestionUsed('q_1');
  console.log('Unused questions after:', await getUnusedQuestions());
}

test().catch(console.error);
