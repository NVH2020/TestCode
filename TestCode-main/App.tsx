
import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, ExamCodeDefinition, SheetResult 
} from './types.ts';
import { 
  GRADES, TOPICS_DATA, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, REGISTER_LINKS 
} from './constants.tsx';
import { generateExam, generateExamFromMatrix, calculateScore, MatrixConfig } from './services/examEngine.ts';
import MathText from './components/MathText.tsx';

const App: React.FC = () => {
  const [step, setStep] = useState<'entry' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'none'>('none');
  const [showScoreModal, setShowScoreModal] = useState(false);
  
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

  const isMatrixExam = EXAM_CODES[config.grade].find(c => c.code === student.examCode)?.topics === 'matrix';

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
    // Đảm bảo dùng đúng tham số API
    const url = `${DEFAULT_API_URL}?action=${action}&account=${encodeURIComponent(authForm.account)}&pass=${encodeURIComponent(authForm.pass)}&idnumber=${encodeURIComponent(authForm.idnumber)}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'success') {
        if (action === 'register') {
          alert(`Chúc mừng ${data.name}! Đăng ký thành công. Hãy đăng nhập.`);
          setAuthMode('login');
        } else {
          setStudent({
            ...student, fullName: data.name, studentClass: data.class, idNumber: data.sbd,
            isVerified: true, isLoggedIn: true, limitTab: data.limittab || MAX_VIOLATIONS
          });
          setAuthMode('none');
          alert(`Chào mừng ${data.name}!`);
        }
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ! Hãy chắc chắn bạn đã Deploy Script ở chế độ 'Anyone'.");
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
          alert("SBD này đã có tài khoản ứng dụng. Bạn BẮT BUỘC phải ĐĂNG NHẬP!");
          setAuthMode('login');
          return;
        }
        setStudent(prev => ({ 
          ...prev, fullName: data.name, studentClass: data.class, isVerified: true,
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
    
    if (isMatrixExam) {
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
    if (isMatrixExam && !student.isVerified && !student.isLoggedIn) {
      alert("Cần xác thực SBD hoặc Đăng nhập!");
      return;
    }
    
    let genResult;
    if (remoteMatrix) {
      genResult = generateExamFromMatrix(remoteMatrix);
      setQuestions(genResult.questions);
      setConfig(genResult.config);
      setExamState({ 
        currentQuestionIndex: 0, answers: {}, 
        timeLeft: genResult.config.duration * 60, 
        violations: 0, isFinished: false, startTime: new Date() 
      });
    } else {
      const qs = generateExam(config);
      setQuestions(qs);
      setExamState({ 
        currentQuestionIndex: 0, answers: {}, 
        timeLeft: config.duration * 60, 
        violations: 0, isFinished: false, startTime: new Date() 
      });
    }

    if (questions.length === 0 && !remoteMatrix) {
      alert("Không tìm thấy câu hỏi phù hợp!");
      return;
    }
    setStep('exam');
  };

  const finishExam = async () => {
    const finalScore = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    
    const durSec = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const timeStr = `${Math.floor(durSec / 60)}p ${durSec % 60}s`;

    // Dùng GET để lưu điểm để tránh CORS lỗi 302 của GAS
    const saveUrl = `${DEFAULT_API_URL}?action=saveResult&makiemtra=${student.examCode}&sbd=${student.idNumber}&name=${encodeURIComponent(student.fullName)}&class=${encodeURIComponent(student.studentClass)}&tongdiem=${finalScore}&time=${encodeURIComponent(timeStr)}`;
    fetch(saveUrl, { mode: 'no-cors' });
  };

  // Các phần render giữ nguyên giao diện đẹp của bạn
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
            <button key={g} onClick={() => setConfig({...config, grade: g})} className={`py-4 rounded-2xl font-black transition-all ${config.grade === g ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Khối {g}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAM_CODES[config.grade].map(def => (
            <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})} className={`p-5 text-left rounded-2xl border-2 transition-all ${student.examCode === def.code ? 'border-teal-500 bg-teal-50' : 'border-slate-100'}`}>
              <div className="font-black text-teal-700">{def.code}</div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">{def.topics === 'matrix' ? 'Chế độ Ma trận' : 'Tự do'}</div>
            </button>
          ))}
        </div>
        <button onClick={handleEntryNext} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] font-black text-xl uppercase shadow-xl hover:bg-teal-700 active:scale-95 transition-all">{loading ? 'Vui lòng đợi...' : 'Tiếp tục'}</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-4xl mx-auto p-6 animate-fadeIn">
      <button onClick={() => setStep('entry')} className="mb-6 font-black text-slate-400 uppercase text-xs hover:text-teal-600 transition-colors">← Quay lại chọn mã đề</button>
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border space-y-6">
        <h2 className="text-xl font-black text-teal-700 uppercase flex items-center gap-2"><span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>Thông tin thí sinh</h2>
        {student.isLoggedIn ? (
           <div className="p-6 bg-teal-50 rounded-2xl border border-teal-100">
             <div className="text-[10px] text-teal-600 uppercase font-black mb-1">Thí sinh đã đăng nhập</div>
             <div className="font-black text-slate-800 text-xl">{student.fullName}</div>
             <div className="text-slate-500 font-bold uppercase text-xs">SBD: {student.idNumber} - Lớp: {student.studentClass}</div>
           </div>
        ) : isMatrixExam ? (
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xác thực số báo danh</label>
            <div className="flex gap-2">
              <input type="text" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="flex-1 p-5 rounded-2xl border-2 font-black outline-none focus:border-teal-500" placeholder="VD: SBD001" />
              <button onClick={verifySBD} className="px-8 bg-teal-600 text-white rounded-2xl font-black shadow-lg">Check</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-5 rounded-2xl border-2 font-black outline-none focus:border-teal-500" placeholder="Họ và Tên thí sinh..." />
            <select value={student.studentClass} onChange={e => setStudent({...student, studentClass: e.target.value})} className="w-full p-5 rounded-2xl border-2 font-black outline-none focus:border-teal-500 bg-white">
               {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {student.isVerified && !student.isLoggedIn && <div className="text-teal-600 font-black p-4 bg-teal-50 rounded-xl border border-teal-100 animate-fadeIn">✓ Đã xác thực: {student.fullName} ({student.studentClass})</div>}
        <button onClick={handleStartExam} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xl shadow-lg hover:bg-teal-700 transition-all">Bắt đầu thi ngay</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && renderInfoSetup()}
      {step === 'exam' && (
        <div className="min-h-screen flex flex-col p-4 md:p-6 animate-fadeIn">
           <header className="flex justify-between items-center mb-6 bg-white p-6 rounded-3xl shadow-md border sticky top-0 z-10">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-teal-600 text-white rounded-2xl flex items-center justify-center font-black text-xl">{examState.currentQuestionIndex + 1}</div>
               <div>
                 <div className="font-black text-slate-800 leading-none uppercase text-sm">{student.fullName}</div>
                 <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Mã đề: {student.examCode}</div>
               </div>
             </div>
             <div className={`text-3xl font-black font-mono ${examState.timeLeft < 60 ? 'text-rose-600 animate-pulse' : 'text-teal-600'}`}>
               {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
             </div>
             <button onClick={() => confirm("Xác nhận nộp bài?") && finishExam()} className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-rose-700 transition-all">Nộp bài</button>
           </header>
           
           <div className="flex-1 max-w-4xl mx-auto w-full">
             <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
               <div className="text-[10px] font-black text-teal-600 uppercase mb-4 tracking-widest">{questions[examState.currentQuestionIndex]?.part}</div>
               <MathText content={questions[examState.currentQuestionIndex]?.question || ""} className="text-2xl font-bold text-slate-800 mb-10 leading-relaxed" />
               
               {/* Logic hiển thị đáp án tùy theo type (mcq, tf, short) */}
               {questions[examState.currentQuestionIndex]?.type === 'mcq' && (
                 <div className="grid grid-cols-1 gap-4">
                   {questions[examState.currentQuestionIndex].o?.map((opt, i) => (
                     <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})}
                       className={`p-6 text-left rounded-2xl border-2 font-bold transition-all flex items-center gap-4 ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'border-teal-500 bg-teal-50 ring-4 ring-teal-50' : 'border-slate-50 hover:border-teal-200 bg-slate-50/50'}`}>
                       <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 border'}`}>
                         {String.fromCharCode(65 + i)}
                       </span>
                       <MathText content={opt} className="text-lg" />
                     </button>
                   ))}
                 </div>
               )}
               {/* Thêm các UI cho True-False và Short-Answer tại đây */}
             </div>
             
             <div className="mt-8 flex justify-between">
                <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.max(0, examState.currentQuestionIndex - 1)})} disabled={examState.currentQuestionIndex === 0} className="px-8 py-4 bg-white text-slate-400 border-2 rounded-2xl font-black uppercase text-xs disabled:opacity-30">Quay lại</button>
                <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.min(questions.length - 1, examState.currentQuestionIndex + 1)})} disabled={examState.currentQuestionIndex === questions.length - 1} className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Tiếp theo</button>
             </div>
           </div>
        </div>
      )}
      
      {/* Các Modal: Tra cứu điểm, Auth */}
      {authMode !== 'none' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative border">
             <button onClick={() => setAuthMode('none')} className="absolute top-6 right-6 font-black text-slate-300 hover:text-slate-600 text-2xl transition-colors">✕</button>
             <h3 className="text-2xl font-black text-slate-800 uppercase text-center mb-8 tracking-widest">{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}</h3>
             <div className="space-y-4">
                {authMode === 'register' && <input type="text" placeholder="Nhập ID từ Giáo viên (idnumber)" value={authForm.idnumber} onChange={e => setAuthForm({...authForm, idnumber: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-teal-500" />}
                <input type="text" placeholder="Số điện thoại / Tài khoản" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-teal-500" />
                <input type="password" placeholder="Mật khẩu" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-teal-500" />
                {authMode === 'register' && <input type="password" placeholder="Nhập lại mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold outline-none focus:border-teal-500" />}
                <button onClick={handleAuth} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-teal-700 transition-all">{loading ? 'Hệ thống đang xử lý...' : (authMode === 'login' ? 'Đăng nhập ngay' : 'Xác nhận Đăng ký')}</button>
                <div className="text-center pt-2">
                   <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-teal-600 underline font-bold uppercase tracking-tighter">
                     {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký tại đây' : 'Đã có tài khoản? Quay về Đăng nhập'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
