import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, CheckCircle, AlertTriangle, AlertCircle, Camera, RefreshCw, 
  RotateCw, ArrowRight, ShieldCheck, Clock, Calendar, Check,
  Sparkles, X, ChevronRight, Info, HeartPulse
} from 'lucide-react';

interface Teacher {
  id: string;
  name: string;
  nip: string;
  subject?: string;
  status?: string;
  phone?: string;
  email?: string;
}

interface Attendance {
  id?: string;
  teacherId: string;
  teacherName: string;
  teacherNip: string;
  meeting: string;
  status: 'Hadir' | 'Izin' | 'Sakit';
  note?: string;
  photoUrl?: string | null;
  date: string;
  time: string;
}

interface TeacherMobilePortalProps {
  teachers: Teacher[];
  attendances: Attendance[];
  onRecordAttendance: (data: {
    teacherId: string;
    meeting: string;
    status: 'Hadir' | 'Izin' | 'Sakit';
    note: string;
    photoUrl: string | null;
    manualName?: string;
    manualNip?: string;
    manualSubject?: string;
  }) => Promise<{ success: boolean; message: string; receipt?: any }>;
  onSwitchToAdmin: () => void;
}

export default function TeacherMobilePortal({
  teachers,
  attendances,
  onRecordAttendance,
  onSwitchToAdmin
}: TeacherMobilePortalProps) {
  // Input Mode: 'select' (Pilih dari daftar) atau 'manual' (Ketik nama sendiri jika belum terdaftar)
  const [inputMode, setInputMode] = useState<'select' | 'manual'>(() => {
    return teachers.length > 0 ? 'select' : 'manual';
  });
  const [manualName, setManualName] = useState('');
  const [manualNip, setManualNip] = useState('');
  const [manualSubject, setManualSubject] = useState('');

  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState('1');
  const [status, setStatus] = useState<'Hadir' | 'Izin' | 'Sakit'>('Hadir');
  const [note, setNote] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Submission & Receipt state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    teacherName: string;
    teacherNip: string;
    meeting: string;
    status: string;
    date: string;
    time: string;
    photoUrl: string | null;
    note?: string;
  } | null>(null);

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  // Filter today's attendances for selected teacher
  const todayStr = currentTime.toLocaleDateString('id-ID');
  const teacherTodayAttendances = attendances.filter(
    a => a.teacherId === selectedTeacherId && a.date === todayStr
  );

  // Camera handling
  const startCamera = async (mode = facingMode) => {
    setIsCameraLoading(true);
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Kamera tidak dapat diakses secara langsung. Anda dapat menggunakan tombol 'Ambil Foto Selfie' untuk memilih dari kamera HP.");
      setIsCameraActive(false);
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const size = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
          setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (inputMode === 'select') {
      if (!selectedTeacherId) {
        setErrorMessage("Silakan pilih nama Anda dalam daftar guru terlebih dahulu!");
        return;
      }
    } else {
      if (!manualName.trim()) {
        setErrorMessage("Silakan ketik nama lengkap Anda terlebih dahulu!");
        return;
      }
    }

    if (status === 'Hadir' && !capturedPhoto) {
      setErrorMessage("Harap ambil foto selfie terlebih dahulu sebagai bukti kehadiran fisik Anda.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onRecordAttendance({
        teacherId: inputMode === 'select' ? selectedTeacherId : 'manual',
        meeting: selectedMeeting,
        status,
        note: note.trim(),
        photoUrl: capturedPhoto,
        manualName: inputMode === 'manual' ? manualName.trim() : undefined,
        manualNip: inputMode === 'manual' ? manualNip.trim() : undefined,
        manualSubject: inputMode === 'manual' ? manualSubject.trim() : undefined
      });

      if (res.success && res.receipt) {
        setSubmittedReceipt(res.receipt);
        stopCamera();
      } else {
        setErrorMessage(res.message || "Gagal merekam absensi. Silakan coba lagi.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menghubungkan ke sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNext = () => {
    setSubmittedReceipt(null);
    setCapturedPhoto(null);
    setNote('');
    // increment session if between 1 and 3
    const nextNum = parseInt(selectedMeeting, 10) + 1;
    if (nextNum <= 4) {
      setSelectedMeeting(String(nextNum));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12">
      {/* HEADER ATAS */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-white/15 backdrop-blur-xs rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              <Users className="text-white w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-blue-200 bg-white/10 px-2 py-0.5 rounded-full">
                Portal Presensi Guru
              </span>
              <h1 className="text-lg font-black tracking-tight mt-0.5">SMP IT ANNUR ABHARI</h1>
            </div>
          </div>
          <button
            onClick={onSwitchToAdmin}
            title="Masuk sebagai Pengelola / Admin"
            className="text-xs bg-white/10 hover:bg-white/20 text-white font-semibold px-3 py-1.5 rounded-xl border border-white/20 transition flex items-center space-x-1"
          >
            <span>Admin</span>
          </button>
        </div>

        {/* Realtime Date & Time Strip */}
        <div className="bg-blue-950/70 border-t border-blue-700/40 px-4 py-2 text-center text-xs text-blue-100 flex items-center justify-center space-x-3">
          <span className="flex items-center space-x-1">
            <Calendar size={13} className="text-blue-300" />
            <span>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </span>
          <span className="text-blue-400">•</span>
          <span className="flex items-center space-x-1 font-mono font-bold text-emerald-300">
            <Clock size={13} />
            <span>{currentTime.toLocaleTimeString('id-ID')} WIB</span>
          </span>
        </div>
      </header>

      {/* CONTENT CONTAINER */}
      <main className="max-w-md w-full mx-auto px-4 mt-4 flex-1">

        {/* TAMPILAN JIKA BERHASIL: STRUK / BUKTI PRESENSI DIGITAL */}
        {submittedReceipt ? (
          <div className="bg-white rounded-3xl shadow-xl border border-blue-100 overflow-hidden animate-fadeIn">
            {/* Success Header Banner */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-center text-white relative">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg ring-4 ring-white/30 text-emerald-600 animate-bounce">
                <CheckCircle size={36} strokeWidth={2.5} />
              </div>
              <span className="bg-emerald-800/60 text-emerald-100 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Bukti Presensi Digital
              </span>
              <h2 className="text-xl font-black mt-2">Presensi Berhasil Dicatat!</h2>
              <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto">
                Kehadiran Anda telah diverifikasi dan tersimpan secara otomatis di sistem server sekolah.
              </p>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-4">
              {/* Photo preview if available */}
              {submittedReceipt.photoUrl && (
                <div className="flex justify-center -mt-10 mb-2">
                  <div className="relative">
                    <img 
                      src={submittedReceipt.photoUrl} 
                      alt="Selfie Presensi" 
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg"
                    />
                    <span className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1 rounded-full shadow">
                      <ShieldCheck size={16} />
                    </span>
                  </div>
                </div>
              )}

              {/* Data Table Slip */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Nama Guru</span>
                  <span className="font-bold text-slate-800 text-sm text-right">{submittedReceipt.teacherName}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">NIP</span>
                  <span className="font-mono font-semibold text-slate-700">{submittedReceipt.teacherNip || '-'}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Sesi Pertemuan</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-xs">
                    Sesi {submittedReceipt.meeting}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Status Kehadiran</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                    submittedReceipt.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                    submittedReceipt.status === 'Izin' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {submittedReceipt.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Waktu Presensi</span>
                  <span className="font-bold text-slate-800">{submittedReceipt.time} WIB</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-semibold text-slate-700">{submittedReceipt.date}</span>
                </div>
                {submittedReceipt.note && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 block mb-1">Catatan / Keterangan:</span>
                    <p className="italic bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                      "{submittedReceipt.note}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleResetForNext}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-md transition flex items-center justify-center space-x-2 text-sm"
                >
                  <RefreshCw size={16} />
                  <span>Presensi Sesi Berikutnya</span>
                </button>
                <p className="text-center text-[11px] text-slate-400">
                  Terima kasih atas dedikasi Anda mengajar di SMP IT Annur Abhari.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* FORMULIR INPUT PRESENSI GURU */
          <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
            
            {/* Info Box */}
            <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-blue-900">
              <Sparkles className="text-blue-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold text-blue-900">Selamat Datang di Presensi Guru</p>
                <p className="text-blue-700 text-[11px] mt-0.5 leading-relaxed">
                  Pilih nama Anda, tentukan sesi pertemuan, lalu ambil foto selfie bukti kehadiran.
                </p>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start space-x-2.5">
                <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* LANGKAH 1: IDENTITAS GURU */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Identitas Guru <span className="text-rose-500">*</span>
                </label>
                {teachers.length > 0 && (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setInputMode('select')}
                      className={`px-2.5 py-1 rounded-md transition ${inputMode === 'select' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Pilih Daftar
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('manual')}
                      className={`px-2.5 py-1 rounded-md transition ${inputMode === 'manual' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Ketik Nama
                    </button>
                  </div>
                )}
              </div>

              {inputMode === 'select' && teachers.length > 0 ? (
                <div>
                  <select
                    required
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-3.5 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-slate-800 bg-slate-50"
                  >
                    <option value="">-- Sentuh untuk Memilih Nama Anda --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.subject ? `(${t.subject})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Info guru terpilih */}
                  {selectedTeacher && (
                    <div className="mt-2.5 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">NIP:</span>
                        <span className="font-mono font-bold text-slate-800">{selectedTeacher.nip || '-'}</span>
                      </div>
                      {selectedTeacher.subject && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Mata Pelajaran:</span>
                          <span className="font-semibold text-blue-800">{selectedTeacher.subject}</span>
                        </div>
                      )}
                      {/* Status riwayat hari ini */}
                      <div className="pt-2 mt-2 border-t border-blue-200/60">
                        <span className="text-slate-500 block mb-1">Riwayat Sesi Hari Ini:</span>
                        <div className="grid grid-cols-4 gap-1.5 text-center font-bold text-[11px]">
                          {['1', '2', '3', '4'].map(num => {
                            const rec = teacherTodayAttendances.find(a => (a.meeting || '1').replace(/[^0-9]/g, '') === num);
                            return (
                              <div 
                                key={num} 
                                className={`py-1 px-1 rounded-lg border text-[10px] ${
                                  rec 
                                    ? rec.status === 'Hadir' 
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-white text-slate-400 border-slate-200'
                                }`}
                              >
                                <span>Sesi {num}</span>
                                <span className="block text-[9px] font-normal">{rec ? rec.status : 'Belum'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode Input Nama Guru Manual */
                <div className="space-y-3">
                  {teachers.length === 0 && (
                    <p className="text-[11px] text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                      ℹ️ Daftar guru belum diinput admin. Bapak/Ibu guru silakan langsung ketik nama Anda di bawah ini:
                    </p>
                  )}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Nama Lengkap Guru <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-slate-50 font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">NIP / NUPTK</label>
                      <input
                        type="text"
                        value={manualNip}
                        onChange={(e) => setManualNip(e.target.value)}
                        placeholder="NIP atau '-'"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                      <input
                        type="text"
                        value={manualSubject}
                        onChange={(e) => setManualSubject(e.target.value)}
                        placeholder="Contoh: Matematika"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LANGKAH 2: PILIH SESI PERTEMUAN (1, 2, 3, 4) */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Sesi Pertemuan <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['1', '2', '3', '4'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedMeeting(num)}
                    className={`py-3 rounded-xl font-extrabold text-base transition border flex flex-col items-center justify-center ${
                      selectedMeeting === num
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{num}</span>
                    <span className="text-[10px] font-medium opacity-80">Sesi</span>
                  </button>
                ))}
              </div>
            </div>

            {/* LANGKAH 3: STATUS KEHADIRAN */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Status Kehadiran <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('Hadir')}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition border flex flex-col items-center space-y-1 ${
                    status === 'Hadir'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle size={18} />
                  <span>Hadir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('Izin')}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition border flex flex-col items-center space-y-1 ${
                    status === 'Izin'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                  }`}
                >
                  <AlertTriangle size={18} />
                  <span>Izin</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('Sakit')}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition border flex flex-col items-center space-y-1 ${
                    status === 'Sakit'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                  }`}
                >
                  <HeartPulse size={18} />
                  <span>Sakit</span>
                </button>
              </div>
            </div>

            {/* LANGKAH 4: FOTO BUKTI KEHADIRAN / SELFIE */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  4. Foto Selfie Kehadiran {status === 'Hadir' && <span className="text-rose-500">*</span>}
                </label>
                {capturedPhoto && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1">
                    <Check size={14} /> <span>Foto Siap</span>
                  </span>
                )}
              </div>

              {/* Kamera aktif live stream */}
              {isCameraActive && (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-[280px] mx-auto shadow-inner border-2 border-blue-500">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                  {/* Floating Action Controls */}
                  <div className="absolute bottom-3 inset-x-0 flex items-center justify-center space-x-4 z-10 px-4">
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-xs transition"
                      title="Ganti Kamera Depan / Belakang"
                    >
                      <RotateCw size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      className="p-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg ring-4 ring-white/50 transition transform active:scale-95"
                      title="Ambil Foto"
                    >
                      <Camera size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="p-3 bg-rose-600/80 hover:bg-rose-700 text-white rounded-full backdrop-blur-xs transition"
                      title="Tutup Kamera"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Foto sudah terambil */}
              {!isCameraActive && capturedPhoto && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative w-40 h-40 rounded-2xl overflow-hidden border-4 border-emerald-500 shadow-md">
                    <img 
                      src={capturedPhoto} 
                      alt="Selfie Terambil" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full shadow">
                      <Check size={14} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 flex items-center space-x-1.5"
                  >
                    <RefreshCw size={13} />
                    <span>Ambil Ulang Foto Selfie</span>
                  </button>
                </div>
              )}

              {/* Belum ada foto dan kamera belum aktif */}
              {!isCameraActive && !capturedPhoto && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Opsi 1: Native Mobile Camera Capture (Sangat mulus di HP) */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-3 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1 transition"
                    >
                      <Camera size={22} className="text-blue-600" />
                      <span>Kamera Selfie HP</span>
                    </button>

                    {/* Opsi 2: Live Browser Camera Stream */}
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      disabled={isCameraLoading}
                      className="py-3 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1 transition"
                    >
                      <RefreshCw size={22} className={isCameraLoading ? "animate-spin text-blue-600" : "text-slate-600"} />
                      <span>{isCameraLoading ? 'Membuka...' : 'Buka Live Video'}</span>
                    </button>
                  </div>

                  {/* Hidden input capture user */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {cameraError && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      {cameraError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* LANGKAH 5: CATATAN TAMBAHAN (OPSIONAL) */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                5. Keterangan / Catatan <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={status === 'Hadir' ? 'Contoh: Mengajar materi Bab 2 di kelas VIII-A' : 'Alasan izin/sakit...'}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-800 placeholder-slate-400 bg-slate-50 resize-none"
              />
            </div>

            {/* TOMBOL SUBMIT */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || teachers.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold py-4 px-4 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-base"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    <span>Merekam Kehadiran Anda...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Presensi Sekarang</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-400">
                Data presensi langsung tersambung ke rekapitulasi sekolah SMP IT Annur Abhari.
              </p>
            </div>

          </form>
        )}

      </main>
    </div>
  );
}
