
// Add Language type definition to fix missing export errors
export type Language = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'sql' | 'cpp';

export interface Question {
  id: number;
  classTag: string; // "Grade.Topic.Level"
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
  isFree?: boolean;
}

export interface ExamCodeDefinition {
  code: string;
  name: string;
  topics: number[] | 'manual' | 'matrix';
}

export interface StudentInfo {
  fullName: string;
  studentClass: string;
  idNumber: string;
  sbd: string;
  examCode: string;
  account: string;
  isLoggedIn?: boolean;
  isVerified?: boolean;
  limit: number;      // Exam attempt limit
  limitTab: number;   // Tab switch limit
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