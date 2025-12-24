
import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState, ExamCodeDefinition, SheetResult 
} from './types.ts';
import { 
  GRADES, TOPICS_DATA, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, API_ROUTING, REGISTER_LINKS 
} from './constants.tsx';
import { generateExam, calculateScore } from './services/examEngine.ts';
import MathText from './components/MathText.tsx';

const App: React.FC = () => {
  const [step, setStep] = useState<'entry' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  
  // Auth states
  const [loginForm, setLoginForm] = useState({ idBanQuyen: '', account: '', pass: '' });
  const [changePassForm, setChangePassForm] = useState({ oldPass: '', newPass: '' });

  const [config, setConfig] = useState<ExamConfig>({
    grade: 10,
    topics: [],
    duration: 45,
    numMC: 12, scoreMC: 3, mcL3: 0, mcL4: 0,
    numTF: 4, scoreTF: 4, tfL3: 0, tfL4: 0,
    numSA: 6, scoreSA: 3, saL3: 0, saL4: 0
  });

  const [student, setStudent] = useState<StudentInfo>({
    fullName: '', studentClass: 'Tự do', idNumber: '', examCode: '', phoneNumber: '', isVerified: false, isLoggedIn: false, limitTab: MAX_VIOLATIONS
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [teacherPhoneForScore, setTeacherPhoneForScore] = useState("");

  const activeApiUrl = API_ROUTING[student.phoneNumber] || DEFAULT_API_URL;
  const currentCodeDef = EXAM_CODES[config.grade].find(c => c.code === student.examCode);
  const isFixedExam = currentCodeDef && currentCodeDef.topics !== 'manual';

  // Chức năng Đăng nhập
  const handleLogin = async () => {
    if (!loginForm.idBanQuyen || !loginForm.account || !loginForm.pass) {
      alert("Vui lòng nhập đầy đủ thông tin đăng nhập!");
      return;
    }
    setLoading(true);
    try {
      const url = `${API_ROUTING[loginForm.idBanQuyen] || DEFAULT_API_URL}?action=login&account=${loginForm.account}&pass=${loginForm.pass}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setStudent({
          ...student,
          fullName: data.name,
          studentClass: data.class,
          idNumber: data.sbd,
          phoneNumber: loginForm.idBanQuyen,
          isVerified: true,
          isLoggedIn: true,
          limitTab: data.limittab || MAX_VIOLATIONS
        });
        setShowLoginModal(false);
        alert(`Chào mừng ${data.name} đã đăng nhập thành công!`);
      } else {
        alert(data.message || "Tài khoản hoặc mật khẩu không chính xác!");
      }
    } catch (err) {
      alert("Lỗi kết nối máy chủ khi đăng nhập!");
    } finally {
      setLoading(false);
    }
  };

  // Chức năng Đổi mật khẩu
  const handleChangePass = async () => {
    if (!changePassForm.oldPass || !changePassForm.newPass) {
      alert("Vui lòng điền đủ thông tin!");
      return;
    }
    setLoading(true);
    try {
      const url = `${activeApiUrl}?action=changePass&account=${loginForm.account}&oldPass=${changePassForm.oldPass}&newPass=${changePassForm.newPass}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'success') {
        alert("Đổi mật khẩu thành công!");
        setShowChangePassModal(false);
        setChangePassForm({ oldPass: '', newPass: '' });
      } else {
        alert(data.message || "Đổi mật khẩu thất bại!");
      }
    } catch {
      alert("Lỗi kết nối!");
    } finally {
      setLoading(false);
    }
  };

  const handleViewScoreRedirect = () => {
    const cleanPhone = teacherPhoneForScore.trim();
    if (!cleanPhone) { alert("Vui lòng nhập số điện thoại giáo viên!"); return; }
    const targetUrl = API_ROUTING[cleanPhone] || DEFAULT_API_URL;
    window.open(`${targetUrl}?action=view`, '_blank');
    setShowScoreModal(false);
  };

  useEffect(() => {
    if (step === 'exam' && !examState.isFinished) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setExamState(prev => {
            const nextViolations = prev.violations + 1;
            const limit = student.limitTab || MAX_VIOLATIONS;
            if (nextViolations >= limit) { finishExam(); }
            return { ...prev, violations: nextViolations };
          });
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [step, examState.isFinished, student.limitTab]);

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
  }, [step, examState.isFinished]);

  const verifySBD = async () => {
    if (student.isLoggedIn) return;
    if (!student.idNumber.trim() || !student.phoneNumber) { alert("Thiếu SBD hoặc SĐT!"); return; }
    setLoading(true);
    try {
      const url = `${activeApiUrl}?action=checkSBD&sbd=${student.idNumber.trim()}&code=${student.examCode}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        // KIỂM TRA BẮT BUỘC ĐĂNG NHẬP:
        // Nếu SBD này đã có taikhoanapp (hasAccount === true từ server) mà chưa login
        if (data.hasAccount) {
          alert("SBD này đã có tài khoản. Bạn bắt buộc phải ĐĂNG NHẬP để thi mã đề này!");
          setStudent(prev => ({ ...prev, isVerified: false }));
          setShowLoginModal(true);
          return;
        }

        if (data.limitReached) { alert("Hết lượt làm bài!"); return; }
        setStudent(prev => ({ 
          ...prev, 
          fullName: data.name, 
          studentClass: data.class, 
          isVerified: true,
          limitTab: data.limittab || MAX_VIOLATIONS
        }));
      } else { alert(data.message || "Không hợp lệ!"); }
    } catch { alert("Lỗi kết nối!"); } finally { setLoading(false); }
  };

  const handleEntryNext = () => {
    if (!student.examCode) { alert("Chọn mã đề!"); return; }
    if (currentCodeDef && currentCodeDef.fixedConfig) {
      const fc = currentCodeDef.fixedConfig;
      setConfig({
        grade: config.grade, topics: currentCodeDef.topics as number[], duration: fc.duration,
        numMC: fc.numMC, scoreMC: fc.scoreMC, mcL3: fc.mcL3 || 0, mcL4: fc.mcL4 || 0,
        numTF: fc.numTF, scoreTF: fc.scoreTF, tfL3: fc.tfL3 || 0, tfL4: fc.tfL4 || 0,
        numSA: fc.numSA, scoreSA: fc.scoreSA, saL3: fc.saL3 || 0, saL4: fc.saL4 || 0
      });
      if (!student.isLoggedIn) {
        setStudent(prev => ({ ...prev, isVerified: false, idNumber: '' }));
      }
    } else {
      setConfig(prev => ({ ...prev, topics: [], mcL3: 0, mcL4: 0, tfL3: 0, tfL4: 0, saL3: 0, saL4: 0 }));
      if (!student.isLoggedIn) {
        setStudent(prev => ({ ...prev, isVerified: true, idNumber: 'Tự do', fullName: 'Thí sinh tự do' }));
      }
    }
    setStep('info_setup');
  };

  const handleStartExam = () => {
    if (!student.fullName || (isFixedExam && !student.isVerified)) { 
      alert("Vui lòng xác thực SBD hoặc Đăng nhập trước khi bắt đầu!"); 
      return; 
    }
    if (config.topics.length === 0) { alert("Chọn chuyên đề!"); return; }
    const generated = generateExam(config);
    if (generated.length === 0) { alert("Không đủ câu hỏi!"); return; }
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
      sbd: student.idNumber, tongdiem: finalScore, time: `${Math.floor(dur / 60)}p ${dur % 60}s`, phoneNumber: student.phoneNumber
    };
    fetch(activeApiUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveResult', ...result }) });
  };

  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pt-10 animate-fadeIn">
      <header className="text-center space-y-4">
        <h1 className="text-3xl font-black text-teal-600 uppercase tracking-[0.2em] leading-tight">Tạo Đề Kiểm Tra Từ Ngân Hàng</h1>
        <p className="text-slate-500 font-bold text-sm tracking-wide">Tác giả: Nguyễn Văn Hà - THPT Yên Dũng số 2 - Bắc Ninh</p>
        
        {/* KHÔI PHỤC CÁC NÚT ĐĂNG KÝ VÀ TIỆN ÍCH */}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <button onClick={() => setShowScoreModal(true)} className="px-6 py-3 bg-white border-2 border-teal-600 text-teal-700 rounded-full font-black shadow-lg hover:bg-teal-50 transition-colors uppercase text-[10px] tracking-widest">XEM ĐIỂM</button>
          
          <a href={REGISTER_LINKS.MATH} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-blue-600 text-white border-2 border-blue-600 rounded-full font-black shadow-lg hover:bg-blue-700 transition-colors uppercase text-[10px] tracking-widest flex items-center gap-2">
            ĐĂNG KÝ HỌC TOÁN
          </a>
          <a href={REGISTER_LINKS.APP} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-orange-500 text-white border-2 border-orange-500 rounded-full font-black shadow-lg hover:bg-orange-600 transition-colors uppercase text-[10px] tracking-widest flex items-center gap-2">
            ĐĂNG KÝ SỬ DỤNG APP
          </a>

          {student.isLoggedIn ? (
            <div className="flex gap-2">
               <button onClick={() => setShowChangePassModal(true)} className="px-6 py-3 bg-teal-50 text-teal-700 border-2 border-teal-100 rounded-full font-black shadow-lg hover:bg-teal-100 transition-colors uppercase text-[10px] tracking-widest">ĐỔI MẬT KHẨU</button>
               <button onClick={() => setStudent({...student, isLoggedIn: false, fullName: '', idNumber: '', isVerified: false})} className="px-6 py-3 bg-rose-50 text-rose-700 border-2 border-rose-100 rounded-full font-black shadow-lg hover:bg-rose-100 transition-colors uppercase text-[10px] tracking-widest">ĐĂNG XUẤT</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="px-6 py-3 bg-teal-600 text-white border-2 border-teal-600 rounded-full font-black shadow-lg hover:bg-teal-700 transition-colors uppercase text-[10px] tracking-widest">ĐĂNG NHẬP</button>
          )}
        </div>
        {student.isLoggedIn && <p className="text-teal-600 font-black text-xs">Xin chào, {student.fullName} ({student.idNumber})</p>}
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border space-y-10">
        <div className="space-y-4">
          <label className="text-xl font-black text-slate-700 flex items-center gap-2"><span className="w-2 h-7 bg-teal-500 rounded-full"></span>Khối lớp</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {GRADES.map(g => (
              <button key={g} onClick={() => { setConfig({...config, grade: g}); setStudent({...student, examCode: ''}); }}
                className={`py-4 rounded-2xl font-black transition-all ${config.grade === g ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-teal-50'}`}>Khối {g}</button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Mã đề mặc định (Phân hóa M3, M4)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXAM_CODES[config.grade].map(def => (
              <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})}
                className={`p-5 text-left rounded-2xl border-2 transition-all ${student.examCode === def.code ? 'border-teal-500 bg-teal-50 ring-4 ring-teal-50' : 'border-slate-100 hover:border-teal-200'}`}>
                <div className="font-black text-teal-700">{def.code}</div>
                <div className="text-xs text-slate-500 font-bold">{def.name}</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleEntryNext} className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] font-black text-xl uppercase tracking-widest shadow-xl hover:bg-teal-700 active:scale-95 transition-all">Tiếp tục</button>
      </div>
    </div>
  );

  const renderInfoSetup = () => (
    <div className="max-w-6xl mx-auto p-6 space-y-6 animate-fadeIn">
      <button 
        onClick={() => setStep('entry')} 
        className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:text-teal-600 transition-colors bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 w-fit"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Quay lại
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border space-y-6 lg:sticky lg:top-6 h-fit">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>Thí sinh</h2>
          
          {student.isLoggedIn ? (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                <p className="text-[10px] font-black text-teal-600 uppercase mb-1">ID Bản Quyền (Của Giáo Viên)</p>
                <p className="font-black text-slate-800">{student.phoneNumber}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Học sinh (Đã đăng nhập)</p>
                <p className="font-black text-slate-800">{student.fullName} - {student.studentClass}</p>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase">SBD: {student.idNumber}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID bản quyền (ID Giáo viên)</label>
                 <input type="tel" value={student.phoneNumber} onChange={e => setStudent({...student, phoneNumber: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold outline-none focus:border-teal-500" placeholder="VD: 0912345678" />
              </div>
              {isFixedExam ? (
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số báo danh (SBD)</label>
                  <div className="flex gap-2">
                    <input type="text" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="flex-1 p-4 rounded-xl border-2 font-black outline-none focus:border-teal-500" placeholder="SBD..." />
                    <button onClick={verifySBD} className="px-5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-colors whitespace-nowrap shadow-md">Check</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                   <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold outline-none focus:border-teal-500" placeholder="Họ và tên..." />
                   <select value={student.studentClass} onChange={e => setStudent({...student, studentClass: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold outline-none focus:border-teal-500">
                      {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
              )}
            </>
          )}

          {student.isVerified && !student.isLoggedIn && <div className="p-4 bg-teal-50 rounded-xl font-black text-teal-800 border border-teal-100 animate-fadeIn flex items-center gap-2"><span>✓</span> {student.fullName} - {student.studentClass}</div>}
          <button onClick={handleStartExam} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-teal-700 active:scale-95 transition-all">Bắt đầu thi</button>
        </div>
        
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-xl border space-y-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>Cấu hình đề: {student.examCode}</h2>
          {/* (Giữ nguyên phần cấu hình đề...) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
             <div className="space-y-1">
                <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Phần I (Trắc nghiệm)</div>
                <div className="text-xs font-bold text-slate-500">{config.numMC} câu ({config.mcL3}M3, {config.mcL4}M4)</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Phần II (Đúng sai)</div>
                <div className="text-xs font-bold text-slate-500">{config.numTF} câu ({config.tfL3}M3, {config.tfL4}M4)</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Phần III (Trả lời ngắn)</div>
                <div className="text-xs font-bold text-slate-500">{config.numSA} câu ({config.saL3}M3, {config.saL4}M4)</div>
             </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn Chuyên Đề</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {TOPICS_DATA[config.grade].map(topic => (
                <button key={topic.id} disabled={isFixedExam} onClick={() => {
                  const isS = config.topics.includes(topic.id);
                  setConfig(prev => ({ ...prev, topics: isS ? prev.topics.filter(id => id !== topic.id) : [...prev.topics, topic.id] }));
                }} className={`p-4 text-left rounded-xl border-2 font-bold transition-all ${config.topics.includes(topic.id) ? 'border-teal-500 text-teal-700 bg-teal-50 shadow-sm' : 'border-slate-50 text-slate-400 bg-white hover:border-teal-100'}`}>{topic.name}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExam = () => {
    const q = questions[examState.currentQuestionIndex];
    if (!q) return null;
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col animate-fadeIn">
        <header className="bg-white border-b p-4 sticky top-0 z-20 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-teal-100">{examState.currentQuestionIndex + 1}</div>
            <div>
               <div className="font-black text-slate-800 leading-none">{student.fullName}</div>
               <div className="text-[10px] uppercase font-bold text-teal-600 mt-1">Loại: {q.part}</div>
            </div>
          </div>
          <div className={`text-3xl font-mono font-black ${examState.timeLeft < 120 ? 'text-rose-600 animate-pulse' : 'text-teal-700'}`}>
             {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
          </div>
          <button onClick={() => confirm("Xác nhận nộp bài?") && finishExam()} className="px-6 py-2 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all">Nộp bài</button>
        </header>
        <main className="flex-1 max-w-4xl mx-auto w-full p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 space-y-10 border border-slate-100">
            <div className="space-y-4">
              <div className="inline-block bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full text-[11px] font-black border border-teal-100 uppercase tracking-tighter">ID = {q.id}</div>
              <MathText content={q.question} className="text-2xl font-bold text-slate-800 leading-relaxed" />
            </div>
            {q.type === 'mcq' && (
              <div className="grid gap-3">
                {q.o?.map((opt, idx) => (
                  <button key={idx} onClick={() => setExamState(p => ({...p, answers: {...p.answers, [q.id]: idx}}))}
                    className={`p-6 text-left rounded-2xl border-2 flex items-center gap-5 transition-all ${examState.answers[q.id] === idx ? 'bg-teal-600 text-white border-teal-600 shadow-xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-teal-100 hover:bg-teal-50/30'}`}>
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${examState.answers[q.id] === idx ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+idx)}</span>
                    <MathText content={opt} className="font-bold text-lg" />
                  </button>
                ))}
              </div>
            )}
            {q.type === 'true-false' && (
              <div className="space-y-4">
                {q.s?.map((item, idx) => {
                  const curr = examState.answers[q.id] || [null,null,null,null];
                  return (
                    <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-100 gap-4">
                      <MathText content={`${String.fromCharCode(97+idx)}) ${item.text}`} className="font-bold flex-1 text-lg" />
                      <div className="flex gap-3">
                        <button onClick={()=>{const n=[...curr];n[idx]=true;setExamState(p=>({...p,answers:{...p.answers,[q.id]:n}}))}} className={`w-24 py-3 rounded-xl font-black transition-all border-2 ${curr[idx]===true?'bg-teal-600 text-white border-teal-600 shadow-md':'bg-white text-slate-400 border-slate-200 hover:border-teal-200'}`}>Đúng</button>
                        <button onClick={()=>{const n=[...curr];n[idx]=false;setExamState(p=>({...p,answers:{...p.answers,[q.id]:n}}))}} className={`w-24 py-3 rounded-xl font-black transition-all border-2 ${curr[idx]===false?'bg-rose-600 text-white border-rose-600 shadow-md':'bg-white text-slate-400 border-slate-200 hover:border-rose-200'}`}>Sai</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {q.type === 'short-answer' && (
              <div className="text-center space-y-4">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nhập đáp án của bạn (Dùng dấu chấm nhé, ví dụ: 6.12):</label>
                 <input type="text" value={examState.answers[q.id] || ''} onChange={e => setExamState(p => ({...p, answers: {...p.answers, [q.id]: e.target.value}}))}
                   className="w-full max-w-md p-8 rounded-[2rem] border-4 text-center text-5xl font-black text-teal-700 outline-none focus:border-teal-500 shadow-inner bg-slate-50 placeholder-slate-200" placeholder="..." />
              </div>
            )}
          </div>
        </main>
        <footer className="bg-white border-t p-6 flex gap-6 sticky bottom-0 z-10 shadow-2xl">
          <button disabled={examState.currentQuestionIndex===0} onClick={()=>setExamState(p=>({...p,currentQuestionIndex:p.currentQuestionIndex-1}))} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-200 disabled:opacity-30 uppercase tracking-widest text-xs transition-colors">Trước</button>
          <div className="flex-[5] flex gap-2 overflow-x-auto no-scrollbar items-center justify-center px-4">
            {questions.map((_, i) => (
              <button key={i} onClick={()=>setExamState(p=>({...p,currentQuestionIndex:i}))}
                className={`min-w-[40px] h-10 rounded-xl text-xs font-black transition-all ${examState.currentQuestionIndex===i?'bg-teal-600 text-white scale-125 shadow-lg':examState.answers[questions[i].id]!==undefined?'bg-teal-100 text-teal-600':'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}>{i+1}</button>
            ))}
          </div>
          <button disabled={examState.currentQuestionIndex===questions.length-1} onClick={()=>setExamState(p=>({...p,currentQuestionIndex:p.currentQuestionIndex+1}))} className="flex-1 py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 disabled:opacity-30 uppercase tracking-widest text-xs transition-all">Sau</button>
        </footer>
      </div>
    );
  };

  const renderResult = () => {
    const score = calculateScore(questions, examState.answers, config);
    return (
      <div className="max-w-2xl mx-auto p-6 pt-16 animate-fadeIn pb-20">
        <div className="bg-white rounded-[3.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-50">
          <div className="bg-gradient-to-br from-teal-600 to-teal-800 p-16 text-center text-white space-y-4">
            <h2 className="text-xl font-black uppercase tracking-[0.3em] text-teal-100 opacity-80">Điểm số của bạn</h2>
            <div className="text-[10rem] font-black leading-none drop-shadow-2xl">{score.toFixed(1)}</div>
            <p className="text-teal-100/60 font-bold italic">Hệ thống đã tự động gửi kết quả tới máy chủ!</p>
          </div>
          <div className="p-12 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Thí sinh</div>
                <div className="text-lg font-black text-slate-800">{student.fullName}</div>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số báo danh</div>
                <div className="text-lg font-black text-slate-800">{student.idNumber || "Tự do"}</div>
              </div>
            </div>

            <div className="space-y-3">
              <button onClick={() => setStep('review')} className="w-full py-5 bg-white border-2 border-teal-500 rounded-2xl font-black text-teal-700 flex items-center justify-center gap-3 shadow-md hover:bg-teal-50 transition-all active:scale-95 uppercase tracking-widest text-sm">Xem lại đề thi</button>
              <button onClick={() => window.location.reload()} className="w-full py-6 bg-teal-600 text-white rounded-3xl font-black text-xl uppercase shadow-2xl shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReview = () => (
    <div className="min-h-screen bg-slate-50 pb-20 animate-fadeIn">
      <header className="bg-white border-b p-6 sticky top-0 z-30 shadow-md flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Xem lại bài làm</h2>
        <button onClick={() => setStep('result')} className="px-6 py-2 bg-teal-600 text-white rounded-xl font-black text-xs uppercase">Quay lại</button>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {questions.map((q, idx) => {
          const userAns = examState.answers[q.id];
          return (
            <div key={q.id} className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-black text-slate-500">{idx + 1}</span>
                <span className="text-xs font-black text-teal-600 uppercase bg-teal-50 px-3 py-1 rounded-full">{q.part}</span>
              </div>
              <MathText content={q.question} className="text-xl font-bold text-slate-800" />
              {q.type === 'mcq' && (
                <div className="grid gap-3">
                  {q.o?.map((opt, i) => {
                    const isCorrect = opt === q.a;
                    const isSelected = userAns === i;
                    return (
                      <div key={i} className={`p-4 rounded-xl border-2 flex items-center justify-between ${isCorrect ? 'bg-green-50 border-green-500' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                           <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</span>
                           <MathText content={opt} className={`font-bold ${isCorrect ? 'text-green-700' : 'text-slate-600'}`} />
                        </div>
                        {isSelected && <span className="text-teal-600 font-black text-lg">✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {q.type === 'true-false' && (
                <div className="space-y-3">
                  {q.s?.map((item, i) => {
                    const userSubAns = (userAns || [null,null,null,null])[i];
                    const isCorrect = userSubAns === item.a;
                    return (
                      <div key={i} className={`p-4 rounded-xl border flex items-center justify-between ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                        <MathText content={`${String.fromCharCode(97+i)}) ${item.text}`} className="font-bold flex-1 text-slate-700" />
                        <div className="flex gap-2">
                           <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${item.a ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'}`}>Đ.Án: {item.a ? 'Đúng' : 'Sai'}</div>
                           <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase bg-white border ${isCorrect ? 'text-green-600 border-green-600' : 'text-rose-600 border-rose-600'}`}>Bạn: {userSubAns === null ? '??' : (userSubAns ? 'Đúng' : 'Sai')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {q.type === 'short-answer' && (
                <div className="p-6 bg-slate-50 rounded-2xl space-y-2">
                   <p className="text-xs font-black text-slate-400 uppercase">Đáp án của bạn: <span className="text-teal-700 text-lg ml-2">{userAns || "Trống"}</span></p>
                   <p className="text-xs font-black text-green-600 uppercase">Đáp án đúng: <span className="text-lg ml-2">{q.a}</span></p>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-teal-200">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && renderInfoSetup()}
      {step === 'exam' && renderExam()}
      {step === 'result' && renderResult()}
      {step === 'review' && renderReview()}
      
      {/* Modal Đăng Nhập */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border relative">
             <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl font-black">✕</button>
             <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest text-center mb-8">Đăng nhập tài khoản học sinh</h3>
             <div className="space-y-4">
                <input type="tel" placeholder="ID Bản Quyền (Của Giáo Viên)" value={loginForm.idBanQuyen} onChange={e => setLoginForm({...loginForm, idBanQuyen: e.target.value})} className="w-full p-4 border-2 rounded-2xl outline-none focus:border-teal-500 font-bold" />
                <input type="text" placeholder="Tài khoản (SĐT học sinh - Cột G)" value={loginForm.account} onChange={e => setLoginForm({...loginForm, account: e.target.value})} className="w-full p-4 border-2 rounded-2xl outline-none focus:border-teal-500 font-bold" />
                <input type="password" placeholder="Mật khẩu (Cột H)" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} className="w-full p-4 border-2 rounded-2xl outline-none focus:border-teal-500 font-bold" />
                <button onClick={handleLogin} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-teal-700 transition-all">{loading ? "Đang kiểm tra..." : "Đăng nhập"}</button>
                <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">Lưu ý: Tài khoản do Giáo viên quản lý cấp</p>
             </div>
          </div>
        </div>
      )}

      {/* Modal Đổi Mật Khẩu */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border relative">
             <button onClick={() => setShowChangePassModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl font-black">✕</button>
             <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest text-center mb-8">Cập nhật mật khẩu mới</h3>
             <div className="space-y-4">
                <input type="password" placeholder="Mật khẩu hiện tại" value={changePassForm.oldPass} onChange={e => setChangePassForm({...changePassForm, oldPass: e.target.value})} className="w-full p-4 border-2 rounded-2xl outline-none focus:border-teal-500 font-bold" />
                <input type="password" placeholder="Mật khẩu mới mong muốn" value={changePassForm.newPass} onChange={e => setChangePassForm({...changePassForm, newPass: e.target.value})} className="w-full p-4 border-2 rounded-2xl outline-none focus:border-teal-500 font-bold" />
                <button onClick={handleChangePass} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-teal-700 transition-all">{loading ? "Đang lưu..." : "Đổi mật khẩu"}</button>
             </div>
          </div>
        </div>
      )}

      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative border border-slate-50">
            <button onClick={() => setShowScoreModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 text-2xl font-black">✕</button>
            <div className="text-center space-y-6">
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Tra cứu điểm</h3>
               <input type="tel" value={teacherPhoneForScore} onChange={e => setTeacherPhoneForScore(e.target.value)}
                 className="w-full p-6 rounded-2xl border-2 border-slate-100 font-black text-center text-2xl outline-none focus:border-teal-500 shadow-sm" placeholder="ID bản quyền" />
               <button onClick={handleViewScoreRedirect} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black shadow-xl hover:bg-teal-700 transition-all uppercase tracking-widest">Truy cập dữ liệu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
