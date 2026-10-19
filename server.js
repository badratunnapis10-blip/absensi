import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET wajib diatur dengan nilai acak minimal 32 karakter.");
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diatur di .env.");
  process.exit(1);
}
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));

const uploadsDir = path.join(__dirname, "private-uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Sesi login tidak valid atau kedaluwarsa." }); }
}
function role(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: "Akses ditolak untuk role ini." });
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = d => d * Math.PI / 180;
  const a = Math.sin(rad(lat2-lat1)/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}
function validCoords(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
async function getProfile(userId) {
  const { data, error } = await db.from("users").select("id,nim,full_name,role,is_active").eq("id", userId).single();
  if (error) throw error;
  return data;
}

// Demo login: NIM is mapped to an internal Supabase Auth email.
// Create accounts through a trusted admin provisioning process first.
app.post("/api/auth/login", async (req, res) => {
  try {
    const nim = String(req.body?.nim || "").trim();
    const password = String(req.body?.password || "");
    if (!nim || !password) return res.status(400).json({ error: "NIM dan password wajib diisi." });
    // Admin/service role is never sent to browser. Sign in with Supabase Auth using anon client in production
    // or use a dedicated auth flow. This endpoint verifies credentials via Supabase Auth REST endpoint.
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY || "" },
      body: JSON.stringify({ email: `${nim}@akun.kampus.local`, password })
    });
    const authData = await response.json();
    if (!response.ok || !authData.user?.id) return res.status(401).json({ error: "NIM atau password salah." });
    const profile = await getProfile(authData.user.id);
    if (!profile.is_active) return res.status(403).json({ error: "Akun dinonaktifkan. Hubungi admin." });
    const token = jwt.sign({ sub: profile.id, nim: profile.nim, role: profile.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { nim: profile.nim, name: profile.full_name, role: profile.role } });
  } catch (e) { console.error("login:", e.message); res.status(500).json({ error: "Login gagal. Periksa konfigurasi database." }); }
});

app.get("/api/me", auth, async (req, res) => {
  try { const profile = await getProfile(req.user.sub); res.json({ user: { nim: profile.nim, name: profile.full_name, role: profile.role } }); }
  catch { res.status(404).json({ error: "Profil tidak ditemukan." }); }
});

app.post("/api/auth/logout", auth, (_req, res) => res.json({ ok: true, message: "Hapus token di browser untuk keluar." }));

app.get("/api/stats/public", async (_req, res) => {
  try {
    const { count: students, error: e1 } = await db.from("mahasiswa").select("*", { count: "exact", head: true });
    if (e1) throw e1;
    const today = new Date(); today.setHours(0,0,0,0);
    const { count: present, error: e2 } = await db.from("absensi").select("*", { count: "exact", head: true }).gte("waktu_absen", today.toISOString()).in("status", ["hadir","telat"]);
    if (e2) throw e2;
    const { count: totalSessions, error: e3 } = await db.from("sesi_absensi").select("*", { count: "exact", head: true }).gte("dibuka_pada", today.toISOString());
    if (e3) throw e3;
    res.json({ students: students || 0, present: present || 0, sessions: totalSessions || 0 });
  } catch { res.json({ students: null, attendancePercent: null, message: "Hubungkan database untuk menampilkan statistik." }); }
});

app.get("/api/admin/overview", auth, role("admin"), async (_req, res) => {
  try {
    const [s, d, c, a] = await Promise.all([
      db.from("mahasiswa").select("*", { count:"exact", head:true }),
      db.from("dosen").select("*", { count:"exact", head:true }),
      db.from("mata_kuliah").select("*", { count:"exact", head:true }),
      db.from("absensi").select("*", { count:"exact", head:true })
    ]);
    for (const result of [s,d,c,a]) if (result.error) throw result.error;
    res.json({ students:s.count||0, lecturers:d.count||0, courses:c.count||0, attendanceRecords:a.count||0 });
  } catch { res.status(500).json({ error: "Gagal mengambil ringkasan." }); }
});

// Create a session. QR token itself is returned only once; DB stores its hash.
// The caller should render this token as a QR code. Session expires server-side after 15 minutes.
app.post("/api/sessions", auth, role("dosen","admin"), async (req, res) => {
  try {
    const jadwalId = String(req.body?.jadwalId || "");
    if (!jadwalId) return res.status(400).json({ error: "jadwalId wajib diisi." });
    const { data: schedule, error: scheduleError } = await db.from("jadwal").select("id,mata_kuliah_id,kelas").eq("id", jadwalId).eq("aktif", true).single();
    if (scheduleError || !schedule) return res.status(404).json({ error: "Jadwal aktif tidak ditemukan." });
    // Production: verify this lecturer is assigned to this course before allowing session creation.
    const qrToken = crypto.randomBytes(32).toString("hex");
    const opened = new Date();
    const closes = new Date(opened.getTime() + 15 * 60 * 1000);
    const { data, error } = await db.from("sesi_absensi").insert({
      jadwal_id: jadwalId, dosen_user_id: req.user.sub, qr_token_hash: sha256(qrToken),
      dibuka_pada: opened.toISOString(), ditutup_pada: closes.toISOString(), status: "terbuka"
    }).select("id,dibuka_pada,ditutup_pada").single();
    if (error) throw error;
    res.status(201).json({ session: data, qrPayload: JSON.stringify({ sessionId: data.id, token: qrToken }) });
  } catch (e) { console.error("session:", e.message); res.status(500).json({ error: "Gagal membuat sesi. Pastikan jadwal dan skema database tersedia." }); }
});

