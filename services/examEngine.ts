
import { Question, ExamConfig } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

/**
 * Ma trận thô từ Sheet
 */
export interface MatrixConfig {
  mcq: string;  // "10.1.5; 11.2.3"
  tf: string;
  short: string;
  m3: string;   // "M10.1.1; T11.4.2" (M=MCQ, T=TF, S=SHORT)
  m4: string;
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

function getLevel(q: Question): number {
  const parts = q.classTag.split('.');
  return Number(parts[parts.length - 1]) || 1;
}

/**
 * Phân tích chuỗi ma trận "10.1.5; 11.2.3" -> { grade, topic, count }[]
 */
function parseMatrixString(str: string) {
  if (!str) return [];
  return str.split(';').map(item => {
    const [g, t, c] = item.trim().split('.').map(Number);
    return { grade: g, topic: t, count: c };
  });
}

/**
 * Phân tích chuỗi mức độ "M10.1.2" -> { type, grade, topic, count }[]
 */
function parseDifficultyString(str: string) {
  if (!str) return [];
  return str.split(';').map(item => {
    const clean = item.trim();
    const typeChar = clean[0]; // M, T, S
    const [g, t, c] = clean.substring(1).split('.').map(Number);
    let type: 'mcq' | 'true-false' | 'short-answer' = 'mcq';
    if (typeChar === 'T') type = 'true-false';
    if (typeChar === 'S') type = 'short-answer';
    return { type, grade: g, topic: t, count: c };
  });
}

export function generateExamFromMatrix(matrix: MatrixConfig): Question[] {
  const mcqRules = parseMatrixString(matrix.mcq);
  const tfRules = parseMatrixString(matrix.tf);
  const shortRules = parseMatrixString(matrix.short);
  const m3Rules = parseDifficultyString(matrix.m3);
  const m4Rules = parseDifficultyString(matrix.m4);

  let finalQuestions: Question[] = [];

  const processSection = (rules: any[], type: string) => {
    rules.forEach(rule => {
      // 1. Lấy tất cả câu hỏi thuộc Grade.Topic.Type
      let pool = ALL_QUESTIONS.filter(q => {
        const p = q.classTag.split('.');
        return Number(p[0]) === rule.grade && Number(p[1]) === rule.topic && q.type === type;
      });

      // 2. Xác định số câu mức 3 và 4 cần cho Grade.Topic này
      const l3Count = m3Rules.find(r => r.type === type && r.grade === rule.grade && r.topic === rule.topic)?.count || 0;
      const l4Count = m4Rules.find(r => r.type === type && r.grade === rule.grade && r.topic === rule.topic)?.count || 0;

      const level4s = shuffle(pool.filter(q => getLevel(q) === 4)).slice(0, l4Count);
      const level3s = shuffle(pool.filter(q => getLevel(q) === 3)).slice(0, l3Count);
      
      const pickedIds = new Set([...level4s, ...level3s].map(q => q.id));
      const remainingCount = rule.count - pickedIds.size;
      
      const others = shuffle(pool.filter(q => !pickedIds.has(q.id))).slice(0, Math.max(0, remainingCount));
      
      finalQuestions = [...finalQuestions, ...level4s, ...level3s, ...others];
    });
  };

  processSection(mcqRules, 'mcq');
  processSection(tfRules, 'true-false');
  processSection(shortRules, 'short-answer');

  return finalQuestions;
}

export function calculateScore(questions: Question[], answers: Record<number, any>, config: ExamConfig): number {
  let totalScore = 0;
  const numMC = questions.filter(q => q.type === 'mcq').length;
  const numTF = questions.filter(q => q.type === 'true-false').length;
  const numSA = questions.filter(q => q.type === 'short-answer').length;

  questions.forEach(q => {
    const answer = answers[q.id];
    if (answer === undefined) return;

    if (q.type === 'mcq' && numMC > 0) {
      if (q.o?.[answer] === q.a) totalScore += 6 / numMC; // Giả định Phần 1: 6đ
    } else if (q.type === 'true-false' && numTF > 0) {
      const userAnswers = answer as boolean[];
      let correct = 0;
      q.s?.forEach((s, i) => { if (userAnswers[i] === s.a) correct++; });
      const itemScore = 2 / numTF; // Giả định Phần 2: 2đ
      if (correct === 1) totalScore += itemScore * 0.1;
      else if (correct === 2) totalScore += itemScore * 0.25;
      else if (correct === 3) totalScore += itemScore * 0.5;
      else if (correct === 4) totalScore += itemScore * 1.0;
    } else if (q.type === 'short-answer' && numSA > 0) {
      if (String(answer).trim().toLowerCase() === String(q.a).trim().toLowerCase()) totalScore += 2 / numSA; // Giả định Phần 3: 2đ
    }
  });

  return Math.round(totalScore * 100) / 100;
}

export function generateExam(config: ExamConfig): Question[] {
  // Hàm này vẫn giữ cho chế độ Tự do
  const basePool = ALL_QUESTIONS.filter(q => {
    const p = q.classTag.split('.');
    return Number(p[0]) === config.grade && config.topics.includes(Number(p[1]));
  });
  return shuffle(basePool).slice(0, config.numMC + config.numTF + config.numSA);
}
