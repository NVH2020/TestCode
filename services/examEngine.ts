
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
 * Phân tích chuỗi ma trận: "Điểm; (G,T,L1,L2,L3,L4), ..."
 */
function parseSection(str: string) {
  if (!str || !str.includes(';')) return { scorePerItem: 0, rules: [], totalCount: 0 };
  const [scorePart, rulesPart] = str.split(';');
  const scorePerItem = parseFloat(scorePart.trim());
  const rules: any[] = [];
  const matches = rulesPart.matchAll(/\(([^)]+)\)/g);
  let totalCount = 0;

  for (const match of matches) {
    const p = match[1].split(',').map(v => parseInt(v.trim()));
    const rule = { g: p[0], t: p[1], l1: p[2] || 0, l2: p[3] || 0, l3: p[4] || 0, l4: p[5] || 0 };
    rules.push(rule);
    totalCount += (rule.l1 + rule.l2 + rule.l3 + rule.l4);
  }
  return { scorePerItem, rules, totalCount };
}

export function generateExamFromMatrix(matrix: MatrixConfig): { questions: Question[], config: ExamConfig } {
  const mcq = parseSection(matrix.mcq);
  const tf = parseSection(matrix.tf);
  const sa = parseSection(matrix.short);

  let finalQuestions: Question[] = [];

  const process = (rules: any[], type: string) => {
    rules.forEach(r => {
      const pool = ALL_QUESTIONS.filter(q => {
        const p = q.classTag.split('.');
        return q.type === type && Number(p[0]) === r.g && Number(p[1]) === r.t;
      });

      const pools = [
        shuffleArray(pool.filter(q => getLevel(q) === 1)),
        shuffleArray(pool.filter(q => getLevel(q) === 2)),
        shuffleArray(pool.filter(q => getLevel(q) === 3)),
        shuffleArray(pool.filter(q => getLevel(q) === 4))
      ];

      const targets = [r.l1, r.l2, r.l3, r.l4];
      
      // Logic bù trừ: Lấy từ mức cao nhất xuống, nếu thiếu lấy từ mức thấp hơn
      for (let i = 3; i >= 0; i--) {
        let needed = targets[i];
        const picked = pools[i].splice(0, needed);
        finalQuestions.push(...picked);
        needed -= picked.length;
        
        // Nếu thiếu, dồn sang mức thấp hơn 1 bậc
        if (needed > 0 && i > 0) {
          targets[i-1] += needed;
        }
      }
    });
  };

  process(mcq.rules, 'mcq');
  process(tf.rules, 'true-false');
  process(sa.rules, 'short-answer');

  // Trộn đáp án MCQ
  finalQuestions = finalQuestions.map(q => {
    if (q.type === 'mcq' && q.o) return { ...q, o: shuffleArray([...q.o]) };
    return q;
  });

  return {
    questions: finalQuestions,
    config: {
      grade: 0, topics: [], duration: matrix.thoigian || 45,
      numMC: mcq.totalCount, scoreMC: mcq.totalCount * mcq.scorePerItem,
      numTF: tf.totalCount, scoreTF: tf.totalCount * tf.scorePerItem,
      numSA: sa.totalCount, scoreSA: sa.totalCount * sa.scorePerItem
    }
  };
}

export function generateFreeExam(config: ExamConfig): Question[] {
  let questions: Question[] = [];

  const pick = (type: string, total: number) => {
    const pool = ALL_QUESTIONS.filter(q => {
      const p = q.classTag.split('.');
      return q.type === type && Number(p[0]) === config.grade && config.topics.includes(Number(p[1]));
    });

    const n34 = Math.round(total * 0.3);
    const n12 = total - n34;

    const pool34 = shuffleArray(pool.filter(q => getLevel(q) >= 3));
    const pool12 = shuffleArray(pool.filter(q => getLevel(q) <= 2));

    const picked34 = pool34.splice(0, n34);
    const picked12 = pool12.splice(0, n12 + (n34 - picked34.length));
    
    let result = [...picked34, ...picked12];
    if (result.length < total) {
      const remain = shuffleArray(pool.filter(q => !result.includes(q))).splice(0, total - result.length);
      result = [...result, ...remain];
    }
    return result;
  };

  questions = [...pick('mcq', config.numMC), ...pick('true-false', config.numTF), ...pick('short-answer', config.numSA)];
  
  return questions.map(q => {
    if (q.type === 'mcq' && q.o) return { ...q, o: shuffleArray([...q.o]) };
    return q;
  });
}

export function calculateScore(questions: Question[], answers: Record<number, any>, config: ExamConfig): number {
  let score = 0;
  const mcPer = config.numMC > 0 ? config.scoreMC / config.numMC : 0;
  const tfPer = config.numTF > 0 ? config.scoreTF / config.numTF : 0;
  const saPer = config.numSA > 0 ? config.scoreSA / config.numSA : 0;

  questions.forEach(q => {
    const ans = answers[q.id];
    if (ans === undefined) return;
    if (q.type === 'mcq') {
      if (q.o?.[ans] === q.a) score += mcPer;
    } else if (q.type === 'true-false') {
      let correct = 0;
      q.s?.forEach((s, i) => { if (ans[i] === s.a) correct++; });
      if (correct === 1) score += tfPer * 0.1;
      else if (correct === 2) score += tfPer * 0.25;
      else if (correct === 3) score += tfPer * 0.5;
      else if (correct === 4) score += tfPer * 1.0;
    } else if (q.type === 'short-answer') {
      if (String(ans).trim().toLowerCase() === String(q.a).trim().toLowerCase()) score += saPer;
    }
  });
  return Math.round(score * 100) / 100;
}
