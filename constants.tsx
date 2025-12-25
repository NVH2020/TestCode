
import { Topic, ExamCodeDefinition } from './types';
export const GRADES = [9, 10, 11, 12];

// 1. LINK MẶC ĐỊNH (Dùng khi không tìm thấy ID)
export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxxxx.../exec"; 

// 2. CẤU HÌNH ĐA LUỒNG (QUAN TRỌNG): Mapping ID -> Link Web App riêng
// Bạn điền ID bản quyền vào bên trái, Link Web App GAS tương ứng vào bên phải
export const API_ROUTING: Record<string, string> = {
  "GV_HA_BACNINH": "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec",
  "GV_NAM_HANOI": "https://script.google.com/macros/s/AKfycbwd...khac.../exec",
  // Thêm các giáo viên khác vào đây...
};

export const REGISTER_LINKS = {
  MATH: "https://admintoanhoc.vercel.app/", 
  APP: "https://forms.gle/wQfqisy2TzFRMzsu6"
};

export const TOPICS_DATA: Record<number, Topic[]> = {
  9: [
    { id: 1, name: "1. Phương trình và hệ phương trình" },
    { id: 2, name: "2. Đường tròn" }
  ],
  10: [
    { id: 1, name: "1. Mệnh đề và Tập hợp" },
    { id: 2, name: "2. Hàm số bậc hai" }
  ],
  11: [
    { id: 1, name: "1. Hàm số lượng giác" },
    { id: 2, name: "2. Dãy số" }
  ],
  12: [
    { id: 4, name: "4. Nguyên hàm và Tích phân" },
    { id: 5, name: "5. Tích phân và ứng dụng" }
  ]
};

export const EXAM_CODES: Record<number, ExamCodeDefinition[]> = {
  9: [
    { code: "K9-TU-DO", name: "Luyện tập tự do khối 9", topics: 'manual' },
    { code: "KT9-15P", name: "Kiểm tra 15p - Ma trận", topics: 'matrix' }
  ],
  10: [
    { code: "K10-TU-DO", name: "Luyện tập tự do khối 10", topics: 'manual' },
    { code: "KT10-45P", name: "Kiểm tra 45p - Ma trận", topics: 'matrix' }
  ],
  11: [
    { code: "K11-TU-DO", name: "Luyện tập tự do khối 11", topics: 'manual' },
    { code: "KT11-45P", name: "Kiểm tra 45p - Ma trận", topics: 'matrix' }
  ],
  12: [
    { code: "K12-TU-DO", name: "Luyện tập tự do khối 12", topics: 'manual' },
    { code: "KT12-GKII", name: "Kiểm tra Giữa kì II - Ma trận", topics: 'matrix' },
    { code: "KT12-45P", name: "Kiểm tra 45p - Chương 4", topics: 'matrix' }
  ]
};

export const CLASSES_LIST = ["Tự do", "12A1", "12A2", "11B1", "10C1"];
export const MAX_VIOLATIONS = 3;
