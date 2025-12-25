import React, { useState, useEffect } from 'react';
import { 
  Question, ExamConfig, StudentInfo, ExamState
} from './types';
import { 
  GRADES, CLASSES_LIST, MAX_VIOLATIONS, EXAM_CODES, DEFAULT_API_URL, API_ROUTING 
} from './constants';
import { generateExam, generateExamFromMatrix, calculateScore, MatrixConfig } from './services/examEngine';
import MathText from './components/MathText';

// --- CẤU HÌNH LINK NGOÀI ---
const LINKS = {
  MATH: "https://admintoanhoc.vercel.app/",
  APP: "https://forms.gle/q8J4FQEFYDfhVung7"
};

const App: React.FC = () => {
  // --- STATE ---
  const [step, setStep] = useState<'entry' | 'info_setup' | 'exam' | 'result' | 'review'>('entry');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'none'>('none');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [activeGrade, setActiveGrade] = useState<number>(12); // Mặc định khối 12
  
  const [authForm, setAuthForm] = useState({ idnumber: '', account: '', pass: '', confirmPass: '' });
  const [remoteMatrix, setRemoteMatrix] = useState<MatrixConfig | null>(null);

  const [config, setConfig] = useState<ExamConfig>({
    grade: 12, topics: [], duration: 45,
    numMC: 12, scoreMC: 0, mcL3: 0, mcL4: 0,
    numTF: 4, scoreTF: 0, tfL3: 0, tfL4: 0,
    numSA: 6, scoreSA: 0, saL3: 0, saL4: 0
  });

  const [student, setStudent] = useState<StudentInfo>({
    fullName: '', studentClass: 'Tự do', idNumber: '', examCode: '', phoneNumber: '', isVerified: false, isLoggedIn: false, limitTab: MAX_VIOLATIONS
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  const isMatrixExam = EXAM_CODES[config.grade]?.find(c => c.code === student.examCode)?.topics === 'matrix';

  // --- HÀM GỌI API (Dynamic URL theo ID Giáo viên) ---
  const callGAS = async (params: string, body: any = null) => {
    // Tự động chọn Link Sheet dựa trên ID Giáo viên nhập vào
    const cleanID = student.idNumber ? student.idNumber.trim() : "";
    // Nếu chưa nhập ID (lúc đăng nhập), dùng ID trong form auth
    const targetID = cleanID || authForm.idnumber.trim();
    
    const url = API_ROUTING[targetID] || DEFAULT_API_URL;
    
    const opt: any = { method: body ? 'POST' : 'GET' };
    if (body) {
      opt.body = JSON.stringify(body);
      opt.headers = { 'Content-Type': 'text/plain' };
    }

    try {
      const res = await fetch(`${url}?${params}`, opt);
      return await res.json();
    } catch (e) {
      console.error(e);
      return { status: 'error', message: 'Lỗi kết nối Server! Kiểm tra ID bản quyền hoặc Mạng.' };
    }
  };

  // --- TIMER ---
  useEffect(() => {
    let timer: any;
    if (step === 'exam' && examState.timeLeft > 0 && !examState.isFinished) {
      timer = setInterval(() => {
        setExamState(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            finishExam(); // Hết giờ tự nộp
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, examState.timeLeft, examState.isFinished]);

  // --- AUTH HANDLER (Đăng nhập/Đăng ký) ---
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
    // Truyền tham số vào URL
    const params = `action=${action}&account=${encodeURIComponent(authForm.account)}&pass=${encodeURIComponent(authForm.pass)}&idnumber=${encodeURIComponent(authForm.idnumber)}`;
    
    try {
      // Dùng hàm callGAS để tự định tuyến đúng Sheet
      // Lưu ý: Lúc này student.idNumber chưa có, nên callGAS sẽ dùng authForm.idnumber để tìm link
      const data = await callGAS(params);

      if (data.status === 'success') {
        if (action === 'register') {
          alert(`Đăng ký thành công cho ${data.name}! Mời bạn đăng nhập.`);
          setAuthMode('login');
        } else {
          setStudent({
            ...student, fullName: data.name, studentClass: data.class, idNumber: data.sbd || authForm.idnumber, // Lưu IDGV vào idNumber để dùng sau này
            isVerified: true, isLoggedIn: true, limitTab: data.limittab || MAX_VIOLATIONS
          });
          setAuthMode('none');
          alert(`Xin chào ${data.name}!`);
        }
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ!");
    } finally {
      setLoading(false);
    }
  };

  // --- VERIFY SBD (Dành cho thi Matrix không cần đăng nhập App) ---
  const verifySBD = async () => {
    if (student.isLoggedIn) return;
    if (!student.idNumber.trim()) { alert("Vui lòng nhập ID Giáo viên & SBD!"); return; }
    
    // Yêu cầu nhập thêm SBD vào 1 ô input nào đó, ở đây ta giả định idNumber chứa IDGV, cần thêm logic SBD
    // Tuy nhiên theo logic cũ: idNumber đang dùng chung. Để đơn giản, ta chỉ check khi vào thi.
    alert("Vui lòng chọn Mã đề và nhấn 'Vào thi' để hệ thống kiểm tra SBD.");
  };

  // --- LẤY ĐỀ THI ---
  const handleEntryNext = async () => {
    if (!student.examCode) { alert("Vui lòng chọn mã đề!"); return; }

    // Nếu là chế độ Matrix (Thi online)
    if (isMatrixExam) {
      // Cần check kỹ thông tin trước khi lấy đề
      if (!student.idNumber) { alert("Vui lòng nhập ID Bản quyền (ID Giáo viên)!"); return; }

      setLoading(true);
      try {
        // 1. Nếu chưa đăng nhập, gọi checkUserInfo để xác thực SBD và Limit
        if (!student.isLoggedIn) {
            // Cần SBD, Account (nếu có yêu cầu). Ở chế độ SBD public, ta cần trường SBD.
            // Để đơn giản, ta sẽ yêu cầu nhập SBD ở bước info_setup
        }

        // 2. Lấy cấu hình ma trận
        const data = await callGAS(`action=getExamData&code=${student.examCode}`);
        if (data.status === 'success') {
           setRemoteMatrix(data.matrix);
           setStep('info_setup');
        } else {
           alert(data.message);
        }
      } catch (e) {
        alert("Lỗi tải đề thi! Kiểm tra lại Mã đề hoặc ID Giáo viên.");
      } finally {
        setLoading(false);
      }
    } else {
      // Thi tự do
      setRemoteMatrix(null);
      setStep('info_setup');
    }
  };

  // --- BẮT ĐẦU LÀM BÀI ---
  const handleStartExam = async () => {
    // Nếu thi Matrix, cần check SBD/Limit lần cuối
    if (isMatrixExam) {
       if (!student.idNumber) { alert("Thiếu ID Giáo viên!"); return; }
       if (!student.isLoggedIn) {
          // Nếu chưa đăng nhập, bắt buộc phải có SBD nhập ở bước Info
          const sbdInput = document.getElementById('sbd_input') as HTMLInputElement;
          const sbd = sbdInput?.value;
          if (!sbd) { alert("Vui lòng nhập Số Báo Danh!"); return; }
          
          setLoading(true);
          // Gọi API check SBD & Limit
          const check = await callGAS(`action=checkUserInfo&idnumber=${student.idNumber}&sbd=${sbd}&code=${student.examCode}`);
          setLoading(false);
          
          if (check.status !== 'success') {
             alert(check.message); 
             return;
          }
          // Update info
          setStudent(prev => ({...prev, fullName: check.name, studentClass: check.class, limitTab: check.limittab, idNumber: student.idNumber /*Keep IDGV*/ }));
       }
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

  // --- NỘP BÀI ---
  const finishExam = () => {
    const finalScore = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    setExamState(prev => ({ ...prev, isFinished: true, finishTime }));
    setStep('result');
    
    const durSec = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const timeStr = `${Math.floor(durSec / 60)}p ${durSec % 60}s`;

    // Gửi kết quả (chỉ gửi nếu thi Matrix hoặc có SBD)
    if (isMatrixExam || student.isLoggedIn) {
        // Lưu ý: student.idNumber ở đây phải là ID Giáo viên để định tuyến
        // SBD thực sự của học sinh có thể cần lưu riêng hoặc lấy từ form
        // Ở đây giả định user đã nhập SBD vào field nào đó hoặc dùng sbd từ checkUserInfo
        const sbdReal = student.isLoggedIn ? student.idNumber : (document.getElementById('sbd_input') as HTMLInputElement)?.value || "FREE";
        
        callGAS('', {
           action: 'saveResult',
           makiemtra: student.examCode,
           sbd: sbdReal,
           name: student.fullName,
           class: student.studentClass,
           tongdiem: finalScore,
           time: timeStr,
           detail: JSON.stringify(examState.answers)
        });
    }
  };

  // --- RENDER 1: TRANG CHỦ (ENTRY) ---
  const renderEntry = () => (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pt-6 animate-fadeIn">
      
      {/* HEADER & TITLE */}
      <header className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-teal-600 uppercase tracking-tighter">RA ĐỀ ONLINE</h1>
        <p className="text-slate-500 font-bold text-xs md:text-sm tracking-widest">Hệ thống thi trắc nghiệm & Tự luận</p>
        <p className="text-slate-400 text-[10px] italic">Tác giả: Nguyễn Văn Hà - THPT Yên Dũng số 2</p>
      </header>
      
      {/* === 4 NÚT CHỨC NĂNG (YÊU CẦU 1) === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <a href={LINKS.MATH} target="_blank" rel="noreferrer" 
             className="flex items-center justify-center px-2 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md uppercase text-[11px] hover:bg-blue-700 hover:shadow-lg transition-all text-center h-12">
             Đăng ký học Toán
          </a>
          <a href={LINKS.APP} target="_blank" rel="noreferrer" 
             className="flex items-center justify-center px-2 py-3 bg-yellow-500 text-white rounded-xl font-bold shadow-md uppercase text-[11px] hover:bg-yellow-600 hover:shadow-lg transition-all text-center h-12">
             Đăng ký dùng App
          </a>
          <button onClick={() => setShowScoreModal(true)} 
             className="flex items-center justify-center px-2 py-3 bg-white text-teal-600 border-2 border-teal-500 rounded-xl font-bold shadow-md uppercase text-[11px] hover:bg-teal-50 transition-all text-center h-12">
             Xem điểm thi
          </button>
          {student.isLoggedIn ? (
             <button onClick={() => setStudent({...student, isLoggedIn: false, fullName: '', isVerified: false})} 
                className="flex items-center justify-center px-2 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-md uppercase text-[11px] hover:bg-rose-600 transition-all text-center h-12">
                Đăng xuất ({student.fullName})
             </button>
          ) : (
             <button onClick={() => setAuthMode('login')} 
                className="flex items-center justify-center px-2 py-3 bg-green-600 text-white rounded-xl font-bold shadow-md uppercase text-[11px] hover:bg-green-700 transition-all text-center h-12">
                Đăng nhập / Đăng ký
             </button>
          )}
      </div>

      {/* CHỌN KHỐI & ĐỀ */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 space-y-6">
        {/* Chọn Khối - Giao diện Tab */}
        <div className="flex justify-center gap-2 bg-slate-100 p-1.5 rounded-xl">
          {GRADES.map(g => (
            <button key={g} onClick={() => { setConfig({...config, grade: g}); setActiveGrade(g); }} 
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${config.grade === g ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              Khối {g}
            </button>
          ))}
        </div>

        {/* Danh sách Mã đề */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          {EXAM_CODES[config.grade]?.map(def => (
            <button key={def.code} onClick={() => setStudent({...student, examCode: def.code})} 
              className={`p-4 text-left rounded-xl border-2 transition-all group ${student.examCode === def.code ? 'border-teal-500 bg-teal-50' : 'border-slate-100 hover:border-teal-200'}`}>
              <div className="flex justify-between items-start">
                 <div>
                    <div className="font-bold text-slate-700 group-hover:text-teal-700">{def.code}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">{def.topics === 'matrix' ? 'Đề thi Online' : 'Luyện tập'}</div>
                 </div>
                 {student.examCode === def.code && <div className="text-teal-500">●</div>}
              </div>
            </button>
          ))}
        </div>

        {/* Input ID Giáo viên nếu là Matrix */}
        {student.examCode && isMatrixExam && (
            <div className="animate-fadeIn">
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">Nhập ID Bản quyền (Giáo viên)</label>
                <input type="text" value={student.idNumber} onChange={e => setStudent({...student, idNumber: e.target.value})} 
                   className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-teal-500 outline-none" placeholder="VD: GV_HA_BACNINH" />
            </div>
        )}

        <button onClick={handleEntryNext} disabled={loading} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black text-lg uppercase shadow-lg hover:bg-teal-700 active:scale-95 transition-all">
          {loading ? 'Đang tải dữ liệu...' : 'TIẾP TỤC'}
        </button>
      </div>
    </div>
  );

  // --- RENDER 2: NHẬP THÔNG TIN (INFO SETUP) ---
  const renderInfoSetup = () => (
    <div className="max-w-xl mx-auto p-6 animate-fadeIn pt-10">
      <button onClick={() => setStep('entry')} className="mb-4 font-bold text-slate-400 uppercase text-xs hover:text-teal-600 flex items-center gap-1">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Quay lại
      </button>
      
      <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 space-y-6">
        <h2 className="text-2xl font-black text-teal-700 uppercase text-center border-b pb-4">Xác nhận thông tin</h2>
        
        {student.isLoggedIn ? (
           <div className="space-y-4">
             <div className="p-4 bg-teal-50 rounded-xl border border-teal-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-200 text-teal-700 rounded-full flex items-center justify-center font-black text-xl">
                    {student.fullName.charAt(0)}
                </div>
                <div>
                    <div className="font-bold text-slate-800 text-lg">{student.fullName}</div>
                    <div className="text-slate-500 text-xs uppercase font-bold">Lớp: {student.studentClass}</div>
                </div>
             </div>
             <p className="text-center text-sm text-slate-500">Bạn đang đăng nhập. Kết quả sẽ được lưu vào tài khoản.</p>
           </div>
        ) : isMatrixExam ? (
          <div className="space-y-4">
            <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Số Báo Danh</label>
               <input id="sbd_input" type="text" className="w-full p-4 rounded-xl border-2 font-bold outline-none focus:border-teal-500 bg-slate-50 text-xl text-center uppercase" placeholder="Nhập SBD..." />
            </div>
            <p className="text-xs text-slate-400 text-center px-4">Hệ thống sẽ kiểm tra SBD và số lần làm bài khi bạn nhấn nút bên dưới.</p>
          </div>
        ) : (
          <div className="space-y-4">
             <input type="text" value={student.fullName} onChange={e => setStudent({...student, fullName: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold bg-slate-50 focus:border-teal-500" placeholder="Họ và Tên..." />
             <select value={student.studentClass} onChange={e => setStudent({...student, studentClass: e.target.value})} className="w-full p-4 rounded-xl border-2 font-bold bg-slate-50 focus:border-teal-500">
               {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
        )}

        <button onClick={handleStartExam} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black uppercase text-lg shadow-xl hover:bg-teal-700 transition-all mt-4">
           VÀO THI NGAY
        </button>
      </div>
    </div>
  );

  // --- RENDER 3: LÀM BÀI (EXAM) ---
  const renderExam = () => (
     <ExamInterface 
        questions={questions} 
        answers={examState.answers} 
        setAnswers={(ans: any) => setExamState({...examState, answers: ans})}
        currentIdx={examState.currentQuestionIndex}
        setIdx={(i: number) => setExamState({...examState, currentQuestionIndex: i})}
        timeLeft={examState.timeLeft}
        examCode={student.examCode}
        onSubmit={() => { if(confirm("Nộp bài?")) finishExam(); }}
     />
  );

  // --- RENDER 4: KẾT QUẢ (RESULT) - YÊU CẦU 2 (2 NÚT) ---
  const renderResult = () => (
    <div className="max-w-xl mx-auto pt-10 px-6 animate-fadeIn">
       <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-50 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-teal-400 to-blue-500"></div>
          
          <h2 className="text-lg font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">Kết quả bài thi</h2>
          
          <div className="relative inline-block">
             <div className="text-[6rem] md:text-[8rem] font-black leading-none text-teal-600 tracking-tighter drop-shadow-sm">
                {calculateScore(questions, examState.answers, config).toFixed(2)}
             </div>
             <div className="absolute -right-4 top-4 text-2xl font-black text-slate-300">/10</div>
          </div>
          
          <div className="mt-8 space-y-2">
             <div className="font-bold text-slate-700 text-xl">{student.fullName || "Thí sinh tự do"}</div>
             <div className="text-sm text-slate-400 font-medium">{student.examCode} • {new Date().toLocaleDateString()}</div>
          </div>

          {/* === 2 NÚT CHỨC NĂNG === */}
          <div className="grid grid-cols-1 gap-4 mt-10">
             <button onClick={() => setStep('review')} 
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-lg hover:bg-blue-700 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                Xem chi tiết bài thi
             </button>
             <button onClick={() => window.location.reload()} 
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                Về trang chủ
             </button>
          </div>
       </div>
    </div>
  );

  // --- RENDER 5: XEM LẠI (REVIEW) ---
  const renderReview = () => (
     <ReviewInterface questions={questions} answers={examState.answers} />
  );

  // --- MAIN RETURN ---
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-teal-100 font-sans text-slate-800">
      {step === 'entry' && renderEntry()}
      {step === 'info_setup' && renderInfoSetup()}
      {step === 'exam' && renderExam()}
      {step === 'result' && renderResult()}
      {step === 'review' && renderReview()}

      {/* MODAL LOGIN / REGISTER */}
      {authMode !== 'none' && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setAuthMode('none')} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full font-bold text-slate-400 hover:bg-slate-200">✕</button>
              <h3 className="text-xl font-black text-slate-800 uppercase text-center mb-6">{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h3>
              <div className="space-y-3">
                 {authMode === 'register' && (
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">ID Giáo viên (Bắt buộc)</label>
                        <input type="text" value={authForm.idnumber} onChange={e => setAuthForm({...authForm, idnumber: e.target.value})} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none focus:border-teal-500" placeholder="VD: GV_HA_BACNINH" />
                    </div>
                 )}
                 <input type="text" placeholder="Tài khoản" value={authForm.account} onChange={e => setAuthForm({...authForm, account: e.target.value})} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none focus:border-teal-500" />
                 <input type="password" placeholder="Mật khẩu" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none focus:border-teal-500" />
                 {authMode === 'register' && <input type="password" placeholder="Xác nhận mật khẩu" value={authForm.confirmPass} onChange={e => setAuthForm({...authForm, confirmPass: e.target.value})} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none focus:border-teal-500" />}
                 
                 <button onClick={handleAuth} disabled={loading} className="w-full py-3 bg-teal-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-teal-700 mt-2 text-sm">
                    {loading ? 'Đang xử lý...' : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
                 </button>
                 <div className="text-center pt-2">
                    <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-teal-600 font-bold uppercase underline">
                      {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                 </div>
              </div>
          </div>
        </div>
      )}

      {/* MODAL TRA ĐIỂM */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl relative">
              <button onClick={() => setShowScoreModal(false)} className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold hover:bg-slate-200">✕</button>
              <h3 className="font-black text-xl mb-4 text-teal-700 uppercase">Tra cứu điểm thi</h3>
              <p className="mb-4 text-sm text-slate-500">Chức năng đang được cập nhật...</p>
              <button onClick={() => setShowScoreModal(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">Đóng</button>
           </div>
        </div>
      )}
    </div>
  );
};

// --- SUB COMPONENTS (ĐỊNH NGHĨA TRONG CÙNG FILE ĐỂ TRÁNH LỖI IMPORT) ---

// 1. Giao diện Làm bài
const ExamInterface = ({ questions, answers, setAnswers, currentIdx, setIdx, timeLeft, examCode, onSubmit }: any) => {
  const q = questions[currentIdx];
  if (!q) return <div>Đang tải...</div>;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 animate-fadeIn pb-20">
       <header className="max-w-5xl mx-auto w-full flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-lg border border-slate-100 sticky top-2 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 text-white rounded-lg flex items-center justify-center font-bold text-xl shadow">{currentIdx + 1}</div>
            <div className="hidden sm:block">
               <div className="text-xs font-bold text-slate-400 uppercase">Câu hỏi</div>
               <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">/ {questions.length}</div>
            </div>
          </div>
          <div className={`text-3xl font-black font-mono tracking-tighter ${timeLeft < 120 ? 'text-rose-600 animate-pulse' : 'text-teal-600'}`}>
            {Math.floor(timeLeft/60).toString().padStart(2,'0')}:{(timeLeft%60).toString().padStart(2,'0')}
          </div>
          <button onClick={onSubmit} className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-xs shadow hover:bg-rose-700 hover:shadow-rose-500/30 transition-all">Nộp bài</button>
       </header>
       
       <div className="flex-1 max-w-5xl mx-auto w-full">
          <div className="bg-white p-6 md:p-10
