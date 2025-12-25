
import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, SheetResult 
} from './types.ts';
import { 
  GRADES, TOPICS_DATA, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, API_ROUTING, REGISTER_LINKS 
} from './constants.tsx';
import { generateExam, calculateScore } from './services/examEngine.ts';
import MathText from './components/MathText.tsx';

const App: React.FC = () => {
  const [step, setStep] = useState<'entry' | 'auth' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('tc_user'));

  const [config, setConfig] = useState<ExamConfig>({
    grade: 12, topics: [], duration: 45,
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
  const [teacherPhone, setTeacherPhone] = useState("");

  const activeApiUrl = API_ROUTING[student.phoneNumber] || DEFAULT_API_URL;

  const handleAuth = () => {
    if (!authForm.username || !authForm.password) { alert("Điền đủ thông tin!"); return; }
    if (authMode === 'register') {
      if (authForm.password !== authForm.confirmPassword) { alert("Mật khẩu không khớp!"); return; }
      localStorage.setItem(`tc_acc_${authForm.username}`, authForm.password);
      alert("Đăng ký thành công!"); setAuthMode('login');
    } else {
      const saved = localStorage.getItem(`tc_acc_${authForm.username}`);
      if (saved === authForm.password) {
        localStorage.setItem('tc_user', authForm.username);
        setCurrentUser(authForm.username); setStep('entry');
      } else { alert("Sai tài khoản hoặc mật khẩu!"); }
    }
  };

  const handleLogout = () => { localStorage.removeItem('tc_user'); setCurrentUser(null); };

  const handleEntryNext = () => {
    if (!student.examCode) { alert("Vui lòng chọn mã đề!"); return; }
    const def = EXAM_CODES[config.grade].find(c => c.code === student.examCode);
    if (def && def.fixedConfig) {
      const fc = def.fixedConfig;
      setConfig({ ...config, topics: def.topics as number[], duration: fc.duration, numMC: fc.numMC, scoreMC: fc.scoreMC, numTF: fc.numTF, scoreTF: fc.scoreTF, numSA: fc.numSA, scoreSA: fc.scoreSA });
      setStudent({ ...student, isVerified: false, idNumber: '' });
    } else {
      setStudent({ ...student, isVerified: true, idNumber: 'Tự do', fullName: currentUser || 'Thí sinh tự do' });
    }
    setStep('info_setup');
  };

  const startExam = () => {
    if (config.topics.length === 0) { alert("Vui lòng chọn chuyên đề!"); return; }
    const generated = generateExam(config);
    if (generated.length === 0) { alert("Không đủ câu hỏi trong ngân hàng!"); return; }
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
    const res: SheetResult = { name: student.fullName, makiemtra: student.examCode, class: student.studentClass, sbd: student.idNumber, tongdiem: finalScore, time: `${Math.floor(dur/60)}p ${dur%60}s`, phoneNumber: student.phoneNumber };
    fetch(activeApiUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveResult', ...res }) });
  };

  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pt-10 animate-fadeIn">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-black text-teal-600 uppercase tracking-tighter">Testcode Online</h1>
        <p className="text-slate-500 font-bold text-sm">Nguyễn Văn Hà - THPT Yên Dũng số 2 - Bắc Ninh</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6">
          <a href={REGISTER_LINKS.MATH} target="_blank" className="p-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase shadow-md hover:bg-blue-700 transition-all flex items-center justify-center text-center">Đăng ký học Toán</a>
          <a href={REGISTER_LINKS.APP} target="_blank" className="p-4 bg-amber-500 text-white rounded-2xl font-bold text-xs uppercase shadow-md hover:bg-amber-600 transition-all flex items-center justify-center text-center">Đăng ký dùng App</a>
          <button onClick={() => setShowScoreModal(true)} className="p-4 bg-teal-600 text-white rounded-2xl font-bold text-xs uppercase shadow-md hover:bg-teal-700">Xem Điểm</button>
          {currentUser ? (
            <button onClick={handleLogout} className="p-4 bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase shadow-md hover:bg-slate-900 truncate">👤 {currentUser}</button>
          ) : (
            <button onClick={() => setStep('auth')} className="p-4 bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase shadow-md hover:bg-slate-900">Đăng Nhập</button>
          )}
        </div>
      </header>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GRADES.map(g => (
            <button key={g} onClick={() => { setConfig({...config, grade: g}); setStudent({...student, examCode: ''}); }}
              className={`py-4 rounded-xl font-black transition-all ${config.grade === g ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>Khối {g}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAM_CODES[config.grade].map(def => (
            <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})}
              className={`p-5 text-left rounded-2xl border-2 transition-all ${student.examCode === def.code ? 'border-teal-500 bg-teal-50 shadow-inner' : 'border-slate-100 hover:border-teal-200'}`}>
              <div className="font-black text-teal-700">{def.code}</div>
              <div className="text-xs text-slate-500 font-bold">{def.name}</div>
            </button>
          ))}
        </div>
        <button onClick={handleEntryNext} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl hover:bg-teal-700 transition-all">Tiếp tục</button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fadeIn pb-20">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-md border sticky top-4 z-50">
        <h2 className="text-xl font-black text-teal-600 uppercase">Xem lại bài thi</h2>
        <button onClick={() => setStep('entry')} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold uppercase text-xs">Về trang chủ</button>
      </header>
      {questions.map((q, idx) => {
        const userAns = examState.answers[q.id];
        return (
          <div key={q.id} className="bg-white p-8 rounded-3xl shadow-lg border space-y-4">
            <div className="flex justify-between">
              <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-teal-100">Câu {idx + 1} - ID: {q.id}</span>
            </div>
            <MathText content={q.question} className="text-lg font-bold text-slate-800" />
            <div className="grid gap-4 mt-4">
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                <div className="text-[10px] font-black text-teal-600 uppercase mb-1">Đáp án đúng:</div>
                <div className="font-bold text-teal-900">
                  {q.type === 'mcq' ? <MathText content={q.a || ""} /> : q.type === 'true-false' ? q.s?.map((s,i) => `(${i+1})${s.a?'Đ':'S'}`).join(' ') : q.a}
                </div>
              </div>
              <div className={`p-4 rounded-xl border ${userAns === undefined ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-100'}`}>
                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Bạn chọn:</div>
                <div className="font-bold text-slate-700">
                  {userAns === undefined ? "Bỏ trống" : (q.type === 'mcq' ? <MathText content={q.o?.[userAns] || ""} /> : q.type === 'true-false' ? userAns.map((a:any,i:number)=>`(${i+1})${a?'Đ':'S'}`).join(' ') : userAns)}
                </div>
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
      {step === 'auth' && (
        <div className="max-w-md mx-auto p-6 pt-20 animate-fadeIn">
          <div className="bg-white p-10 rounded-3xl shadow-2xl border space-y-6">
            <h2 className="text-2xl font-black text-teal-600 text-center uppercase">{authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}</h2>
            <input type="text" placeholder="Tên đăng nhập" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold focus:border-teal-500 outline-none" />
            <input type="password" placeholder="Mật khẩu" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold focus:border-teal-500 outline-none" />
            {authMode === 'register' && <input type="password" placeholder="Nhập lại mật khẩu" value={authForm.confirmPassword} onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold focus:border-teal-500 outline-none" />}
            <button onClick={handleAuth} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-teal-700 transition-all">{authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}</button>
            <div className="text-center">
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-sm font-bold text-slate-500 hover:text-teal-600">{authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
            </div>
            <button onClick={() => setStep('entry')} className="w-full text-slate-400 font-bold text-xs uppercase">Hủy bỏ</button>
          </div>
        </div>
      )}
      {step === 'info_setup' && (
        <div className="max-w-4xl mx-auto p-6 pt-10 animate-fadeIn space-y-6">
          <button onClick={() => setStep('entry')} className="px-6 py-2 bg-white border rounded-xl font-bold text-xs uppercase text-slate-400 hover:text-teal-600 transition-all">Quay lại</button>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-8 rounded-3xl shadow-xl border space-y-6">
              <h3 className="text-lg font-black text-slate-800">Thí sinh</h3>
              <input type="tel" value={student.phoneNumber} onChange={e => setStudent({...student, phoneNumber: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold focus:border-teal-500 outline-none" placeholder="ID bản quyền/SĐT" />
              <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold focus:border-teal-500 outline-none" placeholder="Họ và tên..." />
              <select value={student.studentClass} onChange={e => setStudent({...student, studentClass: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold focus:border-teal-500 outline-none">
                {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={startExam} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-teal-700">Vào thi</button>
            </div>
            <div className="md:col-span-2 bg-white p-8 rounded-3xl shadow-xl border space-y-6">
              <h3 className="text-lg font-black text-slate-800">Chọn chuyên đề ôn tập</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {TOPICS_DATA[config.grade].map(t => (
                  <button key={t.id} onClick={() => {
                    const isS = config.topics.includes(t.id);
                    setConfig({...config, topics: isS ? config.topics.filter(id => id !== t.id) : [...config.topics, t.id]});
                  }} className={`p-4 text-left rounded-xl border-2 font-bold transition-all ${config.topics.includes(t.id) ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-50 text-slate-400'}`}>{t.name}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {step === 'exam' && (
        <div className="min-h-screen bg-slate-50 flex flex-col animate-fadeIn">
          <header className="bg-white border-b p-4 sticky top-0 z-20 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center font-black">{examState.currentQuestionIndex + 1}</div>
              <div className="font-black text-slate-800">{student.fullName}</div>
            </div>
            <div className="text-2xl font-mono font-black text-teal-700">
              {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
            </div>
            <button onClick={() => confirm("Nộp bài?") && finishExam()} className="px-5 py-2 bg-rose-600 text-white rounded-xl font-black text-xs uppercase">Nộp bài</button>
          </header>
          <main className="flex-1 max-w-4xl mx-auto w-full p-6">
            <div className="bg-white rounded-3xl shadow-2xl p-10 space-y-10 border">
              <MathText content={questions[examState.currentQuestionIndex]?.question || ""} className="text-xl font-bold text-slate-800 leading-relaxed" />
              {questions[examState.currentQuestionIndex]?.type === 'mcq' && (
                <div className="grid gap-3">
                  {questions[examState.currentQuestionIndex]?.o?.map((opt, i) => (
                    <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})}
                      className={`p-6 text-left rounded-2xl border-2 flex items-center gap-4 transition-all ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-teal-600 text-white border-teal-600 shadow-lg' : 'bg-white border-slate-100 hover:border-teal-100'}`}>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-400 font-black">{String.fromCharCode(65+i)}</span>
                      <MathText content={opt} className="font-bold" />
                    </button>
                  ))}
                </div>
              )}
              {questions[examState.currentQuestionIndex]?.type === 'true-false' && (
                <div className="space-y-4">
                  {questions[examState.currentQuestionIndex]?.s?.map((item, i) => {
                    const cur = examState.answers[questions[examState.currentQuestionIndex].id] || [null,null,null,null];
                    return (
                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-2xl border gap-4">
                        <MathText content={item.text} className="font-bold flex-1" />
                        <div className="flex gap-2">
                          <button onClick={()=>{const n=[...cur];n[i]=true;setExamState({...examState,answers:{...examState.answers,[questions[examState.currentQuestionIndex].id]:n}})}} className={`px-6 py-2 rounded-xl font-black text-xs ${cur[i]===true?'bg-teal-600 text-white':'bg-white text-slate-400 border'}`}>ĐÚNG</button>
                          <button onClick={()=>{const n=[...cur];n[i]=false;setExamState({...examState,answers:{...examState.answers,[questions[examState.currentQuestionIndex].id]:n}})}} className={`px-6 py-2 rounded-xl font-black text-xs ${cur[i]===false?'bg-rose-600 text-white':'bg-white text-slate-400 border'}`}>SAI</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {questions[examState.currentQuestionIndex]?.type === 'short-answer' && (
                <div className="text-center">
                  <input type="text" value={examState.answers[questions[examState.currentQuestionIndex].id] || ""} onChange={e => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: e.target.value}})}
                    className="w-full max-w-sm p-6 rounded-2xl border-4 text-center text-3xl font-black text-teal-700 outline-none focus:border-teal-500 bg-slate-50 shadow-inner" placeholder="..." />
                </div>
              )}
            </div>
          </main>
          <footer className="bg-white border-t p-6 flex gap-4 sticky bottom-0 z-10">
            <button disabled={examState.currentQuestionIndex===0} onClick={()=>setExamState({...examState,currentQuestionIndex:examState.currentQuestionIndex-1})} className="px-6 py-4 bg-slate-100 rounded-xl font-black text-xs uppercase text-slate-400 disabled:opacity-20">Trước</button>
            <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar items-center justify-center">
              {questions.map((_, i) => (
                <button key={i} onClick={()=>setExamState({...examState,currentQuestionIndex:i})} className={`min-w-[32px] h-8 rounded-lg text-[10px] font-black ${examState.currentQuestionIndex===i?'bg-teal-600 text-white':'bg-slate-50 text-slate-300'}`}>{i+1}</button>
              ))}
            </div>
            <button disabled={examState.currentQuestionIndex===questions.length-1} onClick={()=>setExamState({...examState,currentQuestionIndex:examState.currentQuestionIndex+1})} className="px-6 py-4 bg-teal-600 text-white rounded-xl font-black text-xs uppercase shadow-md">Sau</button>
          </footer>
        </div>
      )}
      {step === 'result' && (
        <div className="max-w-xl mx-auto p-6 pt-20 animate-fadeIn">
          <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden text-center border">
            <div className="bg-teal-600 p-12 text-white space-y-2">
              <h2 className="text-xl font-black uppercase tracking-widest opacity-80">Kết quả bài thi</h2>
              <div className="text-8xl font-black tracking-tighter">{calculateScore(questions, examState.answers, config).toFixed(1)}</div>
            </div>
            <div className="p-10 space-y-6">
              <div className="font-bold text-slate-500 uppercase tracking-widest text-xs">Thí sinh: {student.fullName}</div>
              <button onClick={() => setStep('review')} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black text-lg uppercase shadow-xl hover:bg-teal-700 transition-all">Xem bài thi</button>
              <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-50 text-slate-400 rounded-xl font-bold uppercase text-xs tracking-widest">Về trang chủ</button>
            </div>
          </div>
        </div>
      )}
      {step === 'review' && renderReview()}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-10 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowScoreModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 font-black">✕</button>
            <div className="text-center space-y-6">
              <h3 className="text-xl font-black text-teal-600 uppercase tracking-widest">Tra cứu điểm</h3>
              <input type="tel" value={teacherPhone} onChange={e => setTeacherPhone(e.target.value)} className="w-full p-4 rounded-xl border-2 font-black text-center text-xl outline-none focus:border-teal-500" placeholder="Số điện thoại giáo viên" />
              <button onClick={() => window.open(`${API_ROUTING[teacherPhone] || DEFAULT_API_URL}?action=view`, '_blank')} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black shadow-lg uppercase">Truy cập dữ liệu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
