
// Fix: Added missing Language type definition
export type Language = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'sql' | 'cpp';

export interface Question {
  id: number;
  classTag: string; // "Lớp.ChuyênĐề.MứcĐộ" ví dụ "12.4.1"
  part: string;
  type: 'mcq' | 'true-false' | 'short-answer';
  question: string;
  img?: string;
  o?: string[];
  a?: string;
  s?: { text: string; a: boolean }[];
}

export interface ExamConfig {
  grade: number;
  topics: number[];
  duration: number;
  numMC: number;
  scoreMC: number;
  numTF: number;
  scoreTF: number;
  numSA: number;
  scoreSA: number;
}

export interface ExamCodeDefinition {
  code: string;
  name: string;
  topics: number[] | 'manual' | 'matrix';
}

export interface StudentInfo {
  fullName: string;
  studentClass: string;
  idNumber: string; // ID bản quyền
  sbd: string;
  account: string; // taikhoanapp
  isLoggedIn: boolean;
  isVerified: boolean;
  limit: number;
  limitTab: number;
}

export interface ExamState {
  currentQuestionIndex: number;
  answers: Record<number, any>;
  timeLeft: number;
  violations: number;
  isFinished: boolean;
  startTime: Date;
  finishTime?: Date;
}

export interface Topic {
  id: number;
  name: string;
}