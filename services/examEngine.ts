import { Question, ExamConfig } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

// Interface cấu hình trả về từ Sheet
export interface MatrixConfig {
  mcq: string;   
  tf: string;    
  short: string; 
  duration: number;
  // Các field cũ m3, m4 vẫn giữ trong type để tránh lỗi code cũ, nhưng logic sẽ bỏ qua
  m3?: string;
  m4?: string;
}

// Biến toàn cục lưu cấu hình điểm số
export let CURRENT_SCORING: {
  mcq: number; 
  short: number;
  tf: number; 
} = { mcq: 0, short: 0, tf: 0 };

// --- HÀM BỔ TRỢ ---

// Lấy level từ classTag (VD: "12.4.3" -> trả về 3)
const getLevel = (classTag: string): number => {
  if (!classTag) return 1;
  const parts = classTag.split('.');
  // Giả định format classTag luôn là: Lớp.ChuyênĐề.Level
  // Lấy phần tử cuối cùng
  const lv = parseInt(parts[parts.length - 1]);
  return isNaN(lv) ? 1 : lv;
};

// Xáo trộn mảng
function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

// Parse header điểm số: "(4;8)" -> {points: 4, totalCount: 8, scorePerQ: 0.5}
const parseHeader = (str: string) => {
  const match = str.match(/\((\d+[\.,]?\d*);(\d+)\)/); 
  if (match) {
    const points = parseFloat(match[1]);
    const count = parseInt(match[2]);
    return {
      scorePerQuestion: count > 0 ? points / count : 0
    };
  }
  return null;
};

/**
 * HÀM CHÍNH: TẠO ĐỀ THI
 */
export const generateExamFromMatrix = (matrix: MatrixConfig): Question[] => {
  let examQuestions: Question[] = [];
  
  // Reset điểm
  CURRENT_SCORING = { mcq: 0, short: 0, tf: 0 };

  // Hàm xử lý chung cho cả 3 loại cột
  const processColumn = (configStr: string, type: 'mcq' | 'true-false' | 'short-answer') => {
    if (!configStr || configStr.trim() === "") return;

    // 1. Xử lý Header điểm số (4;8)
    const meta = parseHeader(configStr);
    if (meta) {
      if (type === 'mcq') CURRENT_SCORING.mcq = meta.scorePerQuestion;
      if (type === 'short-answer') CURRENT_SCORING.short = meta.scorePerQuestion;
      if (type === 'true-false') CURRENT_SCORING.tf = meta.scorePerQuestion;
    }

    // 2. Làm sạch chuỗi config (Bỏ phần header)
    let ruleStr = configStr.replace(/\(.*?\);?/, '').trim();
    const rules = ruleStr.split(';').filter(r => r.trim() !== "");

    rules.forEach(rule => {
      // Rule mới: "12.4.3.2.1" (5 phần)
      // Ý nghĩa: Grade.Topic.Count(Lv1,2).Count(Lv3).Count(Lv4)
      
      const parts = rule.trim().split('.');
      if (parts.length < 3) return; // Tối thiểu phải có Lớp.CĐ.Slg

      const targetGrade = parts[0]; // 12
      const targetTopic = parts[1]; // 4
      
      // Parse số lượng cần lấy
      const countEasy = parseInt(parts[2]) || 0; // Mức 1,2
      const countMedium = parseInt(parts[3]) || 0; // Mức 3 (Nếu ko ghi thì là 0)
      const countHard = parseInt(parts[4]) || 0;   // Mức 4 (Nếu ko ghi thì là 0)

      // LỌC CÂU HỎI THEO LỚP & CHUYÊN ĐỀ
      const candidates = ALL_QUESTIONS.filter(q => {
        if (q.type !== type) return false;
        const qParts = q.classTag.split('.');
        // So sánh Lớp và Chuyên đề (2 phần tử đầu)
        return qParts[0] === targetGrade && qParts[1] === targetTopic;
      });

      // PHÂN LOẠI MỨC ĐỘ & LẤY CÂU HỎI
      // 1. Nhóm Dễ (Level 1, 2)
      const poolEasy = candidates.filter(q => {
        const lv = getLevel(q.classTag);
        return lv === 1 || lv === 2;
      });
      
      // 2. Nhóm Vừa (Level 3)
      const poolMedium = candidates.filter(q => getLevel(q.classTag) === 3);

      // 3. Nhóm Khó (Level 4)
      const poolHard = candidates.filter(q => getLevel(q.classTag) === 4);

      // TRỘN VÀ LẤY
      const selectedEasy = shuffle(poolEasy).slice(0, countEasy);
      const selectedMedium = shuffle(poolMedium).slice(0, countMedium);
      const selectedHard = shuffle(poolHard).slice(0, countHard);

      // Log kiểm tra xem có lấy đủ ko
      if (selectedEasy.length < countEasy) console.warn(`Thiếu câu Mức 1,2 cho ${targetGrade}.${targetTopic}`);
      if (selectedMedium.length < countMedium) console.warn(`Thiếu câu Mức 3 cho ${targetGrade}.${targetTopic}`);
      if (selectedHard.length < countHard) console.warn(`Thiếu câu Mức 4 cho ${targetGrade}.${targetTopic}`);

      examQuestions = [...examQuestions, ...selectedEasy, ...selectedMedium, ...selectedHard];
    });
  };

  // --- THỰC THI ---
  processColumn(matrix.mcq, 'mcq');
  processColumn(matrix.tf, 'true-false');
  processColumn(matrix.short, 'short-answer');

  // Lưu ý: Ta KHÔNG gọi hàm xử lý M3, M4 riêng nữa vì nó đã được gộp vào logic trên.

  return examQuestions;
};

/**
 * HÀM TÍNH ĐIỂM (GIỮ NGUYÊN)
 */
export const calculateScore = (questions: Question[], answers: Record<number, any>): number => {
    let totalScore = 0;

    questions.forEach(q => {
        const userAns = answers[q.id];
        if (userAns === undefined || userAns === null || userAns === "") return;

        // 1. MCQ
        if (q.type === 'mcq') {
             const cleanUser = String(userAns).charAt(0).toUpperCase();
             const cleanCorrect = String(q.a).charAt(0).toUpperCase();
             if (cleanUser === cleanCorrect) {
                 totalScore += CURRENT_SCORING.mcq || 0; 
             }
        }
        // 2. Short Answer
        else if (q.type === 'short-answer') {
            if (String(userAns).trim().toLowerCase() === String(q.a).trim().toLowerCase()) {
                totalScore += CURRENT_SCORING.short || 0;
            }
        }
        // 3. True/False
        else if (q.type === 'true-false') {
            let countCorrect = 0;
            if (Array.isArray(userAns) && q.s) {
                q.s.forEach((subQ, idx) => {
                    if (userAns[idx] === subQ.a) countCorrect++;
                });
            }
            // Điểm TF tính trên thang điểm của câu đó (VD: 1đ/câu)
            const maxPoint = CURRENT_SCORING.tf || 0; 
            if (countCorrect === 1) totalScore += maxPoint * 0.1;
            if (countCorrect === 2) totalScore += maxPoint * 0.25;
            if (countCorrect === 3) totalScore += maxPoint * 0.5;
            if (countCorrect === 4) totalScore += maxPoint * 1.0;
        }
    });

    return parseFloat(totalScore.toFixed(2));
};
