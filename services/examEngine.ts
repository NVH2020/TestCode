
import { Question, ExamConfig } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

export interface MatrixConfig {
  mcq: string;  
  tf: string;
  short: string;
  m3: string;   
  m4: string;
  thoigian: number;
}

export interface MatrixParsed {
  rules: { grade: number; topic: number; count: number }[];
  totalScore: number;
  expectedTotalQuestions: number;
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

function getLevel(q: Question): number {
  const parts = q.classTag.split('.');
  return Number(parts[parts.length - 1]) || 1;
}

/**
 * Phân tích chuỗi: "(4;8); 12.4.6; 11.2.2"
 * Trả về: { totalScore: 4, expectedTotalQuestions: 8, rules: [...] }
 */
function parseMatrixFormat(str: string): MatrixParsed {
  if (!str) return { rules: [], totalScore: 0, expectedTotalQuestions: 0 };
  
  let totalScore = 0;
  let expectedTotalQuestions = 0;

  // Lấy nội dung trong ngoặc đơn (điểm;số câu)
  const headerMatch = str.match(/\(([^)]+)\)/);
  if (headerMatch) {
    const parts = headerMatch[1].split(';').map(v => parseFloat(v.trim()));
    totalScore = parts[0] || 0;
    expectedTotalQuestions = parts[1] || 0;
  }

  // Tách các quy tắc sau dấu ngoặc
  const rulePart = str.replace(/\([^)]+\)/, '').replace(/^[:;]\s*/, '');
  const rules = rulePart.split(';').filter(i => i.trim()).map(item => {
    const parts = item.trim().split('.').map(Number);
    return { grade: parts[0], topic: parts[1], count: parts[2] };
  });

  return { rules, totalScore, expectedTotalQuestions };
}

function parseDifficultyString(str: string) {
  if (!str) return [];
  return str.split(';').filter(i => i.trim()).map(item => {
    const clean = item.trim();
    const typeChar = clean[0]; // M, T, S
    const parts = clean.substring(1).split('.').map(Number);
    let type: 'mcq' | 'true-false' | 'short-answer' = 'mcq';
    if (typeChar === 'T') type = 'true-false';
    if (typeChar === 'S') type = 'short-answer';
    return { type, grade: parts[0], topic: parts[1], count: parts[2] };
  });
}

export function generateExamFromMatrix(matrix: MatrixConfig): { questions: Question[], config: ExamConfig } {
  const mcqData = parseMatrixFormat(matrix.mcq);
  const tfData = parseMatrixFormat(matrix.tf);
  const shortData = parseMatrixFormat(matrix.short);
  
  const m3Rules = parseDifficultyString(matrix.m3);
  const m4Rules = parseDifficultyString(matrix.m4);

  let finalQuestions: Question[] = [];

  const processSection = (rules: any[], type: string) => {
    rules.forEach(rule => {
      let pool = ALL_QUESTIONS.filter(q => {
        const p = q.classTag.split('.');
        return Number(p[0]) === rule.grade && Number(p[1]) === rule.topic && q.type === type;
      });

      const l3Count = m3Rules.find(r => r.type === type && r.grade === rule.grade && r.topic === rule.topic)?.count || 0;
      const l4Count = m4Rules.find(r => r.type === type && r.grade === rule.grade && r.topic === rule.topic)?.count || 0;

      const level4s = shuffle(pool.filter(q => getLevel(q) === 4)).slice(0, l4Count);
      const level3s = shuffle(pool.filter(q => getLevel(q) === 3)).slice(0, l3Count);
      
      const pickedIds = new Set([...level4s, ...level3s].map(q => q.id));
      const remainingCount = Math.max(0, rule.count - pickedIds.size);
      const others = shuffle(pool.filter(q => !pickedIds.has(q.id))).slice(0, remainingCount);
      
      finalQuestions = [...finalQuestions, ...level4s, ...level3s, ...others];
    });
  };

  processSection(mcqData.rules, 'mcq');
  processSection(tfData.rules, 'true-false');
  processSection(shortData.rules, 'short-answer');

  const config: ExamConfig = {
    grade: 0, topics: [], 
    duration: matrix.thoigian || 45,
    numMC: mcqData.expectedTotalQuestions,
    scoreMC: mcqData.totalScore,
    mcL3: 0, mcL4: 0,
    numTF: tfData.expectedTotalQuestions,
    scoreTF: tfData.totalScore,
    tfL3: 0, tfL4: 0,
    numSA: shortData.expectedTotalQuestions,
    scoreSA: shortData.totalScore,
    saL3: 0, saL4: 0
  };

  return { questions: finalQuestions, config };
}

export function calculateScore(questions: Question[], answers: Record<number, any>, config: ExamConfig): number {
  let totalScore = 0;
  
  // Lấy các câu thực tế có trong bài làm
  const mcqs = questions.filter(q => q.type === 'mcq');
  const tfs = questions.filter(q => q.type === 'true-false');
  const shorts = questions.filter(q => q.type === 'short-answer');

  questions.forEach(q => {
    const answer = answers[q.id];
    if (answer === undefined) return;

    if (q.type === 'mcq' && config.numMC > 0) {
      if (q.o?.[answer] === q.a) totalScore += config.scoreMC / config.numMC;
    } 
    else if (q.type === 'true-false' && config.numTF > 0) {
      const userAnswers = answer as boolean[];
      let correctCount = 0;
      q.s?.forEach((s, i) => { if (userAnswers[i] === s.a) correctCount++; });
      const itemMaxScore = config.scoreTF / config.numTF;
      if (correctCount === 1) totalScore += itemMaxScore * 0.1;
      else if (correctCount === 2) totalScore += itemMaxScore * 0.25;
      else if (correctCount === 3) totalScore += itemMaxScore * 0.5;
      else if (correctCount === 4) totalScore += itemMaxScore * 1.0;
    } 
    else if (q.type === 'short-answer' && config.numSA > 0) {
      const u = String(answer).trim().toLowerCase();
      const a = String(q.a).trim().toLowerCase();
      if (u === a) totalScore += config.scoreSA / config.numSA;
    }
  });

  return Math.round(totalScore * 100) / 100;
}

export function generateExam(config: ExamConfig): Question[] {
  const basePool = ALL_QUESTIONS.filter(q => {
    const p = q.classTag.split('.');
    return Number(p[0]) === config.grade && config.topics.includes(Number(p[1]));
  });
  return shuffle(basePool).slice(0, config.numMC + config.numTF + config.numSA);
}
