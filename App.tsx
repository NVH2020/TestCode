
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

  // Tab switching surveillance
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'exam' && !examState.isFinished) {
        setExamState(prev => {
          const nextV = prev.violations + 1;
          if (nextV >= student.limitTab) {
            alert("VI PHẠM QUY CHẾ: Bạn đã chuyển tab quá số lần quy định. Bài thi tự động kết thúc!");
            finishExam();
          } else {
            alert(`CẢNH BÁO: Không được rời khỏi tab thi! (${nextV}/${student.limitTab})`);
          }
          return { ...prev, violations: nextV };
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [step, examState.isFinished, student.limitTab]);

  // Timer logic
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
    if (authMode === 'register' && authForm.pass !== authForm.confirmPass) { alert("Mật khẩu nhập lại không khớp!"); return; }
    
    if (authMode === 'register') {
      localStorage.setItem(`testcode_user_${authForm.account}`, authForm.pass);
      alert("Đăng ký thành công!");
      setAuthMode('login');
    } else {
      const savedPass = localStorage.getItem(`testcode_user_${authForm.account}`);
      if (savedPass === authForm.pass) {
        setStudent(prev => ({ ...prev, account: authForm.account, isLoggedIn: true }));
        setStep('entry');
        alert(`Chào mừng ${authForm.account}!`);
      } else {
        alert("Tài khoản hoặc mật khẩu không chính xác!");
      }
    }
  };

  const verifyMatrixIdentity = async () => {
    if (!student.isLoggedIn) { alert("Vui lòng ĐĂNG NHẬP trước!"); setStep('auth'); return; }
    if (!student.idNumber || !student.sbd) { alert("Vui lòng nhập ID bản quyền và Số báo danh!"); return; }
    
    setLoading(true);
    try {
      // 3-Layer Check: idnumber + SBD + account
      const url = `${DEFAULT_API_URL}?action=checkSBD&sbd=${student.sbd}&idnumber=${student.idNumber}&account=${student.account}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.status === 'success') {
        setStudent(prev => ({ 
          ...prev, fullName: data.name, studentClass: data.class, isVerified: true, limitTab: data.limittab || MAX_VIOLATIONS 
        }));
        setRemoteMatrix(data.matrix);
        alert(`Xác thực thành công học sinh: ${data.name}`);
      } else {
        alert(data.message || "Thông tin không khớp với GSheet! Vui lòng kiểm tra lại ID, SBD và tài khoản đăng nhập.");
      }
    } catch {
      alert("Lỗi kết nối máy chủ xác thực. Hãy chắc chắn Apps Script đã được deploy đúng.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    const examDef = EXAM_CODES[activeGrade].find(c => c.code === selectedExamCode);
    let qs: Question[] = [];
    let finalConfig: ExamConfig = freeConfig;

    if (examDef?.topics === 'matrix') {
      if (!student.isVerified) { alert("Chưa xác thực danh tính thi Ma trận!"); return; }
      const res = generateExamFromMatrix(remoteMatrix!);
      qs = res.questions;
      finalConfig = res.config;
    } else {
      qs = generateFreeExam(freeConfig);
    }

    if (qs.length === 0) { alert("Không tìm thấy câu hỏi phù hợp trong dữ liệu!"); return; }
    
    setQuestions(qs);
    setExamState({
      currentQuestionIndex: 0, answers: {}, 
      timeLeft: finalConfig.duration * 60, violations: 0, 
      isFinished: false, startTime: new Date()
    });
    setStep('exam');
  };

  const finishExam = async () => {
    const score = calculateScore(questions, examState.answers, freeConfig);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');

    const duration = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 60000);
    const saveUrl = `${DEFAULT_API_URL}?action=saveResult&makiemtra=${selectedExamCode || 'FREE'}&sbd=${student.sbd}&name=${encodeURIComponent(student.fullName)}&class=${encodeURIComponent(student.studentClass)}&tongdiem=${score}&time=${duration}p`;
    fetch(saveUrl, { mode: 'no-cors' });
  };

  const renderEntry = () => (
    <div className="max-w-6xl mx-auto p-4 space-y-6 pt-10 animate-fadeIn">
      {/* Hàng 1 & 2 */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-blue-700 uppercase tracking-tighter">RA ĐỀ ONLINE THEO MA TRẬN</h1>
        <p className="text-slate-500 font-bold">Tác giả: Nguyễn Văn Hà - THPT Yên Dũng số 2 - Bắc Ninh</p>
      </div>

      {/* Hàng 3: 4 nút chức năng */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a href={REGISTER_LINKS.MATH} target="_blank" className="py-4 bg-green-600 text-white rounded-xl font-black text-center shadow-lg hover:brightness-110 transition-all text-sm uppercase">ĐĂNG KÝ HỌC TOÁN</a>
        <a href={REGISTER_LINKS.APP} target="_blank" className="py-4 bg-yellow-500 text-white rounded-xl font-black text-center shadow-lg hover:brightness-110 transition-all text-sm uppercase">ĐĂNG KÝ DÙNG APP</a>
        <button className="py-4 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-black shadow-lg hover:bg-slate-50 text-sm uppercase">XEM ĐIỂM</button>
        <button onClick={() => setStep('auth')} className="py-4 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:brightness-110 text-sm uppercase">
          {student.isLoggedIn ? `👤 ${student.account}` : 'ĐĂNG NHẬP / ĐĂNG KÝ'}
        </button>
      </div>

      {/* Hàng 4: 4 nút Khối */}
      <div className="grid grid-cols-4 gap-3">
        {GRADES.map(g => (
          <button key={g} onClick={() => setActiveGrade(g)} 
            className={`py-4 rounded-xl font-black transition-all uppercase text-xs ${activeGrade === g ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-slate-200 text-slate-400 opacity-50'}`}>
            KHỐI {g}
          </button>
        ))}
      </div>

      {/* Giao diện hiển thị mã đề */}
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 min-h-[400px]">
        <h3 className="text-xl font-black text-blue-800 mb-8 uppercase flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> Chọn mã đề kiểm tra
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAM_CODES[activeGrade].map(def => (
            <button key={def.code} onClick={() => { 
              setSelectedExamCode(def.code); 
              if (def.topics === 'matrix') setStep('info_setup');
              else setStep('free_setup');
            }} className="p-8 text-left border-2 border-slate-50 bg-slate-50/30 rounded-3xl hover:border-blue-500 hover:bg-blue-50 transition-all group shadow-sm">
              <div className="font-black text-blue-900 text-xl mb-1 group-hover:scale-105 transition-transform">{def.code}</div>
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{def.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="max-w-md mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl border relative">
      <button onClick={() => setStep('entry')} className="absolute top-8 left-8 text-slate-400 font-bold hover:text-blue-600 transition-colors">← Trở về</button>
      <h2 className="text-3xl font-black text-center mb-10 uppercase text-blue-700 tracking-tighter">{authMode === 'login' ? 'Đăng nhập App' : 'Tạo tài khoản mới'}</h2>
      <div className="space-y-4">
        <input type="text" placeholder="Tên tài khoản (taikhoanapp)" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none" />
        <input type="password" placeholder="Mật khẩu (pass)" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none" />
        {authMode === 'register' && <input type="password" placeholder="Nhập lại mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none" />}
        <button onClick={handleAuth} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-xl hover:brightness-110">
          {authMode === 'login' ? 'Vào ứng dụng' : 'Xác nhận Đăng ký'}
        </button>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-blue-600 font-black underline opacity-70 hover:opacity-100">
          {authMode === 'login' ? 'Bạn chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </div>
  );

  const renderFreeSetup = () => (
    <div className="max-w-4xl mx-auto mt-10 p-12 bg-white rounded-[3.5rem] shadow-2xl border relative animate-fadeIn">
      <button onClick={() => setStep('entry')} className="absolute top-8 left-8 text-slate-400 font-bold hover:text-blue-600">← Quay lại</button>
      <h2 className="text-2xl font-black text-blue-900 mb-8 uppercase mt-4">Cấu hình Đề thi Tự do - Khối {activeGrade}</h2>
      <div className="space-y-10">
        <div>
          <p className="font-black text-slate-400 text-[10px] uppercase mb-4 tracking-widest">Chọn chuyên đề ôn tập</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TOPICS_DATA[activeGrade].map(t => (
              <button key={t.id} onClick={() => {
                const isSelected = freeConfig.topics.includes(t.id);
                setFreeConfig({...freeConfig, topics: isSelected ? freeConfig.topics.filter(id => id !== t.id) : [...freeConfig.topics, t.id]});
              }} className={`p-5 text-left rounded-2xl border-2 font-bold transition-all ${freeConfig.topics.includes(t.id) ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-md' : 'border-slate-100 text-slate-400 opacity-60'}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3 bg-slate-50 p-6 rounded-3xl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MCQ (Số câu / Điểm)</label>
            <div className="flex gap-2">
              <input type="number" value={freeConfig.numMC} onChange={e => setFreeConfig({...freeConfig, numMC: parseInt(e.target.value)})} className="w-1/2 p-4 bg-white border-2 rounded-xl font-black text-center" />
              <input type="number" step="0.5" value={freeConfig.scoreMC} onChange={e => setFreeConfig({...freeConfig, scoreMC: parseFloat(e.target.value)})} className="w-1/2 p-4 bg-white border-2 border-blue-100 text-blue-600 rounded-xl font-black text-center" />
            </div>
          </div>
          <div className="space-y-3 bg-slate-50 p-6 rounded-3xl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TF (Số câu / Điểm)</label>
            <div className="flex gap-2">
              <input type="number" value={freeConfig.numTF} onChange={e => setFreeConfig({...freeConfig, numTF: parseInt(e.target.value)})} className="w-1/2 p-4 bg-white border-2 rounded-xl font-black text-center" />
              <input type="number" step="0.5" value={freeConfig.scoreTF} onChange={e => setFreeConfig({...freeConfig, scoreTF: parseFloat(e.target.value)})} className="w-1/2 p-4 bg-white border-2 border-blue-100 text-blue-600 rounded-xl font-black text-center" />
            </div>
          </div>
          <div className="space-y-3 bg-slate-50 p-6 rounded-3xl">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SA (Số câu / Điểm)</label>
            <div className="flex gap-2">
              <input type="number" value={freeConfig.numSA} onChange={e => setFreeConfig({...freeConfig, numSA: parseInt(e.target.value)})} className="w-1/2 p-4 bg-white border-2 rounded-xl font-black text-center" />
              <input type="number" step="0.5" value={freeConfig.scoreSA} onChange={e => setFreeConfig({...freeConfig, scoreSA: parseFloat(e.target.value)})} className="w-1/2 p-4 bg-white border-2 border-blue-100 text-blue-600 rounded-xl font-black text-center" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-blue-600 text-white rounded-3xl shadow-xl flex items-center justify-between">
           <div className="font-black uppercase text-xs tracking-widest">Quy định phân hóa</div>
           <div className="font-black text-sm">70% MĐ1-2 + 30% MĐ3-4</div>
        </div>

        <button onClick={handleStartExam} className="w-full py-6 bg-blue-700 text-white rounded-3xl font-black text-2xl uppercase shadow-2xl hover:brightness-110 active:scale-95 transition-all">Bắt đầu làm bài</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-xl mx-auto mt-20 p-12 bg-white rounded-[3.5rem] shadow-2xl border relative">
      <button onClick={() => setStep('entry')} className="absolute top-8 left-8 text-slate-400 font-bold hover:text-blue-600">← Trở về</button>
      <h2 className="text-3xl font-black text-blue-800 mb-10 uppercase text-center tracking-tighter">Xác thực danh tính</h2>
      <div className="space-y-6">
        <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl mb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black">👤</div>
          <div>
            <div className="text-[10px] font-black text-blue-600 uppercase mb-1">Tài khoản App đang dùng:</div>
            <div className="font-black text-slate-800 text-xl tracking-tight">{student.account}</div>
          </div>
        </div>
        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ID bản quyền (idnumber)</label>
           <input type="text" placeholder="Nhập ID..." value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-black focus:border-blue-500 outline-none" />
        </div>
        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Số báo danh (SBD)</label>
           <input type="text" placeholder="Nhập SBD..." value={student.sbd} onChange={e => setStudent({...student, sbd: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-black focus:border-blue-500 outline-none" />
        </div>
        
        <button onClick={verifyMatrixIdentity} disabled={loading} className="w-full py-5 bg-blue-700 text-white rounded-2xl font-black uppercase shadow-2xl hover:brightness-110">
          {loading ? 'Đang xác thực thông tin...' : 'Check Số báo danh'}
        </button>

        {student.isVerified && (
          <div className="space-y-6 pt-6 animate-fadeIn">
            <div className="p-6 bg-green-50 text-green-700 border-2 border-green-200 rounded-3xl font-black text-center shadow-sm">
              Xác thực hoàn tất!<br/>{student.fullName} ({student.studentClass})
            </div>
            <button onClick={handleStartExam} className="w-full py-6 bg-green-600 text-white rounded-3xl font-black text-2xl uppercase shadow-2xl hover:brightness-110 transition-all">Bắt đầu thi</button>
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
          {/* Header thi */}
          <header className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8 bg-white p-6 rounded-[2.5rem] shadow-xl border sticky top-4 z-20">
             <div className="flex items-center gap-6">
                <div className="px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-2xl shadow-xl shadow-blue-600/20">ID = {questions[examState.currentQuestionIndex].id}</div>
                <div className="hidden lg:block">
                   <div className="font-black text-slate-800 text-lg uppercase tracking-tight">{student.fullName || 'Thí sinh tự do'}</div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Mã đề: {selectedExamCode || 'FREE'}</div>
                </div>
             </div>
             <div className="text-4xl font-black font-mono text-blue-600 tracking-tighter">
                {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
             </div>
             <button onClick={() => confirm("Xác nhận nộp bài?") && finishExam()} className="bg-rose-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-rose-600/30 hover:scale-105 transition-all">Nộp bài</button>
          </header>

          {/* Body thi */}
          <main className="flex-1 max-w-6xl mx-auto w-full">
             <div className="bg-white p-14 rounded-[4rem] shadow-2xl border border-slate-50 min-h-[500px] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-3 h-full bg-blue-600"></div>
                <div className="text-[12px] font-black text-blue-500 uppercase mb-8 tracking-[0.3em]">{questions[examState.currentQuestionIndex].part}</div>
                <MathText content={questions[examState.currentQuestionIndex].question} className="text-3xl font-bold text-slate-800 mb-14 leading-relaxed" />
                
                {/* Answers UI */}
                {questions[examState.currentQuestionIndex].type === 'mcq' && (
                  <div className="grid grid-cols-1 gap-5">
                    {questions[examState.currentQuestionIndex].o?.map((opt, i) => (
                      <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})}
                        className={`p-8 text-left rounded-[2rem] border-2 font-bold transition-all flex items-center gap-8 ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'border-blue-600 bg-blue-50 shadow-inner' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200'}`}>
                        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white text-slate-300 border'}`}>{String.fromCharCode(65+i)}</span>
                        <MathText content={opt} className="text-2xl text-slate-700" />
                      </button>
                    ))}
                  </div>
                )}

                {questions[examState.currentQuestionIndex].type === 'true-false' && (
                  <div className="space-y-6">
                    {questions[examState.currentQuestionIndex].s?.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                        <div className="flex-1 font-bold text-slate-700 text-xl"><MathText content={item.text} /></div>
                        <div className="flex gap-3">
                          {[true, false].map(val => {
                             const cur = examState.answers[questions[examState.currentQuestionIndex].id] || [];
                             const isSel = cur[idx] === val;
                             return (
                               <button key={val.toString()} onClick={() => {
                                 const next = [...cur]; next[idx] = val;
                                 setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: next}});
                               }} className={`px-12 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-md ${isSel ? (val ? 'bg-green-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-slate-400'}`}>
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
                  <div className="max-w-lg">
                    <input type="text" value={examState.answers[questions[examState.currentQuestionIndex].id] || ""} 
                      onChange={e => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: e.target.value}})}
                      className="w-full p-8 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] font-black text-3xl text-blue-700 outline-none focus:border-blue-600 shadow-inner" placeholder="Nhập đáp án..." />
                  </div>
                )}
             </div>

             {/* Footer điều hướng: Hàng câu hỏi bên dưới */}
             <div className="mt-10 flex flex-col gap-10">
                <div className="flex flex-wrap justify-center gap-3 p-8 bg-white/50 rounded-[3rem] border border-white/80 shadow-inner">
                   {questions.map((q, idx) => (
                     <button key={idx} onClick={() => setExamState({...examState, currentQuestionIndex: idx})}
                       className={`w-12 h-12 rounded-2xl font-black text-sm transition-all shadow-md ${examState.currentQuestionIndex === idx ? 'bg-blue-600 text-white scale-125 ring-4 ring-blue-100' : (examState.answers[q.id] !== undefined ? 'bg-green-100 text-green-700' : 'bg-white text-slate-400 hover:bg-slate-50')}`}>
                       {idx + 1}
                     </button>
                   ))}
                </div>
                <div className="flex justify-between gap-6">
                   <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.max(0, examState.currentQuestionIndex - 1)})} disabled={examState.currentQuestionIndex === 0} className="flex-1 py-6 bg-white text-slate-400 border-4 border-slate-100 rounded-[2rem] font-black uppercase text-sm disabled:opacity-20 shadow-xl transition-all">Quay lại câu trước</button>
                   <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.min(questions.length-1, examState.currentQuestionIndex + 1)})} disabled={examState.currentQuestionIndex === questions.length - 1} className="flex-1 py-6 bg-blue-700 text-white rounded-[2rem] font-black uppercase text-sm shadow-2xl hover:brightness-110 active:scale-95 transition-all">Câu tiếp theo</button>
                </div>
             </div>
          </main>
        </div>
      )}

      {step === 'result' && (
        <div className="max-w-2xl mx-auto pt-20 px-6 animate-fadeIn">
           <div className="bg-white p-20 rounded-[4rem] shadow-2xl border border-slate-50 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-blue-600"></div>
              <div className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">Kết quả kiểm tra</div>
              <div className="space-y-1 mb-14">
                <div className="font-black text-slate-800 text-3xl tracking-tight">{student.fullName || 'Thí sinh tự do'}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SBD: {student.sbd || 'N/A'} • Mã đề: {selectedExamCode || 'FREE'}</div>
              </div>
              
              <div className="relative inline-block">
                <div className="text-[13rem] font-black leading-none text-blue-600 tracking-tighter drop-shadow-3xl">
                  {calculateScore(questions, examState.answers, freeConfig).toFixed(1)}
                </div>
              </div>

              <div className="mt-20 flex flex-col gap-5">
                 <button onClick={() => setStep('review')} className="w-full py-7 bg-blue-700 text-white rounded-3xl font-black text-xl uppercase shadow-2xl hover:brightness-110 transition-all">Xem đề thi & đáp án</button>
                 <button onClick={() => window.location.reload()} className="w-full py-7 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase hover:bg-slate-200 transition-all">Quay lại trang chủ</button>
              </div>
           </div>
        </div>
      )}

      {step === 'review' && (
        <div className="max-w-6xl mx-auto p-4 md:p-12 animate-fadeIn space-y-12 pb-20">
           <header className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-xl border sticky top-4 z-20">
              <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Review Đề thi</h2>
              <button onClick={() => setStep('result')} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Quay lại kết quả</button>
           </header>
           
           <div className="space-y-10">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-14 rounded-[3.5rem] shadow-2xl border relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-2 h-full bg-slate-100"></div>
                   <div className="absolute top-10 right-14 px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs uppercase shadow-sm">ID: {q.id}</div>
                   <div className="font-black text-blue-600 text-sm mb-6 tracking-widest">Câu hỏi số {idx + 1} ({q.part})</div>
                   <MathText content={q.question} className="text-3xl font-bold text-slate-800 mb-12 leading-relaxed" />
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="p-8 bg-blue-50/50 rounded-3xl border-2 border-blue-100">
                        <div className="text-[10px] font-black text-blue-400 uppercase mb-4 tracking-widest">Đáp án đúng của hệ thống</div>
                        <div className="font-bold text-blue-900 text-lg">
                          {q.type === 'mcq' ? <MathText content={q.a || ""} /> : 
                           q.type === 'short-answer' ? q.a : 
                           q.s?.map((s,i) => `S${i+1}: ${s.a ? 'Đ' : 'S'}`).join(' • ')}
                        </div>
                     </div>
                     <div className={`p-8 rounded-3xl border-2 ${examState.answers[q.id] === undefined ? 'bg-slate-50 border-slate-200' : 'bg-green-50/50 border-green-100'}`}>
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Câu trả lời của bạn</div>
                        <div className="font-bold text-slate-700 text-lg">
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
