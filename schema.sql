create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','dosen','mahasiswa');
create type public.attendance_status as enum ('hadir','telat','izin','sakit','alpha');
create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 nim text unique not null,
 full_name text not null,
 role public.app_role not null,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.mahasiswa (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique not null references public.users(id) on delete cascade,
 nim text unique not null,
 nama text not null,
 jurusan text not null,
 kelas text not null,
 semester int not null check (semester between 1 and 14),
 created_at timestamptz not null default now()
);
create table public.dosen (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique not null references public.users(id) on delete cascade,
 nidn text unique,
 nama text not null
);
create table public.mata_kuliah (
 id uuid primary key default gen_random_uuid(),
 kode text unique not null,
 nama text not null,
 sks int not null default 2 check(sks between 1 and 8),
 semester int,
 dosen_id uuid references public.dosen(id)
);
create table public.jadwal (
 id uuid primary key default gen_random_uuid(),
 mata_kuliah_id uuid not null references public.mata_kuliah(id),
 kelas text not null,
 hari smallint not null check(hari between 0 and 6),
 mulai time not null,
 selesai time not null,
 ruang text,
 kampus_lat double precision not null,
 kampus_lng double precision not null,
 radius_meter int not null default 100 check(radius_meter between 10 and 1000),
 aktif boolean not null default true,
 check(selesai>mulai)
);
create table public.sesi_absensi (
 id uuid primary key default gen_random_uuid(),
 jadwal_id uuid not null references public.jadwal(id),
 dosen_user_id uuid not null references public.users(id),
 qr_token_hash text not null unique,
 dibuka_pada timestamptz not null default now(),
 ditutup_pada timestamptz not null,
 status text not null default 'terbuka' check(status in ('terbuka','ditutup')),
 created_at timestamptz not null default now(),
 check(ditutup_pada>dibuka_pada)
);
create table public.absensi (
 id uuid primary key default gen_random_uuid(),
 sesi_id uuid not null references public.sesi_absensi(id),
 mahasiswa_id uuid not null references public.mahasiswa(id),
 status public.attendance_status not null,
 waktu_absen timestamptz not null default now(),
 latitude double precision,
 longitude double precision,
 jarak_meter double precision,
 selfie_path text,
 bukti_path text,
 device_fingerprint_hash text,
 catatan text,
 edited_by uuid references public.users(id),
 created_at timestamptz not null default now(),
 unique(sesi_id,mahasiswa_id)
);
create index idx_absensi_mahasiswa on public.absensi(mahasiswa_id,waktu_absen desc);
create index idx_sesi_jadwal on public.sesi_absensi(jadwal_id,dibuka_pada desc);
-- Note: the Express backend uses service role credentials. Never expose them to the browser.
-- Before production, implement and test RLS, role/course authorization, audit logs, and private evidence storage.
