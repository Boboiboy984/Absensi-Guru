import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Home, Users, QrCode, FileText, Download, LogOut, Plus, Trash2, Printer, FolderOpen, Edit, Search, Phone, Mail, X } from 'lucide-react';

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
  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const [teachers, setTeachers] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  const [newTeacher, setNewTeacher] = useState({ name: '', nip: '', subject: '', status: 'PNS', phone: '', email: '' });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState('1');
  const [newFile, setNewFile] = useState({ title: '', category: 'RPP', link: '' });

  const showNotification = (message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 4000);
  };

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
        console.warn("Autentikasi Anonim Firebase belum diaktifkan di Console, menggunakan fallback mode:", error);
        // Fallback user agar Firestore tetap dapat diakses jika Rules disetel public
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
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error teachers:", error));

    const unsubAttendances = onSnapshot(attendanceRef, (snapshot) => {
      const attData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      attData.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setAttendances(attData);
    }, (error) => console.error("Error attendances:", error));

    const unsubFiles = onSnapshot(filesRef, (snapshot) => {
      const fileData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fileData.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setFiles(fileData);
    }, (error) => console.error("Error files:", error));

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
    if (!user || !newTeacher.name || !newTeacher.nip) return;
    try {
      await addDoc(collection(db, 'teachers'), {
        ...newTeacher,
        createdAt: serverTimestamp()
      });
      setNewTeacher({ name: '', nip: '', subject: '', status: 'PNS', phone: '', email: '' });
      showNotification('Data guru berhasil ditambahkan!', 'success');
    } catch (error) {
      console.error("Error adding teacher: ", error);
      showNotification('Gagal menambahkan data guru.', 'error');
    }
  };

  const handleEditTeacher = (teacher: any) => {
    setEditingTeacher({ ...teacher });
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTeacher || !editingTeacher.id) return;
    try {
      const teacherDocRef = doc(db, 'teachers', editingTeacher.id);
      await updateDoc(teacherDocRef, {
        name: editingTeacher.name || '',
        nip: editingTeacher.nip || '',
        subject: editingTeacher.subject || '',
        status: editingTeacher.status || 'PNS',
        phone: editingTeacher.phone || '',
        email: editingTeacher.email || ''
      });
      setEditingTeacher(null);
      showNotification('Data guru berhasil diperbarui!', 'success');
    } catch (error) {
      console.error("Error updating teacher: ", error);
      showNotification('Gagal memperbarui data guru.', 'error');
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!user) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
      showNotification(`Data ${name} berhasil dihapus.`, 'success');
    } catch (error) {
      console.error("Error deleting teacher: ", error);
      showNotification('Gagal menghapus data guru.', 'error');
    }
  };

  const handleRecordAttendance = async () => {
    if (!user || !selectedTeacherId) {
      showNotification('Pilih nama guru terlebih dahulu!', 'error');
      return;
    }
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return;
    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');

    const todayTeacherAttendances = attendances.filter(
      a => a.teacherId === selectedTeacherId && a.date === todayStr
    );

    if (todayTeacherAttendances.length >= 4) {
      showNotification(`Batas maksimal 4 kali absensi per hari untuk ${teacher.name} telah tercapai!`, 'error');
      return;
    }

    const alreadyForMeeting = todayTeacherAttendances.some(
      a => (a.meeting || 'Pertemuan 1') === `Pertemuan ${selectedMeeting}`
    );

    if (alreadyForMeeting) {
      showNotification(`${teacher.name} sudah mengisi absensi Pertemuan ${selectedMeeting} hari ini!`, 'error');
      return;
    }

    try {
      await addDoc(collection(db, 'attendances'), {
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherNip: teacher.nip,
        meeting: `Pertemuan ${selectedMeeting}`,
        date: todayStr,
        time: now.toLocaleTimeString('id-ID'),
        timestamp: serverTimestamp()
      });
      showNotification(`Berhasil merekam absensi Pertemuan ${selectedMeeting} untuk ${teacher.name}!`, 'success');
      setSelectedTeacherId('');
      setSelectedMeeting('1');
    } catch (error) {
      console.error("Error recording attendance: ", error);
      showNotification('Gagal menyimpan absensi.', 'error');
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFile.title || !newFile.link) return;
    try {
      await addDoc(collection(db, 'files'), {
        ...newFile,
        timestamp: serverTimestamp()
      });
      setNewFile({ title: '', category: 'RPP', link: '' });
      showNotification('Dokumen berhasil ditambahkan ke Arsip File!', 'success');
    } catch (error) {
      console.error("Error adding file: ", error);
      showNotification('Gagal menyimpan dokumen.', 'error');
    }
  };

  const handleDeleteFile = async (id: string, title: string) => {
    if (!user) return;
    if (!window.confirm(`Hapus dokumen "${title}" dari Arsip File?`)) return;
    try {
      await deleteDoc(doc(db, 'files', id));
      showNotification('Dokumen berhasil dihapus.', 'success');
    } catch (error) {
      console.error("Error deleting file: ", error);
      showNotification('Gagal menghapus dokumen.', 'error');
    }
  };

  const exportToExcel = () => {
    let csvContent = "Tanggal,Waktu,Pertemuan,Nama Guru,NIP\n";
    attendances.forEach(row => {
      csvContent += `"${row.date}","${row.time}","${row.meeting || 'Pertemuan 1'}","${row.teacherName}","${row.teacherNip}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Rekap_Absensi_Guru_SMPIT_Annur.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('File Excel (CSV) berhasil diunduh!', 'success');
  };

  const exportToPDF = () => {
    window.print();
  };

  const filteredTeachers = teachers.filter(t => {
    const term = teacherSearch.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(term)) ||
      (t.nip && t.nip.toLowerCase().includes(term)) ||
      (t.subject && t.subject.toLowerCase().includes(term))
    );
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-blue-100">
          <div className="text-center mb-6">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
              <Users className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Aplikasi Guru</h1>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Username Akses</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Masukkan password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition shadow-md"
            >
              Masuk
            </button>
          </form>
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
              <h1 className="text-3xl font-bold text-gray-800">Manajemen Data Guru</h1>
              <div className="relative mt-4 md:mt-0 w-full md:w-72">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Cari nama, NIP, mapel..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
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
                    <tr><td colSpan="6" className="p-6 text-center text-gray-400">Data guru tidak ditemukan.</td></tr>
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
          <div className="space-y-6 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800">Absensi Harian Guru</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Master QR Code */}
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-2">QR Code Kehadiran Master</h3>
                <p className="text-gray-500 text-sm mb-6">QR Code ini digunakan oleh seluruh guru SMP IT Annur Abhari untuk melakukan absensi.</p>
                <div className="p-4 bg-white border-4 border-blue-100 rounded-2xl shadow-inner mb-4">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ABSENSI_SMPIT_ANNUR_ABHARI_2026" alt="QR Absensi" className="w-48 h-48" />
                </div>
                <p className="font-mono text-blue-600 font-bold tracking-widest bg-blue-50 px-4 py-2 rounded-lg text-sm">PROYEK: smpitannurabhari-babad</p>
              </div>

              {/* Simulation Scanner */}
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><QrCode className="mr-2 text-blue-600"/> Pindai Kehadiran</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Nama Guru</label>
                    <select 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-sm"
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                    >
                      <option value="">-- Pilih Nama Guru --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (NIP: {t.nip})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Pertemuan Hari Ini</label>
                    <select 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-semibold text-blue-700 text-sm"
                      value={selectedMeeting}
                      onChange={(e) => setSelectedMeeting(e.target.value)}
                    >
                      <option value="1">Pertemuan 1</option>
                      <option value="2">Pertemuan 2</option>
                      <option value="3">Pertemuan 3</option>
                      <option value="4">Pertemuan 4</option>
                    </select>
                  </div>

                  {selectedTeacherId && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex justify-between items-center">
                      <span>Total Absensi Hari Ini:</span>
                      <span className="font-bold text-sm">
                        {attendances.filter(a => a.teacherId === selectedTeacherId && a.date === new Date().toLocaleDateString('id-ID')).length} / 4 Sesi
                      </span>
                    </div>
                  )}

                  <button 
                    onClick={handleRecordAttendance}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2 shadow-md"
                  >
                    <QrCode size={20} /> <span>Konfirmasi Kehadiran</span>
                  </button>
                  <p className="text-xs text-gray-400 mt-2 text-center">Batas maksimal: Setiap guru hanya dapat mengisi absensi hingga 4 kali per hari.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REKAP ABSENSI TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center print:hidden">
              <h1 className="text-3xl font-bold text-gray-800">Rekapitulasi Absensi</h1>
              <div className="flex space-x-3 mt-4 md:mt-0">
                <button onClick={exportToExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center space-x-2 shadow-sm transition text-sm font-semibold">
                  <Download size={18} /> <span>Unduh Excel (CSV)</span>
                </button>
                <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 shadow-sm transition text-sm font-semibold">
                  <Printer size={18} /> <span>Cetak PDF</span>
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
              <div className="hidden print:block text-center mb-6">
                <h2 className="text-2xl font-bold">Laporan Kehadiran Guru - SMP IT Annur Abhari</h2>
                <p className="text-gray-600">Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
                <hr className="my-4" />
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-700 border-b print:bg-white text-xs uppercase font-bold">
                  <tr>
                    <th className="p-4 border-b print:border-gray-800">Tanggal</th>
                    <th className="p-4 border-b print:border-gray-800">Waktu</th>
                    <th className="p-4 border-b print:border-gray-800">Sesi / Pertemuan</th>
                    <th className="p-4 border-b print:border-gray-800">Nama Guru</th>
                    <th className="p-4 border-b print:border-gray-800">NIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 print:divide-gray-400 text-sm">
                  {attendances.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-800 font-medium print:border-b">{a.date}</td>
                      <td className="p-4 text-gray-600 print:border-b">{a.time}</td>
                      <td className="p-4 print:border-b">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {a.meeting || 'Pertemuan 1'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-800 font-bold print:border-b">{a.teacherName}</td>
                      <td className="p-4 text-gray-600 print:border-b font-mono text-xs">{a.teacherNip}</td>
                    </tr>
                  ))}
                  {attendances.length === 0 && (
                    <tr><td colSpan="5" className="p-6 text-center text-gray-400">Belum ada data kehadiran di database.</td></tr>
                  )}
                </tbody>
              </table>
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

      {/* Global CSS for Print */}
      <style>{`
        @media print {
          body { background-color: white; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:divide-gray-400 > :not([hidden]) ~ :not([hidden]) { border-color: #9ca3af !important; }
          .print\\:border-gray-800 { border-color: #1f2937 !important; border-width: 1px !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid black !important; padding: 8px !important; }
        }
      `}</style>
    </div>
  );
}
