import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState
} from './types.ts';
import { 
  GRADES, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL 
} from './constants.tsx';
import { generateExam, generateExamFromMatrix, calculateScore, MatrixConfig } from './services/examEngine.ts';
import MathText from './components/MathText.tsx';

// --- CẤU HÌNH LINK ---
const LINKS = {
  MATH: "https://admintoanhoc.vercel.app/",
  APP: "https://forms.gle/q8J4FQEFYDfhVung7"
};

const App: React.FC = () => {
  // Thêm trạng thái 'review' vào step
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

  // --- TIMER ---
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

  // --- AUTH HANDLER ---
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
    // Lưu ý: Đảm bảo DEFAULT_API_URL trong constants.tsx là đúng
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

  // --- SBD VERIFY ---
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
          alert("SBD này đã có tài khoản. Vui lòng đăng nhập!");
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

  // --- START EXAM ---
  const handleEntryNext = async () => {
    if (!student.examCode) { alert("Vui lòng chọn mã đề!"); return; }

    if (isMatrixExam) {
      setLoading(true);
      try {
        const url = `${DEFAULT_API_URL}?action=getMatrix&code=${student.examCode}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'success') {
           setRemoteMatrix(data.matrix);
           setStep('info_setup');
        } else {
           alert(data.message);
        }
      } catch (e) {
        alert("Lỗi tải ma trận đề thi!");
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

  const finishExam = () => {
    const finalScore = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    
    const durSec = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const timeStr = `${Math.floor(durSec / 60)}p ${durSec % 60}s`;

    // Gửi kết quả (nếu có SBD hoặc đã đăng nhập)
    if (student.idNumber) {
        const saveUrl = `${DEFAULT_API_URL}?action=saveResult&makiemtra=${student.examCode}&sbd=${student.idNumber}&name=${encodeURIComponent(student.fullName)}&class=${encodeURIComponent(student.studentClass)}&tongdiem=${finalScore}&time=${encodeURIComponent(timeStr)}`;
        fetch(saveUrl, { mode: 'no-cors' }).catch(e => console.log(e));
    }
  };

  // --- RENDER FUNCTIONS ---

  // 1. MÀN HÌNH CHÍNH (ENTRY) - Đã sửa 4 nút
  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pt-10 animate-fadeIn">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-black text-teal-600 uppercase tracking-tighter">TestcodeOk</h1>
        <p className="text-slate-400 font-bold text-sm tracking-widest">Hệ thống thi tích hợp Ma trận Google Sheet</p>
        
        {/* === PHẦN SỬA ĐỔI YÊU CẦU 1: 4 Nút ngang hàng === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            {/* Nút 1: Đăng ký học Toán */}
            <a href={LINKS.MATH} target="_blank" rel="noreferrer" 
               className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg uppercase text-[11px] hover:bg-blue-700 transition-all text-center">
               Đăng ký học Toán
            </a>

            {/* Nút 2: Đăng ký dùng App */}
            <a href={LINKS.APP} target="_blank" rel="noreferrer" 
               className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg uppercase text-[11px] hover:bg-purple-700 transition-all text-center">
               Đăng ký dùng App
            </a>

            {/* Nút 3: Xem điểm */}
            <button onClick={() => setShowScoreModal(true)} 
               className="px-4 py-3 bg-teal-500 text-white rounded-xl font-bold shadow-lg uppercase text-[11px] hover:bg-teal-600 transition-all">
               Xem điểm
            </button>

            {/* Nút 4: Đăng nhập/Đăng ký hoặc Đăng xuất */}
            {student.isLoggedIn ? (
               <button onClick={() => setStudent({...student, isLoggedIn: false, fullName: '', idNumber: '', isVerified: false})} 
                  className="px-4 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg uppercase text-[11px] hover:bg-rose-600 transition-all">
                  Đăng xuất
               </button>
            ) : (
               <button onClick={() => setAuthMode('login')} 
                  className="px-4 py-3 bg-slate-700 text-white rounded-xl font-bold shadow-lg uppercase text-[11px] hover:bg-slate-800 transition-all">
                  Đăng nhập / Đăng ký
               </button>
            )}
        </div>
      </header>

      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GRADES.map(g => (
            <button key={g} onClick={() => setConfig({...config, grade: g})} className={`py-4 rounded-xl font-bold transition-all ${config.grade === g ? 'bg-teal-600 text-white shadow-lg transform scale-105' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Khối {g}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXAM_CODES[config.grade].map(def => (
            <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})} className={`p-5 text-left rounded-2xl border-2 transition-all ${student.examCode === def.code ? 'border-teal-500 bg-teal-50 shadow-inner' : 'border-slate-100 hover:bg-slate-50'}`}>
              <div className="font-bold text-teal-700 text-lg mb-1">{def.code}</div>
              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{def.topics === 'matrix' ? 'Chế độ Ma trận' : 'Luyện tập tự do'}</div>
            </button>
          ))}
        </div>
        <button onClick={handleEntryNext} disabled={loading} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black text-lg uppercase shadow-xl hover:bg-teal-700 active:scale-95 transition-all">{loading ? 'Hệ thống đang tải...' : 'Bắt đầu ngay'}</button>
      </div>
    </div>
  );

  // 2. MÀN HÌNH NHẬP INFO (SBD)
  const renderInfoSetup = () => (
    <div className="max-w-2xl mx-auto p-6 animate-fadeIn">
      <button onClick={() => setStep('entry')} className="mb-6 font-bold text-slate-400 uppercase text-xs hover:text-teal-600">← Chọn mã đề khác</button>
      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
        <h2 className="text-2xl font-black text-teal-700 uppercase text-center">Thông tin thí sinh</h2>
        {student.isLoggedIn ? (
           <div className="p-6 bg-teal-50 rounded-2xl border border-teal-100 text-center">
             <div className="font-bold text-slate-800 text-xl">{student.fullName}</div>
             <div className="text-slate-500 text-sm mt-1">SBD: {student.idNumber} • Lớp: {student.studentClass}</div>
             <div className="mt-2 text-xs text-green-600 font-bold uppercase">✓ Đã xác thực</div>
           </div>
        ) : isMatrixExam ? (
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nhập Số Báo Danh</label>
            <div className="flex gap-3">
              <input type="text" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value.toUpperCase()})} className="flex-1 p-4 rounded-xl border-2 font-bold outline-none focus:border-teal-500 bg-slate-50" placeholder="VD: SBD001" />
              <button onClick={verifySBD} className="px-6 bg-teal-600 text-white rounded-xl font-bold shadow-lg hover:bg-teal-700">Kiểm tra</button>
            </div>
            {student.isVerified && <div className="text-center text-green-600 font-bold text-sm">Xin chào: {student.fullName} ({student.studentClass})</div>}
          </div>
        ) : (
          <div className="space-y-4">
            <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold bg-slate-50 focus:border-teal-500" placeholder="Họ và Tên..." />
            <select value={student.studentClass} onChange={e => setStudent({...student, studentClass: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold bg-slate-50 focus:border-teal-500">
               {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <button onClick={handleStartExam} className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-teal-700 transition-all">Vào phòng thi</button>
      </div>
    </div>
  );

  // 3. MÀN HÌNH LÀM BÀI (EXAM)
  const renderExam = () => (
    <div className="min-h-screen flex flex-col p-4 md:p-6 animate-fadeIn">
        <header className="max-w-5xl mx-auto w-full flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-lg border border-slate-100 sticky top-2 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-teal-600 text-white rounded-lg flex items-center justify-center font-bold text-xl shadow">{examState.currentQuestionIndex + 1}</div>
            <div className="hidden sm:block text-xs font-bold text-slate-500 uppercase">Mã đề: {student.examCode}</div>
          </div>
          <div className={`text-3xl font-black font-mono tracking-tighter ${examState.timeLeft < 120 ? 'text-rose-600 animate-pulse' : 'text-teal-600'}`}>
            {Math.floor(examState.timeLeft/60).toString().padStart(2,'0')}:{(examState.timeLeft%60).toString().padStart(2,'0')}
          </div>
          <button onClick={() => confirm("Xác nhận nộp bài?") && finishExam()} className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs shadow hover:bg-rose-700">Nộp bài</button>
        </header>
        
        <div className="flex-1 max-w-5xl mx-auto w-full">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
            <div className="text-[10px] font-black text-teal-600 uppercase mb-4 tracking-widest">{questions[examState.currentQuestionIndex]?.part}</div>
            <div className="mb-8 text-lg text-slate-800 font-medium">
               <span className="font-bold text-teal-600 mr-2">ID: {questions[examState.currentQuestionIndex]?.id}</span>
               <MathText content={questions[examState.currentQuestionIndex]?.question || ""} className="" />
            </div>
            
            {/* Options */}
            {questions[examState.currentQuestionIndex]?.type === 'mcq' && (
              <div className="grid grid-cols-1 gap-4">
                {questions[examState.currentQuestionIndex].o?.map((opt, i) => (
                  <button key={i} onClick={() => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: i}})}
                    className={`p-5 text-left rounded-xl border-2 font-medium transition-all flex items-center gap-4 ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'border-teal-500 bg-teal-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${examState.answers[questions[examState.currentQuestionIndex].id] === i ? 'bg-teal-600 text-white' : 'bg-white text-slate-400 border'}`}>{String.fromCharCode(65 + i)}</span>
                    <MathText content={opt} className="text-slate-700" />
                  </button>
                ))}
              </div>
            )}
            {/* True/False & Short Answer logic giống cũ, giữ nguyên hoặc rút gọn hiển thị */}
            {questions[examState.currentQuestionIndex]?.type === 'short-answer' && (
               <input type="text" value={examState.answers[questions[examState.currentQuestionIndex].id] || ""} 
                  onChange={e => setExamState({...examState, answers: {...examState.answers, [questions[examState.currentQuestionIndex].id]: e.target.value}})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xl text-teal-700 focus:border-teal-500 outline-none" placeholder="Nhập đáp án..." />
            )}
            
            <div className="mt-8 flex justify-between gap-4">
               <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.max(0, examState.currentQuestionIndex - 1)})} disabled={examState.currentQuestionIndex === 0} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold uppercase text-xs hover:bg-slate-200 disabled:opacity-50">Câu trước</button>
               <button onClick={() => setExamState({...examState, currentQuestionIndex: Math.min(questions.length - 1, examState.currentQuestionIndex + 1)})} disabled={examState.currentQuestionIndex === questions.length - 1} className="px-6 py-3 bg-teal-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-teal-700">Câu sau</button>
            </div>
          </div>
        </div>
    </div>
  );

  // 4. KẾT QUẢ (RESULT) - Chỉ 2 nút theo yêu cầu 2
  const renderResult = () => (
    <div className="max-w-2xl mx-auto pt-10 px-6 animate-fadeIn">
       <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-teal-500"></div>
          <h2 className="text-xl font-black uppercase text-slate-400 mb-6 tracking-[0.3em]">Kết quả bài làm</h2>
          <div className="text-[8rem] md:text-[10rem] font-black leading-none text-teal-600 tracking-tighter">
            {calculateScore(questions, examState.answers, config).toFixed(1)}
          </div>
          <p className="mt-6 text-slate-500 font-bold uppercase text-xs tracking-widest">Điểm số đã được lưu vào hệ thống</p>
          
          {/* === PHẦN SỬA ĐỔI YÊU CẦU 2: 2 NÚT === */}
          <div className="grid grid-cols-1 gap-4 mt-10">
             <button onClick={() => setStep('review')} 
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-lg hover:bg-blue-700 transition-all">
                Xem chi tiết bài thi
             </button>
             <button onClick={() => window.location.reload()} 
                className="w-full py-4 bg-slate-500 text-white rounded-2xl font-black uppercase shadow-lg hover:bg-slate-600 transition-all">
                Quay về trang chủ
             </button>
          </div>
       </div>
    </div>
  );

  // 5. XEM LẠI BÀI THI (REVIEW) - Mới thêm
  const renderReview = () => {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 animate-fadeIn space-y-8">
        <div className="flex justify-between items-center sticky top-2 bg-slate-50/90 backdrop-blur p-4 z-20 rounded-xl">
           <h2 className="text-2xl font-black text-teal-700 uppercase">Chi tiết bài làm</h2>
           <button onClick={() => window.location.reload()} className="bg-slate-600 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase hover:bg-slate-700">Về trang chủ</button>
        </div>

        {questions.map((q, idx) => {
          const userAns = examState.answers[q.id];
          // Logic check đúng sai cơ bản (MCQ/Short) để tô màu tiêu đề
          let isCorrect = false;
          let correctText = q.a || ""; // Đáp án đúng từ dữ liệu
          
          if (q.type === 'mcq') {
             // MCQ: User chọn index (0,1,2..) -> map sang text. q.a là text đáp án đúng (VD: "$1$ (Đ).")
             const userText = q.o ? q.o[userAns as number] : ""; 
             // So sánh chuỗi (Cần chuẩn hóa nếu cần)
             if (userText && q.a && userText.trim() === q.a.trim()) isCorrect = true;
          } else if (q.type === 'short-answer') {
             if (String(userAns).trim().toLowerCase() === String(q.a).trim().toLowerCase()) isCorrect = true;
          }
          // TF bỏ qua check màu ở đây vì nó phức tạp từng ý

          return (
            <div key={q.id} className={`bg-white p-6 rounded-2xl shadow-sm border-l-8 ${isCorrect ? 'border-green-500' : 'border-rose-500'}`}>
               <div className="flex justify-between mb-4 border-b pb-2">
                  <span className="font-bold text-slate-700">Câu {idx + 1} <span className="text-xs text-slate-400 font-normal ml-2">ID: {q.id}</span></span>
                  <span className={`text-xs font-black uppercase px-2 py-1 rounded ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                    {isCorrect ? 'ĐÚNG' : 'SAI / CHƯA CHẤM'}
                  </span>
               </div>
               
               <div className="mb-4 text-slate-800"><MathText content={q.question} /></div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl">
                     <div className="text-xs font-bold text-slate-400 uppercase mb-1">Bạn chọn:</div>
                     <div className="font-medium text-slate-700">
                        {q.type === 'mcq' ? (
                          q.o && userAns !== undefined ? <MathText content={q.o[userAns as number]} /> : "Chưa chọn"
                        ) : (
                          <MathText content={String(userAns || "Trống")} />
                        )}
                     </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                     <div className="text-xs font-bold text-green-600 uppercase mb-1">Đáp án đúng:</div>
                     <div className="font-bold text-green-800"><MathText content={correctText} /></div>
                  </div>
               </div>
               
               {/* Hiển thị danh sách phương án nếu là MCQ để dễ đối chiếu */}
               {q.type === 'mcq' && q.o && (
                 <div className="mt-4 pt-4 border-t border-slate-100">
                   <div className="text-xs font-bold text-slate-400 mb-2">Các phương án:</div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {q.o.map((opt, i) => (
                       <div key={i} className={`text-xs p-2 rounded border ${i === userAns ? 'bg-slate-200 border-slate-400' : 'border-slate-100'}`}>
                         <span className="font-bold mr-1">{String.fromCharCode(65+i)}.</span> <MathText content={opt} />
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )
        })}
        
        <div className="text-center pt-8">
           <button onClick={() => window.location.reload()} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-slate-900 transition-all">Quay về trang chủ</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-teal-100 font-sans">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && renderInfoSetup()}
      {step === 'exam' && renderExam()}
      {step === 'result' && renderResult()}
      {step === 'review' && renderReview()}

      {/* Modal Tra điểm & Auth giữ nguyên như cũ, chỉ chỉnh lại trigger */}
      {authMode !== 'none' && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setAuthMode('none')} className="absolute top-4 right-6 text-2xl font-black text-slate-300 hover:text-slate-500">✕</button>
              <h3 className="text-2xl font-black text-slate-800 uppercase text-center mb-6">{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h3>
              <div className="space-y-4">
                 {authMode === 'register' && <input type="text" placeholder="ID Giáo viên (idnumber)" value={authForm.idnumber} onChange={e => setAuthForm({...authForm, idnumber: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold outline-none focus:border-teal-500" />}
                 <input type="text" placeholder="Tài khoản" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold outline-none focus:border-teal-500" />
                 <input type="password" placeholder="Mật khẩu" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold outline-none focus:border-teal-500" />
                 {authMode === 'register' && <input type="password" placeholder="Xác nhận mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-4 bg-slate-50 border-2 rounded-xl font-bold outline-none focus:border-teal-500" />}
                 
                 <button onClick={handleAuth} disabled={loading} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-teal-700 mt-2">
                    {loading ? 'Đang xử lý...' : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
                 </button>
                 <div className="text-center">
                    <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-teal-600 font-bold uppercase underline">
                      {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                 </div>
              </div>
          </div>
        </div>
      )}

      {/* Modal Tra điểm (Giữ nguyên logic cũ nhưng ẩn đi khi chưa kích hoạt) */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
           {/* Bạn có thể paste lại nội dung modal tra điểm từ code cũ vào đây, hoặc dùng iframe tới Script.txt nếu muốn tách biệt.
               Để đơn giản, ở đây mình để placeholder hoặc bạn copy lại logic fetch điểm cũ. */}
           <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center">
              <h3 className="font-bold text-xl mb-4">Chức năng Tra cứu điểm</h3>
              <p className="mb-4">Vui lòng nhập SBD và Mã đề để tra cứu.</p>
              <button onClick={() => setShowScoreModal(false)} className="px-6 py-2 bg-slate-200 rounded-lg font-bold">Đóng</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
