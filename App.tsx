
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, Topic 
} from './types.ts';
import { 
  GRADES, TOPICS_DATA, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, REGISTER_LINKS 
} from './constants.tsx';
import { generateExamFromMatrix, generateFreeExam, calculateScore, MatrixConfig } from './services/examEngine.ts';
import MathText from './components/MathText.tsx';

const App: React.FC = () => {
  const [step, setStep] = useState<'entry' | 'auth' | 'free_setup' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeGrade, setActiveGrade] = useState<number>(12);
  const [selectedExamCode, setSelectedExamCode] = useState("");
  
  const [authForm, setAuthForm] = useState({ account: '', pass: '', confirmPass: '' });
  const [freeConfig, setFreeConfig] = useState<ExamConfig>({
    grade: 12, topics: [], duration: 45, numMC: 10, scoreMC: 6, numTF: 4, scoreTF: 2, numSA: 4, scoreSA: 2
  });

  const [student, setStudent] = useState<StudentInfo>({
    fullName: '', studentClass: 'Tự do', idNumber: '', sbd: '', examCode: '', account: '', isLoggedIn: false, isVerified: false, limitTab: MAX_VIOLATIONS
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  const [remoteMatrix, setRemoteMatrix] = useState<MatrixConfig | null>(null);

  // Tab switching detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'exam' && !examState.isFinished) {
        setExamState(prev => {
          const newViolations = prev.violations + 1;
          if (newViolations >= student.limitTab) {
            alert("Bạn đã chuyển tab quá số lần quy định. Hệ thống tự động nộp bài!");
            finishExam();
          } else {
            alert(`Cảnh báo: Không được rời khỏi phòng thi! (${newViolations}/${student.limitTab})`);
          }
          return { ...prev, violations: newViolations };
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [step, examState.isFinished, student.limitTab]);

  // Timer
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

  const handleAuth = () => {
    if (!authForm.account || !authForm.pass) { alert("Vui lòng điền đủ thông tin!"); return; }
    if (authMode === 'register' && authForm.pass !== authForm.confirmPass) { alert("Mật khẩu không khớp!"); return; }
    
    // Giả lập lưu vào localStorage
    const user = { account: authForm.account, pass: authForm.pass };
    if (authMode === 'register') {
      localStorage.setItem(`user_${authForm.account}`, JSON.stringify(user));
      alert("Đăng ký thành công!");
      setAuthMode('login');
    } else {
      const stored = localStorage.getItem(`user_${authForm.account}`);
      if (stored && JSON.parse(stored).pass === authForm.pass) {
        setStudent(prev => ({ ...prev, account: authForm.account, isLoggedIn: true }));
        setStep('entry');
        alert(`Chào mừng ${authForm.account}!`);
      } else {
        alert("Tài khoản hoặc mật khẩu sai!");
      }
    }
  };

  const verifyMatrixEntry = async () => {
    if (!student.isLoggedIn) { alert("Vui lòng Đăng nhập trước!"); return; }
    if (!student.idNumber || !student.sbd) { alert("Vui lòng nhập ID bản quyền và SBD!"); return; }
    
    setLoading(true);
    try {
      const url = `${DEFAULT_API_URL}?action=checkSBD&sbd=${student.sbd}&idnumber=${student.idNumber}&account=${student.account}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.status === 'success') {
        setStudent(prev => ({ 
          ...prev, fullName: data.name, studentClass: data.class, isVerified: true, limitTab: data.limittab || MAX_VIOLATIONS 
        }));
        setRemoteMatrix(data.matrix);
        alert("Xác thực thành công!");
      } else {
        alert(data.message || "Xác thực thất bại. Vui lòng kiểm tra lại thông tin trên GSheet.");
      }
    } catch {
      alert("Lỗi kết nối máy chủ xác thực!");
    } finally {
      setLoading(false);
    }
  };

  const startExam = () => {
    let qs: Question[] = [];
    let finalConfig: ExamConfig = freeConfig;

    if (selectedExamCode && EXAM_CODES[activeGrade].find(c => c.code === selectedExamCode)?.topics === 'matrix') {
      if (!student.isVerified) { alert("Chưa xác thực thông tin thi Ma trận!"); return; }
      const res = generateExamFromMatrix(remoteMatrix!);
      qs = res.questions;
      finalConfig = res.config;
    } else {
      qs = generateFreeExam(freeConfig);
    }

    if (qs.length === 0) { alert("Không tìm thấy câu hỏi phù hợp!"); return; }
    
    setQuestions(qs);
    setExamState({
      currentQuestionIndex: 0, answers: {}, 
      timeLeft: finalConfig.duration * 60, violations: 0, 
      isFinished: false, startTime: new Date()
    });
    setStep('exam');
  };

  const finishExam = async () => {
    const finalScore = calculateScore(questions, examState.answers, freeConfig);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');

    const timeStr = `${Math.floor((finishTime.getTime() - examState.startTime.getTime())/60000)}p`;
    const saveUrl = `${DEFAULT_API_URL}?action=saveResult&makiemtra=${selectedExamCode || 'FREE'}&sbd=${student.sbd}&name=${encodeURIComponent(student.fullName)}&class=${encodeURIComponent(student.studentClass)}&tongdiem=${finalScore}&time=${timeStr}`;
    fetch(saveUrl, { mode: 'no-cors' });
  };

  const renderEntry = () => (
    <div className="max-w-6xl mx-auto p-4 space-y-6 pt-10 animate-fadeIn">
      <div className="text-center space-y-1">
        <h1 className="text-4xl font-black text-blue-700 tracking-tighter uppercase">RA ĐỀ ONLINE THEO MA TRẬN</h1>
        <p className="text-slate-500 font-bold">Tác giả: Nguyễn Văn Hà - THPT Yên Dũng số 2 - Bắc Ninh</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a href={REGISTER_LINKS.MATH} target="_blank" className="py-4 bg-green-600 text-white rounded-2xl font-black text-center shadow-lg hover:bg-green-700 transition-all text-sm">ĐĂNG KÝ HỌC TOÁN</a>
        <a href={REGISTER_LINKS.APP} target="_blank" className="py-4 bg-yellow-500 text-white rounded-2xl font-black text-center shadow-lg hover:bg-yellow-600 transition-all text-sm">ĐĂNG KÝ DÙNG APP</a>
        <button className="py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black shadow-lg hover:bg-slate-50 text-sm">XEM ĐIỂM</button>
        <button onClick={() => setStep('auth')} className="py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 text-sm">
          {student.isLoggedIn ? `👤 ${student.account}` : 'ĐĂNG NHẬP / ĐĂNG KÝ'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {GRADES.map(g => (
          <button key={g} onClick={() => { setActiveGrade(g); setFreeConfig({...freeConfig, grade: g, topics: []}); }} 
            className={`py-4 rounded-xl font-black transition-all ${activeGrade === g ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-slate-100 text-slate-400 opacity-60'}`}>
            KHỐI {g}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 min-h-[400px]">
        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase border-l-4 border-blue-600 pl-4">Chọn mã đề kiểm tra</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAM_CODES[activeGrade].map(def => (
            <button key={def.code} onClick={() => { 
              setSelectedExamCode(def.code); 
              if (def.topics === 'matrix') setStep('info_setup');
              else setStep('free_setup');
            }} className="p-6 text-left border-2 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
              <div className="font-black text-blue-800 text-lg mb-1 group-hover:scale-105 transition-transform">{def.code}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">{def.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[2.5rem] shadow-2xl border">
      <h2 className="text-2xl font-black text-center mb-8 uppercase text-blue-700">{authMode === 'login' ? 'Đăng nhập hệ thống' : 'Đăng ký học viên'}</h2>
      <div className="space-y-4">
        <input type="text" placeholder="Tên tài khoản (taikhoanapp)" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-4 border-2 rounded-xl font-bold" />
        <input type="password" placeholder="Mật khẩu (pass)" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-4 border-2 rounded-xl font-bold" />
        {authMode === 'register' && <input type="password" placeholder="Nhập lại mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-4 border-2 rounded-xl font-bold" />}
        <button onClick={handleAuth} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase shadow-lg">{authMode === 'login' ? 'Vào ứng dụng' : 'Hoàn tất đăng ký'}</button>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-blue-600 font-bold underline">
          {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký tại đây' : 'Đã có tài khoản? Quay lại đăng nhập'}
        </button>
        <button onClick={() => setStep('entry')} className="w-full text-xs text-slate-400">Trở về Trang chủ</button>
      </div>
    </div>
  );

  const renderFreeSetup = () => (
    <div className="max-w-4xl mx-auto mt-10 p-10 bg-white rounded-[3rem] shadow-2xl border animate-fadeIn">
      <h2 className="text-2xl font-black text-blue-800 mb-8 uppercase">Thiết lập đề thi Tự do - Khối {activeGrade}</h2>
      <div className="space-y-8">
        <div>
          <p className="font-black text-slate-500 text-xs uppercase mb-4 tracking-widest">Chọn chuyên đề ôn tập</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TOPICS_DATA[activeGrade].map(t => (
              <button key={t.id} onClick={() => {
                const newT = freeConfig.topics.includes(t.id) ? freeConfig.topics.filter(id => id !== t.id) : [...freeConfig.topics, t.id];
                setFreeConfig({...freeConfig, topics: newT});
              }} className={`p-4 text-left rounded-xl border-2 font-bold transition-all ${freeConfig.topics.includes(t.id) ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-100 text-slate-400'}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">Số câu MCQ / Điểm</label>
            <div className="flex gap-1">
              <input type="number" value={freeConfig.numMC} onChange={e => setFreeConfig({...freeConfig, numMC: parseInt(e.target.value)})} className="w-full p-3 border rounded-xl font-black" />
              <input type="number" step="0.5" value={freeConfig.scoreMC} onChange={e => setFreeConfig({...freeConfig, scoreMC: parseFloat(e.target.value)})} className="w-full p-3 border rounded-xl font-black text-blue-600" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">Số câu TF / Điểm</label>
            <div className="flex gap-1">
              <input type="number" value={freeConfig.numTF} onChange={e => setFreeConfig({...freeConfig, numTF: parseInt(e.target.value)})} className="w-full p-3 border rounded-xl font-black" />
              <input type="number" step="0.5" value={freeConfig.scoreTF} onChange={e => setFreeConfig({...freeConfig, scoreTF: parseFloat(e.target.value)})} className="w-full p-3 border rounded-xl font-black text-blue-600" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">Số câu SHORT / Điểm</label>
            <div className="flex gap-1">
              <input type="number" value={freeConfig.numSA} onChange={e => setFreeConfig({...freeConfig, numSA: parseInt(e.target.value)})} className="w-full p-3 border rounded-xl font-black" />
              <input type="number" step="0.5" value={freeConfig.scoreSA} onChange={e => setFreeConfig({...freeConfig, scoreSA: parseFloat(e.target.value)})} className="w-full p-3 border rounded-xl font-black text-blue-600" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
           <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold uppercase text-xs">Cấu trúc phân hóa:</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">MĐ1-2: 70% | MĐ3-4: 30%</span>
           </div>
        </div>

        <button onClick={startExam} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl uppercase shadow-2xl hover:bg-blue-700 transition-all">Phát đề luyện tập</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-xl mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl border">
      <h2 className="text-2xl font-black text-blue-800 mb-8 uppercase">Xác thực thi Ma trận</h2>
      <div className="space-y-5">
        <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
          <div className="text-[10px] font-black text-blue-600 uppercase mb-1">Đang đăng nhập:</div>
          <div className="font-black text-slate-800">{student.account}</div>
        </div>
        <input type="text" placeholder="Nhập ID bản quyền (idnumber)" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="w-full p-4 border-2 rounded-xl font-black bg-slate-50" />
        <input type="text" placeholder="Nhập Số báo danh (SBD)" value={student.sbd} onChange={e => setStudent({...student, sbd: e.target.value.toUpperCase()})} className="w-full p-4 border-2 rounded-xl font-black bg-slate-50" />
        <button onClick={verifyMatrixEntry} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase shadow-lg">
          {loading ? 'Hệ thống đang kiểm tra...' : 'Check Số báo danh'}
        </button>
        {student.isVerified && (
          <div className="space-y-4 pt-4 animate-fadeIn">
            <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl font-bold text-center">✓ Đã xác thực: {student.fullName} ({student.studentClass})</div>
            <button onClick={startExam} className="w-full py-5 bg-green-600 text-white rounded-2xl font-black text-xl shadow-xl">Vào thi ngay</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-100">
      {step === 'entry' && renderEntry()}
      {step === 'auth' && renderAuth()}
      {step === 'free_setup' && renderFreeSetup()}
      {step === 'info_setup' && renderInfoSetup()}
      
      {step === 'exam' && (
        <div className="min-h-screen flex flex-col p-4 md:p-8 animate-fadeIn">
          <header className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8 bg-white p-6 rounded-[2.5rem] shadow-xl border sticky top-4 z-20">
             <div className="flex items-center gap-5">
                <div className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg">ID = {questions[examState.currentQuestionIndex].id}</div>
                <div className="hidden sm:block">
                   <div className="font-black text-slate-800 text-lg uppercase">{student.fullName || 'Thí sinh tự do'}</div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã đề: {selectedExamCode || 'FREE'}</div>
                </div>
             </div>
             <div className="text-4xl font-black font-mono text-blue-600">
                {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
             </div>
             <button onClick={() => confirm("Xác nhận nộp bài?") && finishExam()} className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-rose-600/20">Nộp bài</button>
          </header>

          <main className="flex-1 max-w-6xl mx-auto w-full">
             <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border min-h-[500px] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                <div className="text-[11px] font-black text-blue-500 uppercase mb-6 tracking-[0.2em]">{questions[examState.currentQuestionIndex].part}</div>
                <MathText content={questions[examState.currentQuestionIndex].question} className="text-3xl font-bold text-slate-800 mb-12 leading-relaxed" />
                
                {/* Answers UI */}
                {questions[examState.currentQuestionIndex].type === 'mcq' && (
                  <div className="grid grid-cols-1 gap-4">
                    {questions[examState.currentQuestionIndex].o?.map((opt, i) => (
                      <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})}
                        className={`p-6 text-left rounded-2xl border-2 font-bold transition-all flex items-center gap-6 ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-slate-50/50'}`}>
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-blue-600 text-white' : 'bg-white text-slate-300 border'}`}>{String.fromCharCode(65+i)}</span>
                        <MathText content={opt} className="text-xl" />
                      </button>
                    ))}
                  </div>
                )}

                {questions[examState.currentQuestionIndex].type === 'true-false' && (
                  <div className="space-y-4">
                    {questions[examState.currentQuestionIndex].s?.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-6 rounded-2xl">
                        <div className="flex-1 font-bold text-slate-700 text-lg"><MathText content={item.text} /></div>
                        <div className="flex gap-2">
                          {[true, false].map(val => {
                             const cur = examState.answers[questions[examState.currentQuestionIndex].id] || [];
                             return (
                               <button key={val.toString()} onClick={() => {
                                 const next = [...cur]; next[idx] = val;
                                 setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: next}});
                               }} className={`px-8 py-3 rounded-xl font-black text-xs uppercase ${cur[idx] === val ? (val ? 'bg-green-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-slate-300 border'}`}>
                                 {val ? 'Đúng' : 'Sai'}
                               </button>
                             );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {questions[examState.currentQuestionIndex].type === 'short-answer' && (
                  <input type="text" value={examState.answers[questions[examState.currentQuestionIndex].id] || ""} 
                    onChange={e => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: e.target.value}})}
                    className="w-full max-w-md p-6 bg-slate-50 border-2 rounded-3xl font-black text-2xl text-blue-700 outline-none focus:border-blue-500" placeholder="Nhập đáp án..." />
                )}
             </div>

             {/* Navigation Row */}
             <div className="mt-8 flex flex-col gap-6">
                <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                   {questions.map((_, idx) => (
                     <button key={idx} onClick={() => setExamState({...examState, currentQuestionIndex: idx})}
                       className={`w-10 h-10 rounded-lg font-black text-xs transition-all ${examState.currentQuestionIndex === idx ? 'bg-blue-600 text-white scale-110 shadow-lg' : (examState.answers[questions[idx].id] !== undefined ? 'bg-green-100 text-green-700' : 'bg-white text-slate-400')}`}>
                       {idx + 1}
                     </button>
                   ))}
                </div>
                <div className="flex justify-between gap-4">
                   <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.max(0, examState.currentQuestionIndex - 1)})} disabled={examState.currentQuestionIndex === 0} className="flex-1 py-5 bg-white text-slate-400 border-2 rounded-2xl font-black uppercase text-xs disabled:opacity-20 shadow-md">Câu trước</button>
                   <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.min(questions.length-1, examState.currentQuestionIndex + 1)})} disabled={examState.currentQuestionIndex === questions.length - 1} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Câu tiếp theo</button>
                </div>
             </div>
          </main>
        </div>
      )}

      {step === 'result' && (
        <div className="max-w-2xl mx-auto pt-20 px-6 animate-fadeIn">
           <div className="bg-white p-20 rounded-[4rem] shadow-2xl border text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
              <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Kết quả kiểm tra</div>
              <div className="font-black text-slate-800 text-xl mb-2">{student.fullName || 'Thí sinh tự do'}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase mb-10">SBD: {student.sbd || 'N/A'}</div>
              
              <div className="text-[12rem] font-black leading-none text-blue-600 tracking-tighter drop-shadow-2xl">
                {calculateScore(questions, examState.answers, freeConfig).toFixed(1)}
              </div>

              <div className="mt-16 flex flex-col gap-4">
                 <button onClick={() => setStep('review')} className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 transition-all">Xem lại đề thi & đáp án</button>
                 <button onClick={() => window.location.reload()} className="w-full py-6 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase">Quay lại trang chủ</button>
              </div>
           </div>
        </div>
      )}

      {step === 'review' && (
        <div className="max-w-6xl mx-auto p-4 md:p-10 animate-fadeIn">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-800 uppercase">Review đề thi đã làm</h2>
              <button onClick={() => setStep('result')} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-xs">Quay lại kết quả</button>
           </div>
           <div className="space-y-10">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[2.5rem] shadow-xl border relative">
                   <div className="absolute top-8 right-10 text-[10px] font-black text-blue-500 uppercase">ID: {q.id}</div>
                   <div className="font-black text-blue-600 text-sm mb-4">Câu {idx + 1} ({q.part})</div>
                   <MathText content={q.question} className="text-2xl font-bold text-slate-800 mb-8 leading-relaxed" />
                   
                   <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                      <div className="text-[10px] font-black text-blue-400 uppercase mb-2">Đáp án đúng:</div>
                      <div className="font-bold text-blue-900">
                        {q.type === 'mcq' ? q.a : q.type === 'short-answer' ? q.a : q.s?.map((s,i) => `S${i+1}: ${s.a ? 'Đ' : 'S'}`).join('; ')}
                      </div>
                   </div>
                   <div className={`p-6 rounded-2xl border ${examState.answers[q.id] === undefined ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Câu trả lời của bạn:</div>
                      <div className="font-bold">
                        {examState.answers[q.id] === undefined ? 'Không trả lời' : 
                          (q.type === 'mcq' ? q.o?.[examState.answers[q.id]] : 
                           q.type === 'short-answer' ? examState.answers[q.id] : 
                           examState.answers[q.id].map((a: boolean, i: number) => `S${i+1}: ${a ? 'Đ' : 'S'}`).join('; '))}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
