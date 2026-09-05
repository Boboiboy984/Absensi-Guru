import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  Home, Users, QrCode, FileText, Download, LogOut, Plus, Trash2, Printer, 
  FolderOpen, Edit, Search, Phone, Mail, X, Camera, RefreshCw, CheckCircle, 
  AlertTriangle, AlertCircle, Image as ImageIcon, Eye, RotateCw, Smartphone,
  ExternalLink, Copy, Share2, ScanLine, IdCard, Sparkles, Globe, Volume2, ShieldCheck
} from 'lucide-react';
import TeacherMobilePortal from './components/TeacherMobilePortal';

declare const __initial_auth_token: string | undefined;

// ==========================================
// FIREBASE CONFIGURATION (SMP IT ANNUR ABHARI)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyB1cn7NbvBIsa3MBfdlGigajZ7wuxb2KAc",
  authDomain: "smpit-a3b11.firebaseapp.com",
  projectId: "smpit-a3b11",
  storageBucket: "smpit-a3b11.firebasestorage.app",
  messagingSenderId: "354878781545",
  appId: "1:354878781545:web:d54ae8842f4fd5c15c8af8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function AplikasiGuru() {
  const DEFAULT_TEACHERS: any[] = [];

  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Mode Tampilan: 'admin' atau 'presensi_guru' (Portal Scan QR Guru)
  const [viewMode, setViewMode] = useState<'admin' | 'presensi_guru'>(() => {
    if (typeof window !== 'undefined') {
      const search = (window.location.search || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const href = (window.location.href || '').toLowerCase();
      
      // Jika URL mengindikasikan presensi / scan / guru / absen
      if (
        search.includes('presensi') || search.includes('scan') || search.includes('guru') || search.includes('absen') ||
        hash.includes('presensi') || hash.includes('scan') || hash.includes('guru') || hash.includes('absen') ||
        href.includes('presensi') || href.includes('scan')
      ) {
        return 'presensi_guru';
      }

      // Deteksi HP / Smartphone / Tablet: Jika diakses guru lewat HP, otomatis tampilkan formulir absen!
      const isMobile = /android|iphone|ipad|ipod|mobile|phone|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent || ''
      );
      if (isMobile) {
        return 'presensi_guru';
      }
    }
    return 'admin';
  });

  // Pilihan Sumber URL QR Code
  // 'live': URL Server Aktif saat ini (Otomatis menyesuaikan domain Vercel/Cloud Run)
  // 'custom': Alamat domain sekolah atau tunnel kustom
  const [urlMode, setUrlMode] = useState<'live' | 'custom'>('live');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  // Tautan URL Resmi untuk Scan Presensi Guru
  const [portalUrl, setPortalUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Mode Absensi di Tab QR: 'form' (Form Manual & Selfie) atau 'scanner' (Scanner Kamera Meja Piket)
  const [adminScanMode, setAdminScanMode] = useState<'form' | 'scanner'>('form');
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [scannerCameraError, setScannerCameraError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<{
    teacher: any;
    meeting: string;
    time: string;
    photo: string;
  } | null>(null);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);
  const lastScanCooldownRef = useRef(0);

  // Modal Kartu QR Digital Guru (ID Card Presensi)
  const [selectedTeacherForCard, setSelectedTeacherForCard] = useState<any | null>(null);
  const [teacherCardQrDataUrl, setTeacherCardQrDataUrl] = useState<string>('');

  const [teachers, setTeachers] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('smpit_teachers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Kosongkan data contoh bawaan terdahulu jika ada
          const userTeachers = parsed.filter(t => !['t1', 't2', 't3', 't4', 't5'].includes(t.id));
          return userTeachers;
        }
      }
    } catch (e) {}
    return [];
  });

  const [attendances, setAttendances] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('smpit_attendances');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [files, setFiles] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('smpit_files');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [newTeacher, setNewTeacher] = useState({ name: '', nip: '', subject: '', status: 'PNS', phone: '', email: '' });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState('1');
  const [newFile, setNewFile] = useState({ title: '', category: 'RPP', link: '' });

  // Status Kehadiran (Hadir / Izin / Sakit) & Catatan
  const [attendanceStatus, setAttendanceStatus] = useState<'Hadir' | 'Izin' | 'Sakit'>('Hadir');
  const [attendanceNote, setAttendanceNote] = useState('');

  // Kamera & Foto Kehadiran
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState<{ url: string; teacherName: string; date: string; time: string; status: string } | null>(null);

  // Cetak QR Code
  const [showQrPrintModal, setShowQrPrintModal] = useState(false);
  const [printTarget, setPrintTarget] = useState<'rekap' | 'qr'>('rekap');

  // Video and input refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotification = (message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 4000);
  };

  // Dengarkan perubahan URL / hash secara real-time
  useEffect(() => {
    const checkUrlMode = () => {
      if (typeof window !== 'undefined') {
        const search = (window.location.search || '').toLowerCase();
        const hash = (window.location.hash || '').toLowerCase();
        const href = (window.location.href || '').toLowerCase();
        if (
          search.includes('presensi') || search.includes('scan') || search.includes('guru') || search.includes('absen') ||
          hash.includes('presensi') || hash.includes('scan') || hash.includes('guru') || hash.includes('absen') ||
          href.includes('presensi') || href.includes('scan')
        ) {
          setViewMode('presensi_guru');
        }
      }
    };
    window.addEventListener('popstate', checkUrlMode);
    window.addEventListener('hashchange', checkUrlMode);
    return () => {
      window.removeEventListener('popstate', checkUrlMode);
      window.removeEventListener('hashchange', checkUrlMode);
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenErr) {
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.warn("Autentikasi Anonim Firebase mode fallback:", error);
        setUser({ uid: 'local-guest-user', isFallback: true });
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const teachersRef = collection(db, 'teachers');
    const attendanceRef = collection(db, 'attendances');
    const filesRef = collection(db, 'files');

    const unsubTeachers = onSnapshot(teachersRef, (snapshot) => {
      if (!snapshot.empty) {
        const firestoreTeachers = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((t: any) => !['t1', 't2', 't3', 't4', 't5'].includes(t.id));
        setTeachers(firestoreTeachers);
        try { localStorage.setItem('smpit_teachers', JSON.stringify(firestoreTeachers)); } catch (e) {}
      }
    }, (error) => console.warn("Notice teachers listener:", error));

    const unsubAttendances = onSnapshot(attendanceRef, (snapshot) => {
      if (!snapshot.empty) {
        const attData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        attData.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setAttendances(attData);
        try { localStorage.setItem('smpit_attendances', JSON.stringify(attData)); } catch (e) {}
      }
    }, (error) => console.warn("Notice attendances listener:", error));

    const unsubFiles = onSnapshot(filesRef, (snapshot) => {
      if (!snapshot.empty) {
        const fileData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        fileData.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setFiles(fileData);
        try { localStorage.setItem('smpit_files', JSON.stringify(fileData)); } catch (e) {}
      }
    }, (error) => console.warn("Notice files listener:", error));

    return () => {
      unsubTeachers();
      unsubAttendances();
      unsubFiles();
    };
  }, [user]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim().toLowerCase() === 'admin' && passwordInput === 'guru123') {
      setIsLoggedIn(true);
      showNotification('Berhasil masuk ke sistem SMP IT Annur Abhari!', 'success');
    } else {
      showNotification('Username atau Password salah!', 'error');
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacher.name || !newTeacher.nip) {
      showNotification('Nama dan NIP guru wajib diisi!', 'error');
      return;
    }
    const teacherData = {
      ...newTeacher,
      createdAt: serverTimestamp()
    };
    let newId = 't_' + Date.now();
    try {
      const docRef = await addDoc(collection(db, 'teachers'), teacherData);
      newId = docRef.id;
    } catch (error) {
      console.warn("Firestore addDoc error, menyimpan secara lokal:", error);
    }
    setTeachers(prev => {
      const updated = [...prev, { ...teacherData, id: newId }];
      try { localStorage.setItem('smpit_teachers', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setNewTeacher({ name: '', nip: '', subject: '', status: 'PNS', phone: '', email: '' });
    showNotification('Data guru berhasil ditambahkan!', 'success');
  };

  const handleEditTeacher = (teacher: any) => {
    setEditingTeacher({ ...teacher });
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editingTeacher.id) return;
    const updatedData = {
      name: editingTeacher.name || '',
      nip: editingTeacher.nip || '',
      subject: editingTeacher.subject || '',
      status: editingTeacher.status || 'PNS',
      phone: editingTeacher.phone || '',
      email: editingTeacher.email || ''
    };
    try {
      const teacherDocRef = doc(db, 'teachers', editingTeacher.id);
      await updateDoc(teacherDocRef, updatedData);
    } catch (error) {
      console.warn("Firestore updateDoc error, memperbarui secara lokal:", error);
    }
    setTeachers(prev => {
      const updated = prev.map(t => t.id === editingTeacher.id ? { ...t, ...updatedData } : t);
      try { localStorage.setItem('smpit_teachers', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setEditingTeacher(null);
    showNotification('Data guru berhasil diperbarui!', 'success');
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'teachers', id));
    } catch (error) {
      console.warn("Firestore deleteDoc error, menghapus secara lokal:", error);
    }
    setTeachers(prev => {
      const updated = prev.filter(t => t.id !== id);
      try { localStorage.setItem('smpit_teachers', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    showNotification(`Data ${name} berhasil dihapus.`, 'success');
  };

  const handleClearAllTeachers = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mengosongkan seluruh daftar guru? Anda dapat memasukkan data guru baru secara mandiri.")) return;
    try {
      teachers.forEach(async (t) => {
        if (t.id && !t.id.startsWith('t_')) {
          try { await deleteDoc(doc(db, 'teachers', t.id)); } catch (e) {}
        }
      });
    } catch (e) {}
    setTeachers([]);
    try { localStorage.setItem('smpit_teachers', JSON.stringify([])); } catch (e) {}
    showNotification('Seluruh data guru berhasil dikosongkan.', 'success');
  };

  // ==========================================
  // KAMERA & FOTO KEHADIRAN HANDLERS
  // ==========================================
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setIsCameraLoading(true);
    setCameraError(null);
    setIsCameraActive(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Fitur kamera browser tidak didukung atau diblokir.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Play error:", e));
      }
    } catch (err: any) {
      console.warn("Camera error:", err);
      let msg = 'Kamera tidak dapat diakses.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera ditolak browser. Izinkan akses kamera atau gunakan tombol "Ambil Foto HP / File".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat Anda. Gunakan tombol "Ambil Foto HP / File".';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Kamera sedang digunakan aplikasi lain. Gunakan tombol "Ambil Foto HP / File".';
      } else {
        msg = 'Kamera tidak dapat dibuka (' + (err.message || 'Error') + '). Gunakan tombol "Ambil Foto HP / File".';
      }
      setCameraError(msg);
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
    setIsCameraLoading(false);
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Sync stream to video element when mounted
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(e => console.warn("Video sync error:", e));
    }
  }, [isCameraActive]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const size = Math.min(width, height) || 360;
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(360, 0);
        ctx.scale(-1, 1);
      }
      const sx = (width - size) / 2;
      const sy = (height - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 360, 360);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      setCapturedPhoto(dataUrl);
      stopCamera();
      showNotification('Foto bukti kehadiran berhasil diambil!', 'success');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 360, 360);
          setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.75));
          showNotification('Foto bukti kehadiran berhasil diunggah!', 'success');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (activeTab !== 'qr') {
      stopCamera();
    }
  }, [activeTab]);

  // ==========================================
  // GENERASI QR CODE REAL DENGAN TAUTAN URL HP GURU
  // ==========================================
  const FALLBACK_DEV_URL = 'https://presensi-guru.vercel.app/?presensi=guru';

  useEffect(() => {
    let target = '';

    if (urlMode === 'custom' && customUrlInput.trim()) {
      let custom = customUrlInput.trim();
      if (!custom.startsWith('http://') && !custom.startsWith('https://')) {
        custom = 'https://' + custom;
      }
      target = custom.includes('?') ? `${custom}&presensi=guru` : `${custom}/?presensi=guru`;
    } else {
      // Prioritaskan domain aktif saat ini yang sedang melayani request
      if (typeof window !== 'undefined' && window.location) {
        const origin = window.location.origin;
        const pathname = window.location.pathname || '';
        // Jika bukan localhost, gunakan origin server nyata yang sedang aktif
        if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
          const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
          target = `${origin}${cleanPath}?presensi=guru`;
        } else {
          target = FALLBACK_DEV_URL;
        }
      } else {
        target = FALLBACK_DEV_URL;
      }
    }

    setPortalUrl(target);

    // Generate high-resolution QR code locally with strong contrast
    QRCode.toDataURL(target, {
      width: 650,
      margin: 2,
      color: {
        dark: '#0f172a', // Kontras tinggi agar mudah dibaca oleh semua sensor kamera smartphone
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then(dataUri => {
        setQrCodeDataUrl(dataUri);
      })
      .catch(err => {
        console.warn("QRCode local generation failed, using fallback:", err);
        setQrCodeDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(target)}`);
      });
  }, [urlMode, customUrlInput]);

  const handleCopyPortalLink = () => {
    if (portalUrl && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).then(() => {
        setIsCopied(true);
        showNotification('Tautan presensi guru berhasil disalin! Silakan bagikan ke grup guru.', 'success');
        setTimeout(() => setIsCopied(false), 3000);
      }).catch(() => {
        showNotification('Tautan: ' + portalUrl, 'info');
      });
    }
  };

  // ==========================================
  // CETAK & UNDUH QR CODE
  // ==========================================
  const downloadQrCode = () => {
    if (qrCodeDataUrl) {
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = "QR_Code_Presensi_Guru_SMPIT_Annur_Abhari.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Gambar QR Code presensi berhasil diunduh!', 'success');
    } else {
      showNotification('QR Code sedang disiapkan...', 'info');
    }
  };

  const openQrPrintModal = () => {
    setPrintTarget('qr');
    setShowQrPrintModal(true);
  };

  const triggerQrPrint = () => {
    setPrintTarget('qr');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Handler khusus untuk pengiriman presensi dari Portal HP Guru (Scan QR)
  const handleRecordAttendanceFromPortal = async (data: {
    teacherId: string;
    meeting: string;
    status: 'Hadir' | 'Izin' | 'Sakit';
    note: string;
    photoUrl: string | null;
    manualName?: string;
    manualNip?: string;
    manualSubject?: string;
  }) => {
    let teacher = teachers.find(t => t.id === data.teacherId);
    let teacherName = teacher ? teacher.name : (data.manualName || 'Guru SMP IT Annur Abhari').trim();
    let teacherNip = teacher ? (teacher.nip || '-') : (data.manualNip?.trim() || '-');
    let teacherId = teacher ? teacher.id : ('teacher_manual_' + Date.now());

    // Jika guru baru diketik manual di portal, daftarkan otomatis ke database guru
    if (!teacher && data.manualName && data.manualName.trim()) {
      const newTeacherRecord = {
        name: data.manualName.trim(),
        nip: data.manualNip?.trim() || '-',
        subject: data.manualSubject?.trim() || 'Guru Pengajar',
        status: 'Aktif',
        createdAt: serverTimestamp()
      };
      try {
        const docRef = await addDoc(collection(db, 'teachers'), newTeacherRecord);
        teacherId = docRef.id;
      } catch (e) {
        console.warn("Firestore teacher sync error, local only:", e);
      }
      setTeachers(prev => {
        const updated = [...prev, { id: teacherId, ...newTeacherRecord }];
        try { localStorage.setItem('smpit_teachers', JSON.stringify(updated)); } catch (err) {}
        return updated;
      });
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');
    const timeStr = now.toLocaleTimeString('id-ID');
    const cleanSelectedMeeting = (data.meeting || '1').replace(/[^0-9]/g, '') || '1';

    const todayTeacherAttendances = attendances.filter(
      a => (a.teacherId === teacherId || (teacherName && a.teacherName === teacherName)) && a.date === todayStr
    );

    const existingForMeeting = todayTeacherAttendances.find(
      a => (a.meeting === cleanSelectedMeeting || a.meeting === `Pertemuan ${cleanSelectedMeeting}`)
    );

    const recordData = {
      teacherId: teacherId,
      teacherName: teacherName,
      teacherNip: teacherNip || '-',
      meeting: cleanSelectedMeeting,
      status: data.status,
      note: data.note || '',
      photoUrl: data.photoUrl || null,
      date: todayStr,
      time: timeStr,
      timestamp: serverTimestamp()
    };

    try {
      let finalId = 'att_' + Date.now();
      if (existingForMeeting && existingForMeeting.id) {
        // Perbarui sesi yang sudah ada
        try {
          await updateDoc(doc(db, 'attendances', existingForMeeting.id), recordData);
        } catch (err) {
          console.warn("Firestore update error, memperbarui lokal:", err);
        }
        setAttendances(prev => {
          const updated = prev.map(a => a.id === existingForMeeting.id ? { ...a, ...recordData, id: existingForMeeting.id } : a);
          try { localStorage.setItem('smpit_attendances', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      } else {
        // Buat record presensi baru
        try {
          const docRef = await addDoc(collection(db, 'attendances'), recordData);
          finalId = docRef.id;
        } catch (err) {
          console.warn("Firestore addDoc error, menyimpan lokal:", err);
        }
        setAttendances(prev => {
          const updated = [{ ...recordData, id: finalId }, ...prev];
          try { localStorage.setItem('smpit_attendances', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      }

      return {
        success: true,
        message: 'Presensi berhasil direkam!',
        receipt: {
          teacherName: teacherName,
          teacherNip: teacherNip || '-',
          meeting: cleanSelectedMeeting,
          status: data.status,
          date: todayStr,
          time: timeStr,
          photoUrl: data.photoUrl,
          note: data.note
        }
      };
    } catch (error: any) {
      console.error("Gagal merekam presensi dari portal:", error);
      return { success: false, message: error?.message || 'Gagal menyimpan presensi.' };
    }
  };

  const handlePrintRekapPdf = () => {
    setPrintTarget('rekap');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleRecordAttendance = async () => {
    if (!selectedTeacherId) {
      showNotification('Silakan pilih nama guru terlebih dahulu!', 'error');
      return;
    }
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) {
      showNotification('Data guru tidak ditemukan!', 'error');
      return;
    }
    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');
    const timeStr = now.toLocaleTimeString('id-ID');

    const todayTeacherAttendances = attendances.filter(
      a => a.teacherId === selectedTeacherId && a.date === todayStr
    );

    const cleanSelectedMeeting = (selectedMeeting || '1').replace(/[^0-9]/g, '') || '1';
    const existingForMeeting = todayTeacherAttendances.find(
      a => (a.meeting === cleanSelectedMeeting || a.meeting === `Pertemuan ${cleanSelectedMeeting}` || a.meeting === selectedMeeting)
    );

    if (!existingForMeeting && todayTeacherAttendances.length >= 4) {
      showNotification(`Batas maksimal 4 sesi absensi per hari untuk ${teacher.name} telah tercapai. Anda dapat memilih sesi yang sudah ada untuk memperbarui status.`, 'error');
      return;
    }

    const recordData = {
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherNip: teacher.nip,
      meeting: cleanSelectedMeeting,
      status: attendanceStatus,
      note: attendanceNote.trim(),
      photoUrl: capturedPhoto || null,
      date: todayStr,
      time: timeStr,
      timestamp: serverTimestamp()
    };

    try {
      if (existingForMeeting && existingForMeeting.id) {
        // Update existing record
        try {
          await updateDoc(doc(db, 'attendances', existingForMeeting.id), recordData);
        } catch (err) {
          console.warn("Firestore update error, memperbarui secara lokal:", err);
        }
        setAttendances(prev => {
          const updated = prev.map(a => a.id === existingForMeeting.id ? { ...a, ...recordData, id: existingForMeeting.id } : a);
          try { localStorage.setItem('smpit_attendances', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
        showNotification(`Absensi Sesi ${cleanSelectedMeeting} (${attendanceStatus}) untuk ${teacher.name} berhasil diperbarui!`, 'success');
      } else {
        // Create new record
        let newId = 'att_' + Date.now();
        try {
          const docRef = await addDoc(collection(db, 'attendances'), recordData);
          newId = docRef.id;
        } catch (err) {
          console.warn("Firestore addDoc error, menyimpan secara lokal:", err);
        }
        setAttendances(prev => {
          const updated = [{ ...recordData, id: newId }, ...prev];
          try { localStorage.setItem('smpit_attendances', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
        showNotification(`Berhasil merekam absensi (${attendanceStatus}) Sesi ${cleanSelectedMeeting} untuk ${teacher.name}!`, 'success');
      }

      setSelectedTeacherId('');
      setSelectedMeeting('1');
      setAttendanceStatus('Hadir');
      setAttendanceNote('');
      setCapturedPhoto(null);
      stopCamera();
    } catch (error: any) {
      console.error("Error recording attendance: ", error);
      showNotification('Terjadi kendala saat menyimpan absensi.', 'error');
    }
  };

  const handleDeleteAttendance = async (id: string, teacherName: string, meeting: string) => {
    try {
      await deleteDoc(doc(db, 'attendances', id));
    } catch (err) {
      console.warn("Firestore deleteDoc error, menghapus secara lokal:", err);
    }
    setAttendances(prev => {
      const updated = prev.filter(a => a.id !== id);
      try { localStorage.setItem('smpit_attendances', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    showNotification(`Data absensi ${teacherName} (${meeting}) berhasil dihapus.`, 'success');
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile.title || !newFile.link) {
      showNotification('Judul dan link dokumen wajib diisi!', 'error');
      return;
    }
    const fileData = {
      ...newFile,
      timestamp: serverTimestamp()
    };
    let newId = 'f_' + Date.now();
    try {
      const docRef = await addDoc(collection(db, 'files'), fileData);
      newId = docRef.id;
    } catch (error) {
      console.warn("Firestore addDoc file error, menyimpan secara lokal:", error);
    }
    setFiles(prev => {
      const updated = [{ ...fileData, id: newId }, ...prev];
      try { localStorage.setItem('smpit_files', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setNewFile({ title: '', category: 'RPP', link: '' });
    showNotification('Dokumen berhasil ditambahkan ke Arsip File!', 'success');
  };

  const handleDeleteFile = async (id: string, title: string) => {
    try {
      await deleteDoc(doc(db, 'files', id));
    } catch (error) {
      console.warn("Firestore deleteDoc file error, menghapus secara lokal:", error);
    }
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      try { localStorage.setItem('smpit_files', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    showNotification(`Dokumen "${title}" berhasil dihapus.`, 'success');
  };

  const exportToExcel = () => {
    const todayStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const totalRekap = attendances.length;
    const totalHadir = attendances.filter(a => !a.status || a.status === 'Hadir').length;
    const totalIzin = attendances.filter(a => a.status === 'Izin').length;
    const totalSakit = attendances.filter(a => a.status === 'Sakit').length;

    let tableRows = '';
    attendances.forEach((row, idx) => {
      const meetingNum = (row.meeting || '1').replace(/[^0-9]/g, '') || '1';
      const statusText = row.status || 'Hadir';
      const statusBg = statusText === 'Hadir' ? '#DCFCE7' : statusText === 'Izin' ? '#FEF3C7' : '#FEE2E2';
      const statusColor = statusText === 'Hadir' ? '#15803D' : statusText === 'Izin' ? '#B45309' : '#B91C1C';
      
      tableRows += `
        <tr style="height: 28px; background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
          <td style="text-align: center; border: 1px solid #D1D5DB; font-size: 11pt;">${idx + 1}</td>
          <td style="text-align: center; border: 1px solid #D1D5DB; font-size: 11pt;">${row.date || '-'}</td>
          <td style="text-align: center; border: 1px solid #D1D5DB; font-size: 11pt; font-family: monospace;">${row.time || '-'}</td>
          <td style="text-align: center; border: 1px solid #D1D5DB; font-weight: bold; font-size: 11pt; mso-number-format: '0';">${meetingNum}</td>
          <td style="text-align: center; border: 1px solid #D1D5DB; font-weight: bold; background-color: ${statusBg}; color: ${statusColor}; font-size: 11pt;">${statusText}</td>
          <td style="text-align: left; border: 1px solid #D1D5DB; font-weight: bold; font-size: 11pt;">${row.teacherName || '-'}</td>
          <td style="text-align: center; border: 1px solid #D1D5DB; font-size: 11pt; mso-number-format: '\\@';">${row.teacherNip || '-'}</td>
          <td style="text-align: left; border: 1px solid #D1D5DB; font-size: 11pt;">${row.note || '-'}</td>
          <td style="text-align: center; border: 1px solid #D1D5DB; font-size: 11pt;">${row.photoUrl ? 'Terverifikasi' : 'Tanpa Foto'}</td>
        </tr>
      `;
    });

    if (attendances.length === 0) {
      tableRows = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px; border: 1px solid #D1D5DB; color: #6B7280; font-style: italic;">
            Belum ada catatan absensi yang tersimpan di database.
          </td>
        </tr>
      `;
    }

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Rekap Presensi Guru</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
        </style>
      </head>
      <body>
        <table>
          <!-- KOP SURAT SEKOLAH -->
          <tr>
            <td colspan="9" style="text-align: center; font-size: 13pt; font-weight: bold; color: #1E3A8A; padding-top: 10px;">
              YAYASAN PENDIDIKAN ISLAM ANNUR ABHARI
            </td>
          </tr>
          <tr>
            <td colspan="9" style="text-align: center; font-size: 18pt; font-weight: bold; color: #1E40AF;">
              SMP IT ANNUR ABHARI
            </td>
          </tr>
          <tr>
            <td colspan="9" style="text-align: center; font-size: 10pt; color: #4B5563;">
              Alamat: Jl. Raya Pendidikan No. 12, Jawa Barat | NPSN: 69982341
            </td>
          </tr>
          <tr>
            <td colspan="9" style="text-align: center; font-size: 14pt; font-weight: bold; padding: 8px 0; border-top: 2px solid #1E3A8A; border-bottom: 2px solid #1E3A8A;">
              LAPORAN REKAPITULASI PRESENSI KEHADIRAN GURU
            </td>
          </tr>
          <tr>
            <td colspan="9" style="text-align: left; font-size: 10pt; color: #374151; padding: 6px 0;">
              <b>Tanggal Laporan:</b> ${todayStr} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Total Rekap:</b> ${totalRekap} Data &nbsp;&nbsp;|&nbsp;&nbsp; <b>Hadir:</b> ${totalHadir} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Izin:</b> ${totalIzin} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Sakit:</b> ${totalSakit}
            </td>
          </tr>
          <tr><td colspan="9" style="height: 10px;"></td></tr>

          <!-- TABEL HEADER -->
          <thead>
            <tr style="background-color: #1E40AF; color: #FFFFFF; font-weight: bold; height: 36px;">
              <th style="border: 1px solid #000000; text-align: center; width: 45px;">NO</th>
              <th style="border: 1px solid #000000; text-align: center; width: 110px;">TANGGAL</th>
              <th style="border: 1px solid #000000; text-align: center; width: 85px;">WAKTU</th>
              <th style="border: 1px solid #000000; text-align: center; width: 65px;">SESI</th>
              <th style="border: 1px solid #000000; text-align: center; width: 95px;">STATUS</th>
              <th style="border: 1px solid #000000; text-align: left; width: 240px;">NAMA GURU</th>
              <th style="border: 1px solid #000000; text-align: center; width: 170px;">NIP</th>
              <th style="border: 1px solid #000000; text-align: left; width: 200px;">KETERANGAN</th>
              <th style="border: 1px solid #000000; text-align: center; width: 120px;">FOTO BUKTI</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <!-- RINGKASAN FOOTER -->
          <tfoot>
            <tr style="background-color: #E2E8F0; font-weight: bold; height: 30px;">
              <td colspan="4" style="border: 1px solid #94A3B8; text-align: right; padding-right: 10px;">TOTAL KEHADIRAN:</td>
              <td colspan="5" style="border: 1px solid #94A3B8; text-align: left; padding-left: 10px;">
                Hadir: ${totalHadir} | Izin: ${totalIzin} | Sakit: ${totalSakit} | Total: ${totalRekap}
              </td>
            </tr>
            <tr><td colspan="9" style="height: 25px;"></td></tr>
            <tr>
              <td colspan="4" style="text-align: center; font-size: 11pt;">
                Mengetahui,<br>
                <b>Kepala SMP IT Annur Abhari</b><br><br><br><br>
                <u>___________________________</u><br>
                NIP. -
              </td>
              <td></td>
              <td colspan="4" style="text-align: center; font-size: 11pt;">
                Dicetak pada: ${todayStr}<br>
                <b>Petugas Piket / Kurikulum</b><br><br><br><br>
                <u>___________________________</u><br>
                NIP. -
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Presensi_Guru_SMPIT_Annur_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Laporan Excel rapi (.xls) berhasil diunduh!', 'success');
  };

  const exportToCSV = () => {
    let csv = "\uFEFF"; // UTF-8 BOM agar rapi di Microsoft Excel Indonesia
    csv += "No;Tanggal;Waktu;Sesi;Status;Nama Guru;NIP;Keterangan;Foto Bukti\r\n";
    attendances.forEach((row, idx) => {
      const meetingNum = (row.meeting || '1').replace(/[^0-9]/g, '') || '1';
      const cleanNote = (row.note || '-').replace(/;/g, ',').replace(/\r?\n/g, ' ');
      csv += `${idx + 1};"${row.date || ''}";"${row.time || ''}";"${meetingNum}";"${row.status || 'Hadir'}";"${row.teacherName || ''}";"${row.teacherNip || ''}";"${cleanNote}";"${row.photoUrl ? 'Ada Foto' : 'Tanpa Foto'}"\r\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekap_Presensi_Guru_SMPIT_Annur_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('File CSV rapi berhasil diunduh!', 'success');
  };

  const exportToPDF = () => {
    handlePrintRekapPdf();
  };

  const filteredTeachers = teachers.filter(t => {
    const term = teacherSearch.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(term)) ||
      (t.nip && t.nip.toLowerCase().includes(term)) ||
      (t.subject && t.subject.toLowerCase().includes(term))
    );
  });

  // JIKA DALAM MODE PORTAL GURU (HASIL SCAN QR DI SMARTPHONE GURU)
  if (viewMode === 'presensi_guru') {
    return (
      <TeacherMobilePortal
        teachers={teachers}
        attendances={attendances}
        onRecordAttendance={handleRecordAttendanceFromPortal}
        onSwitchToAdmin={() => setViewMode('admin')}
      />
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-md w-full border border-blue-100">
          
          {/* TAB PILIHAN: ISI ABSENSI GURU VS LOGIN ADMIN */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setViewMode('presensi_guru')}
              className="py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Smartphone size={15} />
              <span>Isi Presensi Guru</span>
            </button>
            <button
              type="button"
              className="py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 bg-white text-blue-950 shadow-xs"
            >
              <Users size={15} />
              <span>Login Admin</span>
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
              <Users className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Aplikasi Presensi Guru</h1>
            <p className="text-gray-500 text-sm mt-1">SMP IT Annur Abhari</p>
          </div>

          {toast.show && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm text-center font-medium ${
              toast.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700'
            }`}>
              {toast.message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username Admin / Piket</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="Masukkan username..."
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Akses</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="Masukkan password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition shadow-md text-sm"
            >
              Masuk Dashboard Admin
            </button>
          </form>

          {/* OPSI LANGSUNG UNTUK GURU YANG INGIN PRESENSI */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2">
            <p className="text-xs text-gray-500 font-medium">Bapak/Ibu Guru yang ingin mengisi presensi kehadiran:</p>
            <button
              type="button"
              onClick={() => setViewMode('presensi_guru')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-sm"
            >
              <Smartphone size={16} />
              <span>Buka Portal Presensi Guru (Scan QR)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans relative">
      
      {/* Toast Banner */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-medium text-sm transition transform animate-bounce ${
          toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-blue-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-blue-800 text-white flex flex-col shadow-xl print:hidden">
        <div className="p-6 text-center border-b border-blue-700">
          <h2 className="text-xl font-bold tracking-wider">Aplikasi Guru</h2>
          <p className="text-blue-300 text-xs mt-1">SMP IT Annur Abhari</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-blue-900 font-bold shadow-inner' : 'hover:bg-blue-700'}`}>
            <Home size={20} /> <span>Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('teachers')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'teachers' ? 'bg-blue-900 font-bold shadow-inner' : 'hover:bg-blue-700'}`}>
            <Users size={20} /> <span>Data Guru</span>
          </button>
          <button onClick={() => setActiveTab('qr')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'qr' ? 'bg-blue-900 font-bold shadow-inner' : 'hover:bg-blue-700'}`}>
            <QrCode size={20} /> <span>Absensi QR</span>
          </button>
          <button onClick={() => setActiveTab('attendance')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'attendance' ? 'bg-blue-900 font-bold shadow-inner' : 'hover:bg-blue-700'}`}>
            <FileText size={20} /> <span>Rekap Absensi</span>
          </button>
          <button onClick={() => setActiveTab('files')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'files' ? 'bg-blue-900 font-bold shadow-inner' : 'hover:bg-blue-700'}`}>
            <FolderOpen size={20} /> <span>Arsip File</span>
          </button>
          
          <div className="pt-2">
            <button 
              type="button"
              onClick={() => setViewMode('presensi_guru')} 
              className="w-full flex items-center space-x-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs shadow-md border border-emerald-400/30"
              title="Buka tampilan yang dilihat guru ketika memindai QR Code di HP"
            >
              <Smartphone size={16} /> <span>Simulasi HP Guru</span>
            </button>
          </div>
        </nav>
        <div className="p-4 border-t border-blue-700">
          <button onClick={() => { setIsLoggedIn(false); showNotification('Anda telah keluar.'); }} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-300 hover:bg-blue-900 transition">
            <LogOut size={20} /> <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard Sekolah</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="bg-blue-100 p-4 rounded-full text-blue-600"><Users size={24} /></div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Guru</p>
                  <p className="text-2xl font-bold text-gray-800">{teachers.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="bg-emerald-100 p-4 rounded-full text-emerald-600"><FileText size={24} /></div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Kehadiran</p>
                  <p className="text-2xl font-bold text-gray-800">{attendances.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="bg-amber-100 p-4 rounded-full text-amber-600"><FolderOpen size={24} /></div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Arsip File</p>
                  <p className="text-2xl font-bold text-gray-800">{files.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Selamat Datang di Aplikasi Guru SMP IT Annur Abhari</h3>
            </div>
          </div>
        )}

        {/* DATA GURU TAB */}
        {activeTab === 'teachers' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Manajemen Data Guru</h1>
                <p className="text-gray-500 text-sm">Kelola data tenaga pendidik SMP IT Annur Abhari.</p>
              </div>
              <div className="flex items-center space-x-3 mt-4 md:mt-0 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Cari nama, NIP, mapel..."
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {teachers.length > 0 && (
                  <button
                    onClick={handleClearAllTeachers}
                    title="Kosongkan seluruh data guru untuk input ulang mandiri"
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 shrink-0 transition"
                  >
                    <Trash2 size={15} />
                    <span>Kosongkan Guru</span>
                  </button>
                )}
              </div>
            </div>

            {/* Form Tambah Guru */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Tambah Data Guru Baru</h3>
              <form onSubmit={handleAddTeacher} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Lengkap & Gelar *</label>
                  <input type="text" required value={newTeacher.name} onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ahmad Fauzi, S.Pd." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">NIP / NIPPPK *</label>
                  <input type="text" required value={newTeacher.nip} onChange={(e) => setNewTeacher({...newTeacher, nip: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="19850123..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mata Pelajaran</label>
                  <input type="text" value={newTeacher.subject} onChange={(e) => setNewTeacher({...newTeacher, subject: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Matematika / IPA" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status Kepegawaian</label>
                  <select value={newTeacher.status} onChange={(e) => setNewTeacher({...newTeacher, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="GTY">GTY</option>
                    <option value="Honorer">Honorer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">No. HP / WA</label>
                  <input type="text" value={newTeacher.phone} onChange={(e) => setNewTeacher({...newTeacher, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="081234567890" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input type="email" value={newTeacher.email} onChange={(e) => setNewTeacher({...newTeacher, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="guru@sekolah.sch.id" />
                </div>
                <div className="md:col-span-3 flex justify-end mt-2">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm font-semibold shadow-sm transition">
                    <Plus size={18} /> <span>Simpan Data Guru</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Tabel Data Guru */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-700 text-xs font-bold uppercase border-b">
                  <tr>
                    <th className="p-4">Nama Guru</th>
                    <th className="p-4">NIP</th>
                    <th className="p-4">Mapel</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Kontak</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredTeachers.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-bold text-gray-800">{t.name}</td>
                      <td className="p-4 text-gray-600 font-mono text-xs">{t.nip}</td>
                      <td className="p-4 text-gray-600">{t.subject || '-'}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {t.status || 'PNS'}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500 space-y-1">
                        {t.phone && <div className="flex items-center"><Phone size={12} className="mr-1 text-gray-400" /> {t.phone}</div>}
                        {t.email && <div className="flex items-center"><Mail size={12} className="mr-1 text-gray-400" /> {t.email}</div>}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button onClick={() => handleEditTeacher(t)} title="Edit Guru" className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDeleteTeacher(t.id, t.name)} title="Hapus Guru" className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-gray-500">
                        <div className="max-w-md mx-auto space-y-2">
                          <Users size={40} className="mx-auto text-blue-500/60 mb-2" />
                          <p className="font-bold text-gray-800 text-base">
                            {teachers.length === 0 ? 'Daftar Guru Masih Kosong' : 'Guru Tidak Ditemukan'}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {teachers.length === 0 
                              ? 'Silakan gunakan formulir di atas untuk mendaftarkan nama guru, NIP, mata pelajaran, dan data kontak guru mandiri.'
                              : 'Tidak ada data guru yang cocok dengan kata kunci pencarian Anda.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL EDIT GURU */}
        {editingTeacher && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-fadeIn">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-lg font-bold text-gray-800">Edit Data Guru</h3>
                <button onClick={() => setEditingTeacher(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Lengkap</label>
                  <input type="text" required value={editingTeacher.name} onChange={(e) => setEditingTeacher({...editingTeacher, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">NIP</label>
                  <input type="text" required value={editingTeacher.nip} onChange={(e) => setEditingTeacher({...editingTeacher, nip: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Mata Pelajaran</label>
                    <input type="text" value={editingTeacher.subject} onChange={(e) => setEditingTeacher({...editingTeacher, subject: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Status Kepegawaian</label>
                    <select value={editingTeacher.status} onChange={(e) => setEditingTeacher({...editingTeacher, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="PNS">PNS</option>
                      <option value="PPPK">PPPK</option>
                      <option value="GTY">GTY</option>
                      <option value="Honorer">Honorer</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">No. HP / WA</label>
                    <input type="text" value={editingTeacher.phone} onChange={(e) => setEditingTeacher({...editingTeacher, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                    <input type="email" value={editingTeacher.email} onChange={(e) => setEditingTeacher({...editingTeacher, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setEditingTeacher(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Simpan Perubahan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR ABSENSI TAB */}
        {activeTab === 'qr' && (
          <div className="space-y-6 animate-fadeIn print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Absensi Harian Guru</h1>
                <p className="text-gray-500 text-sm">Pindai QR Code, tentukan status kehadiran, dan ambil foto selfie bukti presensi.</p>
              </div>
              <button
                onClick={openQrPrintModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm transition self-start sm:self-auto"
              >
                <Printer size={18} />
                <span>Menu Cetak QR Code</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Master QR Code */}
              <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                  <QrCode size={26} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">QR Code Presensi Guru</h3>
                <p className="text-gray-500 text-xs mb-4 max-w-xs leading-relaxed">
                  Pindai QR ini dengan kamera HP/Google Lens guru untuk langsung membuka formulir presensi dan bukti selfie di layar smartphone.
                </p>

                {/* Gambar QR Code Resmi */}
                <div className="p-4 bg-white border-4 border-blue-500/80 rounded-3xl shadow-md mb-3 hover:shadow-lg transition flex items-center justify-center">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code Presensi Guru SMP IT Annur Abhari" 
                      className="w-52 h-52 rounded-xl object-contain" 
                    />
                  ) : (
                    <div className="w-52 h-52 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                      <RefreshCw className="animate-spin text-blue-600 mb-2" size={24} />
                      <span className="text-xs">Menyiapkan QR Code...</span>
                    </div>
                  )}
                </div>

                <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-4 py-1 rounded-full text-xs tracking-wider mb-4">
                  SMP IT ANNUR ABHARI
                </span>

                {/* Pengaturan Sumber URL QR Code */}
                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-3 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700">Target Alamat URL QR:</span>
                    <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Aktif & Siap Scan
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 p-1 rounded-xl text-[11px] font-semibold mb-2.5">
                    <button
                      type="button"
                      onClick={() => setUrlMode('live')}
                      className={`py-1.5 px-2 rounded-lg transition text-center ${
                        urlMode === 'live' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ⚡ Server Aktif (Otomatis)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlMode('custom')}
                      className={`py-1.5 px-2 rounded-lg transition text-center ${
                        urlMode === 'custom' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ✏️ Tautan Kustom
                    </button>
                  </div>

                  {urlMode === 'live' ? (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 leading-relaxed space-y-1">
                      <p className="font-semibold flex items-center">
                        <CheckCircle size={14} className="text-emerald-600 mr-1.5 shrink-0" />
                        URL Live Aktif Terhubung Langsung
                      </p>
                      <p className="text-[10px] text-emerald-700">
                        QR Code menggunakan alamat server live yang sedang online saat ini. Tidak akan ada error 404 / <em>Page not found</em> saat di-scan HP guru.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-600">
                        Ketik Tautan / Domain Khusus:
                      </label>
                      <input
                        type="text"
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="Contoh: https://presensi.smpitannur.sch.id"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Tautan URL Langsung */}
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Tautan Presensi HP:</span>
                    <button
                      type="button"
                      onClick={handleCopyPortalLink}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1"
                    >
                      {isCopied ? (
                        <>
                          <CheckCircle size={12} className="text-emerald-600" />
                          <span className="text-emerald-600">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Salin Link</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-slate-700 truncate bg-white p-2 rounded-lg border border-slate-200 select-all">
                    {portalUrl || 'Menyiapkan URL...'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5 w-full mb-3">
                  <button
                    onClick={openQrPrintModal}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition"
                  >
                    <Printer size={15} /> <span>Cetak Poster</span>
                  </button>
                  <button
                    onClick={downloadQrCode}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition"
                  >
                    <Download size={15} /> <span>Unduh PNG</span>
                  </button>
                </div>

                {/* Tombol Uji Coba Simulasi HP */}
                <div className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('presensi_guru')}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition"
                  >
                    <Smartphone size={15} className="text-indigo-600" />
                    <span>Uji Coba Tampilan HP Guru</span>
                  </button>

                  {portalUrl && (
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-[11px] text-gray-500 hover:text-blue-600 underline font-medium"
                    >
                      <span>Buka Tautan di Tab Baru</span>
                      <ExternalLink size={12} className="ml-1" />
                    </a>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 mt-3">
                  * Cetak poster ini untuk ditempel di meja piket atau dinding ruang guru.
                </p>
              </div>

              {/* Attendance Form & Camera */}
              <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                  <QrCode className="mr-2 text-blue-600" size={22}/> Pindai Presensi & Foto
                </h3>

                <div className="space-y-4">
                  {/* Notice jika data guru masih kosong */}
                  {teachers.length === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span>Data guru masih kosong. Silakan tambahkan data guru terlebih dahulu agar dapat memilih nama guru.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('teachers')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 transition"
                      >
                        Ke Menu Data Guru
                      </button>
                    </div>
                  )}

                  {/* Select Teacher */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Pilih Nama Guru <span className="text-red-500">*</span>
                    </label>
                    <select 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-sm font-medium text-gray-800"
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                    >
                      <option value="">-- Pilih Nama Guru --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (NIP: {t.nip})</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Meeting - Hanya 1, 2, 3, 4 */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Sesi Pertemuan <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {['1', '2', '3', '4'].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSelectedMeeting(num)}
                          className={`py-2 rounded-xl font-bold text-sm transition border flex items-center justify-center ${
                            selectedMeeting === num
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <select 
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-bold text-blue-700 text-sm"
                      value={selectedMeeting}
                      onChange={(e) => setSelectedMeeting(e.target.value)}
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </div>

                  {/* Status Kehadiran: Hadir, Izin, Sakit */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Status Kehadiran <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAttendanceStatus('Hadir')}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition border ${
                          attendanceStatus === 'Hadir' 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300' 
                            : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle size={16} />
                        <span>Hadir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceStatus('Izin')}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition border ${
                          attendanceStatus === 'Izin' 
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-300' 
                            : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <AlertTriangle size={16} />
                        <span>Izin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceStatus('Sakit')}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition border ${
                          attendanceStatus === 'Sakit' 
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300' 
                            : 'bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <AlertCircle size={16} />
                        <span>Sakit</span>
                      </button>
                    </div>
                  </div>

                  {/* Keterangan jika Izin atau Sakit */}
                  {attendanceStatus !== 'Hadir' && (
                    <div className="animate-fadeIn bg-amber-50/40 p-3 rounded-xl border border-amber-200">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Keterangan / Alasan {attendanceStatus}:
                      </label>
                      <input
                        type="text"
                        value={attendanceNote}
                        onChange={(e) => setAttendanceNote(e.target.value)}
                        placeholder={`Contoh: Sedang sakit demam / Surat izin terlampir / Dinas luar...`}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                      />
                    </div>
                  )}

                  {/* AKSES KAMERA UNTUK FOTO / SELFIE */}
                  <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/70 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                        <Camera size={16} className="mr-1.5 text-blue-600" />
                        Foto Bukti Kehadiran (Selfie)
                      </label>
                      {capturedPhoto && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center">
                          <CheckCircle size={12} className="mr-1" /> Foto Tersimpan
                        </span>
                      )}
                    </div>

                    {/* Hidden input for photo upload */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="image/*" 
                      capture="user" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />

                    {/* Scenario 1: Foto sudah diambil */}
                    {capturedPhoto ? (
                      <div className="flex flex-col items-center space-y-2.5 py-1">
                        <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md">
                          <img src={capturedPhoto} alt="Bukti Foto Guru" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                          >
                            <RefreshCw size={13} /> <span>Ambil Ulang</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCapturedPhoto(null)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                          >
                            <Trash2 size={13} /> <span>Hapus Foto</span>
                          </button>
                        </div>
                      </div>
                    ) : isCameraActive ? (
                      /* Scenario 2: Kamera Aktif (Live Video Feed) */
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-black border-2 border-blue-500 shadow-inner">
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
                          />
                          <div className="absolute inset-4 border-2 border-white/30 border-dashed rounded-xl pointer-events-none"></div>
                          <div className="absolute top-2.5 right-2.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"></span> Kamera Aktif
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 w-full max-w-[280px]">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow transition"
                          >
                            <Camera size={15} /> <span>Ambil Foto</span>
                          </button>
                          <button
                            type="button"
                            onClick={switchCamera}
                            title="Ganti Kamera Depan/Belakang"
                            className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition"
                          >
                            <RotateCw size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            title="Tutup Kamera"
                            className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl transition"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Scenario 3: Kamera Belum Aktif */
                      <div className="p-4 bg-white rounded-xl border border-dashed border-gray-300 text-center space-y-2.5">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                          <Camera size={20} />
                        </div>
                        <p className="text-xs text-gray-600">
                          Ambil foto selfie guru saat melakukan scan presensi untuk verifikasi fisik kehadiran.
                        </p>
                        {cameraError && (
                          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs text-left space-y-1.5">
                            <div className="flex items-center font-semibold text-amber-800">
                              <AlertTriangle size={14} className="mr-1.5 text-amber-600 shrink-0" />
                              <span>Akses Kamera Browser Terbatas</span>
                            </div>
                            <p className="text-[11px] leading-relaxed">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full mt-1.5 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1 shadow-xs transition"
                            >
                              <Camera size={13} />
                              <span>Klik di Sini: Buka Kamera HP / Galeri</span>
                            </button>
                          </div>
                        )}
                        <div className="flex flex-wrap justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            disabled={isCameraLoading}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
                          >
                            <Camera size={14} /> <span>{isCameraLoading ? 'Menghubungkan...' : 'Buka Kamera Web'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
                          >
                            <ImageIcon size={14} /> <span>Ambil Foto HP / File</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedTeacherId && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex justify-between items-center">
                      <span className="font-medium">Total Absensi Guru Ini Hari Ini:</span>
                      <span className="font-bold text-sm bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full">
                        {attendances.filter(a => a.teacherId === selectedTeacherId && a.date === new Date().toLocaleDateString('id-ID')).length} / 4 Sesi
                      </span>
                    </div>
                  )}

                  <button 
                    onClick={handleRecordAttendance}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
                  >
                    <QrCode size={20} /> <span>Konfirmasi Kehadiran ({attendanceStatus})</span>
                  </button>
                  <p className="text-[11px] text-gray-400 mt-2 text-center">
                    Batas maksimal: Setiap guru dapat mengisi absensi hingga 4 sesi pertemuan per hari.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REKAP ABSENSI TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center print:hidden">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Rekapitulasi Absensi</h1>
                <p className="text-gray-500 text-sm">Daftar rekaman kehadiran guru lengkap dengan status dan foto bukti presensi.</p>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-4 md:mt-0">
                <button 
                  onClick={exportToExcel} 
                  title="Unduh file spreadsheet Excel rapi dengan kop surat dan styling resmi"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl flex items-center space-x-2 shadow-xs transition text-xs font-bold"
                >
                  <Download size={16} /> <span>Unduh Excel (.xls)</span>
                </button>
                <button 
                  onClick={exportToCSV} 
                  title="Unduh file format CSV UTF-8"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl flex items-center space-x-2 shadow-xs transition text-xs font-bold"
                >
                  <FileText size={16} /> <span>Unduh CSV</span>
                </button>
                <button 
                  onClick={handlePrintRekapPdf} 
                  title="Cetak langsung atau simpan sebagai PDF A4 resmi"
                  className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl flex items-center space-x-2 shadow-xs transition text-xs font-bold"
                >
                  <Printer size={16} /> <span>Cetak Laporan PDF</span>
                </button>
              </div>
            </div>

            {/* Statistik Ringkas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
              <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-xs">
                <p className="text-xs text-gray-500 font-medium">Total Rekap</p>
                <p className="text-xl font-bold text-gray-800">{attendances.length}</p>
              </div>
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                <p className="text-xs text-emerald-700 font-medium">Hadir</p>
                <p className="text-xl font-bold text-emerald-800">
                  {attendances.filter(a => !a.status || a.status === 'Hadir').length}
                </p>
              </div>
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100 shadow-xs">
                <p className="text-xs text-amber-700 font-medium">Izin</p>
                <p className="text-xl font-bold text-amber-800">
                  {attendances.filter(a => a.status === 'Izin').length}
                </p>
              </div>
              <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100 shadow-xs">
                <p className="text-xs text-rose-700 font-medium">Sakit</p>
                <p className="text-xl font-bold text-rose-800">
                  {attendances.filter(a => a.status === 'Sakit').length}
                </p>
              </div>
            </div>
            
            <div className="rekap-print-content bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none print:p-0">
              {/* KOP SURAT RESMI UNTUK CETAK PDF */}
              <div className="hidden print:block mb-4">
                <div className="text-center pb-2">
                  <h3 className="text-xs font-bold tracking-wider uppercase text-gray-800">
                    YAYASAN PENDIDIKAN ISLAM ANNUR ABHARI
                  </h3>
                  <h1 className="text-2xl font-black tracking-tight text-blue-900 my-0.5">
                    SMP IT ANNUR ABHARI
                  </h1>
                  <p className="text-[11px] text-gray-600 font-medium">
                    NPSN: 69982341 | Akreditasi: B | Telp: (021) 89012345 | Email: info@smpitannur.sch.id
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Alamat: Jl. Raya Pendidikan No. 12, Jawa Barat - Indonesia
                  </p>
                </div>
                {/* Garis Ganda Kop Surat */}
                <div className="border-b-2 border-black"></div>
                <div className="border-b border-black mt-0.5 mb-3"></div>

                <div className="text-center mb-3">
                  <h2 className="text-base font-bold uppercase tracking-wider text-black underline">
                    LAPORAN REKAPITULASI PRESENSI KEHADIRAN GURU
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <div className="flex justify-center space-x-6 text-xs text-gray-800 font-semibold mt-2 py-1 px-3 bg-gray-100 border border-gray-400 rounded">
                    <span>Total Rekap: {attendances.length}</span>
                    <span>Hadir: {attendances.filter(a => !a.status || a.status === 'Hadir').length}</span>
                    <span>Izin: {attendances.filter(a => a.status === 'Izin').length}</span>
                    <span>Sakit: {attendances.filter(a => a.status === 'Sakit').length}</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-700 border-b print:bg-gray-100 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-3 border-b text-center w-12 print:border-gray-700 print:text-black">No</th>
                      <th className="p-3 border-b print:border-gray-700 print:text-black">Tanggal & Waktu</th>
                      <th className="p-3 border-b text-center print:border-gray-700 print:text-black">Sesi</th>
                      <th className="p-3 border-b text-center print:border-gray-700 print:text-black">Status</th>
                      <th className="p-3 border-b print:border-gray-700 print:text-black">Nama Guru</th>
                      <th className="p-3 border-b print:border-gray-700 print:text-black">NIP</th>
                      <th className="p-3 border-b print:border-gray-700 print:text-black">Keterangan</th>
                      <th className="p-3 border-b text-center print:border-gray-700 print:text-black">Foto Bukti</th>
                      <th className="p-3 border-b text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 print:divide-gray-400 text-sm">
                    {attendances.map((a, idx) => {
                      const meetingNum = (a.meeting || '1').replace(/[^0-9]/g, '') || '1';
                      return (
                        <tr key={a.id} className="hover:bg-gray-50 print:hover:bg-white">
                          <td className="p-3 text-center text-xs font-semibold text-gray-500 print:text-black print:border-b">
                            {idx + 1}
                          </td>
                          <td className="p-3 text-gray-800 font-medium print:border-b whitespace-nowrap">
                            <div>{a.date}</div>
                            <div className="text-xs text-gray-500 font-mono print:text-black">{a.time}</div>
                          </td>
                          <td className="p-3 print:border-b text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-0.5 text-xs font-bold rounded-lg bg-blue-100 text-blue-900 border border-blue-200 print:border-black print:bg-white print:text-black">
                              {meetingNum}
                            </span>
                          </td>
                          <td className="p-3 print:border-b text-center whitespace-nowrap">
                            {(!a.status || a.status === 'Hadir') && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 print:bg-white print:text-black print:border-black">
                                <CheckCircle size={12} className="mr-1 print:hidden" /> Hadir
                              </span>
                            )}
                            {a.status === 'Izin' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 print:bg-white print:text-black print:border-black">
                                <AlertTriangle size={12} className="mr-1 print:hidden" /> Izin
                              </span>
                            )}
                            {a.status === 'Sakit' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 print:bg-white print:text-black print:border-black">
                                <AlertCircle size={12} className="mr-1 print:hidden" /> Sakit
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-800 font-bold print:border-b whitespace-nowrap">{a.teacherName}</td>
                          <td className="p-3 text-gray-600 print:border-b font-mono text-xs whitespace-nowrap">{a.teacherNip}</td>
                          <td className="p-3 text-gray-600 print:border-b text-xs max-w-xs">
                            {a.note ? (
                              <span className="italic bg-gray-50 px-2 py-0.5 rounded border border-gray-200 text-gray-700 print:border-none print:p-0">
                                {a.note}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 print:border-b text-center">
                            {a.photoUrl ? (
                              <div className="inline-block">
                                <button 
                                  onClick={() => setViewPhotoModal({ 
                                    url: a.photoUrl, 
                                    teacherName: a.teacherName, 
                                    date: a.date, 
                                    time: a.time, 
                                    status: a.status || 'Hadir' 
                                  })} 
                                  title="Klik untuk perbesar foto"
                                  className="relative group w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 shadow-xs hover:ring-2 hover:ring-blue-500 transition cursor-pointer print:w-9 print:h-9 print:rounded-md"
                                >
                                  <img src={a.photoUrl} alt={a.teacherName} className="w-full h-full object-cover" />
                                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition print:hidden">
                                    <Eye size={14} />
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">Tanpa Foto</span>
                            )}
                          </td>
                          <td className="p-3 print:border-b text-center print:hidden">
                            <button
                              onClick={() => handleDeleteAttendance(a.id, a.teacherName, meetingNum)}
                              title="Hapus riwayat absensi ini"
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {attendances.length === 0 && (
                      <tr><td colSpan={9} className="p-8 text-center text-gray-400">Belum ada data kehadiran yang tercatat.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TANDA TANGAN RESMI UNTUK CETAK PDF */}
              <div className="hidden print:block mt-8 pt-4 print:break-inside-avoid">
                <div className="grid grid-cols-2 gap-8 text-xs text-black">
                  <div className="text-center">
                    <p className="font-medium">Mengetahui,</p>
                    <p className="font-bold text-sm">Kepala SMP IT Annur Abhari</p>
                    <div className="h-20"></div>
                    <p className="font-bold underline text-sm">___________________________</p>
                    <p className="text-[11px] text-gray-600">NIP. -</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">
                      Dicetak di Sekolah, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="font-bold text-sm">Petugas Presensi / Kurikulum</p>
                    <div className="h-20"></div>
                    <p className="font-bold underline text-sm">___________________________</p>
                    <p className="text-[11px] text-gray-600">NIP. -</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARSIP FILE TAB */}
        {activeTab === 'files' && (
          <div className="space-y-6 animate-fadeIn print:hidden">
            <h1 className="text-3xl font-bold text-gray-800">Arsip File (RPP, Modul & Jurnal)</h1>
            <p className="text-gray-600 text-sm">Simpan tautan Google Drive untuk dokumen RPP, Jurnal, dan Modul Ajar agar dapat saling diakses antar guru SMP IT Annur Abhari secara terorganisir.</p>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Tambah Dokumen ke Arsip File</h3>
              <form onSubmit={handleAddFile} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Judul Dokumen *</label>
                  <input type="text" required value={newFile.title} onChange={(e) => setNewFile({...newFile, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="RPP Matematika Kelas VII Semester 1" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori Dokumen</label>
                  <select required value={newFile.category} onChange={(e) => setNewFile({...newFile, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="RPP">RPP (Rencana Pelaksanaan Pembelajaran)</option>
                    <option value="Modul">Modul Ajar</option>
                    <option value="Jurnal">Jurnal Mengajar</option>
                    <option value="Lainnya">Dokumen Lainnya</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Link Google Drive / Word *</label>
                  <input type="url" required value={newFile.link} onChange={(e) => setNewFile({...newFile, link: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://drive.google.com/..." />
                </div>
                <div className="md:col-span-2">
                  <button type="submit" className="w-full bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center justify-center space-x-2 text-sm font-semibold transition">
                    <Plus size={18} /> <span>Simpan</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {files.map(f => (
                <div key={f.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                        f.category === 'RPP' ? 'bg-blue-100 text-blue-700' : 
                        f.category === 'Modul' ? 'bg-emerald-100 text-emerald-700' : 
                        f.category === 'Jurnal' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {f.category}
                      </span>
                      <button onClick={() => handleDeleteFile(f.id, f.title)} className="text-gray-400 hover:text-red-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <h4 className="font-bold text-gray-800 mt-2 line-clamp-2">{f.title}</h4>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <a href={f.link} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-semibold hover:underline flex items-center">
                      Buka Dokumen <Download size={14} className="ml-1" />
                    </a>
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <div className="col-span-full p-10 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                  Belum ada dokumen yang tersimpan di Arsip File.
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* MODAL CETAK POSTER QR CODE */}
      {showQrPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 md:p-8 animate-fadeIn print:shadow-none print:max-w-none print:w-full print:p-0">
            {/* Header controls (hidden on print) */}
            <div className="flex justify-between items-center pb-4 mb-6 border-b print:hidden">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Cetak Poster QR Code Absensi</h3>
                <p className="text-xs text-gray-500">Lembar resmi presensi guru untuk ditempel di ruang guru / meja piket</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={downloadQrCode}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <Download size={15} /> <span>Unduh PNG</span>
                </button>
                <button 
                  onClick={triggerQrPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow transition"
                >
                  <Printer size={15} /> <span>Cetak Sekarang</span>
                </button>
                <button 
                  onClick={() => setShowQrPrintModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Poster content */}
            <div className="qr-print-content border-2 border-gray-800 rounded-2xl p-6 md:p-8 text-center bg-white print:border-none print:p-4 print:m-0">
              <div className="max-w-md mx-auto">
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 bg-blue-700 rounded-2xl flex items-center justify-center text-white shadow-sm">
                    <QrCode size={26} />
                  </div>
                </div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-blue-900">YAYASAN PENDIDIKAN ISLAM ANNUR ABHARI</h3>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">SMP IT ANNUR ABHARI</h1>
                <p className="text-[11px] text-gray-500 font-medium">SISTEM PRESENSI & KEHADIRAN GURU</p>
                
                <div className="my-4 border-t-2 border-b-2 border-gray-900 py-1">
                  <p className="font-extrabold text-xs tracking-widest text-gray-800 uppercase">
                    LEMBAR RESMI QR CODE KEHADIRAN GURU
                  </p>
                </div>

                <div className="inline-block p-3 bg-white border-4 border-blue-600 rounded-2xl shadow-sm my-1">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code Presensi Guru" 
                      className="w-56 h-56 mx-auto object-contain"
                    />
                  ) : (
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(portalUrl || '')}`} 
                      alt="QR Code Presensi Guru" 
                      className="w-56 h-56 mx-auto object-contain"
                    />
                  )}
                </div>

                <div className="mt-1 mb-2">
                  <p className="text-[10px] text-gray-500 font-mono select-all">
                    Tautan Akses: {portalUrl}
                  </p>
                </div>

                <div className="mt-3 bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-left text-xs space-y-1.5 text-gray-700">
                  <p className="font-bold text-blue-900 text-xs mb-1 text-center uppercase tracking-wider">
                    Petunjuk Pengisian Absensi Melalui Smartphone Guru:
                  </p>
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-blue-700">1.</span>
                    <span>Buka kamera smartphone atau Google Lens, arahkan ke QR Code di atas.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-blue-700">2.</span>
                    <span>Ketuk tautan yang muncul untuk membuka Portal Presensi Guru SMP IT Annur Abhari di layar HP Anda.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-blue-700">3.</span>
                    <span>Pilih nama guru dan sesi pertemuan (Sesi 1, 2, 3, atau 4).</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-blue-700">4.</span>
                    <span>Pilih status kehadiran: <b>Hadir</b>, <b>Izin</b>, atau <b>Sakit</b>, lalu ambil foto selfie bukti presensi.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-blue-700">5.</span>
                    <span>Tekan tombol <b>Kirim Presensi Sekarang</b>. Struk digital bukti presensi akan langsung muncul di HP Anda.</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-300 flex justify-between text-left text-xs text-gray-600">
                  <div>
                    <p className="font-medium">Mengetahui,</p>
                    <p className="font-bold text-gray-800">Kepala SMP IT Annur Abhari</p>
                    <div className="h-14"></div>
                    <p className="font-bold text-gray-900 underline">________________________</p>
                    <p className="text-[10px] text-gray-500">NIP. -</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Dicetak Pada:</p>
                    <p className="font-bold text-gray-800">{new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <div className="h-14"></div>
                    <p className="font-bold text-gray-900 underline">TIM KURIKULUM & SDM</p>
                    <p className="text-[10px] text-gray-500">SMP IT Annur Abhari</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW FOTO DETAIL */}
      {viewPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 animate-fadeIn text-center">
            <div className="flex justify-between items-center mb-3 pb-2 border-b">
              <div className="text-left">
                <h4 className="font-bold text-gray-900 text-sm">{viewPhotoModal.teacherName}</h4>
                <p className="text-xs text-gray-500">{viewPhotoModal.date} • {viewPhotoModal.time}</p>
              </div>
              <button 
                onClick={() => setViewPhotoModal(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center mb-4 aspect-square shadow-inner border border-gray-200">
              <img src={viewPhotoModal.url} alt="Foto Bukti Kehadiran" className="w-full h-full object-cover" />
            </div>

            <div className="flex justify-between items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                viewPhotoModal.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                viewPhotoModal.status === 'Izin' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                Status: {viewPhotoModal.status}
              </span>
              <button 
                onClick={() => setViewPhotoModal(null)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Print */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 10mm 10mm;
        }
        @media print {
          html, body { 
            background-color: white !important; 
            color: #000 !important;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:break-inside-avoid { 
            break-inside: avoid !important; 
            page-break-inside: avoid !important; 
          }
          table { 
            width: 100% !important; 
            border-collapse: collapse !important; 
            font-size: 11px !important;
          }
          thead { display: table-header-group !important; }
          tr { 
            break-inside: avoid !important; 
            page-break-inside: avoid !important; 
          }
          th, td { 
            border: 1px solid #374151 !important; 
            padding: 5px 6px !important; 
            color: #000 !important;
          }
          ${printTarget === 'qr' ? `
            .rekap-print-content { display: none !important; }
            .qr-print-content { display: block !important; }
          ` : `
            .rekap-print-content { display: block !important; }
            .qr-print-content { display: none !important; }
          `}
        }
      `}</style>
    </div>
  );
}
