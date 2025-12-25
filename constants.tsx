
import { Topic, ExamCodeDefinition } from './types';

export const GRADES = [9, 10, 11, 12];

export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec";

export const API_ROUTING: Record<string, string> = {
  "Test12345678": "https://script.google.com/macros/s/AKfycbyc5zVzrdXukeL6kr2nEoyLVxiaD0aMquX8gtkk15SpeQKyK33A1mKcZoIJqsMuqwme/exec",
  "Ha0988948882": "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec"
};

export const REGISTER_LINKS = {
  MATH: "https://admintoanhoc.vercel.app/", 
  APP: "https://forms.gle/wQfqisy2TzFRMzsu6"
};

export const TOPICS_DATA: Record<number, Topic[]> = {
  // ... (giữ nguyên các khối 9, 10, 11)
  9: [
    { id: 1, name: "1. Phương trình và hệ phương trình bậc nhất" },
    { id: 2, name: "2. Phương trình bậc hai một ẩn số" },
    { id: 3, name: "3. Hệ thức lượng trong tam giác vuông" },
    { id: 4, name: "4. Đường tròn" },
    { id: 5, name: "5. Hàm số y = ax²" },
    { id: 6, name: "6. Các hình khối trong thực tiễn" },
    { id: 7, name: "7. Căn thức bậc hai và căn thức bậc ba" },
    { id: 8, name: "8. Một số yếu tố xác suất và thống kê" }
  ],
  10: [
    { id: 1, name: "1. Mệnh đề và Tập hợp" },
    { id: 2, name: "2. BPT và Hệ BPT bậc nhất hai ẩn" },
    { id: 3, name: "3. Hàm số bậc hai và Đồ thị" },
    { id: 4, name: "4. Hệ thức lượng trong tam giác" },
    { id: 5, name: "5. Vectơ" },
    { id: 6, name: "6. Thống kê" },
    { id: 7, name: "7. Phương pháp tọa độ trong mặt phẳng" },
    { id: 8, name: "8. Đại số tổ hợp" },
    { id: 9, name: "9. Xác suất cổ điển của biến cố" }
  ],
  11: [
    { id: 1, name: "1. Hàm số lượng giác và Phương trình lượng giác" },
    { id: 2, name: "2. Dãy số, Cấp số cộng và Cấp số nhân" },
    { id: 3, name: "3. Các số đặc trưng đo thế giới trung tâm" },
    { id: 4, name: "4. Quan hệ song song trong không gian" },
    { id: 5, name: "5. Giới hạn dãy số" },
    { id: 6, name: "6. Giới hạn hàm số. Hàm số liên tục" },
    { id: 7, name: "7. Hàm số mũ và Hàm số lôgarit" },
    { id: 8, name: "8. Quan hệ vuông góc trong không gian" },
    { id: 9, name: "9. Quy tắc tính đạo hàm" },
    { id: 10, name: "10. Quy tắc tính xác suất" }
  ],
  12: [
    { id: 1, name: "1. Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số" },
    { id: 2, name: "2. Vectơ và Hệ tọa độ trong không gian (Oxyz)" },
    { id: 3, name: "3. Các số đặc trưng đo mức độ phân tán của mẫu số liệu ghép nhóm" },
    { id: 4, name: "4. Nguyên hàm và Tích phân" },
    { id: 5, name: "5. Phương pháp tọa độ trong không gian (Đường thẳng, Mặt phẳng, Mặt cầu)" },
    { id: 6, name: "6. Xác suất có điều kiện và Công thức Bayes" }
  ]
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
