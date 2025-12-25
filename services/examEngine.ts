
import { Question, ExamConfig } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

export interface MatrixConfig {
  mcq: string;  
  tf: string;
  short: string;
  thoigian: number;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function getLevel(q: Question): number {
  const parts = q.classTag.split('.');
  return Number(parts[parts.length - 1]) || 1;
}

/**
 * Parses section: "Score; (G,T,L1,L2,L3,L4), ..."
 */
function parseMatrixSection(str: string) {
  if (!str || !str.includes(';')) return { scorePerItem: 0, totalNeeded: 0, rules: [] };
  
  const [scorePart, rulesPart] = str.split(';');
  const scorePerItem = parseFloat(scorePart.trim()) || 0;
  
  const rules: {g:number, t:number, c1:number, c2:number, c3:number, c4:number}[] = [];
  const matches = rulesPart.matchAll(/\(([^)]+)\)/g);
  let totalNeeded = 0;

  for (const match of matches) {
    const p = match[1].split(',').map(v => parseInt(v.trim()));
    if (p.length < 2) continue;
    const rule = {
      g: p[0],
      t: p[1],
      c1: p[2] || 0,
      c2: p[3] || 0,
      c3: p[4] || 0,
      c4: p[5] || 0
    };
    rules.push(rule);
    totalNeeded += (rule.c1 + rule.c2 + rule.c3 + rule.c4);
  }

  return { scorePerItem, totalNeeded, rules };
}

export function generateExamFromMatrix(matrix: MatrixConfig): { questions: Question[], config: ExamConfig } {
  const sections = [
    { type: 'mcq', data: parseMatrixSection(matrix.mcq) },
    { type: 'true-false', data: parseMatrixSection(matrix.tf) },
    { type: 'short-answer', data: parseMatrixSection(matrix.short) }
  ];

  let finalQuestions: Question[] = [];

  sections.forEach(sec => {
    sec.data.rules.forEach(rule => {
      const pool = ALL_QUESTIONS.filter(q => {
        const p = q.classTag.split('.');
        return q.type === sec.type && Number(p[0]) === rule.g && Number(p[1]) === rule.t;
      });

      const pools = [
        shuffleArray(pool.filter(q => getLevel(q) === 1)),
        shuffleArray(pool.filter(q => getLevel(q) === 2)),
        shuffleArray(pool.filter(q => getLevel(q) === 3)),
        shuffleArray(pool.filter(q => getLevel(q) === 4))
      ];

      const counts = [rule.c1, rule.c2, rule.c3, rule.c4];

      // Pick from level 4 down to 1 with fallback
      for (let lv = 3; lv >= 0; lv--) {
        let needed = counts[lv];
        if (needed <= 0) continue;

        // Try to pick from current level
        const fromCurrent = pools[lv].splice(0, needed);
        finalQuestions.push(...fromCurrent);
        needed -= fromCurrent.length;

        // Fallback to lower levels
        let fallbackLv = lv - 1;
        while (needed > 0 && fallbackLv >= 0) {
          const fromFallback = pools[fallbackLv].splice(0, needed);
          finalQuestions.push(...fromFallback);
          needed -= fromFallback.length;
          fallbackLv--;
        }
      }
    });
  });

  // Shuffle MCQ options
  finalQuestions = finalQuestions.map(q => {
    if (q.type === 'mcq' && q.o) {
      const shuffledOptions = shuffleArray([...q.o]);
      return { ...q, o: shuffledOptions };
    }
    return q;
  });

  const mcq = parseMatrixSection(matrix.mcq);
  const tf = parseMatrixSection(matrix.tf);
  const sa = parseMatrixSection(matrix.short);

  return { 
    questions: finalQuestions, 
    config: {
      grade: 0, topics: [], duration: matrix.thoigian || 45,
      numMC: mcq.totalNeeded, scoreMC: mcq.totalNeeded * mcq.scorePerItem,
      numTF: tf.totalNeeded, scoreTF: tf.totalNeeded * tf.scorePerItem,
      numSA: sa.totalNeeded, scoreSA: sa.totalNeeded * sa.scorePerItem
    } 
  };
}

export function generateFreeExam(config: ExamConfig): Question[] {
  let questions: Question[] = [];

  const getPool = (type: string) => ALL_QUESTIONS.filter(q => {
    const p = q.classTag.split('.');
    return q.type === type && Number(p[0]) === config.grade && config.topics.includes(Number(p[1]));
  });

  const pickForType = (type: string, total: number) => {
    const pool = getPool(type);
    if (pool.length === 0) return [];
    
    // Logic: 30% M3-4, 70% M1-2
    const n34 = Math.round(total * 0.3);
    const n12 = total - n34;

    const pool34 = shuffleArray(pool.filter(q => getLevel(q) >= 3));
    const pool12 = shuffleArray(pool.filter(q => getLevel(q) <= 2));
    
    const picked: Question[] = [];
    
    const picked34 = pool34.splice(0, n34);
    picked.push(...picked34);
    
    const needed12 = n12 + (n34 - picked34.length);
    const picked12 = pool12.splice(0, needed12);
    picked.push(...picked12);

    // Final safety if still lacking
    if (picked.length < total) {
      const remaining = shuffleArray(pool.filter(q => !picked.includes(q)));
      picked.push(...remaining.splice(0, total - picked.length));
    }

    return picked;
  };

  questions = [
    ...pickForType('mcq', config.numMC),
    ...pickForType('true-false', config.numTF),
    ...pickForType('short-answer', config.numSA)
  ];

  return questions.map(q => {
    if (q.type === 'mcq' && q.o) {
      return { ...q, o: shuffleArray([...q.o]) };
    }
    return q;
  });
}

export function calculateScore(questions: Question[], answers: Record<number, any>, config: ExamConfig): number {
  let score = 0;
  
  const mcqScorePer = config.numMC > 0 ? config.scoreMC / config.numMC : 0;
  const tfScorePer = config.numTF > 0 ? config.scoreTF / config.numTF : 0;
  const saScorePer = config.numSA > 0 ? config.scoreSA / config.numSA : 0;

  questions.forEach(q => {
    const ans = answers[q.id];
    if (ans === undefined) return;

    if (q.type === 'mcq') {
      if (q.o?.[ans] === q.a) score += mcqScorePer;
    } else if (q.type === 'true-false') {
      let correct = 0;
      q.s?.forEach((s, i) => { if (ans[i] === s.a) correct++; });
      if (correct === 1) score += tfScorePer * 0.1;
      else if (correct === 2) score += tfScorePer * 0.25;
      else if (correct === 3) score += tfScorePer * 0.5;
      else if (correct === 4) score += tfScorePer * 1.0;
    } else if (q.type === 'short-answer') {
      if (String(ans).trim().toLowerCase() === String(q.a).trim().toLowerCase()) {
        score += saScorePer;
      }
    }
  });

  return Math.round(score * 100) / 100;
}
