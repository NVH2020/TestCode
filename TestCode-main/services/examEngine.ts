
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
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

function getLevel(q: Question): number {
  const parts = q.classTag.split('.');
  return Number(parts[parts.length - 1]) || 1;
}

/**
 * Phân tích chuỗi: "[6]; 12.4.10; 11.2.5" 
 * Trả về tổng điểm và mảng các quy tắc lấy câu
 */
function parseMatrixWithScore(str: string): MatrixParsed {
  if (!str) return { rules: [], totalScore: 0 };
  
  let totalScore = 0;
  // Lấy phần trong ngoặc []
  const scoreMatch = str.match(/\[(.*?)\]/);
  if (scoreMatch) {
    totalScore = parseFloat(scoreMatch[1]);
  }

  // Loại bỏ phần [điểm] và tách các quy tắc
  const rulePart = str.replace(/\[.*?\]/, '').replace(/^[:;]\s*/, '');
  const rules = rulePart.split(';').filter(i => i.trim()).map(item => {
    const parts = item.trim().split('.').map(Number);
    return { grade: parts[0], topic: parts[1], count: parts[2] };
  });

  return { rules, totalScore };
}

function parseDifficultyString(str: string) {
  if (!str) return [];
  return str.split(';').filter(i => i.trim()).map(item => {
    const clean = item.trim();
    const typeChar = clean[0];
    const parts = clean.substring(1).split('.').map(Number);
    let type: 'mcq' | 'true-false' | 'short-answer' = 'mcq';
    if (typeChar === 'T') type = 'true-false';
    if (typeChar === 'S') type = 'short-answer';
    return { type, grade: parts[0], topic: parts[1], count: parts[2] };
  });
}

export function generateExamFromMatrix(matrix: MatrixConfig): { questions: Question[], config: ExamConfig } {
  const mcqData = parseMatrixWithScore(matrix.mcq);
  const tfData = parseMatrixWithScore(matrix.tf);
  const shortData = parseMatrixWithScore(matrix.short);
  
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
    numMC: finalQuestions.filter(q => q.type === 'mcq').length,
    scoreMC: mcqData.totalScore,
    mcL3: 0, mcL4: 0,
    numTF: finalQuestions.filter(q => q.type === 'true-false').length,
    scoreTF: tfData.totalScore,
    tfL3: 0, tfL4: 0,
    numSA: finalQuestions.filter(q => q.type === 'short-answer').length,
    scoreSA: shortData.totalScore,
    saL3: 0, saL4: 0
  };

  return { questions: finalQuestions, config };
}

export function calculateScore(questions: Question[], answers: Record<number, any>, config: ExamConfig): number {
  let totalScore = 0;
  
  const mcqs = questions.filter(q => q.type === 'mcq');
  const tfs = questions.filter(q => q.type === 'true-false');
  const shorts = questions.filter(q => q.type === 'short-answer');

  questions.forEach(q => {
    const answer = answers[q.id];
    if (answer === undefined) return;

    if (q.type === 'mcq' && mcqs.length > 0) {
      if (q.o?.[answer] === q.a) totalScore += config.scoreMC / mcqs.length;
    } 
    else if (q.type === 'true-false' && tfs.length > 0) {
      const userAnswers = answer as boolean[];
      let correctCount = 0;
      q.s?.forEach((s, i) => { if (userAnswers[i] === s.a) correctCount++; });
      const baseScore = config.scoreTF / tfs.length;
      if (correctCount === 1) totalScore += baseScore * 0.1;
      else if (correctCount === 2) totalScore += baseScore * 0.25;
      else if (correctCount === 3) totalScore += baseScore * 0.5;
      else if (correctCount === 4) totalScore += baseScore * 1.0;
    } 
    else if (q.type === 'short-answer' && shorts.length > 0) {
      const cleanUser = String(answer).trim().toLowerCase();
      const cleanAns = String(q.a).trim().toLowerCase();
      if (cleanUser === cleanAns) totalScore += config.scoreSA / shorts.length;
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
