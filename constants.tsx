
import { Topic, ExamCodeDefinition } from './types';

export const GRADES = [9, 10, 11, 12];

export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec";

export const REGISTER_LINKS = {
  MATH: "https://admintoanhoc.vercel.app/", 
  APP: "https://forms.gle/q8J4FQEFYDfhVung7"
};

export const TOPICS_DATA: Record<number, Topic[]> = {
  9: [
    { id: 1, name: "1. Phương trình bậc nhất" },
    { id: 2, name: "2. Đường tròn" }
  ],
  10: [
    { id: 1, name: "1. Mệnh đề và Tập hợp" },
    { id: 2, name: "2. Hàm số bậc hai" }
  ],
  11: [
    { id: 1, name: "1. Lượng giác" },
    { id: 2, name: "2. Cấp số cộng/nhân" }
  ],
  12: [
    { id: 4, name: "4. Nguyên hàm và Tích phân" },
    { id: 5, name: "5. Tọa độ Oxyz" },
    { id: 6, name: "6. Xác suất có điều kiện" }
  ]
};

export const EXAM_CODES: Record<number, ExamCodeDefinition[]> = {
  9: [
    { code: "K9-TU-DO", name: "Luyện tập tự do khối 9", topics: 'manual' },
    { code: "KT9-15P", name: "Kiểm tra 15p (Ma trận)", topics: 'matrix' }
  ],
  10: [
    { code: "K10-TU-DO", name: "Luyện tập tự do khối 10", topics: 'manual' },
    { code: "KT10-45P", name: "Kiểm tra 45p (Ma trận)", topics: 'matrix' }
  ],
  11: [
    { code: "K11-TU-DO", name: "Luyện tập tự do khối 11", topics: 'manual' },
    { code: "KT11-45P", name: "Kiểm tra 45p (Ma trận)", topics: 'matrix' }
  ],
  12: [
    { code: "K12-TU-DO", name: "Luyện tập tự do khối 12", topics: 'manual' },
    { code: "KT12-GKII", name: "Kiểm tra Giữa kì II (Ma trận)", topics: 'matrix' },
    { code: "KT12-45P", name: "Kiểm tra 45p (Ma trận)", topics: 'matrix' }
  ]
};

export const MAX_VIOLATIONS = 3;
