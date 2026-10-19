const token=sessionStorage.getItem("hadirin_token");const stored=sessionStorage.getItem("hadirin_user");if(!token||!stored)location.replace("/");
const user=JSON.parse(stored||"{}");const $=s=>document.querySelector(s);
$("#user-name").textContent=user.name||user.nim||"Pengguna";
const labels={admin:"ADMINISTRATOR",dosen:"PORTAL DOSEN",mahasiswa:"PORTAL MAHASISWA"};
$("#role-label").textContent=labels[user.role]||"PORTAL AKADEMIK";
$("#dash-subtitle").textContent=user.role==="admin"?"Pantau data akademik dan kelola presensi kampus.":user.role==="dosen"?"Kelola sesi presensi dan pantau kehadiran kelas.":"Akses jadwal kuliah dan riwayat presensimu.";
const cards={
 admin:[["♙","Data mahasiswa","Kelola data mahasiswa, kelas, jurusan, dan semester."],["♧","Dosen & mata kuliah","Kelola pengajar dan mata kuliah."],["▤","Laporan presensi","Lihat rekap dan siapkan ekspor laporan."]],
 dosen:[["▦","Sesi absensi","Buka sesi QR dengan batas waktu 15 menit."],["♙","Daftar kehadiran","Pantau status hadir, telat, izin, sakit, dan alpha."],["▤","Rekap semester","Tinjau rekap kehadiran kelas yang diajar."]],
 mahasiswa:[["▦","Absen sekarang","Scan QR sesi aktif, cek lokasi, dan kirim selfie."],["▣","Jadwal hari ini","Lihat mata kuliah dan waktu perkuliahan."],["◷","Riwayat presensi","Pantau kehadiran pribadi dan status presensi."]]
};
$("#dash-cards").innerHTML=(cards[user.role]||[]).map(([icon,title,text])=>`<article class="feature"><span>${icon}</span><h3>${title}</h3><p>${text}</p></article>`).join("");
$("#panel-title").textContent=user.role==="admin"?"Ringkasan administrasi":user.role==="dosen"?"Aksi dosen":"Informasi presensi";
$("#panel-description").textContent="Akun berhasil masuk. Sambungkan data jadwal dan modul sesuai role untuk mengaktifkan fitur lengkap.";
async function api(url){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d.error||"Gagal memuat data.");return d;}
async function render(){
 const panel=$("#panel-content");
 if(user.role==="admin"){
  try{const d=await api("/api/admin/overview");panel.innerHTML=`<div class="stats"><div class="stat-card blue-card"><strong>${d.students}</strong><small>Mahasiswa</small></div><div class="stat-card green-card"><strong>${d.lecturers}</strong><small>Dosen</small></div><div class="stat-card blue-card"><strong>${d.courses}</strong><small>Mata kuliah</small></div><div class="stat-card green-card"><strong>${d.attendanceRecords}</strong><small>Catatan absensi</small></div></div>`;}
  catch(e){panel.textContent=e.message;}
 } else if(user.role==="mahasiswa"){
  try{const d=await api("/api/student/history");const items=d.history||[];panel.innerHTML=items.length?`<div class="history-list">${items.map(x=>`<div class="session-row"><div><b>${x.sesi_absensi?.jadwal?.mata_kuliah?.nama||"Mata kuliah"}</b><small>${new Date(x.waktu_absen).toLocaleString("id-ID")}</small></div><span class="pill">${x.status}</span></div>`).join("")}</div>`:"Belum ada riwayat presensi.";}
  catch(e){panel.textContent=e.message;}
 } else {panel.textContent="Modul pembuat sesi, QR, dan rekap per kelas perlu disambungkan pada halaman ini.";}
}
render();
$("#logout").addEventListener("click",()=>{sessionStorage.removeItem("hadirin_token");sessionStorage.removeItem("hadirin_user");location.replace("/");});