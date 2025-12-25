import React, { useState, useEffect } from 'react';
// Import các type (bạn tự define trong types.ts nhé, hoặc lấy từ code cũ)
import { Question, ExamConfig, StudentInfo, ExamState } from './types'; 
import { DEFAULT_API_URL } from './constants';
import { generateExamFromMatrix, calculateScore, MatrixConfig } from './services/examEngine';
import MathText from './components/MathText'; // Giả sử bạn đã có component này để render Latex

const App: React.FC = () => {
  // --- STATE ---
  const [step, setStep] = useState<'entry' | 'info_setup' | 'exam' | 'result'>('entry');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'none'>('none');
  
  // Dữ liệu User & Form
  const [authForm, setAuthForm] = useState({ idnumber: '', account: '', pass: '', confirmPass: '' });
  const [student, setStudent] = useState<StudentInfo>({ 
      fullName: '', studentClass: '', idNumber: '', examCode: '', 
      isVerified: false, isLoggedIn: false, limitTab: 2 
  });

  // Dữ liệu Đề thi
  const [questions, setQuestions] = useState<Question[]>([]);
  const [config, setConfig] = useState<ExamConfig>({ duration: 45 } as any);
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0, answers: {}, timeLeft: 0, violations: 0, isFinished: false, startTime: new Date()
  });

  // --- XỬ LÝ AUTH (LOGIN/REGISTER) ---
  const handleAuth = async () => {
    setLoading(true);
    try {
      // Gọi API GAS
      const params = authMode === 'login' 
        ? `action=login&account=${authForm.account}&pass=${authForm.pass}`
        : `action=register&idnumber=${authForm.idnumber}&account=${authForm.account}&pass=${authForm.pass}`;
      
      const res = await fetch(`${DEFAULT_API_URL}?${params}`);
      const data = await res.json();

      if (data.status === 'success') {
        if (authMode === 'login') {
          setStudent({ 
             ...student, isLoggedIn: true, isVerified: true, 
             fullName: data.name, idNumber: data.sbd, 
             studentClass: data.class, limitTab: data.limittab 
          });
          setAuthMode('none');
        } else {
          alert("Đăng ký thành công! Hãy đăng nhập.");
          setAuthMode('login');
        }
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert("Lỗi kết nối!");
    } finally {
      setLoading(false);
    }
  };

  // --- XỬ LÝ LẤY ĐỀ THI (Bước quan trọng nhất) ---
  const handleGetExam = async () => {
    if (!student.examCode) { alert("Nhập mã đề!"); return; }
    setLoading(true);

    try {
      // 1. Lấy cấu hình từ Google Sheet
      const res = await fetch(`${DEFAULT_API_URL}?action=getExamData&code=${student.examCode}`);
      const data = await res.json();

      if (data.status === 'success') {
        const matrix: MatrixConfig = data.matrix;
        
        // 2. Trộn đề từ Local Data (questions.ts) dựa trên config
        const generatedQuestions = generateExamFromMatrix(matrix);

        if (generatedQuestions.length === 0) {
          alert("Lỗi: Không tìm thấy câu hỏi phù hợp trong dữ liệu!");
        } else {
          setQuestions(generatedQuestions);
          setConfig(prev => ({ ...prev, duration: matrix.duration }));
          setStep('info_setup'); // Chuyển sang màn hình xác nhận
        }
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi tải đề! Kiểm tra mã đề hoặc mạng.");
    } finally {
      setLoading(false);
    }
  };

  // --- BẮT ĐẦU THI ---
  const startExam = () => {
    setExamState({
      currentQuestionIndex: 0, answers: {}, violations: 0, isFinished: false,
      timeLeft: config.duration * 60, startTime: new Date()
    });
    setStep('exam');
  };

  // --- NỘP BÀI (Hybrid: Tính điểm local -> Gửi server) ---
  const finishExam = async () => {
    // 1. Tính điểm
    const score = calculateScore(questions, examState.answers, config);
    const finishTime = new Date();
    const durationSec = Math.floor((finishTime.getTime() - examState.startTime.getTime()) / 1000);
    const timeString = `${Math.floor(durationSec / 60)}p ${durationSec % 60}s`;

    setExamState(prev => ({ ...prev, isFinished: true }));
    setLoading(true);

    try {
      // 2. Gửi kết quả về Sheet (Dùng POST)
      const payload = {
        action: 'saveResult',
        makiemtra: student.examCode,
        sbd: student.idNumber,
        name: student.fullName,
        class: student.studentClass,
        tongdiem: score,
        time: timeString,
        detail: JSON.stringify(examState.answers)
      };

      // fetch POST text/plain để tránh preflight option
      await fetch(DEFAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      alert(`Nộp bài thành công! Điểm: ${score}`);
    } catch (e) {
      alert(`Đã có lỗi mạng khi lưu, nhưng điểm của bạn là: ${score}`);
    } finally {
      setStep('result');
      setLoading(false);
    }
  };

  // --- UI RENDER (Rút gọn cho ngắn, bạn chèn style tùy ý) ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      {/* HEADER */}
      <header className="mb-6 bg-white p-4 shadow rounded flex justify-between items-center">
        <h1 className="font-bold text-xl text-teal-700">HỆ THỐNG THI ONLINE</h1>
        {student.isLoggedIn && <div className="text-sm">Xin chào, <b>{student.fullName}</b></div>}
      </header>

      {/* BODY */}
      <main className="max-w-3xl mx-auto bg-white p-6 shadow-lg rounded-xl">
        {loading && <div className="text-center text-teal-600 font-bold">Đang xử lý...</div>}
        
        {/* Màn 1: ENTRY & LOGIN */}
        {step === 'entry' && (
          <div className="space-y-4">
             {authMode === 'none' && !student.isLoggedIn ? (
               <div className="text-center space-y-3">
                 <h2 className="text-lg font-bold">Bạn chưa đăng nhập</h2>
                 <button onClick={() => setAuthMode('login')} className="bg-teal-600 text-white px-6 py-2 rounded">Đăng nhập ngay</button>
               </div>
             ) : authMode !== 'none' ? (
               // Form Login/Register
               <div className="flex flex-col gap-3">
                  <h3 className="font-bold text-center">{authMode === 'login' ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ'}</h3>
                  {authMode === 'register' && <input placeholder="ID Bản Quyền" value={authForm.idnumber} onChange={e=>setAuthForm({...authForm, idnumber: e.target.value})} className="border p-2 rounded"/>}
                  <input placeholder="Tài khoản" value={authForm.account} onChange={e=>setAuthForm({...authForm, account: e.target.value})} className="border p-2 rounded"/>
                  <input type="password" placeholder="Mật khẩu" value={authForm.pass} onChange={e=>setAuthForm({...authForm, pass: e.target.value})} className="border p-2 rounded"/>
                  <button onClick={handleAuth} className="bg-blue-600 text-white p-2 rounded">Xác nhận</button>
                  <button onClick={() => setAuthMode('none')} className="text-sm underline">Quay lại</button>
               </div>
             ) : (
               // Đã đăng nhập -> Nhập mã đề
               <div className="text-center space-y-4">
                 <p>SBD: {student.idNumber} | Lớp: {student.studentClass}</p>
                 <input 
                    placeholder="Nhập mã đề thi (VD: DE01)" 
                    value={student.examCode} 
                    onChange={e => setStudent({...student, examCode: e.target.value})}
                    className="border-2 border-teal-500 p-3 rounded-lg w-full text-center text-xl font-bold uppercase"
                 />
                 <button onClick={handleGetExam} className="bg-teal-600 text-white px-8 py-3 rounded-lg font-bold">LẤY ĐỀ THI</button>
               </div>
             )}
          </div>
        )}

        {/* Màn 2: INFO SETUP (Chuẩn bị vào thi) */}
        {step === 'info_setup' && (
           <div className="text-center space-y-4">
             <h2 className="text-2xl font-bold text-teal-700">Đề thi đã sẵn sàng!</h2>
             <p>Số lượng câu hỏi: <b>{questions.length}</b></p>
             <p>Thời gian làm bài: <b>{config.duration} phút</b></p>
             <button onClick={startExam} className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold text-xl animate-pulse">BẮT ĐẦU LÀM BÀI</button>
           </div>
        )}

        {/* Màn 3: EXAM (Làm bài) */}
        {step === 'exam' && (
          <div>
            {/* Thanh thời gian */}
            <div className="sticky top-0 bg-gray-800 text-white p-2 text-center rounded mb-4 z-50">
               Thời gian còn lại: {Math.floor(examState.timeLeft / 60)}:{String(examState.timeLeft % 60).padStart(2,'0')}
               {/* Note: Bạn cần thêm useEffect để giảm timeLeft mỗi giây */}
            </div>

            {/* Render câu hỏi */}
            <div className="space-y-8">
              {questions.map((q, idx) => (
                <div key={q.id} className="border-b pb-4">
                  <div className="font-bold text-blue-800 mb-2">Câu {idx + 1}: <MathText text={q.question} /></div>
                  <div className="ml-2 space-y-2">
                    {/* Render Option dựa vào q.type (MCQ/TF/Short) - Bạn tự fill phần này từ code cũ nhé vì nó khá dài */}
                    {q.type === 'mcq' && q.o?.map(opt => (
                       <label key={opt} className="block cursor-pointer">
                          <input 
                             type="radio" 
                             name={`q-${q.id}`} 
                             onChange={() => setExamState(prev => ({...prev, answers: {...prev.answers, [q.id]: opt}}))}
                          /> <MathText text={opt} />
                       </label>
                    ))}
                    {q.type === 'short-answer' && (
                        <input 
                            type="text" 
                            className="border p-2 w-full rounded" 
                            placeholder="Nhập đáp án..."
                            onBlur={(e) => setExamState(prev => ({...prev, answers: {...prev.answers, [q.id]: e.target.value}}))}
                        />
                    )}
                    {/* ... Thêm phần True/False tương tự ... */}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={finishExam} className="mt-8 w-full bg-green-600 text-white py-4 rounded font-bold text-xl">NỘP BÀI</button>
          </div>
        )}

        {/* Màn 4: RESULT */}
        {step === 'result' && (
           <div className="text-center">
             <h2 className="text-3xl font-bold text-green-600">Hoàn thành bài thi!</h2>
             <p className="mt-4">Kết quả đã được lưu vào hệ thống.</p>
             <button onClick={() => window.location.reload()} className="mt-6 bg-gray-500 text-white px-6 py-2 rounded">Thoát</button>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