app.post("/api/attendance", auth, role("mahasiswa"), upload.single("selfie"), async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "");
    const qrToken = String(req.body?.qrToken || "");
    const lat = Number(req.body?.latitude);
    const lng = Number(req.body?.longitude);
    const accuracy = Number(req.body?.accuracy);
    if (!sessionId || !qrToken || !validCoords(lat,lng)) {
      if (req.file) fs.unlink(req.file.path,()=>{});
      return res.status(400).json({ error: "QR dan koordinat GPS yang valid wajib diisi." });
    }
    if (!req.file) return res.status(400).json({ error: "Selfie wajib diambil." });
    if (Number.isFinite(accuracy) && accuracy > 100) return res.status(400).json({ error: "Akurasi GPS terlalu rendah. Coba di area terbuka." });
    const { data: student, error: studentError } = await db.from("mahasiswa").select("id").eq("user_id", req.user.sub).single();
    if (studentError || !student) return res.status(404).json({ error: "Data mahasiswa tidak ditemukan." });
    const { data: session, error: sessionError } = await db.from("sesi_absensi").select("*,jadwal(kampus_lat,kampus_lng,radius_meter)").eq("id", sessionId).single();
    if (sessionError || !session) return res.status(404).json({ error: "Sesi tidak ditemukan." });
    const now = Date.now();
    if (session.status !== "terbuka" || now < Date.parse(session.dibuka_pada) || now > Date.parse(session.ditutup_pada)) return res.status(400).json({ error: "Sesi presensi sudah ditutup." });
    if (sha256(qrToken) !== session.qr_token_hash) return res.status(400).json({ error: "QR tidak valid." });
    const schedule = session.jadwal;
    const distance = distanceMeters(schedule.kampus_lat, schedule.kampus_lng, lat, lng);
    if (distance > schedule.radius_meter) return res.status(400).json({ error: `Di luar radius kampus (${Math.round(distance)} meter).` });
    // Store evidence privately on the server. For production use Supabase Storage private bucket + retention policy.
    const relativeSelfiePath = path.basename(req.file.path);
    const status = now > Date.parse(session.dibuka_pada) + 5 * 60 * 1000 ? "telat" : "hadir";
    const { data: attendance, error } = await db.from("absensi").insert({
      sesi_id: session.id, mahasiswa_id: student.id, status, latitude: lat, longitude: lng,
      jarak_meter: Math.round(distance), selfie_path: relativeSelfiePath, device_fingerprint_hash: req.body?.deviceId ? sha256(String(req.body.deviceId)) : null
    }).select("id,status,waktu_absen,jarak_meter").single();
    if (error?.code === "23505") return res.status(409).json({ error: "Kamu sudah absen pada sesi ini." });
    if (error) throw error;
    res.status(201).json({ ok:true, attendance });
  } catch (e) {
    console.error("attendance:", e.message);
    res.status(500).json({ error: "Presensi gagal disimpan. Periksa konfigurasi backend." });
  }
});

app.get("/api/student/history", auth, role("mahasiswa"), async (req, res) => {
  try {
    const { data: student, error: se } = await db.from("mahasiswa").select("id").eq("user_id", req.user.sub).single();
    if (se || !student) return res.status(404).json({ error: "Data mahasiswa tidak ditemukan." });
    const { data, error } = await db.from("absensi").select("id,status,waktu_absen,jarak_meter,sesi_absensi(jadwal(mata_kuliah(nama),kelas))").eq("mahasiswa_id", student.id).order("waktu_absen",{ascending:false}).limit(100);
    if (error) throw error;
    res.json({ history: data || [] });
  } catch { res.status(500).json({ error: "Gagal mengambil riwayat." }); }
});

app.get("/api/admin/students", auth, role("admin"), async (_req,res) => {
  const {data,error}=await db.from("mahasiswa").select("id,nim,nama,jurusan,kelas,semester").order("nama");
  if(error)return res.status(500).json({error:"Gagal mengambil mahasiswa."});
  res.json({students:data});
});
app.post("/api/admin/students", auth, role("admin"), async (req,res) => {
  const {nim,nama,jurusan,kelas,semester,user_id}=req.body||{};
  if(!nim||!nama||!jurusan||!kelas||!Number.isInteger(Number(semester))||!user_id)return res.status(400).json({error:"Semua field dan user_id wajib diisi."});
  const {data,error}=await db.from("mahasiswa").insert({nim,nama,jurusan,kelas,semester:Number(semester),user_id}).select().single();
  if(error)return res.status(400).json({error:error.message});
  res.status(201).json({student:data});
});
app.put("/api/admin/students/:id", auth, role("admin"), async (req,res) => {
  const allowed=["nim","nama","jurusan","kelas","semester"];
  const payload=Object.fromEntries(Object.entries(req.body||{}).filter(([k])=>allowed.includes(k)));
  const {data,error}=await db.from("mahasiswa").update(payload).eq("id",req.params.id).select().single();
  if(error)return res.status(400).json({error:error.message});
  res.json({student:data});
});
app.delete("/api/admin/students/:id", auth, role("admin"), async (req,res) => {
  const {error}=await db.from("mahasiswa").delete().eq("id",req.params.id);
  if(error)return res.status(400).json({error:error.message});
  res.json({ok:true});
});

app.get("*", (req,res,next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Terjadi kesalahan server."});});
app.listen(PORT, ()=>console.log(`Hadirin berjalan di http://localhost:${PORT}`));
