
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
 * Phân tích x.y.z.t.u -> {grade, topic, l12, l3, l4}
 * Tự động bù 0 nếu thiếu phần đuôi
 */
function parseRule(ruleStr: string) {
  const p = ruleStr.trim().split('.').map(Number);
  return {
    grade: p[0],
    topic: p[1],
    l12: p[2] || 0,
    l3: p[3] || 0,
    l4: p[4] || 0
  };
}

export function generateExamFromMatrix(matrix: MatrixConfig): { questions: Question[], config: ExamConfig } {
  const parseSection = (str: string) => {
    if (!str) return { score: 0, count: 0, rules: [] };
    const headerMatch = str.match(/\(([^)]+)\)/);
    // (score;count)
    const header = headerMatch ? headerMatch[1].split(';').map(v => parseFloat(v.trim())) : [0, 0];
    const rulePart = str.replace(/\([^)]+\)/, '').replace(/^[:;]\s*/, '');
    const rules = rulePart.split(';').filter(i => i.trim()).map(parseRule);
    return { score: header[0], count: header[1], rules };
  };

  const mcqData = parseSection(matrix.mcq);
  const tfData = parseSection(matrix.tf);
  const saData = parseSection(matrix.short);

  let finalQuestions: Question[] = [];

  const process = (data: any, type: string) => {
    data.rules.forEach((r: any) => {
      const pool = ALL_QUESTIONS.filter(q => {
        const p = q.classTag.split('.');
        return q.type === type && Number(p[0]) === r.grade && Number(p[1]) === r.topic;
      });

      const l4s = shuffleArray(pool.filter(q => getLevel(q) === 4)).slice(0, r.l4);
      const l3s = shuffleArray(pool.filter(q => getLevel(q) === 3)).slice(0, r.l3);
      const l12s = shuffleArray(pool.filter(q => getLevel(q) <= 2)).slice(0, r.l12);

      finalQuestions = [...finalQuestions, ...l4s, ...l3s, ...l12s];
    });
  };

  process(mcqData, 'mcq');
  process(tfData, 'true-false');
  process(saData, 'short-answer');

  // Trộn các phương án trắc nghiệm so với câu hỏi gốc
  finalQuestions = finalQuestions.map(q => {
    if (q.type === 'mcq' && q.o) {
      const shuffled = shuffleArray([...q.o]);
      return { ...q, o: shuffled };
    }
    return q;
  });

  const config: ExamConfig = {
    grade: 0, topics: [], duration: matrix.thoigian || 45,
    numMC: mcqData.count, scoreMC: mcqData.score,
    numTF: tfData.count, scoreTF: tfData.score,
    numSA: saData.count, scoreSA: saData.score
  };

  return { questions: finalQuestions, config };
}

export function generateFreeExam(config: ExamConfig): Question[] {
  let questions: Question[] = [];

  const getPool = (type: string) => ALL_QUESTIONS.filter(q => {
    const p = q.classTag.split('.');
    return q.type === type && Number(p[0]) === config.grade && config.topics.includes(Number(p[1]));
  });

  const pickForSection = (type: string, total: number) => {
    const pool = getPool(type);
    if (pool.length === 0) return [];
    
    const n34 = Math.round(total * 0.3);
    const n12 = total - n34;

    const l34 = shuffleArray(pool.filter(q => getLevel(q) >= 3)).slice(0, n34);
    const l12 = shuffleArray(pool.filter(q => getLevel(q) <= 2)).slice(0, n12);
    
    let result = [...l12, ...l34];
    if (result.length < total) {
      const remain = shuffleArray(pool.filter(q => !result.includes(q))).slice(0, total - result.length);
      result = [...result, ...remain];
    }
    return result;
  };

  questions = [
    ...pickForSection('mcq', config.numMC),
    ...pickForSection('true-false', config.numTF),
    ...pickForSection('short-answer', config.numSA)
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
  questions.forEach(q => {
    const ans = answers[q.id];
    if (ans === undefined) return;

    if (q.type === 'mcq' && config.numMC > 0) {
      if (q.o?.[ans] === q.a) score += config.scoreMC / config.numMC;
    } else if (q.type === 'true-false' && config.numTF > 0) {
      let correctParts = 0;
      q.s?.forEach((s, i) => { if (ans[i] === s.a) correctParts++; });
      const base = config.scoreTF / config.numTF;
      if (correctParts === 1) score += base * 0.1;
      else if (correctParts === 2) score += base * 0.25;
      else if (correctParts === 3) score += base * 0.5;
      else if (correctParts === 4) score += base * 1.0;
    } else if (q.type === 'short-answer' && config.numSA > 0) {
      if (String(ans).trim().toLowerCase() === String(q.a).trim().toLowerCase()) {
        score += config.scoreSA / config.numSA;
      }
    }
  });
  return Math.round(score * 100) / 100;
}
