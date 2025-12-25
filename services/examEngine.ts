import { Question, ExamConfig } from '../types';
import { ALL_QUESTIONS } from '../data/questions'; // Đảm bảo đường dẫn đúng tới file questions.ts của bạn

// Định nghĩa kiểu dữ liệu trả về từ Sheet
export interface MatrixConfig {
  mcq: string;  
  tf: string;
  short: string;
  m3: string;   
  m4: string;
  duration: number;
}

// Hàm xáo trộn mảng (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

/**
 * Hàm chính: Tạo bộ câu hỏi từ Config Online và Data Offline
 */
export const generateExamFromMatrix = (matrix: MatrixConfig): Question[] => {
  let examQuestions: Question[] = [];

  // Hàm con: Lọc và lấy câu hỏi theo chuỗi config
  const pickQuestions = (configStr: string, defaultType: string | null, isAdvanced: boolean) => {
    if (!configStr) return;
    
    // Xử lý chuỗi: "12.4.8; 11.2.2" -> bỏ phần [điểm] nếu có
    let cleanStr = configStr;
    if (configStr.includes("]")) cleanStr = configStr.split("]")[1]; 

    const parts = cleanStr.split(';');

    parts.forEach(part => {
      part = part.trim();
      if (!part) return;

      let targetGrade = "";
      let targetTopic = "";
      let count = 0;
      let targetType = defaultType;

      if (isAdvanced) {
        // Dạng Nâng cao: M12.4.1 (Loại.Lớp.ChuyênĐề.SốLượng)
        const typeChar = part.charAt(0).toUpperCase();
        if (typeChar === 'M') targetType = 'mcq';
        else if (typeChar === 'T') targetType = 'true-false'; 
        else if (typeChar === 'S') targetType = 'short-answer';

        const subParts = part.substring(1).split('.'); 
        targetGrade = subParts[0];
        targetTopic = subParts[1];
        count = parseInt(subParts[2]);
      } else {
        // Dạng Cơ bản: 12.4.8 (Lớp.ChuyênĐề.SốLượng)
        // Type được truyền từ ngoài vào (MCQ, TF hoặc SHORT)
        const subParts = part.split('.');
        targetGrade = subParts[0];
        targetTopic = subParts[1];
        count = parseInt(subParts[2]);
      }

      // LỌC CÂU HỎI TỪ ALL_QUESTIONS
      const candidates = ALL_QUESTIONS.filter(q => {
        // 1. Check loại câu hỏi (mcq, true-false, short-answer)
        if (q.type !== targetType) return false;
        
        // 2. Check Lớp và Chuyên đề từ classTag (VD: "12.4.1")
        // Tách classTag thành mảng [12, 4, 1]
        const qParts = q.classTag.split('.'); 
        if (qParts.length < 2) return false;

        // So sánh Lớp và Chuyên đề
        return qParts[0] === targetGrade && qParts[1] === targetTopic;
      });

      // Xáo trộn và lấy đủ số lượng
      const selected = shuffle(candidates).slice(0, count);
      examQuestions = [...examQuestions, ...selected];
    });
  };

  // --- THỰC THI LỌC ---
  // 1. Các cột cơ bản (Sheet trả về cột B, C, D)
  pickQuestions(matrix.mcq, 'mcq', false);
  pickQuestions(matrix.tf, 'true-false', false);
  pickQuestions(matrix.short, 'short-answer', false);

  // 2. Các cột vận dụng (Sheet trả về cột E, F)
  pickQuestions(matrix.m3, null, true);
  pickQuestions(matrix.m4, null, true);

  return examQuestions;
};

/**
 * Hàm tính điểm tại Client (Vì đã có đáp án trong questions.ts)
 */
export const calculateScore = (questions: Question[], answers: Record<number, any>, config: ExamConfig): number => {
    let totalScore = 0;
    
    // Đếm số lượng câu mỗi loại để chia điểm (nếu cần)
    // Hoặc bạn có thể hardcode điểm cho từng câu tùy logic của bạn
    // Ở đây mình giả định logic đơn giản:
    // MCQ: 0.2đ, TF: Phức tạp, Short: 0.2đ (Ví dụ)

    questions.forEach(q => {
        const userAns = answers[q.id];
        if (userAns === undefined || userAns === null || userAns === "") return;

        // 1. MCQ
        if (q.type === 'mcq') {
            // q.a ví dụ: "$1$ (Đ)." -> userAns: "$1$ (Đ)."
            // Cần so sánh chính xác
            if (String(userAns).trim() === String(q.a).trim()) {
                totalScore += 0.25; // Giả sử mỗi câu 0.25
            }
        }
        
        // 2. Short Answer
        else if (q.type === 'short-answer') {
            if (String(userAns).trim().toLowerCase() === String(q.a).trim().toLowerCase()) {
                totalScore += 0.25;
            }
        }

        // 3. True/False (Logic phức tạp hơn chút)
        else if (q.type === 'true-false') {
            // q.s là mảng các ý [ {id, a: true}, ... ]
            // userAns là mảng [true, false, ...]
            let countCorrect = 0;
            if (Array.isArray(userAns) && q.s) {
                q.s.forEach((subQ, idx) => {
                    if (userAns[idx] === subQ.a) countCorrect++;
                });
            }
            // Quy tắc tính điểm TF (ví dụ của Bộ GD)
            if (countCorrect === 1) totalScore += 0.1;
            if (countCorrect === 2) totalScore += 0.25;
            if (countCorrect === 3) totalScore += 0.5;
            if (countCorrect === 4) totalScore += 1.0;
        }
    });

    return parseFloat(totalScore.toFixed(2));
};
