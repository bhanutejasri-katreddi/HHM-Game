export interface ParsedQuestionRow {
  clue_letters: string;
  hero_name: string;
  heroine_name: string;
  movie_name: string;
  points: number;
  isValid: boolean;
  validationError?: string;
  rowNumber: number;
}

export function parseCSV(csvString: string): string[][] {
  if (!csvString || typeof csvString !== 'string') return [];
  // Strip UTF-8 BOM if present
  const cleanStr = csvString.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
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

const norm = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseQuestionsFromCSV(csvData: string): {
  rows: ParsedQuestionRow[];
  validCount: number;
  invalidCount: number;
  total: number;
} {
  const parsedRows = parseCSV(csvData);
  if (parsedRows.length === 0) {
    return { rows: [], validCount: 0, invalidCount: 0, total: 0 };
  }

  const headerRow = parsedRows[0];
  const clueIdx = headerRow.findIndex(h => ['clue', 'clueletters', 'clues', 'letters', 'initials', 'prompt', 'code', 'shortcode'].includes(norm(h)));
  const heroIdx = headerRow.findIndex(h => ['hero', 'heroname', 'actor', 'malelead', 'male', 'actorname', 'heroactor'].includes(norm(h)));
  const heroineIdx = headerRow.findIndex(h => ['heroine', 'heroinename', 'actress', 'femalelead', 'female', 'actressname', 'heroineactress'].includes(norm(h)));
  const movieIdx = headerRow.findIndex(h => ['movie', 'moviename', 'film', 'filmname', 'title', 'cinema', 'movietitle'].includes(norm(h)));
  const pointsIdx = headerRow.findIndex(h => ['points', 'point', 'score', 'pts', 'mark', 'marks'].includes(norm(h)));

  const hasHeader = (clueIdx !== -1 || heroIdx !== -1 || heroineIdx !== -1 || movieIdx !== -1);
  const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;
  const startRowOffset = hasHeader ? 2 : 1;

  const colMap = {
    clue: clueIdx !== -1 ? clueIdx : 0,
    hero: heroIdx !== -1 ? heroIdx : 1,
    heroine: heroineIdx !== -1 ? heroineIdx : 2,
    movie: movieIdx !== -1 ? movieIdx : 3,
    points: pointsIdx !== -1 ? pointsIdx : 4
  };

  const rows: ParsedQuestionRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + startRowOffset;
    
    // Ignore completely empty rows
    if (row.every(c => !c.trim())) continue;

    const clue = (row[colMap.clue] || '').trim();
    const hero = (row[colMap.hero] || '').trim();
    const heroine = (row[colMap.heroine] || '').trim();
    const movie = (row[colMap.movie] || '').trim();
    const rawPts = colMap.points < row.length ? row[colMap.points] : '';
    const points = parseInt(rawPts) || 1;

    const missingFields: string[] = [];
    if (!clue) missingFields.push('Clue');
    if (!hero) missingFields.push('Hero');
    if (!heroine) missingFields.push('Heroine');
    if (!movie) missingFields.push('Movie');

    const isValid = missingFields.length === 0;
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    rows.push({
      clue_letters: clue,
      hero_name: hero,
      heroine_name: heroine,
      movie_name: movie,
      points,
      isValid,
      validationError: isValid ? undefined : `Missing: ${missingFields.join(', ')}`,
      rowNumber
    });
  }

  return {
    rows,
    validCount,
    invalidCount,
    total: rows.length
  };
}

export function generateSampleCSV(): string {
  return `Clue,Hero,Heroine,Movie,Points
PAB,Prabhas,Anushka,Baahubali,1
PIJ,Pawan Kalyan,Ileana,Jalsa,1
APA,Allu Arjun,Pooja Hegde,Ala Vaikunthapurramuloo,1
MSD,Mahesh Babu,Samantha,Dookudu,1
RRR,NTR & Ram Charan,Alia Bhatt,RRR,1
MSG,Mahesh Babu,Sreeleela,Guntur Kaaram,1
APD,Allu Arjun,Pooja Hegde,Duvvada Jagannadham,1
VSK,Vijay Deverakonda,Samantha,Kushi,1`;
}

export function downloadSampleCSV(): void {
  const csvContent = generateSampleCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'hhm_questions_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
