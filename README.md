# Hadirin — HTML, CSS, JavaScript + Backend

Starter project website absensi mahasiswa dengan:
- Frontend: HTML, CSS, JavaScript murni (tanpa Next.js).
- Backend: Node.js + Express.
- Database: Supabase PostgreSQL.
- Login role: Admin, Dosen, Mahasiswa.
- Endpoint awal untuk ringkasan admin, data mahasiswa, buat sesi QR 15 menit, presensi dengan validasi QR/waktu/GPS/selfie, dan riwayat mahasiswa.

## Persiapan
1. Instal Node.js LTS.
2. Ekstrak ZIP, buka folder proyek di VS Code.
3. Di terminal jalankan `npm install`.
4. Salin `.env.example` menjadi `.env`.
   - Windows CMD: `copy .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
5. Isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, dan `JWT_SECRET`.
   `JWT_SECRET` harus random dan panjang minimal 32 karakter. Buat secret misalnya dengan `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
6. Buka Supabase SQL Editor, jalankan `supabase/schema.sql`.
7. Jalankan `npm run dev`, lalu buka http://localhost:3000.

## Membuat akun
Buat akun melalui Supabase Auth (email/password) dan buat row `public.users` dengan UUID sama dengan `auth.users.id`, NIM, nama, role, dan `is_active=true`. Email login yang dipakai backend adalah `${NIM}@akun.kampus.local`. Buat row mahasiswa/dosen terkait. Provisioning harus dilakukan oleh admin tepercaya, bukan frontend publik.

## Endpoint tersedia
- `POST /api/auth/login` — body `{ "nim":"...", "password":"..." }`
- `GET /api/me` — bearer token
- `GET /api/stats/public` — statistik landing page
- `GET /api/admin/overview` — admin
- `GET/POST/PUT/DELETE /api/admin/students...` — CRUD awal mahasiswa (create perlu `user_id` dari akun Auth yang sudah diprovision)
- `POST /api/sessions` — dosen/admin membuat sesi; sesi berakhir setelah 15 menit; response memuat `qrPayload` untuk dirender sebagai QR.
- `POST /api/attendance` — multipart form: `sessionId`, `qrToken`, `latitude`, `longitude`, `accuracy`, `deviceId`, dan file `selfie`
- `GET /api/student/history` — riwayat presensi mahasiswa

## Hal yang harus diperkuat sebelum produksi
- Service role key memiliki akses tinggi dan hanya boleh disimpan di backend `.env`; jangan commit `.env`.
- Endpoint pembuatan sesi harus memeriksa dosen benar-benar mengajar mata kuliah/jadwal terkait. Pengecekan tersebut masih ditandai untuk ditambahkan.
- Implementasikan pembatasan perangkat berbasis registrasi perangkat dan proses reset admin; `deviceId` di browser bukan bukti perangkat yang kuat dan dapat dipalsukan.
- GPS browser dapat dipalsukan. Pemeriksaan radius server mengurangi risiko, tetapi tidak dapat menjamin deteksi fake GPS.
- Foto selfie pada starter disimpan di folder privat lokal dan belum mempunyai halaman peninjauan/retensi. Untuk produksi, pindahkan ke private Supabase Storage, batasi akses, buat kebijakan retensi dan persetujuan.
- Scanner kamera, renderer QR, UI CRUD penuh, ekspor Excel/PDF, izin/sakit, jadwal, penutupan sesi terjadwal, dan audit edit manual belum seluruhnya diselesaikan.
- Jangan digunakan untuk presensi resmi sebelum diuji dengan akun per role, kebijakan privasi, dan audit keamanan.
