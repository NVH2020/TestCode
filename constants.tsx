
import { Topic, ExamCodeDefinition } from './types';

export const GRADES = [9, 10, 11, 12];

export const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec";

export const API_ROUTING: Record<string, string> = {
  "Test12345678": "https://script.google.com/macros/s/AKfycbyc5zVzrdXukeL6kr2nEoyLVxiaD0aMquX8gtkk15SpeQKyK33A1mKcZoIJqsMuqwme/exec",
  "Ha0988948882": "https://script.google.com/macros/s/AKfycbzPin0LbYlG0pTrhnmArHT43nVBIjdH5YXqjsjjyXcT4oPltRDCkoP5TNlKdbFsSPk1/exec",
  "0987654321": "https://script.google.com/macros/s/URL_GIAO_VIEN_B/exec"
};

// Các liên kết đăng ký
export const REGISTER_LINKS = {
  MATH: "https://admintoanhoc.vercel.app/",
  APP: "https://forms.gle/fzE1p7DGfrwG7KMz8"
};

export const TOPICS_DATA: Record<number, Topic[]> = {
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
    { code: "Tu_Do_K9", name: "Luyện tập tự do (Học sinh tự chọn)", topics: 'manual' },
    { 
      code: "KT9-15P-02", 
      name: "Kiểm tra 15p (Chuyên đề 1, 3, 4)", 
      topics: [1, 3, 4],
      fixedConfig: { duration: 15, numMC: 10, scoreMC: 10, numTF: 0, scoreTF: 0, numSA: 0, scoreSA: 0 }
    }
  ],
  10: [
    { code: "Tu_Do_K10", name: "Luyện tập tự do (Học sinh tự chọn)", topics: 'manual' },
    { 
      code: "Chuyen_De_1.10", 
      name: "Kiểm tra Mệnh đề, Tập hợp", 
      topics: [1],
      fixedConfig: { 
        duration: 45, 
        numMC: 12, scoreMC: 6, mcL3: 0, mcL4: 0,
        numTF: 2, scoreTF: 2, tfL3: 1, tfL4: 0,
        numSA: 4, scoreSA: 2, saL3: 1, saL4: 1
      }
    },
    { 
      code: "Chuyen_De_2.10", 
      name: "Kiểm tra BPT và Hệ BPT bậc nhất", 
      topics: [2],
      fixedConfig: { 
        duration: 45, 
        numMC: 12, scoreMC: 6, mcL3: 0, mcL4: 0,
        numTF: 2, scoreTF: 2, tfL3: 1, tfL4: 0,
        numSA: 4, scoreSA: 2, saL3: 1, saL4: 1
      }
    }
  ],
  11: [
    { code: "Tu_Do_K11", name: "Luyện tập tự do (Học sinh tự chọn)", topics: 'manual' },
    { 
      code: "Chuyen_De_1.11", 
      name: "Kiểm tra chương lượng giác", 
      topics: [1],
      fixedConfig: { 
        duration: 45, 
        numMC: 12, scoreMC: 6, mcL3: 0, mcL4: 0,
        numTF: 2, scoreTF: 2, tfL3: 1, tfL4: 0,
        numSA: 4, scoreSA: 2, saL3: 1, saL4: 1
      }
    }
  ],
  12: [
    { code: "Tu_Do_K12", name: "Luyện tập tự do (Học sinh tự chọn)", topics: 'manual' },
    { 
      code: "Chuyen_De_1.12", 
      name: "Kiểm tra khảo sát hàm số", 
      topics: [1],
      fixedConfig: { 
        duration: 45, 
        numMC: 12, scoreMC: 6, mcL3: 0, mcL4: 0,
        numTF: 2, scoreTF: 2, tfL3: 1, tfL4: 0,
        numSA: 4, scoreSA: 2, saL3: 1, saL4: 1
      }
    },
    { 
      code: "Chuyen_De_4.12", 
      name: "Kiểm tra nguyên hàm, tích phân", 
      topics: [4],
      fixedConfig: { 
        duration: 45, 
        numMC: 6, scoreMC: 6, mcL3: 0, mcL4: 0,
        numTF: 2, scoreTF: 2, tfL3: 1, tfL4: 0,
        numSA: 2, scoreSA: 2, saL3: 1, saL4: 1
      }
    }
  ]
};

export const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 150];
export const MC_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 40, 50];
export const CLASSES_LIST = ["Tự do", "12A1", "12A3", "11B2", "10C5"];
export const MAX_VIOLATIONS = 2;
