
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

  // Đồng hồ đếm ngược
  useEffect(() => {
    let timer: any;
    if (step === 'exam' && examState.timeLeft > 0 && !examState.isFinished) {
      timer = setInterval(() => {
        setExamState(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            finishExam();
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, examState.timeLeft, examState.isFinished]);

  const handleAuth = async () => {
    if (!authForm.account || !authForm.pass || (authMode === 'register' && !authForm.idnumber)) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    if (authMode === 'register' && authForm.pass !== authForm.confirmPass) {
      alert("Mật khẩu không khớp!");
      return;
    }

    setLoading(true);
    const action = authMode === 'login' ? 'login' : 'register';
    const url = `${DEFAULT_API_URL}?action=${action}&account=${encodeURIComponent(authForm.account)}&pass=${encodeURIComponent(authForm.pass)}&idnumber=${encodeURIComponent(authForm.idnumber)}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'success') {
        if (action === 'register') {
          alert(`Đăng ký thành công cho ${data.name}! Mời bạn đăng nhập.`);
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
      alert("Lỗi kết nối máy chủ! Hãy kiểm tra Deploy Apps Script (Anyone).");
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
          alert("SBD này đã có tài khoản ứng dụng. Bạn hãy chọn ĐĂNG NHẬP!");
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
    setStep('exam');
  };

  const finishExam = async () => {
    const finalScore = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    
    const durSec = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const timeStr = `${Math.floor(durSec / 60)}p ${durSec % 60}s`;

    const saveUrl = `${DEFAULT_API_URL}?action=saveResult&makiemtra=${student.examCode}&sbd=${student.idNumber}&name=${encodeURIComponent(student.fullName)}&class=${encodeURIComponent(student.studentClass)}&tongdiem=${finalScore}&time=${encodeURIComponent(timeStr)}`;
    fetch(saveUrl, { mode: 'no-cors' });
  };

  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pt-10 animate-fadeIn">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-black text-teal-600 uppercase tracking-tighter">TestcodeOk</h1>
        <p className="text-slate-400 font-bold text-sm tracking-widest">Hệ thống thi tích hợp Ma trận Google Sheet</p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <button onClick={() => setShowScoreModal(true)} className="px-6 py-3 bg-white border-2 border-teal-500 text-teal-600 rounded-2xl font-black shadow-lg uppercase text-[10px]">TRA ĐIỂM</button>
          <a href={REGISTER_LINKS.MATH} target="_blank" className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px]">HỌC TOÁN ONLINE</a>
          {student.isLoggedIn ? (
            <button onClick={() => setStudent({...student, isLoggedIn: false})} className="px-6 py-3 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl font-black uppercase text-[10px]">ĐĂNG XUẤT</button>
          ) : (
            <button onClick={() => setAuthMode('login')} className="px-6 py-3 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">ĐĂNG NHẬP / ĐĂNG KÝ</button>
          )}
        </div>
      </header>
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GRADES.map(g => (
            <button key={g} onClick={() => setConfig({...config, grade: g})} className={`py-5 rounded-2xl font-black transition-all ${config.grade === g ? 'bg-teal-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-300'}`}>Khối {g}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXAM_CODES[config.grade].map(def => (
            <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})} className={`p-6 text-left rounded-3xl border-2 transition-all ${student.examCode === def.code ? 'border-teal-500 bg-teal-50 shadow-inner' : 'border-slate-50 hover:bg-slate-50'}`}>
              <div className="font-black text-teal-700 text-lg mb-1">{def.code}</div>
              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{def.topics === 'matrix' ? 'Chế độ Ma trận' : 'Luyện tập tự do'}</div>
            </button>
          ))}
        </div>
        <button onClick={handleEntryNext} disabled={loading} className="w-full py-6 bg-teal-600 text-white rounded-3xl font-black text-xl uppercase shadow-2xl hover:bg-teal-700 active:scale-95 transition-all">{loading ? 'Hệ thống đang tải...' : 'Bắt đầu ngay'}</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-4xl mx-auto p-6 animate-fadeIn">
      <button onClick={() => setStep('entry')} className="mb-6 font-black text-slate-400 uppercase text-xs hover:text-teal-600">← Chọn mã đề khác</button>
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-8">
        <h2 className="text-2xl font-black text-teal-700 uppercase">Thông tin thí sinh</h2>
        {student.isLoggedIn ? (
           <div className="p-8 bg-teal-50 rounded-3xl border-2 border-teal-100 shadow-sm">
             <div className="text-[10px] text-teal-600 uppercase font-black mb-2 tracking-widest">Đã đăng nhập thành công</div>
             <div className="font-black text-slate-800 text-2xl">{student.fullName}</div>
             <div className="text-slate-500 font-bold uppercase text-xs mt-1">SBD: {student.idNumber} • Lớp: {student.studentClass}</div>
           </div>
        ) : isMatrixExam ? (
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Xác thực số báo danh</label>
            <div className="flex gap-3">
              <input type="text" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="flex-1 p-5 rounded-2xl border-2 font-black outline-none focus:border-teal-500 bg-slate-50" placeholder="VD: SBD001" />
              <button onClick={verifySBD} className="px-10 bg-teal-600 text-white rounded-2xl font-black shadow-lg hover:bg-teal-700">Check</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-5 rounded-2xl border-2 font-black bg-slate-50 focus:border-teal-500" placeholder="Họ và Tên của bạn..." />
            <select value={student.studentClass} onChange={e => setStudent({...student, studentClass: e.target.value})} className="w-full p-5 rounded-2xl border-2 font-black bg-slate-50 focus:border-teal-500">
               {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {student.isVerified && !student.isLoggedIn && <div className="p-5 bg-green-50 text-green-700 font-black rounded-2xl border-2 border-green-100 animate-fadeIn">✓ Xác thực: {student.fullName} ({student.studentClass})</div>}
        <button onClick={handleStartExam} className="w-full py-6 bg-teal-600 text-white rounded-3xl font-black uppercase text-xl shadow-2xl hover:bg-teal-700 transition-all">Vào phòng thi</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-teal-100">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && renderInfoSetup()}
      {step === 'exam' && (
        <div className="min-h-screen flex flex-col p-4 md:p-8 animate-fadeIn">
           <header className="max-w-5xl mx-auto w-full flex justify-between items-center mb-8 bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 sticky top-4 z-10">
             <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-teal-600 text-white rounded-[1.2rem] flex items-center justify-center font-black text-2xl shadow-lg shadow-teal-600/30">{examState.currentQuestionIndex + 1}</div>
               <div className="hidden sm:block">
                 <div className="font-black text-slate-800 text-lg uppercase tracking-tight">{student.fullName}</div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Mã đề: {student.examCode}</div>
               </div>
             </div>
             <div className={`text-4xl font-black font-mono tracking-tighter ${examState.timeLeft < 120 ? 'text-rose-600 animate-pulse' : 'text-teal-600'}`}>
               {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
             </div>
             <button onClick={() => confirm("Xác nhận nộp bài?") && finishExam()} className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-rose-600/30 hover:bg-rose-700 active:scale-95 transition-all">Nộp bài</button>
           </header>
           
           <div className="flex-1 max-w-5xl mx-auto w-full">
             <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-teal-500"></div>
               <div className="text-[11px] font-black text-teal-600 uppercase mb-6 tracking-[0.2em]">{questions[examState.currentQuestionIndex]?.part}</div>
               <MathText content={questions[examState.currentQuestionIndex]?.question || ""} className="text-3xl font-bold text-slate-800 mb-12 leading-relaxed" />
               
               {questions[examState.currentQuestionIndex]?.type === 'mcq' && (
                 <div className="grid grid-cols-1 gap-5">
                   {questions[examState.currentQuestionIndex].o?.map((opt, i) => (
                     <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})}
                       className={`p-7 text-left rounded-3xl border-2 font-bold transition-all flex items-center gap-6 ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'border-teal-500 bg-teal-50 shadow-inner' : 'border-slate-50 hover:bg-slate-50 hover:border-slate-200'}`}>
                       <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-teal-600 text-white shadow-lg' : 'bg-white text-slate-400 border'}`}>
                         {String.fromCharCode(65 + i)}
                       </span>
                       <MathText content={opt} className="text-xl text-slate-700" />
                     </button>
                   ))}
                 </div>
               )}

               {questions[examState.currentQuestionIndex]?.type === 'true-false' && (
                  <div className="space-y-6">
                    {questions[examState.currentQuestionIndex].s?.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-6 rounded-3xl">
                        <div className="flex-1 font-bold text-slate-700 text-lg"><MathText content={item.text} /></div>
                        <div className="flex gap-2">
                          {[true, false].map((val) => {
                             const currentAns = examState.answers[questions[examState.currentQuestionIndex].id] || [];
                             const isSelected = currentAns[idx] === val;
                             return (
                               <button key={val.toString()} onClick={() => {
                                 const newAns = [...currentAns];
                                 newAns[idx] = val;
                                 setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: newAns}});
                               }} className={`px-8 py-3 rounded-xl font-black text-xs uppercase transition-all ${isSelected ? (val ? 'bg-green-600 text-white shadow-lg' : 'bg-rose-600 text-white shadow-lg') : 'bg-white text-slate-400 border'}`}>
                                 {val ? 'Đúng' : 'Sai'}
                               </button>
                             );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
               )}

               {questions[examState.currentQuestionIndex]?.type === 'short-answer' && (
                  <div className="max-w-md">
                    <input type="text" value={examState.answers[questions[examState.currentQuestionIndex].id] || ""} onChange={e => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: e.target.value}})}
                      className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-2xl text-teal-700 focus:border-teal-500 outline-none shadow-inner" placeholder="Nhập đáp án..." />
                    <p className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest text-center">Lưu ý: Nhập số hoặc cụm từ ngắn gọn</p>
                  </div>
               )}
             </div>
             
             <div className="mt-10 flex justify-between gap-4">
                <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.max(0, examState.currentQuestionIndex - 1)})} disabled={examState.currentQuestionIndex === 0} className="flex-1 py-5 bg-white text-slate-400 border-2 border-slate-100 rounded-3xl font-black uppercase text-xs shadow-lg hover:text-teal-600 transition-all disabled:opacity-20">Câu trước</button>
                <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.min(questions.length - 1, examState.currentQuestionIndex + 1)})} disabled={examState.currentQuestionIndex === questions.length - 1} className="flex-1 py-5 bg-teal-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-teal-600/30 hover:bg-teal-700 transition-all">Câu tiếp theo</button>
             </div>
           </div>
        </div>
      )}
      
      {step === 'result' && (
        <div className="max-w-2xl mx-auto pt-20 px-6 animate-fadeIn">
           <div className="bg-white p-20 rounded-[4rem] shadow-2xl border border-slate-50 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-teal-500"></div>
              <h2 className="text-xl font-black uppercase text-slate-400 mb-6 tracking-[0.3em]">Kết quả bài làm</h2>
              <div className="text-[12rem] font-black leading-none text-teal-600 tracking-tighter shadow-teal-200 drop-shadow-2xl">
                {calculateScore(questions, examState.answers, config).toFixed(1)}
              </div>
              <p className="mt-10 text-slate-500 font-bold uppercase text-xs tracking-widest">Hệ thống đã tự động lưu điểm của bạn</p>
              <button onClick={() => window.location.reload()} className="mt-12 w-full py-6 bg-teal-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-teal-700 transition-all">Quay lại trang chủ</button>
           </div>
        </div>
      )}

      {authMode !== 'none' && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-3xl relative border border-slate-100">
             <button onClick={() => setAuthMode('none')} className="absolute top-8 right-8 font-black text-slate-300 hover:text-slate-600 text-2xl">✕</button>
             <h3 className="text-3xl font-black text-slate-800 uppercase text-center mb-10 tracking-tight">{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký học viên'}</h3>
             <div className="space-y-4">
                {authMode === 'register' && <input type="text" placeholder="ID của Giáo viên (idnumber)" value={authForm.idnumber} onChange={e => setAuthForm({...authForm, idnumber: e.target.value})} className="w-full p-5 bg-slate-50 border-2 rounded-2xl font-bold focus:border-teal-500 outline-none" />}
                <input type="text" placeholder="Số điện thoại / Tài khoản" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-5 bg-slate-50 border-2 rounded-2xl font-bold focus:border-teal-500 outline-none" />
                <input type="password" placeholder="Mật khẩu bảo mật" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-5 bg-slate-50 border-2 rounded-2xl font-bold focus:border-teal-500 outline-none" />
                {authMode === 'register' && <input type="password" placeholder="Xác nhận lại mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-5 bg-slate-50 border-2 rounded-2xl font-bold focus:border-teal-500 outline-none" />}
                <button onClick={handleAuth} disabled={loading} className="w-full py-6 bg-teal-600 text-white rounded-3xl font-black uppercase shadow-2xl hover:bg-teal-700 transition-all mt-4">{loading ? 'Đang xử lý...' : (authMode === 'login' ? 'Vào ứng dụng' : 'Hoàn tất đăng ký')}</button>
                <div className="text-center pt-4">
                   <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-teal-600 underline font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                     {authMode === 'login' ? 'Bạn chưa có tài khoản? Đăng ký' : 'Bạn đã có tài khoản? Đăng nhập'}
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
