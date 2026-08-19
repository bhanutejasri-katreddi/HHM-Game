export function parseCSV(csvString) {
  if (!csvString || typeof csvString !== 'string') return [];
  // Strip UTF-8 BOM if present
  const cleanStr = csvString.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    const nextChar = cleanStr[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

const norm = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseQuestionsFromCSV(csvData) {
  const rows = parseCSV(csvData);
  if (rows.length === 0) return { questions: [], skipped: 0, total: 0 };

  const headerRow = rows[0];
  const clueIdx = headerRow.findIndex(h => ['clue', 'clueletters', 'clues', 'letters', 'initials', 'prompt', 'code', 'shortcode'].includes(norm(h)));
  const heroIdx = headerRow.findIndex(h => ['hero', 'heroname', 'actor', 'malelead', 'male', 'actorname', 'heroactor'].includes(norm(h)));
  const heroineIdx = headerRow.findIndex(h => ['heroine', 'heroinename', 'actress', 'femalelead', 'female', 'actressname', 'heroineactress'].includes(norm(h)));
  const movieIdx = headerRow.findIndex(h => ['movie', 'moviename', 'film', 'filmname', 'title', 'cinema', 'movietitle'].includes(norm(h)));
  const pointsIdx = headerRow.findIndex(h => ['points', 'point', 'score', 'pts', 'mark', 'marks'].includes(norm(h)));

  const hasHeader = (clueIdx !== -1 || heroIdx !== -1 || heroineIdx !== -1 || movieIdx !== -1);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const colMap = {
    clue: clueIdx !== -1 ? clueIdx : 0,
    hero: heroIdx !== -1 ? heroIdx : 1,
    heroine: heroineIdx !== -1 ? heroineIdx : 2,
    movie: movieIdx !== -1 ? movieIdx : 3,
    points: pointsIdx !== -1 ? pointsIdx : 4
  };

  const questions = [];
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.every(c => !c.trim())) continue;

    const clue = (row[colMap.clue] || '').trim();
    const hero = (row[colMap.hero] || '').trim();
    const heroine = (row[colMap.heroine] || '').trim();
    const movie = (row[colMap.movie] || '').trim();
    const rawPts = colMap.points < row.length ? row[colMap.points] : '';
    const points = parseInt(rawPts) || 1;

    if (!clue || !hero || !heroine || !movie) {
      skipped++;
      continue;
    }

    questions.push({
      clue_letters: clue,
      hero_name: hero,
      heroine_name: heroine,
      movie_name: movie,
      points
    });
  }

  return { questions, skipped, total: dataRows.length };
}
