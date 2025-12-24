
import { Question } from '../types';

export const ALL_QUESTIONS: Question[] = [
  // PHẦN I: MCQ (Dựa vào số cuối classTag để xác định level)
  {
    id: 1,
    classTag: "12.4.1",
    part: "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn",
    type: "mcq",
    question: "Hàm số $y = \\sin 2x$ là một nguyên hàm của hàm số nào dưới đây?",
    o: ["$y = \\cos 2x$.", "$y = 2\\cos 2x$.", "$y = 2\\sin 2x$.", "$y = -\\cos 2x$."],
    a: "$y = 2\\cos 2x$."
  },
  {
    id: 2,
    classTag: "12.4.2",
    part: "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn",
    type: "mcq",
    question: "Cho $\\int{f\\left( x \\right)\\text{d}x=F\\left( x \\right)+C}$. Với $a\\ne 0$, khẳng định nào sau đây đúng?",
    o: [
      "$\\int{f\\left( ax+b \\right)\\text{d}x}=\\frac{1}{a}F\\left( ax+b \\right)+C$.",
      "$\\int{f\\left( ax+b \\right)\\text{d}x}=aF\\left( ax+b \\right)+C$.",
      "$\\int{f\\left( ax+b \\right)\\text{d}x}=F\\left( ax+b \\right)+C$.",
      "$\\int{f\\left( ax+b \\right)\\text{d}x}=\\frac{1}{a+b}F\\left( ax+b \\right)+C$."
    ],
    a: "$\\int{f\\left( ax+b \\right)\\text{d}x}=\\frac{1}{a}F\\left( ax+b \\right)+C$."
  },
  {
    id: 3,
    classTag: "12.4.3",
    part: "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn",
    type: "mcq",
    question: "Tính tích phân $I = \\int_0^1 (3x^2 + 2x + e^x) \\text{d}x$.",
    o: ["$e+1$", "$e+2$", "$e$", "$e-1$"],
    a: "$e+1$"
  },
  {
    id: 4,
    classTag: "12.4.4",
    part: "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn",
    type: "mcq",
    question: "Cho hàm số $f(x)$ liên tục trên $\\mathbb{R}$ thỏa mãn $f(x) + f(2-x) = x^2 - 2x + 4$. Tính $I = \\int_0^2 f(x) \\text{d}x$.",
    o: ["$I = \\frac{14}{3}$", "$I = \\frac{20}{3}$", "$I = 4$", "$I = \\frac{8}{3}$"],
    a: "$I = \\frac{20}{3}$"
  },

  // PHẦN II: TRẮC NGHIỆM ĐÚNG SAI
  {
    id: 16,
    classTag: "12.4.2",
    part: "Phần II. Câu trắc nghiệm đúng sai.",
    type: "true-false",
    question: "Cho hàm số $f\\left( x \\right)=2x-\\sin x$. Các mệnh đề sau đây đúng hay sai?",
    s: [
      { "text": "$f\\left( 0 \\right)=0$.", "a": true },
      { "text": "$F\\left( x \\right)={{x}^{2}}+\\cos x$ là một nguyên hàm của hàm số $f\\left( x \\right)$.", "a": true },
      { "text": "$f'\\left( x \\right)=2+\\cos x$.", "a": false },
      { "text": "Hàm số $f(x)$ đồng biến trên $\\mathbb{R}$.", "a": true }
    ]
  },
  {
    id: 17,
    classTag: "12.4.3",
    part: "Phần II. Câu trắc nghiệm đúng sai.",
    type: "true-false",
    question: "Cho tích phân $I = \\int_1^e \\frac{\\ln x}{x} \\text{d}x$. Xét các mệnh đề sau:",
    s: [
      { "text": "Đổi biến $t = \\ln x$ ta được $I = \\int_0^1 t \\text{d}t$.", "a": true },
      { "text": "Giá trị của $I = \\frac{1}{2}$.", "a": true },
      { "text": "Hàm số $F(x) = \\frac{\\ln^2 x}{2}$ là một nguyên hàm của $f(x) = \\frac{\\ln x}{x}$.", "a": true },
      { "text": "Nếu thay cận từ $1 \\to e^2$ thì giá trị tích phân là $2$.", "a": true }
    ]
  },

  // PHẦN III: TRẢ LỜI NGẮN
  {
    id: 21,
    classTag: "12.4.3",
    part: "Phần III. Câu trắc nghiệm trả lời ngắn",
    type: "short-answer",
    question: "Tính giá trị của tích phân $I = \\int_0^2 (3x^2 - 2x + 1) \\text{d}x$.",
    a: "6"
  },
  {
    id: 25,
    classTag: "12.4.4",
    part: "Phần III. Câu trắc nghiệm trả lời ngắn",
    type: "short-answer",
    question: "Tính tích phân $K = \\int_0^1 xe^x \\text{d}x$. (Kết quả là một số nguyên)",
    a: "1"
  }
];
