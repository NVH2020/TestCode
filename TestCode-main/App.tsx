import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, ExamCodeDefinition, SheetResult 
} from './types';
import { 
  GRADES, TOPICS_DATA, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, API_ROUTING 
} from './constants';
import { generateExam, calculateScore } from './services/examEngine';
import MathText from './components/MathText';

const App: React.FC = () => {
  // Quản lý các bước: entry (trang chủ), info (nhập thông tin), exam (thi), result (điểm), review (xem lại)
  const [step, setStep] = useState<'entry' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [userAccount, setUserAccount] = useState<{user: string, pass: string} | null>(
    JSON.parse(localStorage.getItem('user_account') || 'null')
  );
  
  const [config, setConfig] = useState<ExamConfig>({
    grade: 10, topics: [], duration: 45,
    numMC: 12, scoreMC: 3, mcL3: 0, mcL4: 0,
    numTF: 4, scoreTF: 4, tfL3: 0, tfL4: 0,
    numSA: 6, scoreSA: 3, saL3: 0, saL4: 0
  });

  const [student, setStudent] = useState<StudentInfo>({
    fullName: '', studentClass: 'Tự do', idNumber: '', examCode: '', phoneNumber: '', isVerified: false
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [teacherPhoneForScore, setTeacherPhoneForScore] = useState("");

  const activeApiUrl = API_ROUTING[student.phoneNumber] || DEFAULT_API_URL;

  // Logic Đăng nhập / Đăng ký (Lưu Local)
  const handleAuth = () => {
    const u = (document.getElementById('u_name') as HTMLInputElement).value;
    const p = (document.getElementById('u_pass') as HTMLInputElement).value;
    if(!u || !p) { alert("Vui lòng nhập đủ thông tin!"); return; }
    
    if(isRegister) {
      localStorage.setItem('user_account', JSON.stringify({user: u, pass: p}));
      alert("Đăng ký thành công!");
      setIsRegister(false);
    } else {
      const saved = JSON.parse(localStorage.getItem('user_account') || '{}');
      if(saved.user === u && saved.pass === p) {
        setUserAccount(saved);
        setShowLoginModal(false);
      } else {
        alert("Tên đăng nhập hoặc mật khẩu không đúng!");
      }
    }
  };

  const finishExam = async () => {
    const finalScore = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    const dur = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const result: SheetResult = {
      name: student.fullName, makiemtra: student.examCode, class: student.studentClass,
      sbd: student.idNumber, tongdiem: finalScore, time: `${Math.floor(dur / 60)}p ${dur % 60}s`, phoneNumber: student.phoneNumber
    };
    fetch(activeApiUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveResult', ...result }) });
  };

  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pt-10 animate-fadeIn">
      <header className="text-center space-y-6">
        <h1 className="text-3xl font-black text-teal-600 uppercase tracking-widest leading-tight">Tạo Đề Kiểm Tra Từ Ngân Hàng</h1>
        <p className="text-slate-500 font-bold text-sm uppercase">Tác giả: Nguyễn Văn Hà - THPT Yên Dũng số 2</p>
        
        {/* Sửa lỗi CSS: Dùng class Tailwind flex thay cho thẻ style */}
        <div className="flex flex-wrap gap-3 justify-center items-center">
          <a href="https://admintoanhoc.vercel.app/" target="_blank" rel="noreferrer" 
             className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-md transition-all">
             Đăng ký học Toán
          </a>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSc0WnpsymYVfZ95SE9LOo_8A5QZJPAfbaLufXvKYfq5LOFgiw/viewform" target="_blank" rel="noreferrer"
             className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-md transition-all">
             Đăng ký dùng App
          </a>
          <button onClick={() => setShowScoreModal(true)} 
             className="px-6 py-3 bg-teal-600 text-white rounded-xl font-bold text-xs hover:bg-teal-700 shadow-md transition-all">
             Xem điểm
          </button>
          <button onClick={() => setShowLoginModal(true)} 
             className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold text-xs hover:bg-amber-600 shadow-md transition-all uppercase">
             {userAccount ? `Chào, ${userAccount.user}` : 'Đăng nhập'}
          </button>
        </div>
      </header>

      <div className="bg-white p-8 rounded-[2rem] shadow-2xl border space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GRADES.map(g => (
            <button key={g} onClick={() => setConfig({...config, grade: g})}
              className={`py-4 rounded-2xl font-black ${config.grade === g ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-500'}`}>Khối {g}</button>
          ))}
        </div>
        <button onClick={() => setStep('info_setup')} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">Tiếp tục</button>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="max-w-xl mx-auto p-6 pt-16 text-center animate-fadeIn">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border space-y-8">
        <div className="space-y-2">
          <h2 className="text-8xl font-black text-teal-600 leading-none">
            {calculateScore(questions, examState.answers, config).toFixed(1)}
          </h2>
          <p className="font-bold text-slate-400 uppercase tracking-widest text-sm">Điểm số của bạn</p>
        </div>
        
        <div className="space-y-3">
          <button onClick={() => setStep('review')} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-2">
            Xem chi tiết bài thi
          </button>
          <button onClick={() => window.location.reload()} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-slate-900 transition-all">
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fadeIn pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border sticky top-4 z-10">
        <h2 className="text-xl font-black text-slate-800 uppercase">Review Bài Làm</h2>
        <button onClick={() => setStep('result')} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Quay lại</button>
      </div>
      {questions.map((q, idx) => {
        const studentAns = examState.answers[q.id];
        return (
          <div key={q.id} className="bg-white p-8 rounded-[2.5rem] shadow-md border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center font-black"> {idx + 1} </span>
              <span className="text-[10px] font-black text-teal-600 uppercase bg-teal-50 px-3 py-1 rounded-full">ID: {q.id}</span>
            </div>
            <MathText content={q.question} className="text-xl font-bold text-slate-800 mb-6 leading-relaxed" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bạn chọn:</p>
                  <div className="font-bold text-rose-500">
                    {q.type === 'mcq' && studentAns !== undefined ? String.fromCharCode(65 + studentAns) : JSON.stringify(studentAns) || "Trống"}
                  </div>
               </div>
               <div className="p-5 bg-teal-50 rounded-2xl border border-teal-100">
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2">Đáp án đúng (a):</p>
                  <div className="font-black text-teal-700">{q.a}</div>
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && <div className="p-10 text-center font-bold">Hãy bổ sung renderInfoSetup của bạn tại đây...</div>}
      {step === 'exam' && <div className="p-10 text-center font-bold">Hãy bổ sung renderExam của bạn tại đây...</div>}
      {step === 'result' && renderResult()}
      {step === 'review' && renderReview()}

      {/* Modal Đăng nhập / Đăng ký */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm relative shadow-2xl">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-xl font-black">✕</button>
            <div className="text-center space-y-6">
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                 {isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập App'}
               </h3>
               <div className="space-y-3 text-left">
                  <input id="u_name" type="text" placeholder="Tên đăng nhập" className="w-full p-4 border-2 rounded-xl font-bold outline-none focus:border-amber-500" />
                  <input id="u_pass" type="password" placeholder="Mật khẩu" className="w-full p-4 border-2 rounded-xl font-bold outline-none focus:border-amber-500" />
               </div>
               <button onClick={handleAuth} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black shadow-lg hover:bg-amber-600 transition-all uppercase">
                 {isRegister ? 'Tạo tài khoản' : 'Vào hệ thống'}
               </button>
               <p onClick={() => setIsRegister(!isRegister)} className="text-xs font-black text-slate-400 cursor-pointer hover:text-amber-600">
                 {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
