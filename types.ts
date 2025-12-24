
// Fix: Added exported Language type used by Sidebar and geminiService
export type Language = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'sql' | 'cpp';

export interface Question {
  id: number;
  classTag: string; // "Grade.Topic.Level" ví dụ "12.4.1"
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
  mcL3: number;
  mcL4: number;
  numTF: number;
  scoreTF: number;
  tfL3: number;
  tfL4: number;
  numSA: number;
  scoreSA: number;
  saL3: number;
  saL4: number;
}

export interface ExamCodeDefinition {
  code: string;
  name: string;
  topics: number[] | 'manual';
  fixedConfig?: {
    duration: number;
    numMC: number;
    scoreMC: number;
    mcL3?: number;
    mcL4?: number;
    numTF: number;
    scoreTF: number;
    tfL3?: number;
    tfL4?: number;
    numSA: number;
    scoreSA: number;
    saL3?: number;
    saL4?: number;
  };
}

export interface StudentInfo {
  fullName: string;
  studentClass: string;
  idNumber: string;
  examCode: string;
  phoneNumber: string;
  isVerified?: boolean;
  isLoggedIn?: boolean;
  limitTab?: number;
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

export interface SheetResult {
  name: string;
  makiemtra: string;
  class: string;
  sbd: string;
  tongdiem: number;
  time: string;
  phoneNumber?: string;
}
