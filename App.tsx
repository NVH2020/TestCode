
import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, Topic 
} from './types.ts';
import { 
  GRADES, TOPICS_DATA, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, REGISTER_LINKS 
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
  const [freeSetup, setFreeSetup] = useState({ 
    mcC: 10, mcS: 6, tfC: 4, tfS: 2, saC: 4, saS: 2, dur: 45, topics: [] as number[] 
  });

  const [student, setStudent] = useState<StudentInfo>({
    fullName: '', studentClass: 'Tự do', idNumber: '', sbd: '', account: '', isLoggedIn: false, isVerified: false, limit: 1, limitTab: MAX_VIOLATIONS
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  const [remoteMatrix, setRemoteMatrix] = useState<MatrixConfig | null>(null);

  // Visibility Check
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && step === 'exam' && !examState.isFinished) {
        setExamState(prev => {
          const nextV = prev.violations + 1;
          if (nextV >= student.limitTab) {
            alert("VI PHẠM QUY CHẾ: Bạn chuyển tab quá giới hạn. Bài thi tự động nộp!");
            finishExam();
          } else {
            alert(`CẢNH BÁO: Không được rời khỏi tab thi! (${nextV}/${student.limitTab})`);
          }
          return { ...prev, violations: nextV };
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [step, examState.isFinished, student.limitTab]);

  // Timer
  useEffect(() => {
    let timer: any;
    if (step === 'exam' && examState.timeLeft > 0 && !examState.isFinished) {
      timer = setInterval(() => {
        setExamState(prev => {
          if (prev.timeLeft <= 1) { clearInterval(timer); finishExam(); return { ...prev, timeLeft: 0 }; }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, examState.timeLeft, examState.isFinished]);

  const handleAuth = () => {
    if (!authForm.account || !authForm.pass) { alert("Vui lòng điền đủ thông tin!"); return; }
    if (authMode === 'register') {
      if (authForm.pass !== authForm.confirmPass) { alert("Mật khẩu không khớp!"); return; }
      localStorage.setItem(`tc_user_${authForm.account}`, authForm.pass);
      alert("Đăng ký thành công!");
      setAuthMode('login');
    } else {
      const saved = localStorage.getItem(`tc_user_${authForm.account}`);
      if (saved === authForm.pass) {
        setStudent(prev => ({ ...prev, account: authForm.account, isLoggedIn: true }));
        setStep('entry');
      } else {
        alert("Sai tài khoản hoặc mật khẩu!");
      }
    }
  };

  const verifyGSheet = async () => {
    if (!student.isLoggedIn) { alert("Hãy ĐĂNG NHẬP trước!"); setStep('auth'); return; }
    if (!student.idNumber || !student.sbd) { alert("Nhập ID bản quyền và SBD!"); return; }
    setLoading(true);
    try {
      const url = `${DEFAULT_API_URL}?action=checkSBD&sbd=${student.sbd}&idnumber=${student.idNumber}&account=${student.account}&examCode=${selectedExamCode}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        setStudent(prev => ({ ...prev, fullName: data.name, studentClass: data.class, isVerified: true, limit: data.limit || 1, limitTab: data.limittab || MAX_VIOLATIONS }));
        setRemoteMatrix(data.matrix);
      } else {
        alert(data.message || "Thông tin không khớp trên Google Sheet!");
      }
    } catch {
      alert("Lỗi kết nối máy chủ xác thực!");
    } finally {
      setLoading(false);
    }
  };

  const startExam = () => {
    const isMatrix = EXAM_CODES[activeGrade].find(c => c.code === selectedExamCode)?.topics === 'matrix';
    let qs: Question[] = [];
    let config: ExamConfig;

    if (isMatrix) {
      if (!student.isVerified) { alert("Chưa xác thực thông tin!"); return; }
      const res = generateExamFromMatrix(remoteMatrix!);
      qs = res.questions;
      config = res.config;
    } else {
      if (freeSetup.topics.length === 0) { alert("Hãy chọn ít nhất 1 chuyên đề!"); return; }
      config = { grade: activeGrade, topics: freeSetup.topics, duration: freeSetup.dur, numMC: freeSetup.mcC, scoreMC: freeSetup.mcS, numTF: freeSetup.tfC, scoreTF: freeSetup.tfS, numSA: freeSetup.saC, scoreSA: freeSetup.saS };
      qs = generateFreeExam(config);
    }

    if (qs.length === 0) { alert("Không đủ câu hỏi!"); return; }
    setQuestions(qs);
    setExamState({ currentQuestionIndex: 0, answers: {}, timeLeft: config.duration * 60, violations: 0, isFinished: false, startTime: new Date() });
    setStep('exam');
  };

  const finishExam = () => {
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    const score = calculateScore(questions, examState.answers, {
       grade: activeGrade, topics: freeSetup.topics, duration: 0, 
       numMC: questions.filter(q => q.type === 'mcq').length, scoreMC: remoteMatrix ? 6 : freeSetup.mcS, 
       numTF: questions.filter(q => q.type === 'true-false').length, scoreTF: remoteMatrix ? 2 : freeSetup.tfS,
       numSA: questions.filter(q => q.type === 'short-answer').length, scoreSA: remoteMatrix ? 2 : freeSetup.saS
    });
    const dur = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const timeStr = `${Math.floor(dur/60)}p ${dur%60}s`;
    fetch(`${DEFAULT_API_URL}?action=saveResult&makiemtra=${selectedExamCode || 'FREE'}&sbd=${student.sbd}&name=${encodeURIComponent(student.fullName)}&class=${encodeURIComponent(student.studentClass)}&tongdiem=${score}&fulltime=${encodeURIComponent(timeStr)}`, { mode: 'no-cors' });
  };

  const renderEntry = () => (
    <div className="max-w-6xl mx-auto p-4 space-y-6 pt-10 animate-fadeIn">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-blue-700 uppercase tracking-tighter">RA ĐỀ ONLINE THEO MA TRẬN</h1>
        <p className="text-slate-500 font-bold">Tác giả: Nguyễn Văn Hà - THPT Yên Dũng số 2 - Bắc Ninh</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a href={REGISTER_LINKS.MATH} target="_blank" className="bg-blue-600 text-white p-4 rounded-xl font-black text-center uppercase shadow-md flex items-center justify-center">ĐĂNG KÝ HỌC TOÁN</a>
        <a href={REGISTER_LINKS.APP} target="_blank" className="bg-yellow-500 text-white p-4 rounded-xl font-black text-center uppercase shadow-md flex items-center justify-center">ĐĂNG KÝ DÙNG APP</a>
        <button className="bg-white border-2 text-slate-700 p-4 rounded-xl font-black uppercase shadow-md">XEM ĐIỂM</button>
        <button onClick={() => setStep('auth')} className="bg-blue-600 text-white p-4 rounded-xl font-black uppercase shadow-md">
          {student.isLoggedIn ? `👤 ${student.account}` : 'ĐĂNG NHẬP/ĐĂNG KÝ'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {GRADES.map(g => (
          <button key={g} onClick={() => setActiveGrade(g)} className={`p-4 rounded-xl font-black transition-all ${activeGrade === g ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-slate-200 text-slate-400 opacity-60'}`}>Khối {g}</button>
        ))}
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border min-h-[400px]">
        <h3 className="text-xl font-black text-blue-800 mb-8 uppercase flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> Chọn mã đề kiểm tra
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAM_CODES[activeGrade].map(def => (
            <button key={def.code} onClick={() => { setSelectedExamCode(def.code); setStep(def.topics === 'matrix' ? 'info_setup' : 'free_setup'); }} className="p-8 text-left border-2 rounded-2xl bg-slate-50/50 hover:border-blue-500 hover:bg-blue-50 transition-all group shadow-sm">
              <div className="font-black text-blue-900 text-xl mb-1">{def.code}</div>
              <div className="text-xs text-slate-400 font-bold uppercase">{def.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[2.5rem] shadow-2xl relative">
      <button onClick={() => setStep('entry')} className="absolute top-8 left-8 text-slate-400 font-bold hover:text-blue-600">← Quay lại</button>
      <h2 className="text-2xl font-black text-center mb-8 text-blue-700 uppercase">{authMode === 'login' ? 'Đăng nhập App' : 'Đăng ký tài khoản'}</h2>
      <div className="space-y-4">
        <input type="text" placeholder="Tên tài khoản (taikhoanapp)" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold focus:border-blue-500 outline-none" />
        <input type="password" placeholder="Mật khẩu" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold focus:border-blue-500 outline-none" />
        {authMode === 'register' && <input type="password" placeholder="Nhập lại mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold focus:border-blue-500 outline-none" />}
        <button onClick={handleAuth} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase shadow-lg hover:brightness-110">Xác nhận</button>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-blue-600 font-bold underline opacity-70">
          {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </div>
  );

  const renderFreeSetup = () => (
    <div className="max-w-4xl mx-auto mt-10 p-10 bg-white rounded-[3rem] shadow-xl relative animate-fadeIn">
      <button onClick={() => setStep('entry')} className="absolute top-8 left-8 text-slate-400 font-bold hover:text-blue-600">← Quay lại</button>
      <h2 className="text-2xl font-black text-blue-900 mb-8 uppercase text-center mt-4">Cấu hình Đề thi Tự do - Khối {activeGrade}</h2>
      <div className="space-y-10">
        <div>
          <p className="font-black text-slate-400 text-xs uppercase mb-4 tracking-widest text-center">Chọn các chuyên đề ôn tập</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TOPICS_DATA[activeGrade].map(t => (
              <button key={t.id} onClick={() => {
                const isS = freeSetup.topics.includes(t.id);
                setFreeSetup({...freeSetup, topics: isS ? freeSetup.topics.filter(id => id !== t.id) : [...freeSetup.topics, t.id]});
              }} className={`p-4 text-left rounded-xl border-2 font-bold transition-all ${freeSetup.topics.includes(t.id) ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-md' : 'border-slate-50 text-slate-400 opacity-60'}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase">MCQ (Số câu / Điểm)</label>
            <div className="flex gap-2">
              <input type="number" value={freeSetup.mcC} onChange={e => setFreeSetup({...freeSetup, mcC: parseInt(e.target.value)})} className="w-1/2 p-3 border-2 rounded-xl font-black text-center" />
              <input type="number" step="0.5" value={freeSetup.mcS} onChange={e => setFreeSetup({...freeSetup, mcS: parseFloat(e.target.value)})} className="w-1/2 p-3 border-2 border-blue-200 text-blue-600 rounded-xl font-black text-center" />
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase">TF (Số câu / Điểm)</label>
            <div className="flex gap-2">
              <input type="number" value={freeSetup.tfC} onChange={e => setFreeSetup({...freeSetup, tfC: parseInt(e.target.value)})} className="w-1/2 p-3 border-2 rounded-xl font-black text-center" />
              <input type="number" step="0.5" value={freeSetup.tfS} onChange={e => setFreeSetup({...freeSetup, tfS: parseFloat(e.target.value)})} className="w-1/2 p-3 border-2 border-blue-200 text-blue-600 rounded-xl font-black text-center" />
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase">SHORT (Số câu / Điểm)</label>
            <div className="flex gap-2">
              <input type="number" value={freeSetup.saC} onChange={e => setFreeSetup({...freeSetup, saC: parseInt(e.target.value)})} className="w-1/2 p-3 border-2 rounded-xl font-black text-center" />
              <input type="number" step="0.5" value={freeSetup.saS} onChange={e => setFreeSetup({...freeSetup, saS: parseFloat(e.target.value)})} className="w-1/2 p-3 border-2 border-blue-200 text-blue-600 rounded-xl font-black text-center" />
            </div>
          </div>
        </div>
        <button onClick={startExam} className="w-full py-6 bg-blue-700 text-white rounded-2xl font-black text-2xl uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all">Bắt đầu thi tự do</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-xl mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl border relative">
      <button onClick={() => setStep('entry')} className="absolute top-10 left-10 text-slate-400 font-black hover:text-blue-600">← Quay lại</button>
      <h2 className="text-3xl font-black text-blue-800 mb-10 text-center uppercase tracking-tighter">Xác thực thi Ma trận</h2>
      <div className="space-y-6">
        <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl">
          <div className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">Tài khoản App (account):</div>
          <div className="font-black text-slate-800 text-2xl tracking-tight">{student.account}</div>
        </div>
        <input type="text" placeholder="Nhập ID bản quyền (idnumber)" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl font-black outline-none" />
        <input type="text" placeholder="Nhập Số báo danh (SBD)" value={student.sbd} onChange={e => setStudent({...student, sbd: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl font-black outline-none" />
        <button onClick={verifyGSheet} disabled={loading} className="w-full py-6 bg-blue-700 text-white rounded-2xl font-black uppercase shadow-xl hover:brightness-110">
          {loading ? 'Đang xác thực...' : 'Check Số báo danh'}
        </button>
        {student.isVerified && (
          <div className="space-y-6 pt-6 animate-fadeIn">
            <div className="p-8 bg-green-50 text-green-700 border-4 border-green-200 rounded-[2rem] font-black text-center text-xl shadow-inner">
              ✓ {student.fullName} ({student.studentClass})<br/>
              <span className="text-sm font-bold opacity-60">Xác thực thành công. Bạn đã có thể vào thi.</span>
            </div>
            <button onClick={startExam} className="w-full py-8 bg-green-600 text-white rounded-3xl font-black text-3xl uppercase shadow-2xl hover:brightness-110 transition-all">Vào thi ngay</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-100 pb-20">
      {step === 'entry' && renderEntry()}
      {step === 'auth' && renderAuth()}
      {step === 'free_setup' && renderFreeSetup()}
      {step === 'info_setup' && renderInfoSetup()}
      
      {step === 'exam' && (
        <div className="min-h-screen flex flex-col p-4 md:p-10 animate-fadeIn">
          <header className="max-w-7xl mx-auto w-full flex justify-between items-center mb-10 bg-white p-8 rounded-[3rem] shadow-2xl border sticky top-4 z-20">
             <div className="flex items-center gap-8">
                <div className="px-10 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-3xl shadow-xl ring-8 ring-blue-50">ID = {questions[examState.currentQuestionIndex].id}</div>
                <div className="hidden xl:block">
                   <div className="font-black text-slate-800 text-2xl uppercase tracking-tighter">{student.fullName || 'Thí sinh tự do'}</div>
                   <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Mã đề: {selectedExamCode || 'FREE'}</div>
                </div>
             </div>
             <div className="text-5xl font-black font-mono text-blue-600 tracking-tighter bg-blue-50 px-8 py-3 rounded-2xl">
                {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
             </div>
             <button onClick={() => confirm("Bạn thực sự muốn nộp bài?") && finishExam()} className="bg-rose-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-sm shadow-xl shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all">Nộp bài</button>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full">
             <div className="bg-white p-16 rounded-[4.5rem] shadow-2xl border min-h-[600px] relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-4 h-full bg-blue-600"></div>
                <div className="text-sm font-black text-blue-500 uppercase mb-10 tracking-[0.4em] flex items-center gap-3">
                  <span className="w-10 h-1 bg-blue-500 rounded-full"></span> {questions[examState.currentQuestionIndex].part}
                </div>
                
                <div className="flex-1">
                  <MathText content={questions[examState.currentQuestionIndex].question} className="text-3xl font-bold text-slate-800 mb-16 leading-relaxed" />
                  
                  {questions[examState.currentQuestionIndex].type === 'mcq' && (
                    <div className="grid grid-cols-1 gap-5">
                      {questions[examState.currentQuestionIndex].o?.map((opt, i) => (
                        <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})} className={`p-8 text-left rounded-[2rem] border-4 font-bold transition-all flex items-center gap-8 ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'border-blue-600 bg-blue-50 shadow-inner' : 'border-slate-50 bg-slate-50/30 hover:border-slate-200'}`}>
                          <span className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-300 border'}`}>{String.fromCharCode(65+i)}</span>
                          <MathText content={opt} className="text-2xl text-slate-700" />
                        </button>
                      ))}
                    </div>
                  )}

                  {questions[examState.currentQuestionIndex].type === 'true-false' && (
                    <div className="space-y-6">
                      {questions[examState.currentQuestionIndex].s?.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-center gap-8 bg-slate-50/50 p-10 rounded-[2.5rem] border-2 border-slate-100">
                          <div className="flex-1 font-bold text-slate-700 text-2xl"><MathText content={item.text} /></div>
                          <div className="flex gap-4">
                            {[true, false].map(val => {
                               const cur = examState.answers[questions[examState.currentQuestionIndex].id] || [];
                               const isSel = cur[idx] === val;
                               return (
                                 <button key={val.toString()} onClick={() => {
                                   const next = [...cur]; next[idx] = val;
                                   setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: next}});
                                 }} className={`px-14 py-5 rounded-2xl font-black text-sm uppercase transition-all shadow-md ${isSel ? (val ? 'bg-green-600 text-white ring-8 ring-green-100' : 'bg-rose-600 text-white ring-8 ring-rose-100') : 'bg-white text-slate-300 border hover:bg-slate-50'}`}>
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
                    <div className="max-w-2xl">
                      <input type="text" value={examState.answers[questions[examState.currentQuestionIndex].id] || ""} onChange={e => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: e.target.value}})} className="w-full p-10 bg-slate-50 border-4 border-slate-100 rounded-[3rem] font-black text-4xl text-blue-700 outline-none focus:border-blue-600 shadow-inner" placeholder="Đáp án của bạn..." />
                    </div>
                  )}
                </div>
             </div>

             <div className="mt-12 flex flex-col gap-10">
                <div className="flex flex-wrap justify-center gap-3 p-10 bg-white/60 rounded-[3.5rem] shadow-inner border-2 border-white backdrop-blur-md">
                   {questions.map((q, idx) => (
                     <button key={idx} onClick={() => setExamState({...examState, currentQuestionIndex: idx})} className={`w-14 h-14 rounded-2xl font-black text-lg transition-all shadow-lg ${examState.currentQuestionIndex === idx ? 'bg-blue-600 text-white scale-125 ring-8 ring-blue-100' : (examState.answers[q.id] !== undefined ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-white text-slate-400 border-2 border-slate-50')}`}>
                       {idx + 1}
                     </button>
                   ))}
                </div>
                <div className="flex justify-between gap-8 px-10">
                   <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.max(0, examState.currentQuestionIndex - 1)})} disabled={examState.currentQuestionIndex === 0} className="flex-1 py-7 bg-white text-slate-400 border-4 border-slate-100 rounded-[2.5rem] font-black uppercase text-sm disabled:opacity-20 shadow-xl transition-all">Quay lại câu trước</button>
                   <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.min(questions.length-1, examState.currentQuestionIndex + 1)})} disabled={examState.currentQuestionIndex === questions.length - 1} className="flex-1 py-7 bg-blue-700 text-white rounded-[2.5rem] font-black uppercase text-sm shadow-2xl hover:scale-[1.02] transition-all">Câu tiếp theo</button>
                </div>
             </div>
          </main>
        </div>
      )}

      {step === 'result' && (
        <div className="max-w-3xl mx-auto pt-20 px-6 animate-fadeIn">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl border-4 border-white text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-4 bg-blue-600"></div>
              <div className="text-lg font-black text-slate-400 uppercase tracking-[0.5em] mb-10">KẾT QUẢ CỦA BẠN</div>
              <div className="space-y-2 mb-16">
                <div className="font-black text-slate-800 text-5xl tracking-tighter uppercase">{student.fullName || 'Thí sinh tự do'}</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest bg-slate-50 inline-block px-6 py-2 rounded-full">SBD: {student.sbd || 'N/A'} • Mã đề: {selectedExamCode || 'FREE'}</div>
              </div>
              <div className="relative inline-block mb-10">
                <div className="text-[15rem] font-black leading-none text-blue-600 tracking-tighter drop-shadow-3xl">
                  {calculateScore(questions, examState.answers, { grade: 0, topics: [], duration: 0, numMC: questions.filter(q => q.type === 'mcq').length, scoreMC: remoteMatrix ? 6 : freeSetup.mcS, numTF: questions.filter(q => q.type === 'true-false').length, scoreTF: remoteMatrix ? 2 : freeSetup.tfS, numSA: questions.filter(q => q.type === 'short-answer').length, scoreSA: remoteMatrix ? 2 : freeSetup.saS }).toFixed(1)}
                </div>
              </div>
              <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <button onClick={() => setStep('review')} className="w-full py-8 bg-blue-700 text-white rounded-[2rem] font-black text-2xl uppercase shadow-2xl hover:brightness-110 active:scale-95 transition-all">Xem đề thi</button>
                 <button onClick={() => window.location.reload()} className="w-full py-8 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-2xl uppercase hover:bg-slate-200 active:scale-95 transition-all">Trang chủ</button>
              </div>
           </div>
        </div>
      )}

      {step === 'review' && (
        <div className="max-w-7xl mx-auto p-4 md:p-12 animate-fadeIn space-y-12 pb-32">
           <header className="flex justify-between items-center bg-white p-10 rounded-[3.5rem] shadow-2xl border-4 border-white sticky top-4 z-20">
              <h2 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">Review chi tiết bài làm</h2>
              <button onClick={() => setStep('result')} className="px-14 py-6 bg-slate-900 text-white rounded-3xl font-black uppercase text-sm shadow-xl">Quay lại kết quả</button>
           </header>
           <div className="space-y-14">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-16 rounded-[4.5rem] shadow-2xl border-2 border-slate-50 relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-3 h-full bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                   <div className="absolute top-12 right-16 px-8 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-sm uppercase shadow-sm">ID: {q.id}</div>
                   <div className="font-black text-blue-600 text-lg mb-10 tracking-[0.2em] uppercase">Câu hỏi số {idx + 1} ({q.part})</div>
                   <MathText content={q.question} className="text-3xl font-bold text-slate-800 mb-14 leading-relaxed" />
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="p-10 bg-blue-50/50 rounded-[3rem] border-4 border-blue-100 shadow-inner">
                        <div className="text-xs font-black text-blue-400 uppercase mb-6 tracking-widest">Hệ thống: Đáp án đúng</div>
                        <div className="font-bold text-blue-900 text-2xl">
                          {q.type === 'mcq' ? <MathText content={q.a || ""} /> : 
                           q.type === 'short-answer' ? q.a : 
                           q.s?.map((s,i) => `S${i+1}: ${s.a ? 'Đ' : 'S'}`).join(' • ')}
                        </div>
                     </div>
                     <div className={`p-10 rounded-[3rem] border-4 shadow-inner ${examState.answers[q.id] === undefined ? 'bg-slate-50 border-slate-200' : 'bg-green-50/30 border-green-100'}`}>
                        <div className="text-xs font-black text-slate-400 uppercase mb-6 tracking-widest">Bài làm của bạn</div>
                        <div className="font-bold text-slate-700 text-2xl">
                          {examState.answers[q.id] === undefined ? <span className="text-rose-400">Không trả lời</span> : 
                            (q.type === 'mcq' ? <MathText content={q.o?.[examState.answers[q.id]] || ""} /> : 
                             q.type === 'short-answer' ? examState.answers[q.id] : 
                             examState.answers[q.id].map((a: boolean, i: number) => `S${i+1}: ${a ? 'Đ' : 'S'}`).join(' • '))}
                        </div>
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
