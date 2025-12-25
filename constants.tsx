
import { Topic, ExamCodeDefinition } from './types';

export const GRADES = [9, 10, 11, 12];

export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec";

export const API_ROUTING: Record<string, string> = {
  "Test12345678": "https://script.google.com/macros/s/AKfycby4UzGKm1foHKV2I9YoKUQdnhPbFB4o6KRLKcTcsTf2zfYT2XG1fTz-o9tZ3hJDZ3-I/exec",
  "Ha0988948882": "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec"
};

export const REGISTER_LINKS = {
  MATH: "https://admintoanhoc.vercel.app/", 
  APP: "https://forms.gle/wQfqisy2TzFRMzsu6"
};

export const TOPICS_DATA: Record<number, Topic[]> = {
  9: [{ id: 1, name: "1. Phương trình và hệ phương trình" }, { id: 2, name: "2. Đường tròn" }],
  10: [{ id: 1, name: "1. Mệnh đề và Tập hợp" }, { id: 2, name: "2. Hàm số bậc hai" }],
  11: [{ id: 1, name: "1. Hàm số lượng giác" }, { id: 2, name: "2. Dãy số" }],
  12: [{ id: 1, name: "1. Ứng dụng đạo hàm" }, { id: 4, name: "4. Nguyên hàm và Tích phân" }]
};

export const EXAM_CODES: Record<number, ExamCodeDefinition[]> = {
  9: [
    { code: "Tu_Do_K9", name: "Luyện tập tự do", topics: 'manual' },
    { code: "KT9-15P", name: "Kiểm tra 15p", topics: 'matrix' }
  ],
  10: [
    { code: "Tu_Do_K10", name: "Luyện tập tự do", topics: 'manual' },
    { code: "KT10-45P", name: "Kiểm tra 45p", topics: 'matrix' }
  ],
  11: [
    { code: "Tu_Do_K11", name: "Luyện tập tự do", topics: 'manual' },
    { code: "KT11-45P", name: "Kiểm tra 45p", topics: 'matrix' }
  ],
  12: [
    { code: "Tu_Do_K12", name: "Luyện tập tự do", topics: 'manual' },
    { code: "KT12-45P", name: "Kiểm tra 45p", topics: 'matrix' }
  ]
};

export const CLASSES_LIST = ["Tự do", "12A1", "12A2", "11B1", "10C1"];
export const MAX_VIOLATIONS = 2;
