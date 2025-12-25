
import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, ExamCodeDefinition, SheetResult 
} from './types.ts';
import { 
  GRADES, TOPICS_DATA, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, API_ROUTING, REGISTER_LINKS 
} from './constants.tsx';
import { generateExam, generateExamFromMatrix, calculateScore, MatrixConfig } from './services/examEngine.ts';
import MathText from './components/MathText.tsx';

const App: React.FC = () => {
  const [step, setStep] = useState<'entry' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'none'>('none');
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  
  // Auth states
  const [authForm, setAuthForm] = useState({ idnumber: '', account: '', pass: '', confirmPass: '' });
  const [teacherPhoneForScore, setTeacherPhoneForScore] = useState("");
  const [remoteMatrix, setRemoteMatrix] = useState<MatrixConfig | null>(null);

  const [config, setConfig] = useState<ExamConfig>({
    grade: 10, topics: [], duration: 45,
    numMC: 12, scoreMC: 6, mcL3: 0, mcL4: 0,
    numTF: 4, scoreTF: 2, tfL3: 0, tfL4: 0,
    numSA: 6, scoreSA: 2, saL3: 0, saL4: 0
  });

  const [student, setStudent] = useState<StudentInfo>({
    fullName: '', studentClass: 'Tự do', idNumber: '', examCode: '', phoneNumber: '', isVerified: false, isLoggedIn: false, limitTab: MAX_VIOLATIONS
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  const activeApiUrl = API_ROUTING[student.phoneNumber] || DEFAULT_API_URL;
  const currentCodeDef = EXAM_CODES[config.grade].find(c => c.code === student.examCode);
  const isFixedExam = currentCodeDef && currentCodeDef.topics === 'matrix';

  const handleAuth = async () => {
    if (!authForm.account || !authForm.pass || (authMode === 'register' && !authForm.idnumber)) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    if (authMode === 'register' && authForm.pass !== authForm.confirmPass) {
      alert("Mật khẩu nhập lại không khớp!");
      return;
    }

    setLoading(true);
    const action = authMode === 'login' ? 'login' : 'register';
    const url = `${DEFAULT_API_URL}?action=${action}&account=${encodeURIComponent(authForm.account)}&pass=${encodeURIComponent(authForm.pass)}&idnumber=${authForm.idnumber}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'success') {
        if (action === 'register') {
          alert(`Đăng ký thành công cho ${data.name}! Hãy đăng nhập để thi.`);
          setAuthMode('login');
        } else {
          setStudent({
            ...student,
            fullName: data.name,
            studentClass: data.class,
            idNumber: data.sbd,
            isVerified: true,
            isLoggedIn: true,
            limitTab: data.limittab || MAX_VIOLATIONS
          });
          setAuthMode('none');
          alert(`Chào mừng ${data.name}!`);
        }
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ! Kiểm tra lại ID Google Sheet và quyền truy cập Web App.");
    } finally {
      setLoading(false);
    }
  };

  const verifySBD = async () => {
    if (student.isLoggedIn) return;
    if (!student.idNumber.trim()) { alert("Vui lòng nhập SBD!"); return; }
    
    setLoading(true);
    try {
      const url = `${DEFAULT_API_URL}?action=checkSBD&sbd=${encodeURIComponent(student.idNumber.trim())}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        if (data.hasAccount) {
          alert("SBD này đã được cấp tài khoản ứng dụng. Bạn BẮT BUỘC phải ĐĂNG NHẬP để làm mã đề này!");
          setAuthMode('login');
          return;
        }
        setStudent(prev => ({ 
          ...prev, 
          fullName: data.name, 
          studentClass: data.class, 
          isVerified: true,
          limitTab: data.limittab || MAX_VIOLATIONS
        }));
      } else {
        alert(data.message);
      }
    } catch {
      alert("Lỗi máy chủ khi kiểm tra SBD!");
    } finally {
      setLoading(false);
    }
  };

  const handleEntryNext = async () => {
    if (!student.examCode) { alert("Chọn mã đề!"); return; }
    
    if (isFixedExam) {
      setLoading(true);
      try {
        const url = `${DEFAULT_API_URL}?action=getMatrix&code=${student.examCode}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success') {
          setRemoteMatrix(data.matrix);
          setStep('info_setup');
        } else {
          alert(data.message);
        }
      } catch {
        alert("Không thể tải ma trận đề!");
      } finally {
        setLoading(false);
      }
    } else {
      setRemoteMatrix(null);
      setStep('info_setup');
    }
  };

  const handleStartExam = () => {
    if (isFixedExam && !student.isVerified && !student.isLoggedIn) {
      alert("Cần xác thực SBD hoặc Đăng nhập!");
      return;
    }
    
    let generated: Question[] = [];
    if (remoteMatrix) {
      generated = generateExamFromMatrix(remoteMatrix);
    } else {
      generated = generateExam(config);
    }

    if (generated.length === 0) {
      alert("Không tìm thấy câu hỏi phù hợp với ma trận!");
      return;
    }

    setQuestions(generated);
    setExamState({ currentQuestionIndex: 0, answers: {}, timeLeft: config.duration * 60, violations: 0, isFinished: false, startTime: new Date() });
    setStep('exam');
  };

  const finishExam = async () => {
    const finalScore = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    const dur = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const result: SheetResult = {
      name: student.fullName, makiemtra: student.examCode, class: student.studentClass,
      sbd: student.idNumber, tongdiem: finalScore, time: `${Math.floor(dur / 60)}p ${dur % 60}s`
    };
    fetch(DEFAULT_API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveResult', ...result }) });
  };

  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pt-10 animate-fadeIn">
      <header className="text-center space-y-4">
        <h1 className="text-3xl font-black text-teal-600 uppercase tracking-widest">TestcodeOk</h1>
        <p className="text-slate-500 font-bold text-sm">Hệ thống thi tích hợp Ma trận Google Sheet</p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <button onClick={() => setShowScoreModal(true)} className="px-6 py-3 bg-white border-2 border-teal-600 text-teal-700 rounded-full font-black shadow-lg uppercase text-[10px]">XEM ĐIỂM</button>
          <a href={REGISTER_LINKS.MATH} target="_blank" className="px-6 py-3 bg-blue-600 text-white rounded-full font-black shadow-lg uppercase text-[10px]">ĐĂNG KÝ HỌC TOÁN</a>
          <a href={REGISTER_LINKS.APP} target="_blank" className="px-6 py-3 bg-orange-500 text-white rounded-full font-black shadow-lg uppercase text-[10px]">ĐĂNG KÝ SỬ DỤNG APP</a>
          {student.isLoggedIn ? (
            <button onClick={() => setStudent({...student, isLoggedIn: false})} className="px-6 py-3 bg-rose-50 text-rose-700 border-2 border-rose-100 rounded-full font-black uppercase text-[10px]">ĐĂNG XUẤT</button>
          ) : (
            <button onClick={() => setAuthMode('login')} className="px-6 py-3 bg-teal-600 text-white rounded-full font-black uppercase text-[10px]">ĐĂNG NHẬP / ĐĂNG KÝ</button>
          )}
        </div>
      </header>
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border space-y-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GRADES.map(g => (
            <button key={g} onClick={() => setConfig({...config, grade: g})} className={`py-4 rounded-2xl font-black transition-all ${config.grade === g ? 'bg-teal-600 text-white' : 'bg-slate-50'}`}>Khối {g}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAM_CODES[config.grade].map(def => (
            <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})} className={`p-5 text-left rounded-2xl border-2 ${student.examCode === def.code ? 'border-teal-500 bg-teal-50' : 'border-slate-100'}`}>
              <div className="font-black text-teal-700">{def.code}</div>
              <div className="text-xs text-slate-500 uppercase">{def.topics === 'matrix' ? 'Cấu hình Ma trận' : 'Tự do'}</div>
            </button>
          ))}
        </div>
        <button onClick={handleEntryNext} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] font-black text-xl uppercase shadow-xl">{loading ? 'Đang tải ma trận...' : 'Tiếp tục'}</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-4xl mx-auto p-6 animate-fadeIn">
      <button onClick={() => setStep('entry')} className="mb-6 font-black text-slate-400 uppercase text-xs">← Quay lại</button>
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border space-y-6">
        <h2 className="text-xl font-black text-teal-700 uppercase">Thông tin thí sinh</h2>
        {student.isLoggedIn ? (
           <div className="p-6 bg-teal-50 rounded-2xl border border-teal-100 font-bold text-teal-800">Tài khoản: {student.fullName} ({student.idNumber})</div>
        ) : isFixedExam ? (
          <div className="flex gap-2">
            <input type="text" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value})} className="flex-1 p-5 rounded-2xl border-2 font-black outline-none" placeholder="Nhập SBD..." />
            <button onClick={verifySBD} className="px-8 bg-teal-600 text-white rounded-2xl font-black">Check</button>
          </div>
        ) : (
          <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-5 rounded-2xl border-2 font-black" placeholder="Nhập Họ Tên..." />
        )}
        {student.isVerified && <div className="text-teal-600 font-black">✓ Đã xác thực: {student.fullName}</div>}
        <button onClick={handleStartExam} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xl shadow-lg">Bắt đầu thi ngay</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && renderInfoSetup()}
      {step === 'exam' && (
        <div className="p-6">
           <header className="flex justify-between items-center mb-6 bg-white p-6 rounded-3xl shadow-sm">
             <div className="font-black text-teal-700 uppercase">Câu {examState.currentQuestionIndex + 1}</div>
             <div className="text-3xl font-black font-mono text-teal-600">{Math.floor(examState.timeLeft/60)}:{(examState.timeLeft%60).toString().padStart(2,'0')}</div>
             <button onClick={() => finishExam()} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs">Nộp bài</button>
           </header>
           <div className="bg-white p-10 rounded-[3rem] shadow-xl">
             <MathText content={questions[examState.currentQuestionIndex]?.question || ""} className="text-2xl font-bold text-slate-800 mb-8" />
             {/* Logic render đáp án tương tự code cũ */}
           </div>
        </div>
      )}
      {step === 'result' && (
        <div className="max-w-xl mx-auto pt-20 text-center">
           <div className="bg-white p-16 rounded-[4rem] shadow-2xl border">
              <h2 className="text-xl font-black uppercase text-slate-400 mb-4">Tổng điểm của bạn</h2>
              <div className="text-[12rem] font-black leading-none text-teal-600">{calculateScore(questions, examState.answers, config).toFixed(1)}</div>
              <button onClick={() => window.location.reload()} className="mt-10 w-full py-5 bg-teal-600 text-white rounded-3xl font-black uppercase">Về trang chủ</button>
           </div>
        </div>
      )}
      
      {authMode !== 'none' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative">
             <button onClick={() => setAuthMode('none')} className="absolute top-6 right-6 font-black text-slate-300">✕</button>
             <h3 className="text-2xl font-black text-slate-800 uppercase text-center mb-8">{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h3>
             <div className="space-y-4">
                {authMode === 'register' && <input type="text" placeholder="ID Bản Quyền (Cột F - idnumber)" value={authForm.idnumber} onChange={e => setAuthForm({...authForm, idnumber: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold" />}
                <input type="text" placeholder="Tên tài khoản (SĐT học sinh)" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold" />
                <input type="password" placeholder="Mật khẩu" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold" />
                {authMode === 'register' && <input type="password" placeholder="Nhập lại mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold" />}
                <button onClick={handleAuth} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase">{loading ? '...' : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký')}</button>
                <div className="text-center">
                   <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-teal-600 underline font-bold">{authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
