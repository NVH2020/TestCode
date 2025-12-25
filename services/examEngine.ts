
import { Question, ExamConfig } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

/**
 * Trộn mảng ngẫu nhiên
 */
function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

/**
 * Trích xuất mức độ từ classTag (số cuối cùng)
 */
function getLevel(q: Question): number {
  const parts = q.classTag.split('.');
  return Number(parts[parts.length - 1]) || 1;
}

/**
 * Trộn các phương án của một câu hỏi cụ thể
 */
function shuffleQuestionContent(q: Question): Question {
  const newQ = { ...q };
  
  if (q.type === 'mcq' && q.o) {
    newQ.o = shuffle(q.o);
  } else if (q.type === 'true-false' && q.s) {
    newQ.s = shuffle(q.s);
  }
  
  return newQ;
}

/**
 * Lấy danh sách câu hỏi theo mức độ cho từng phần
 */
function pickByLevel(pool: Question[], total: number, l3Count: number, l4Count: number): Question[] {
  if (total <= 0) return [];

  // Lấy các câu mức 4 và mức 3 trước
  const level4s = shuffle(pool.filter(q => getLevel(q) === 4)).slice(0, l4Count);
  const level3s = shuffle(pool.filter(q => getLevel(q) === 3)).slice(0, l3Count);
  
  const remainingCount = total - level4s.length - level3s.length;
  if (remainingCount <= 0) return shuffle([...level4s, ...level3s].slice(0, total));

  // Các câu còn lại lấy từ mức 1 và 2 với tỉ lệ ~60/40 (Mức 1 chiếm 60%)
  const level1s = pool.filter(q => getLevel(q) === 1);
  const level2s = pool.filter(q => getLevel(q) === 2);
  
  const targetL1 = Math.ceil(remainingCount * 0.6);
  const targetL2 = remainingCount - targetL1;

  const pickedL1 = shuffle(level1s).slice(0, targetL1);
  const pickedL2 = shuffle(level2s).slice(0, targetL2);

  let result = [...level4s, ...level3s, ...pickedL1, ...pickedL2];

  // Nếu vẫn thiếu (do ngân hàng không đủ câu ở mức mong muốn), lấy bù từ các mức khác
  if (result.length < total) {
    const idsAlreadyPicked = new Set(result.map(r => r.id));
    const leftovers = shuffle(pool.filter(p => !idsAlreadyPicked.has(p.id)));
    result = [...result, ...leftovers.slice(0, total - result.length)];
  }

  return shuffle(result);
}

export function generateExam(config: ExamConfig): Question[] {
  const { grade, topics } = config;
  
  // Lọc ngân hàng theo khối và chuyên đề (Dựa trên classTag "Khối.ChuyênĐề.MứcĐộ")
  const basePool = ALL_QUESTIONS.filter(q => {
    const parts = q.classTag.split('.');
    const qGrade = Number(parts[0]);
    const qTopic = Number(parts[1]);
    return qGrade === grade && topics.includes(qTopic);
  });

  // Chia pool theo loại câu hỏi
  const mcPool = basePool.filter(q => q.type === 'mcq');
  const tfPool = basePool.filter(q => q.type === 'true-false');
  const saPool = basePool.filter(q => q.type === 'short-answer');

  // Lấy câu hỏi theo cấu hình mức độ
  const mcQuestions = pickByLevel(mcPool, config.numMC, config.mcL3, config.mcL4);
  const tfQuestions = pickByLevel(tfPool, config.numTF, config.tfL3, config.tfL4);
  const saQuestions = pickByLevel(saPool, config.numSA, config.saL3, config.saL4);

  // Trộn phương án trả lời và trả về danh sách cuối cùng
  return [
    ...mcQuestions.map(shuffleQuestionContent),
    ...tfQuestions.map(shuffleQuestionContent),
    ...saQuestions.map(shuffleQuestionContent)
  ];
}

export function calculateScore(questions: Question[], answers: Record<number, any>, config: ExamConfig): number {
  let totalScore = 0;

  questions.forEach(q => {
    const answer = answers[q.id];
    if (answer === undefined) return;

    if (q.type === 'mcq' && config.numMC > 0) {
      const selectedOptionText = q.o?.[answer];
      if (selectedOptionText === q.a) {
        totalScore += config.scoreMC / config.numMC;
      }
    } else if (q.type === 'true-false' && config.numTF > 0) {
      const subItems = q.s || [];
      const userAnswers = answer as boolean[];
      let correctCount = 0;
      for (let i = 0; i < subItems.length; i++) {
        if (userAnswers[i] === subItems[i].a) correctCount++;
      }
      
      const itemScore = config.scoreTF / config.numTF;
      if (correctCount === 1) totalScore += itemScore * 0.1;
      else if (correctCount === 2) totalScore += itemScore * 0.25;
      else if (correctCount === 3) totalScore += itemScore * 0.5;
      else if (correctCount === 4) totalScore += itemScore * 1.0;
    } else if (q.type === 'short-answer' && config.numSA > 0) {
      if (String(answer).trim().toLowerCase() === String(q.a).trim().toLowerCase()) {
        totalScore += config.scoreSA / config.numSA;
      }
    }
  });

  return Math.round(totalScore * 100) / 100;
}
