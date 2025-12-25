
import { Topic, ExamCodeDefinition } from './types';

export const GRADES = [9, 10, 11, 12];

export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec";

export const API_ROUTING: Record<string, string> = {
  "Test12345678": "https://script.google.com/macros/s/AKfycbyc5zVzrdXukeL6kr2nEoyLVxiaD0aMquX8gtkk15SpeQKyK33A1mKcZoIJqsMuqwme/exec",
  "Ha0988948882": "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec"
};

export const REGISTER_LINKS = {
  MATH: "https://admintoanhoc.vercel.app/",
  APP: "https://forms.gle/q8J4FQEFYDfhVung7"
};

export const TOPICS_DATA: Record<number, Topic[]> = {
  9: [
    { id: 1, name: "1. Phương trình và hệ phương trình" },
    { id: 2, name: "2. Hàm số bậc hai y=ax^2" },
    { id: 3, name: "3. Hệ thức lượng tam giác vuông" },
    { id: 4, name: "4. Đường tròn" }
  ],
  10: [
    { id: 1, name: "1. Mệnh đề và Tập hợp" },
    { id: 2, name: "2. BPT bậc nhất hai ẩn" },
    { id: 3, name: "3. Hàm số bậc hai" },
    { id: 4, name: "4. Hệ thức lượng tam giác" },
    { id: 5, name: "5. Vectơ" },
    { id: 6, name: "6. Thống kê" },
    { id: 7, name: "7. Tọa độ phẳng" },
    { id: 8, name: "8. Đại số tổ hợp" },
    { id: 9, name: "9. Xác suất" }
  ],
  11: [
    { id: 1, name: "1. Hàm số lượng giác" },
    { id: 2, name: "2. Dãy số, CSC, CSN" },
    { id: 3, name: "3. Giới hạn và Liên tục" },
    { id: 4, name: "4. Quan hệ song song" },
    { id: 5, name: "5. Mũ và Logarit" },
    { id: 6, name: "6. Quan hệ vuông góc" },
    { id: 7, name: "7. Đạo hàm" },
    { id: 8, name: "8. Xác suất" }
  ],
  12: [
    { id: 1, name: "1. Khảo sát hàm số" },
    { id: 2, name: "2. Vectơ Oxyz" },
    { id: 3, name: "3. Mẫu số liệu ghép nhóm" },
    { id: 4, name: "4. Nguyên hàm và Tích phân" },
    { id: 5, name: "5. Tọa độ đường, mặt Oxyz" },
    { id: 6, name: "6. Xác suất có điều kiện" }
  ]
};

export const EXAM_CODES: Record<number, ExamCodeDefinition[]> = {
  9: [
    { code: "Tu_Do_K9", name: "Luyện tập tự do", topics: 'manual' },
    { code: "KT9-15P", name: "Kiểm tra 15p", topics: [1, 3, 4], fixedConfig: { duration: 15, numMC: 10, scoreMC: 10, numTF: 0, scoreTF: 0, numSA: 0, scoreSA: 0 } }
  ],
  10: [
    { code: "Tu_Do_K10", name: "Luyện tập tự do", topics: 'manual' },
    { code: "Chuyen_De_1.10", name: "Mệnh đề, Tập hợp", topics: [1], fixedConfig: { duration: 45, numMC: 12, scoreMC: 6, numTF: 2, scoreTF: 2, numSA: 4, scoreSA: 2 } }
  ],
  11: [
    { code: "Tu_Do_K11", name: "Luyện tập tự do", topics: 'manual' },
    { code: "Chuyen_De_1.11", name: "Lượng giác", topics: [1], fixedConfig: { duration: 45, numMC: 12, scoreMC: 6, numTF: 2, scoreTF: 2, numSA: 4, scoreSA: 2 } }
  ],
  12: [
    { code: "Tu_Do_K12", name: "Luyện tập tự do", topics: 'manual' },
    { code: "Chuyen_De_1.12", name: "Khảo sát hàm số", topics: [1], fixedConfig: { duration: 45, numMC: 12, scoreMC: 6, numTF: 2, scoreTF: 2, numSA: 4, scoreSA: 2 } }
  ]
};

export const MAX_VIOLATIONS = 2;
export const CLASSES_LIST = ["Tự do", "12A1", "12A2", "12A3", "11B1", "11B2", "10C1"];
