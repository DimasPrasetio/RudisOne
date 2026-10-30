#!/usr/bin/env node
// Kebijakan akses & batas kewenangan RudisOne — hook PreToolUse/PostToolUse Claude Code + perintah pengelola.
// Jenjang & akses jabatan hanya di sesi RudisOne (COO, divisi, tim engineering); sesi pribadi dilewati tanpa jejak,
// KECUALI berkas terlindung (kebijakan, konfigurasi, audit, settings, transkrip, rc shell) → ask di sesi mana pun.
// Jenjang 1 (baca) → allow · jenjang 2 (rutin, syarat terpenuhi) → allow · jenjang 3 / di luar akses jabatan → ask.
// `allow` hanya bila SETIAP bagian perintah majemuk dikenali aman; sisanya ke alur izin biasa. Jabatan dari folder AWAL
// sesi / pesan pertama, bukan folder sekarang. Galat apa pun → keluar 0 tanpa keputusan (gagal terbuka) — larangan
// keras milik permissions.deny + sandbox di settings pengguna (skills/rudis-operasi › Berkas terlindung).
// Pemakaian:
//   hook            dibaca Claude Code (stdin JSON) — dipasang oleh `pasang`
//   pasang [--ya]   tambahkan hook ke ~/.claude/settings.json (dijalankan PENGGUNA; cadangan dibuat dulu)
//   lepas [--ya]    hapus hook dari ~/.claude/settings.json
//   cek             status pemasangan · tampil  ringkasan kebijakan · audit [n]  n catatan audit terakhir
//   uji '<json>'    simulasikan satu panggilan alat, mis. uji '{"cwd":"<RudisOne>/ruang/system-administrator","tool_name":"Bash","tool_input":{"command":"ssh <alias> uptime"}}'
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bacaKonfig, FILE_KONFIG } from "./konfig.mjs";

const HOME = os.homedir();
const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const FILE_KEBIJAKAN = process.env.RUDISONE_KEBIJAKAN || path.join(ROOT, "kebijakan-akses.json");
const DIR_AUDIT = process.env.RUDISONE_AUDIT || path.join(ROOT, "handoff", "audit");
const FILE_REGISTER = process.env.RUDISONE_REGISTER || path.join(ROOT, "handoff", "register-tugas.json");
const SETTINGS = process.env.RUDISONE_SETTINGS_USER || path.join(HOME, ".claude", "settings.json");
const PENANDA = `"${INI}"`;   // path absolut skrip ini — hook sistem lain yang juga bernama bin/kebijakan.mjs bukan milik kita

const rumah = (p) => String(p ?? "").replace(/^~(?=\/|$)/, HOME);
const di = (anak, induk) => { const a = path.resolve(rumah(anak)), b = path.resolve(induk); return a === b || a.startsWith(b + path.sep); };

/** Aturan generik (kebijakan-akses.json) + fakta per device (konfigurasi/server.json, lihat bin/konfig.mjs).
 *  Tanpa konfigurasi: tidak ada host ssh / aplikasi / MCP DNS yang dikenali → semuanya ke alur izin biasa. */
export function muatKebijakan(file = FILE_KEBIJAKAN, fileKonfig = FILE_KONFIG) {
  const K = JSON.parse(fs.readFileSync(file, "utf8"));
  K.penyedia ??= {};
  const cfg = bacaKonfig(fileKonfig);
  for (const [alias, s] of Object.entries(cfg?.server ?? {})) {
    if (s?.ssh_host) K.penyedia[alias] = { jenis: "ssh", host: s.ssh_host, kemampuan: "server", akun: s.akun ?? null };
  }
  K.aplikasi = cfg?.aplikasi ?? {};
  const mcp = cfg?.dns?.mcp_server;
  if (mcp && K.adapter_mcp?.[mcp]) K.penyedia[mcp] = { jenis: "mcp", server: mcp, ...K.adapter_mcp[mcp] };
  return K;
}

// ---------- pengenal sesi RudisOne & jabatan ----------
// Jabatan TIDAK dibaca dari `input.cwd` (ikut `cd`, dok hooks) maupun dari berkas yang bisa ditulis agent sebagai sumber
// kebenaran (T-20261030-5 · F2). Sumbernya: folder AWAL sesi (`cwd` baris pertama transkrip), pembuka peran di pesan
// PERTAMA sesi, atau pemanggilan /rudisone yang posisinya di transkrip diverifikasi ulang setiap kali dipakai.
const WORKTREE = { lead: "tech-lead", bsa: "business-systems-analyst", se1: "software-engineer", se2: "software-engineer" };
const POLA_WORKTREE = /\/\.claude\/worktrees\/r[1-3]-(lead|bsa|se1|se2)-[^/]+(?:\/|$)/;
const PENANDA_RUDISONE = "<command-name>/rudisone</command-name>";
let TULIS_CACHE = true;   // `uji` tidak menulis cache sesi

function petaNama(K) {
  const m = [];
  for (const [id, j] of Object.entries(K.jabatan)) for (const n of [j.nama, ...(j.alias ?? [])]) m.push([n, id]);
  return m.sort((a, b) => b[0].length - a[0].length);
}
function jabatanDariTeks(teks, K) {
  const m = String(teks).match(/Kamu adalah \**([A-Za-z][A-Za-z &-]*?)\**(?:\s*#\d)?\s+di RudisOne/);
  if (!m) return null;
  return petaNama(K).find(([n]) => m[1].trim() === n)?.[1] ?? null;
}
function teksPesanPengguna(baris) {
  if (baris?.type !== "user" || !baris.message || baris.isMeta) return "";
  const c = baris.message.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  return "";
}
/** Hanya /rudisone yang DIKETIK pengguna. Pemanggilan Skill oleh model sendiri tidak dihitung (model yang terinjeksi
 *  bisa menjadikan dirinya COO) — sesi yang memanggil RudisOne lewat bahasa biasa tetap jalan, hanya tanpa jenjang COO. */
const panggilRudisone = (b) => teksPesanPengguna(b).includes(PENANDA_RUDISONE);

/** Transkrip sesi utama. Untuk subagent, transkrip miliknya (`<sid>/subagents/agent-*.jsonl`) ditulis pemanggilnya
 *  (prompt) — identitas induk selalu dibaca dari transkrip utama `<sid>.jsonl`. */
export function transkripInduk(t) {
  if (!t) return null;
  const m = String(t).match(/^(.*)\/([^/]+)\/subagents\/[^/]+\.jsonl$/);
  return m ? `${m[1]}/${m[2]}.jsonl` : String(t);
}

/** Kepala transkrip: folder awal sesi + pesan pengguna pertama (dibaca sampai keduanya ketemu, maks. 4 MB). */
function kepalaTranskrip(file) {
  const out = { cwd: null, pertama: null };
  let fd; try { fd = fs.openSync(file, "r"); } catch { return out; }
  try {
    let pos = 0, sisa = "";
    const buf = Buffer.alloc(262144);
    while (pos < 4 * 1048576) {
      const n = fs.readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      pos += n;
      const teks = sisa + buf.toString("utf8", 0, n);
      const baris = teks.split("\n"); sisa = baris.pop();
      for (const l of baris) {
        if (!l.trim()) continue;
        let b; try { b = JSON.parse(l); } catch { continue; }
        if (!out.cwd && typeof b.cwd === "string" && b.cwd) out.cwd = b.cwd;
        if (out.pertama === null) { const t = teksPesanPengguna(b); if (t) out.pertama = t; }
        if (out.cwd && out.pertama !== null) return out;
      }
    }
    return out;
  } finally { fs.closeSync(fd); }
}

/** Satu baris transkrip yang dimulai di `offset` (untuk memverifikasi cache). */
function barisPada(file, offset) {
  let fd; try { fd = fs.openSync(file, "r"); } catch { return null; }
  try {
    const buf = Buffer.alloc(1048576);
    const n = fs.readSync(fd, buf, 0, buf.length, offset);
    const teks = buf.toString("utf8", 0, n), akhir = teks.indexOf("\n");
    if (akhir < 0) return null;
    if (offset > 0) { const b1 = Buffer.alloc(1); fs.readSync(fd, b1, 0, 1, offset - 1); if (b1[0] !== 0x0a) return null; }
    return JSON.parse(teks.slice(0, akhir));
  } catch { return null; } finally { fs.closeSync(fd); }
}

/** /rudisone pernah dipanggil di sesi ini? Pemindaian bertahap; cache hanya menyimpan POSISI baris penanda, yang
 *  dibaca & diperiksa ulang tiap kali — memalsukan cache tidak memberi jabatan (paling jauh menyembunyikannya). */
function adaRudisone(file, sessionId) {
  const dirSesi = path.join(DIR_AUDIT, ".sesi");
  const fileSesi = path.join(dirSesi, `${String(sessionId ?? "x").replace(/[^\w.-]/g, "_")}.json`);
  let st = { offset: 0, penanda: null };
  try { const c = JSON.parse(fs.readFileSync(fileSesi, "utf8")); st = { offset: Number(c.offset) || 0, penanda: Number.isInteger(c.penanda) ? c.penanda : null }; } catch { /* sesi baru */ }
  if (st.penanda !== null && panggilRudisone(barisPada(file, st.penanda))) return true;
  st.penanda = null;
  let ukuran = 0;
  try { ukuran = fs.statSync(file).size; } catch { return false; }
  if (ukuran < st.offset) st.offset = 0;
  if (ukuran <= st.offset) return false;
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(ukuran - st.offset);
  fs.readSync(fd, buf, 0, buf.length, st.offset);
  fs.closeSync(fd);
  let pos = st.offset;
  for (const l of buf.toString("utf8").split("\n").slice(0, -1)) {
    const panjang = Buffer.byteLength(l, "utf8") + 1;
    if (l.trim()) { let b; try { b = JSON.parse(l); } catch { b = null; } if (b && panggilRudisone(b)) { st.penanda = pos; pos += panjang; break; } }
    pos += panjang;
  }
  st.offset = st.penanda !== null ? st.offset : pos;
  if (TULIS_CACHE) try { fs.mkdirSync(dirSesi, { recursive: true }); fs.writeFileSync(fileSesi, JSON.stringify(st)); } catch { /* cache opsional */ }
  return st.penanda !== null;
}

/** { rudisOne, jabatan [, subagent, induk] } untuk satu panggilan alat.
 *  Subagent dari definisi peran (`agent_type` = rudis-<id>, protokol.md › Model sesi) dicatat dengan jabatan perannya,
 *  tetapi aksesnya hanya boleh MENYEMPIT: `putuskan` mensyaratkan jabatan induk dan jabatan subagent sama-sama berhak,
 *  jenjang 2 selalu ditanya, dan subagent dari sesi yang bukan RudisOne tidak pernah diloloskan. */
export function kenaliSesi(input, K) {
  const sub = String(input.agent_type ?? "").match(/^rudis-([a-z-]+)$/);
  if (sub && K.jabatan[sub[1]]) {
    const induk = kenaliInduk(input, K);
    return { rudisOne: true, jabatan: sub[1], subagent: true, induk: induk.rudisOne ? induk.jabatan : null };
  }
  return kenaliInduk(input, K);
}

/** Jabatan menurut folder AWAL sesi (bukan folder sekarang). */
/** Worktree tim hanya bermakna di folder proyek yang terdaftar: repo RudisOne sendiri, atau `folder` tugas mana pun di
 *  register (ditulis COO lewat bin/register.sh; Write/Edit langsung ke register = berkas terlindung). Path lain yang
 *  kebetulan memuat `.claude/worktrees/r1-lead-…` tidak memberi jabatan (L3b). */
export function proyekTerdaftar(akar) {
  const n = (p) => { const r = path.resolve(rumah(p)); return process.platform === "darwin" ? r.toLowerCase() : r; };
  const a = n(akar);
  if (a === n(ROOT)) return true;
  try {
    const reg = JSON.parse(fs.readFileSync(FILE_REGISTER, "utf8"));
    return (reg.tugas ?? []).some((t) => { const f = String(t.folder ?? "").replace(/\s*\(.*\)\s*$/, "").trim(); return f && n(f) === a; });
  } catch { return false; }
}

function jabatanDariFolder(cwd, K) {
  if (!cwd) return null;
  const c = rumah(cwd);
  // Worktree tim didahulukan: worktree repo RudisOne sendiri berada DI DALAM ROOT (.claude/worktrees/r<n>-…).
  const wt = c.match(POLA_WORKTREE);
  if (wt && proyekTerdaftar(c.slice(0, wt.index))) return WORKTREE[wt[1]];
  if (di(c, ROOT)) {
    const rel = path.relative(ROOT, path.resolve(c)).split(path.sep);
    return rel[0] === "ruang" && K.jabatan[rel[1]] ? rel[1] : "coo";
  }
  return null;
}

/** { rudisOne, jabatan, asal } sesi (utas utama). Tanpa transkrip (simulasi `uji`, tes) folder = input.cwd. */
function kenaliInduk(input, K) {
  const t = transkripInduk(input.transcript_path);
  if (!t) {
    const j = jabatanDariFolder(input.cwd, K);
    return { rudisOne: !!j, jabatan: j, asal: input.cwd ?? null };
  }
  const kepala = kepalaTranskrip(t);
  const j = jabatanDariFolder(kepala.cwd, K) ?? (kepala.pertama ? jabatanDariTeks(kepala.pertama, K) : null);
  if (j) return { rudisOne: true, jabatan: j, asal: kepala.cwd };
  if (adaRudisone(t, input.session_id)) return { rudisOne: true, jabatan: "coo", asal: kepala.cwd };
  return { rudisOne: false, jabatan: null, asal: kepala.cwd };
}

// ---------- pengurai perintah shell (sadar tanda kutip, pengalihan, ekspansi) ----------
const OP_ALIH = ["&>>", "&>", "<<<", "<<-", "<<", ">>", ">|", ">&", "<&", "<>", ">", "<"];
const AWAL_EKSPANSI = /[A-Za-z0-9_{@*#?$!-]/;

/** Urai perintah: segmen dipisah &&, ||, ;, |, |&, &, baris baru (di luar kutip). Per segmen: teks mentah, kata (kutip
 *  dibuang; tanda `glob` = *?[{ tanpa kutip, `ekspansi` = $var) dan pengalihan { op, target }.
 *  `kompleks` = $( ), backtick, $'…', subshell/( ), proses substitusi, here-doc, kutip tak tertutup.
 *  `ekspansi` = ada $var/${…} di luar kutip tunggal. Pengurai sengaja konservatif: yang ragu → bukan aman. */
export function urai(cmd) {
  cmd = String(cmd);
  const segmen = []; let kompleks = false, ekspansi = false;
  let seg = { teks: "", kata: [], alih: [] }, w = null, tunggu = null;
  const kini = () => (w ??= { nilai: "", glob: false, kurawal: false, ekspansi: false });
  const tutupKata = () => {
    if (!w) return;
    if (tunggu) { seg.alih.push({ op: tunggu, target: w.nilai, glob: w.glob, ekspansi: w.ekspansi }); tunggu = null; } else seg.kata.push(w);
    w = null;
  };
  const tutupSeg = () => {
    tutupKata();
    if (tunggu) { kompleks = true; seg.alih.push({ op: tunggu, target: "", glob: false, ekspansi: false }); tunggu = null; }
    seg.teks = seg.teks.trim();
    if (seg.teks) segmen.push(seg);
    seg = { teks: "", kata: [], alih: [] };
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i], n = cmd[i + 1];
    if (c === "'") {
      const j = cmd.indexOf("'", i + 1), akhir = j < 0 ? cmd.length : j;
      if (j < 0) kompleks = true;
      kini().nilai += cmd.slice(i + 1, akhir); seg.teks += cmd.slice(i, akhir + 1); i = akhir; continue;
    }
    if (c === '"') {
      let j = i + 1, v = "";
      const k = kini();
      for (; j < cmd.length && cmd[j] !== '"'; j++) {
        const d = cmd[j], e = cmd[j + 1];
        if (d === "\\" && e !== undefined) { if (e !== "\n") v += '"\\$`'.includes(e) ? e : d + e; j++; continue; }
        if (d === "`" || (d === "$" && e === "(")) kompleks = true;
        else if (d === "$" && e !== undefined && AWAL_EKSPANSI.test(e)) { ekspansi = true; k.ekspansi = true; }
        v += d;
      }
      if (j >= cmd.length) kompleks = true;
      k.nilai += v; seg.teks += cmd.slice(i, j + 1); i = j; continue;
    }
    if (c === "\\") { if (n === "\n") { i++; continue; } if (n !== undefined) { kini().nilai += n; seg.teks += c + n; i++; } continue; }
    if (c === "$") {
      if (n === "(" || n === "'" || n === '"') kompleks = true;
      else if (n !== undefined && AWAL_EKSPANSI.test(n)) { ekspansi = true; kini().ekspansi = true; }
      kini().nilai += c; seg.teks += c; continue;
    }
    if (c === "`") { kompleks = true; kini().nilai += c; seg.teks += c; continue; }
    if ((c === "&" && n === "&") || (c === "|" && (n === "|" || n === "&"))) { tutupSeg(); i++; continue; }
    if (c === ";" || c === "\n" || c === "|") { tutupSeg(); continue; }
    if (c === "&" && n !== ">") { tutupSeg(); continue; }
    if (c === "(" || c === ")") { kompleks = true; tutupKata(); seg.teks += c; continue; }
    if (c === ">" || c === "<" || (c === "&" && n === ">")) {
      let fd = "";
      if (w && !tunggu && /^\d+$/.test(w.nilai) && /\d$/.test(seg.teks)) { fd = w.nilai; w = null; }
      tutupKata();
      if (tunggu) { kompleks = true; tunggu = null; }
      const op = OP_ALIH.find((o) => cmd.startsWith(o, i));
      i += op.length - 1;
      seg.teks += op;
      if (cmd[i + 1] === "(") kompleks = true;                   // <( ) / >( )
      if (op === "<<" || op === "<<-") kompleks = true;          // here-doc: isinya bukan perintah yang bisa dinilai
      tunggu = fd + op;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") { tutupKata(); seg.teks += c; continue; }
    if (c === "#" && !w) kompleks = true;                       // komentar: sisa baris tidak terlihat oleh pengurai
    if ("*?[{".includes(c)) kini().glob = true;
    if (c === "{") kini().kurawal = true;
    kini().nilai += c; seg.teks += c;
  }
  if (tunggu || w) tutupKata();
  tutupSeg();
  return { segmen, kompleks, ekspansi };
}
/** Kompatibel lama: teks segmen + kompleks. */
export function pisahSegmen(cmd) { const u = urai(cmd); return { segmen: u.segmen.map((s) => s.teks), kompleks: u.kompleks }; }
/** Kata-kata satu perintah, tanda kutip dibuang (pengalihan tidak termasuk). */
export function kata(seg) { return urai(seg).segmen.flatMap((s) => s.kata.map((x) => x.nilai)); }

/** Pengalihan yang tidak menulis berkas: duplikasi fd, buangan /dev/null|stdout|stderr, baca berkas biasa. */
function alihAman(a) {
  if (/^\d*[<>]&$/.test(a.op)) return /^(\d+|-)$/.test(a.target);
  if (/^(\d*>>?|&>>?|\d*>\|)$/.test(a.op)) return /^\/dev\/(null|stdout|stderr)$/.test(a.target);
  if (/^\d*<$/.test(a.op)) return !!a.target && !a.glob && !a.ekspansi;
  return false;   // here-doc, here-string, <>
}

// ---------- klasifikasi ----------
const OPSI_SSH_BERNILAI = new Set(["-o", "-p", "-i", "-l", "-F", "-J", "-L", "-R", "-D", "-c", "-m", "-E", "-b", "-S", "-W", "-w", "-O", "-Q", "-B", "-e"]);
/** Opsi ssh yang tidak menjalankan perintah lokal, tidak menulis berkas, dan tidak membuka terowongan. */
const OPSI_SSH_AMAN = new Set(["-p", "-l", "-i", "-c", "-m", "-b", "-B", "-e"]);
const KUNCI_SSH_AMAN = /^(BatchMode|ConnectTimeout|ConnectionAttempts|ServerAliveInterval|ServerAliveCountMax|LogLevel|StrictHostKeyChecking|RequestTTY|Compression|IdentitiesOnly|Port|User)=/i;
const BENDERA_SSH_AMAN = /^-[TtqvnC46x]+$/;

/** Argumen yang membuat perintah "baca" menulis, menghapus, atau menjalankan perintah lain (lokal maupun server). */
const ARG_BERBAHAYA = {
  find: (a) => a.some((x) => /^-(exec|execdir|ok|okdir|delete|fprint0?|fprintf|fls)$/.test(x)),
  sort: (a) => a.some((x) => /^--(output|temporary-directory|compress-program)/.test(x) || /^-[A-Za-z]*[oT]/.test(x)),
  uniq: (a) => a.filter((x) => x === "-" || !x.startsWith("-")).length > 1,
  date: (a) => a.some((x) => x.startsWith("--set") || /^-[uR]*s/.test(x) || /^\d/.test(x)),
  hostname: (a) => a.some((x) => !/^-([fsdiIaAy]+|-(fqdn|short|domain|ip-address|all-ip-addresses|all-fqdns|long))$/.test(x)),
  sed: (a) => a.some((x) => /^-[A-Za-z]*[iefsz]|^--(in-place|expression|file|separate|null-data)/.test(x.replace(/^-n/, "-"))),
  journalctl: (a) => a.some((x) => /^--(vacuum|rotate|flush|relinquish|smart-relinquish|sync|setup-keys|update-catalog|cursor-file)/.test(x)),
  ss: (a) => a.some((x) => /^--(kill|diag)/.test(x) || /^-[A-Za-z]*[KD]/.test(x)),
  curl: (a) => curlBerbahaya(a),
  openssl: (a) => a.some((x) => /^-(out|keyout|writerand|sess_out|keylogfile|msgfile|trace|engine|provider|provider-path|config|CAcreateserial|CAserial)$/.test(x)),
  jq: (a) => a.some((x) => /\$ENV|\benv\b|input_filename|\$__loc__|\bimport\b|\binclude\b/.test(x) || /^(--rawfile|--slurpfile|--from-file|-f|-L)$/.test(x)),
};
/** Khusus lokal: grep rekursif membaca semua berkas (termasuk .env) ke transkrip. */
const ARG_BERBAHAYA_LOKAL = {
  grep: (a) => a.some((x) => /^--(recursive|dereference-recursive|directories)/.test(x) || /^-[A-Za-z]*[rRd]/.test(x)),
};

/** curl hanya dengan opsi dari daftar baca (tidak menulis berkas, tidak mengirim data, tidak membaca config). */
function curlBerbahaya(a) {
  const nilaiBuruk = (opsi, v) => (opsi === "o" && v !== "/dev/null") || (opsi === "w" && /%output\{|^@/.test(v)) || (opsi === "H" && v.startsWith("@"));
  const panjang = { output: "o", "write-out": "w", header: "H", "max-time": "m", "connect-timeout": "m", "user-agent": "A", retry: "m", "retry-delay": "m", "max-redirs": "m", resolve: "m", range: "m" };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (!x.startsWith("-") || x === "-") { if (!/^https?:\/\//i.test(x)) return true; continue; }   // URL: hanya http(s)
    if (/^--(silent|show-error|fail|fail-with-body|location|head|insecure|verbose|include|compressed|ipv4|ipv6|http1\.1|http2|no-progress-meter|globoff|no-buffer)$/.test(x)) continue;
    const pj = x.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (pj) { if (!(pj[1] in panjang)) return true; const v = pj[2] ?? a[++i] ?? ""; if (nilaiBuruk(panjang[pj[1]], v)) return true; continue; }
    for (let j = 1; j < x.length; j++) {
      const c = x[j];
      if ("sSfLIkvi46".includes(c)) continue;
      if ("mHAwo".includes(c)) { const v = j + 1 < x.length ? x.slice(j + 1) : a[++i] ?? ""; if (nilaiBuruk(c, v)) return true; break; }
      return true;
    }
  }
  return false;
}

/** mysql hanya: opsi koneksi/format dari daftar, satu -e, satu pernyataan baca (tanpa INTO OUTFILE, \, ;). */
function mysqlBaca(w) {
  let stmt = null, posisional = 0;
  for (let i = 1; i < w.length; i++) {
    const x = w[i];
    if (x === "-e" || x === "--execute") { if (stmt !== null) return false; stmt = w[++i] ?? ""; continue; }
    if (/^--execute=/.test(x)) { if (stmt !== null) return false; stmt = x.slice(10); continue; }
    if (/^-e./.test(x)) { if (stmt !== null) return false; stmt = x.slice(2); continue; }
    if (/^-[uhPD]$/.test(x)) { i++; continue; }
    if (/^-[uhPD]\S+$/.test(x)) continue;
    if (/^--(user|host|port|database|default-character-set|connect-timeout)=/.test(x)) continue;
    if (/^-[NBstEr]+$/.test(x) || /^--(batch|skip-column-names|silent|table|vertical|raw|column-names|no-auto-rehash|skip-pager)$/.test(x)) continue;
    if (!x.startsWith("-")) { if (++posisional > 1) return false; continue; }
    return false;
  }
  if (stmt === null) return false;
  const q = stmt.trim().replace(/;\s*$/, "");
  // komentar (/* */, #, --) bisa memisahkan kata kunci: INTO/**/OUTFILE — ditolak seluruhnya
  return /^(select|show|describe|desc|explain)\b/i.test(q) && !/[;\\#]|\/\*|--/.test(q)
    && !/\binto\b/i.test(q) && !/\bfor\s+(update|share)\b|\block\s+in\s+share\s+mode\b/i.test(q)
    && !/\b(load_file|sleep|benchmark|get_lock)\s*\(/i.test(q);
}

/** Perintah lokal yang boleh ikut dalam perintah majemuk yang diloloskan — irisan daftar bawaan hook dengan
 *  `lokal_netral` di kebijakan (berkas kebijakan hanya bisa MENYEMPITKAN). awk/sed/tee/git tidak pernah netral. */
// printf -v dan test -v mengevaluasi subskrip array (zsh/bash) → bisa menjalankan $( ) — tidak termasuk.
const BACA_LOKAL = new Set(["cd", "echo", "tail", "head", "grep", "wc", "sort", "uniq", "cut", "jq", "cat", "ls", "tr", "sleep", "true", "date", "column"]);
const RAHASIA_LOKAL = "|\\.ssh(/|$)|\\.aws|\\.netrc|\\.npmrc|\\.pypirc|\\.git-credentials|\\.config/gh|\\.gnupg|\\.docker/config|keychain|\\.kube/config";
/** Program dipanggil dengan nama telanjang (dicari di PATH) atau dari folder sistem — bukan ./gh atau /tmp/x/cat. */
const programStandar = (prog) => !prog.includes("/") || /^\/(usr\/(local\/)?bin|bin|usr\/sbin|sbin|opt\/homebrew\/bin)\/[^/]+$/.test(prog);

function klasifikasiRemote(remote, prov, K) {
  const u = urai(remote);
  const teks = u.segmen.map((s) => s.teks);
  const rahasia = new RegExp(K.ssh_rahasia, "i");
  // deploy: cd ~/<app> && ./deploy.sh <sha40>
  if (teks.length === 2 && /^cd\s+\S+$/.test(teks[0])) {
    const sha = teks[1].match(/^\.\/deploy\.sh\s+([0-9a-f]{40})$/)?.[1];
    if (sha) {
      const folder = teks[0].split(/\s+/)[1].replace(/\/$/, "");
      const app = Object.entries(K.aplikasi ?? {}).find(([, a]) => a.server === prov && a.folder.replace(/\/$/, "") === folder);
      return [{ kemampuan: "server", jenjang: 2, jenis: "deploy", aksi: `deploy ${app?.[0] ?? folder} ${sha.slice(0, 12)}`, app: app?.[0] ?? null, repo: app?.[1].repo ?? null, sha }];
    }
  }
  const baca = K.ssh_baca.map((r) => new RegExp(r));
  const tidakBaca = u.segmen.filter((s) => {
    const t = s.teks;
    if (/\bsudo\b/.test(t) || rahasia.test(t) || rahasia.test(s.kata.map((x) => x.nilai).join(" ")) || !s.alih.every(alihAman)) return true;
    const w = s.kata.map((x) => x.nilai);
    if (!w.length || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) return true;
    if (s.kata.some((x) => x.kurawal)) return true;                    // {a,b} diekspansi shell server menjadi opsi
    if (path.basename(w[0]) === "mysql") return !mysqlBaca(w);
    if (ARG_BERBAHAYA[path.basename(w[0])]?.(w.slice(1))) return true;
    return !baca.some((r) => r.test(t));
  });
  const kemampuan = u.segmen.some((s) => path.basename(s.kata[0]?.nilai ?? "") === "mysql") ? "data-produksi" : "server";
  if (!tidakBaca.length && !u.kompleks && !u.ekspansi) {
    const my = u.segmen.find((s) => path.basename(s.kata[0]?.nilai ?? "") === "mysql");
    if (!my) return [{ kemampuan, jenjang: 1, aksi: `baca server ${prov}` }];
    const w = my.kata.map((x) => x.nilai);
    // bentuk keluaran untuk menghitung baris di PostToolUse: vertikal (-E/\G) atau tanpa baris kepala (-N)
    return [{ kemampuan, jenjang: 1, jenis: "baca-data", aksi: `baca data prod ${prov}`, bacaData: true,
      vertikal: w.some((x) => /^-[A-Za-z]*E/.test(x) && !x.startsWith("--") || x === "--vertical") || /\\G\s*$/.test(w.join(" ")),
      tanpaKepala: w.some((x) => /^-[A-Za-z]*N/.test(x) && !x.startsWith("--") || x === "--skip-column-names") }];
  }
  return [{ kemampuan, jenjang: 3, aksi: `perintah server ${prov}: ${(tidakBaca[0]?.teks ?? remote).slice(0, 80)}` }];
}

/** gh/glab api: menulis bila ada field/input, atau metode selain GET — termasuk gugus opsi pendek (-iX DELETE, -if). */
function apiTulis(t) {
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (/^--(field|raw-field|input|form)(=|$)/.test(x)) return true;
    if (/^--method(=|$)/.test(x)) { const v = x.includes("=") ? x.slice(9) : t[++i]; if (!/^get$/i.test(v ?? "")) return true; continue; }
    if (/^-[A-Za-z]/.test(x)) {
      for (let j = 1; j < x.length; j++) {
        const c = x[j];
        if (c === "f" || c === "F") return true;
        if (c === "X") { const v = j + 1 < x.length ? x.slice(j + 1) : t[++i]; if (!/^get$/i.test(v ?? "")) return true; break; }
        if ("HpqtR".includes(c)) { if (j + 1 >= x.length) i++; break; }   // opsi bernilai: sisanya nilai
        if (!/[A-Za-z]/.test(c)) break;
      }
    }
  }
  return false;
}

/** Skrip perkakas RudisOne yang asli: path absolut di ROOT/bin, atau bin/… relatif terhadap folder sekarang tanpa
 *  `cd` sebelumnya di perintah yang sama (cd /tmp/x && bin/server-cek.sh tidak lagi dikenali). */
function perkakasAsli(prog, ctx) {
  const p = rumah(prog);
  let abs;
  if (path.isAbsolute(p)) abs = p;
  else if (/^(\.\/)?bin\/[^/]+$/.test(p) && ctx.cwd) abs = path.resolve(rumah(ctx.cwd), p);
  else return false;
  return path.dirname(path.resolve(abs)) === path.join(ROOT, "bin");
}

const BACA_SENDIRI = { kebijakan: ["uji", "cek", "tampil", "audit"], konfig: ["cek", "get", "host", "playbook", "contoh"], inti: ["hook", "cek", "uji"] };

/** Satu segmen → { aksi?, aman, bacaSendiri? }. `aman` = segmen ini boleh ikut dalam perintah yang diloloskan. */
function klasifikasiSegmen(s, K, ctx) {
  const w = [...s.kata];
  const prefiks = [];
  while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0].nilai)) prefiks.push(w.shift().nilai);
  const alihOk = s.alih.every(alihAman);
  if (!w.length) return { aman: false };
  const prog = w[0].nilai, nama = path.basename(prog), args = w.slice(1).map((x) => x.nilai);
  // glob & {a,b} diekspansi shell lokal SEBELUM program melihatnya (bisa menyisipkan opsi/perintah) → tidak pernah aman
  const dasarAman = alihOk && !prefiks.length && !w.some((x) => x.ekspansi || x.glob);
  // perkakas RudisOne (bin/<nama>.sh)
  const pk = nama.match(/^([a-z-]+)\.sh$/)?.[1];
  if (pk && perkakasAsli(prog, ctx)) {
    if (K.perkakas_baca[pk]) return { aman: dasarAman, aksi: [{ kemampuan: K.perkakas_baca[pk], jenjang: 1, aksi: `perkakas ${pk}`, perkakas: pk, args }] };
    const sub = K.perkakas_perintah?.[pk]?.[args[0]];
    if (sub) return { aman: dasarAman, aksi: [{ kemampuan: sub, jenjang: 1, aksi: `perkakas ${pk} ${args.slice(0, 2).join(" ")}`, perkakas: pk, args }] };
  }
  // pengelola kebijakan/konfigurasi/inti: subperintah baca tidak dianggap mengubah berkas terlindung (tidak pernah allow)
  const skrip = (nama === "node" ? path.basename(args[0] ?? "") : nama).match(/^(kebijakan|konfig|inti)\.(sh|mjs)$/)?.[1];
  if (skrip) {
    const subp = nama === "node" ? args[1] : args[0];
    return { aman: false, ubahSendiri: !BACA_SENDIRI[skrip].includes(subp),
      bacaSendiri: BACA_SENDIRI[skrip].includes(subp) && alihOk && prefiks.every((p) => /^RUDISONE_[A-Z_]+=/.test(p)) };
  }
  if (!programStandar(prog)) return { aman: false };
  const cli = Object.entries(K.penyedia).find(([, p]) => p.jenis === "cli" && p.perintah === nama);
  if (cli) {
    const [id, p] = cli;
    let rest = args;
    if (nama === "git") while (rest.length && rest[0].startsWith("-")) rest = rest.slice(["-C", "-c", "--git-dir", "--work-tree"].includes(rest[0]) ? 2 : 1);
    const a = rest.join(" ");
    // git: hanya push yang urusan kebijakan (jenjang 3); git lain = perintah lokal biasa, TIDAK pernah ikut diloloskan.
    if (p.tulis_remote) return new RegExp(p.tulis_remote).test(a)
      ? { aman: false, aksi: [{ kemampuan: p.kemampuan, jenjang: 3, aksi: `${nama} ${a}`.slice(0, 80) }] } : { aman: false };
    const amanCli = dasarAman && !/\$ENV|\benv\b|--show-token/.test(a) && !(rest[0] === "auth" && rest.some((x) => /^-[A-Za-z]*t/.test(x)));
    if ((p.baca ?? []).some((r) => new RegExp(r).test(a))) return { aman: amanCli, aksi: [{ kemampuan: p.kemampuan, jenjang: 1, aksi: `${id} baca` }] };
    if (p.api_baca && rest[0] === "api" && !apiTulis(rest.slice(1)))
      return { aman: amanCli, aksi: [{ kemampuan: p.kemampuan, jenjang: 1, aksi: `${id} api baca` }] };
    if (p.repo_buat_privat && new RegExp(p.repo_buat_privat).test(a))
      return { aman: dasarAman, aksi: [{ kemampuan: p.kemampuan, jenjang: 2, jenis: "repo_buat_privat", aksi: `${id} buat repo privat ${rest[2] ?? ""}`.trim() }] };
    return { aman: false, aksi: [{ kemampuan: p.kemampuan, jenjang: 3, aksi: `${nama} ${a}`.slice(0, 80) }] };
  }
  if (nama === "ssh" || nama === "scp" || nama === "rsync") {
    const hostDikenal = (h) => Object.entries(K.penyedia).find(([, p]) => p.jenis === "ssh" && p.host === h);
    if (nama === "ssh") {
      let i = 1, opsiAman = true;
      const v = w.map((x) => x.nilai);
      for (; i < v.length; i++) {
        const o = v[i];
        if (!o.startsWith("-")) break;
        if (o === "-o" || /^-o./.test(o)) { const kv = o === "-o" ? v[++i] ?? "" : o.slice(2); if (!KUNCI_SSH_AMAN.test(kv)) opsiAman = false; continue; }
        if (OPSI_SSH_BERNILAI.has(o)) { if (!OPSI_SSH_AMAN.has(o)) opsiAman = false; i++; continue; }
        if (!BENDERA_SSH_AMAN.test(o)) opsiAman = false;
      }
      const host = (v[i] ?? "").replace(/^[^@]*@/, ""), prov = hostDikenal(host);
      if (!prov) return { aman: false };
      if (!opsiAman) return { aman: false, aksi: [{ kemampuan: "server", jenjang: 3, aksi: `ssh ${host} dengan opsi di luar daftar aman` }] };
      const remote = v.slice(i + 1).join(" ");
      if (!remote) return { aman: false, aksi: [{ kemampuan: "server", jenjang: 3, aksi: `sesi shell interaktif ${host}` }] };
      return { aman: dasarAman, aksi: klasifikasiRemote(remote, prov[0], K) };
    }
    const prov = args.map((a) => a.match(/^(?:[^@\s]+@)?([^:\s/]+):/)?.[1]).map((h) => h && hostDikenal(h)).find(Boolean);
    return prov ? { aman: false, aksi: [{ kemampuan: "server", jenjang: 3, aksi: `${nama} ke ${prov[1].host}` }] } : { aman: false };
  }
  if (BACA_LOKAL.has(nama) && K.lokal_netral.includes(nama)) {
    const rahasia = new RegExp(K.ssh_rahasia + RAHASIA_LOKAL, "i");
    const dibaca = [...args, ...s.alih.filter((a) => a.op.endsWith("<")).map((a) => a.target)];
    const aman = dasarAman
      && !dibaca.some((x) => rahasia.test(x))
      && !ARG_BERBAHAYA[nama]?.(args) && !ARG_BERBAHAYA_LOKAL[nama]?.(args);
    return { aman };
  }
  return { aman: false };
}

// ---------- berkas terlindung (T-20261030-5 · F2) ----------
// Berkas yang menentukan keputusan hook ini atau izin Claude Code. Write/Edit/MultiEdit/NotebookEdit ke sana, dan
// perintah Bash yang menyebutnya tetapi tidak sepenuhnya baca, SELALU "ask" — di semua sesi. Batas: Bash yang
// menyamarkan path (variabel, glob, base64, skrip) tidak terlihat; penegakan kerasnya permissions.deny + sandbox
// (skills/rudis-operasi › Berkas terlindung).
const NAMA_TERLINDUNG = [
  /kebijakan-akses\.json/i, /kebijakan\.(mjs|sh)/i, /konfig\.(mjs|sh)/i, /inti\.(mjs|sh)/i, /rilis-cek\.(sh|mjs)/i,
  /(^|\/)konfigurasi(\/|$)/i, /handoff\/audit/i, /(^|\/)\.sesi(\/|$)/i, /(^|\/)\d{4}-\d{2}\.jsonl$/i,
  // ~/.claude: hanya bagian yang memengaruhi izin/identitas — bukan tool-results, plans, memory, worktrees
  /\.claude\/?$/i, /\.claude\.json/i, /\.claude\/(agents|skills|commands|shell-snapshots|hooks)(\/|$)/i, /\.claude\/projects\/.*\.jsonl$/i,
  /(^|\/)settings(\.local)?\.json/i, /\.mcp\.json/i,
  /(^|\/)\.(zshrc|zshenv|zprofile|bashrc|bash_profile|profile)$/i, /register-tugas\.json/i,
];
/** Program yang menghapus/memindah/menimpa: menyebut folder LELUHUR berkas terlindung (mv bin x, rm -rf handoff, rm -rf ~)
 *  juga terlindung. git hanya untuk subperintah yang menimpa berkas kerja. */
const PROGRAM_PERUSAK = /^(rm|rmdir|mv|cp|ln|chmod|chown|chflags|truncate|dd|rsync|install|unlink|trash|ditto|tar|unzip)$/;
const GIT_PERUSAK = /^(checkout|restore|reset|clean|rm|mv|stash|apply|am|merge|pull|rebase|switch|worktree|read-tree|checkout-index)$/;
// Sistem berkas macOS/Windows tidak membedakan huruf besar-kecil: ~/.ZSHRC = ~/.zshrc.
const LIPAT = process.platform === "darwin" || process.platform === "win32";
// /System/Volumes/Data/<path> (firmlink macOS) = <path>; /.vol/<dev>/<ino> membuka berkas lewat nomor inode.
const normal = (p) => { const r = path.resolve(p).replace(/^\/System\/Volumes\/Data(?=\/)/i, ""); return LIPAT ? r.toLowerCase() : r; };
const dalam = (a, b) => a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
function asli(p) {
  try { return fs.realpathSync.native(p); } catch { /* belum ada */ }
  try { return path.join(fs.realpathSync.native(path.dirname(p)), path.basename(p)); } catch { return null; }
}
let _terlindung = null;
function daftarTerlindung() {
  if (_terlindung) return _terlindung;
  const berkas = [path.join(ROOT, "kebijakan-akses.json"), FILE_KEBIJAKAN, INI, FILE_KONFIG, path.join(HOME, ".claude.json"), FILE_REGISTER,
    ...[".zshrc", ".zshenv", ".zprofile", ".bashrc", ".bash_profile", ".profile"].map((f) => path.join(HOME, f))];
  const folder = [path.join(ROOT, "bin"), path.join(ROOT, "konfigurasi"), path.join(ROOT, "agen"), path.join(ROOT, "skills"), DIR_AUDIT,
    ...["shell-snapshots", "agents", "skills", "commands"].map((f) => path.join(HOME, ".claude", f))];
  const semua = (xs) => [...new Set(xs.flatMap((x) => [path.resolve(x), asli(x)].filter(Boolean)).map(normal))];
  return (_terlindung = { berkas: semua(berkas), folder: semua(folder), proyek: semua([path.join(HOME, ".claude", "projects")]),
    akar: semua([ROOT]), claude: semua([path.join(HOME, ".claude")]) });
}
/** Alasan bila path absolut `p` terlindung. `ikuti` = periksa juga tujuan symlink & hardlink (alat tulis berkas).
 *  `leluhur` = "semua" (folder leluhur mana pun — untuk program perusak) | false. */
export function sebabTerlindung(p, ikuti = true, leluhur = false) {
  const L = daftarTerlindung();
  const calon = [normal(p)];
  if (ikuti) { const r = asli(p); if (r && !calon.includes(normal(r))) calon.push(normal(r)); }
  for (const c of calon) {
    if (/^\/\.vol(\/|$)/.test(c)) return `path inode ${c}`;
    if (L.berkas.includes(c)) return `berkas kebijakan/konfigurasi ${c}`;
    const d = L.folder.find((f) => dalam(c, f));
    if (d) return `folder terlindung ${d}`;
    if (/\/\.claude\/settings[^/]*\.json$/i.test(c) || /\/\.mcp\.json$/i.test(c)) return `settings Claude Code ${c}`;
    if (L.proyek.some((f) => dalam(c, f)) && c.endsWith(".jsonl")) return `transkrip sesi ${c}`;
    if (leluhur) {
      const sasaran = [...L.berkas, ...L.folder, ...L.proyek];
      const boleh = leluhur === "semua" || L.akar.some((r) => c !== r && dalam(c, r)) || L.claude.some((r) => dalam(c, r));
      if (boleh && sasaran.some((t) => t !== c && dalam(t, c))) return `folder induk berkas terlindung ${c}`;
    }
  }
  if (ikuti) {
    try {
      const st = fs.statSync(p);
      if (st.nlink > 1) for (const f of L.berkas) { try { const s2 = fs.statSync(f); if (s2.ino === st.ino && s2.dev === st.dev) return `hardlink ke ${f}`; } catch { /* tidak ada */ } }
    } catch { /* belum ada */ }
  }
  return null;
}

/** Analisis lengkap satu perintah Bash. */
function analisisBash(input, K) {
  const cmd = String(input.tool_input?.command ?? "");
  const u = urai(cmd);
  // cwd berjalan: `cd <path harfiah>` diikuti; cd lain (variabel, -, pushd/popd) → tidak diketahui (null)
  const ctx = { cwd: input.cwd ? rumah(input.cwd) : HOME };
  const hasil = [];
  let sebut = null, ubahSendiri = false;
  for (const s of u.segmen) {
    const h = klasifikasiSegmen(s, K, ctx);
    hasil.push(h);
    if (h.ubahSendiri) ubahSendiri = true;
    // semua kata kecuali nama program (menjalankan bin/<x>.sh bukan mengubahnya) + target pengalihan
    const iProg = s.kata.findIndex((x) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(x.nilai));
    const kandidat = [...s.kata.filter((_, i) => i !== iProg).map((x) => x.nilai), ...s.alih.map((a) => a.target)];
    const prog = path.basename(s.kata[iProg]?.nilai ?? "");
    const gitSub = prog === "git" ? s.kata.slice(iProg + 1).map((x) => x.nilai).filter((x, i, a) => !x.startsWith("-") && !["-C", "-c", "--git-dir", "--work-tree"].includes(a[i - 1]))[0] : null;
    // folder induk berkas terlindung hanya relevan bagi program yang menghapus/memindah/menimpa (rm -rf handoff, mv <ROOT>)
    const leluhur = PROGRAM_PERUSAK.test(prog) || (gitSub && GIT_PERUSAK.test(gitSub)) ? "semua" : false;
    for (const k0 of kandidat) {
      if (!k0 || sebut) continue;
      for (const k of new Set([k0, k0.slice(k0.lastIndexOf("=") + 1), k0.replace(/^-[A-Za-z]/, "")])) {
        if (!k || sebut) continue;
        if (NAMA_TERLINDUNG.some((r) => r.test(k))) sebut = k;
        else if (ctx.cwd && !k.startsWith("-")) sebut = sebabTerlindung(path.resolve(ctx.cwd, rumah(k)), false, leluhur);
      }
    }
    const k0 = s.kata[0]?.nilai ?? "";
    if (/^(pushd|popd)$/.test(k0)) ctx.cwd = null;
    else if (k0 === "cd") {
      const arg = s.kata.slice(1).filter((x) => !/^-[LP]$/.test(x.nilai));
      ctx.cwd = arg.length === 0 ? HOME : arg.length === 1 && ctx.cwd && !arg[0].ekspansi && !arg[0].glob && arg[0].nilai !== "-" ? path.resolve(ctx.cwd, rumah(arg[0].nilai)) : null;
    }
  }
  const aksi = hasil.flatMap((h) => h.aksi ?? []);
  const aman = !u.kompleks && !u.ekspansi && hasil.length > 0 && hasil.every((h) => h.aman);
  // Menyebut berkas terlindung hanya boleh lolos bila SETIAP bagian perintah dikenali baca.
  const bacaSaja = !u.kompleks && !u.ekspansi && hasil.every((h) => h.aman || h.bacaSendiri);
  const terlindung = ubahSendiri ? "pengelola kebijakan/hook (pasang, lepas, …)" : sebut && !bacaSaja ? sebut : null;
  return { aksi, aman, terlindung, ringkasan: cmd };
}

const ALAT_TULIS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** Semua aksi infrastruktur dalam satu panggilan alat + apakah SEMUA bagiannya dikenali aman + berkas terlindung. */
export function klasifikasi(input, K) {
  if (input.tool_name === "Bash") {
    const a = analisisBash(input, K);
    return { aksi: a.aksi, dipahami: a.aman, terlindung: a.terlindung, ringkasan: a.ringkasan };
  }
  if (ALAT_TULIS.has(input.tool_name)) {
    const f = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    const sebab = f ? sebabTerlindung(path.resolve(rumah(input.cwd || HOME), rumah(f)), true) : null;
    return { aksi: [], dipahami: false, terlindung: sebab, ringkasan: `${input.tool_name} ${f ?? ""}` };
  }
  if (String(input.tool_name).startsWith("mcp__")) {
    const aksi = klasifikasiMcp(input.tool_name, input.tool_input, K) ?? [];
    return { aksi, dipahami: true, terlindung: null, ringkasan: `${input.tool_name} ${JSON.stringify(input.tool_input ?? {})}` };
  }
  return { aksi: [], dipahami: false, terlindung: null, ringkasan: "" };
}

function klasifikasiMcp(toolName, input, K) {
  const m = toolName.match(/^mcp__(.+?)__(.+)$/);
  if (!m) return null;
  const prov = Object.entries(K.penyedia).find(([, p]) => p.jenis === "mcp" && p.server === m[1]);
  if (!prov) return null;
  const [id, p] = prov;
  const kemampuanOp = (op) => { const a = Object.entries(p.kemampuan_menurut_awalan ?? {}).find(([pre]) => pre !== "*" && op.startsWith(pre)); return a ? a[1] : (p.kemampuan_menurut_awalan?.["*"] ?? "hosting"); };
  const satu = (op, params = {}) => {
    const kem = kemampuanOp(op);
    if (new RegExp(p.baca_operasi).test(op)) return { kemampuan: kem, jenjang: 1, aksi: `${id} ${op}` };
    if (op === p.dns_tambah_operasi && dnsTambahSah(params, K)) return { kemampuan: kem, jenjang: 2, jenis: "dns_tambah", aksi: `${id} tambah record ${(params.zone ?? []).map((z) => `${z.name}.${params.domain} ${z.type}`).join(", ")}` };
    return { kemampuan: kem, jenjang: 3, aksi: `${id} ${op}${params.domain ? ` ${params.domain}` : ""}` };
  };
  if (m[2] === "search") return [{ kemampuan: p.kemampuan_menurut_awalan?.["*"] ?? "hosting", jenjang: 1, aksi: `${id} cari operasi` }];
  if (m[2] === "execute") return [satu(String(input?.operation ?? ""), input?.params)];
  if (m[2] === "multi-execute") return (input?.steps ?? []).map((s) => satu(String(s?.operation ?? ""), s?.params));
  return [{ kemampuan: p.kemampuan_menurut_awalan?.["*"] ?? "hosting", jenjang: /^(get|list|search|read|view|fetch|find)[_-]/.test(m[2]) ? 1 : 3, aksi: `${id} ${m[2]}` }];
}

function dnsTambahSah(params, K) {
  const a = K.jenjang2.dns_tambah;
  if (!params?.domain || params.overwrite === true || !Array.isArray(params.zone) || !params.zone.length) return false;
  return params.zone.every((z) => a.tipe.includes(z?.type) && typeof z?.name === "string" && !a.nama_dilarang.includes(z.name.trim()) && !z.name.includes("*"));
}

// ---------- audit ----------
const RAHASIA = [/((?:pass(?:word)?|passwd|token|secret|api[_-]?key|authorization)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi,
  /(bearer\s+)\S+/gi, /(\s-p)(\S+)/g, /(gh[pousr]_)[A-Za-z0-9]{20,}/g];
export function samarkan(s) { let t = String(s); for (const r of RAHASIA) t = t.replace(r, "$1***"); return t.length > 400 ? `${t.slice(0, 400)}…` : t; }

function berkasAudit(tgl = new Date()) { return path.join(DIR_AUDIT, `${tgl.toISOString().slice(0, 7)}.jsonl`); }

// ---- rantai hash audit (L3b): setiap baris memuat sha256(rantai sebelumnya + isi). Menyunting/menghapus/menyisipkan
// baris di tengah terdeteksi `audit --verifikasi`; baris lama tanpa rantai hanya sah sebelum baris berantai pertama.
const rantaiDari = (prev, rec) => crypto.createHash("sha256").update(`${prev}\n${JSON.stringify(rec)}`).digest("hex");
function rantaiTerakhir(f) {
  try {
    const st = fs.statSync(f), n = Math.min(st.size, 65536), b = Buffer.alloc(n), fd = fs.openSync(f, "r");
    fs.readSync(fd, b, 0, n, st.size - n); fs.closeSync(fd);
    const ls = b.toString("utf8").split("\n").filter((l) => l.trim());
    for (let i = ls.length - 1; i >= 0; i--) { try { const r = JSON.parse(ls[i]); if (r.rantai) return r.rantai; } catch { /* potongan */ } }
  } catch { /* belum ada */ }
  return "0";
}
function denganKunci(fn) {
  const kunci = path.join(DIR_AUDIT, ".kunci");
  for (let i = 0; i < 50; i++) {
    let fd; try { fd = fs.openSync(kunci, "wx"); } catch {
      try { if (Date.now() - fs.statSync(kunci).mtimeMs > 5000) fs.rmSync(kunci, { force: true }); } catch { /* sudah hilang */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); continue;
    }
    try { return fn(); } finally { fs.closeSync(fd); fs.rmSync(kunci, { force: true }); }
  }
  return fn();   // kunci macet: tetap catat (rantai bisa terputus, terdeteksi verifikasi)
}
export function tambahAudit(rec) {
  fs.mkdirSync(DIR_AUDIT, { recursive: true });
  denganKunci(() => { const f = berkasAudit(); fs.appendFileSync(f, `${JSON.stringify({ ...rec, rantai: rantaiDari(rantaiTerakhir(f), rec) })}\n`); });
}
/** [{ berkas, baris, lama, rusak: [nomor baris] }] untuk semua berkas audit. */
export function verifikasiAudit() {
  let daftar = [];
  try { daftar = fs.readdirSync(DIR_AUDIT).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort(); } catch { return []; }
  return daftar.map((nama) => {
    const ls = fs.readFileSync(path.join(DIR_AUDIT, nama), "utf8").split("\n").filter((l) => l.trim());
    let prev = "0", mulai = false, lama = 0; const rusak = [];
    ls.forEach((l, i) => {
      let r; try { r = JSON.parse(l); } catch { rusak.push(i + 1); return; }
      if (!r.rantai) { if (mulai) rusak.push(i + 1); else lama++; return; }
      const { rantai, ...isi } = r;
      mulai = true;
      if (rantaiDari(prev, isi) !== rantai) rusak.push(i + 1);
      prev = rantai;
    });
    return { berkas: nama, baris: ls.length, lama, rusak };
  });
}
export function bacaAudit(bulan = 2) {
  const out = []; const now = new Date();
  for (let i = bulan - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    try { for (const l of fs.readFileSync(berkasAudit(d), "utf8").split("\n")) if (l.trim()) try { out.push(JSON.parse(l)); } catch { /* baris rusak */ } } catch { /* belum ada */ }
  }
  return out;
}
/** ID tugas dari pesan masuk sesi itu (brief "[Tugas dari …] T-…", [Revisi], dst.), bukan dari teks yang ditulis agent
 *  atau isi berkas — di sesi COO yang membahas banyak tugas hasilnya sering kosong, dan kosong lebih jujur daripada salah. */
function tugasTerakhir(transcript) {
  try {
    const st = fs.statSync(transcript), n = Math.min(st.size, 524288), fd = fs.openSync(transcript, "r"), b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, st.size - n); fs.closeSync(fd);
    let id = null;
    for (const l of b.toString("utf8").split("\n")) {
      if (!l.includes('"user"')) continue;
      let baris; try { baris = JSON.parse(l); } catch { continue; }
      const m = teksPesanPengguna(baris).match(/^\s*\[[^\]]{1,80}\]\s*(T-\d{8}-\d+(?:\.\d+)?)/m);
      if (m) id = m[1];
    }
    return id;
  } catch { return null; }
}

// ---------- keputusan ----------
const RILIS_CEK = process.env.RUDISONE_RILIS_CEK || path.join(ROOT, "bin", "rilis-cek.sh");
/** Syarat deploy jenjang 2: catatan rilis-cek "SIAP DEPLOY" ≤ N jam DAN pemeriksaan ulang langsung saat ini (GitHub
 *  lewat bin/rilis-cek.sh). Catatan audit bisa ditulis agent sendiri, jadi tidak pernah cukup sendirian (F2). Galat,
 *  timeout, atau belum siap → ditanya. */
function rilisSiap(repo, sha, K) {
  if (!repo || !sha) return false;
  const batas = Date.now() - (K.jenjang2.deploy.rilis_cek_maks_jam ?? 24) * 3600e3;
  // hanya catatan berantai dari berkas audit yang utuh (catatan yang disisipkan/disunting tidak dipercaya)
  if (verifikasiAudit().some((v) => v.rusak.length)) return false;
  const tercatat = bacaAudit().some((r) => r.rantai && r.jenis === "rilis-cek" && r.hasil === "SIAP DEPLOY" && r.repo?.toLowerCase() === repo.toLowerCase()
    && r.sha && r.sha.length >= 7 && (sha.startsWith(r.sha) || r.sha.startsWith(sha)) && Date.parse(r.waktu) >= batas);
  if (!tercatat) return false;
  try {
    const out = execFileSync(RILIS_CEK, [repo, sha], { timeout: 20000, stdio: ["ignore", "pipe", "ignore"] }).toString();
    return /Hasil: SIAP DEPLOY/.test(out);
  } catch { return false; }
}

/** { keputusan: "allow" | "ask" | null, alasan } — null = biarkan alur izin biasa.
 *  `allow` hanya bila SETIAP bagian panggilan dikenali aman (F1); berkas terlindung selalu `ask` di sesi mana pun (F2). */
export function putuskan(input, K) {
  const k = klasifikasi(input, K);
  if (k.terlindung) {
    const sesi0 = kenaliSesi(input, K);
    return { keputusan: "ask", alasan: `RudisOne · berkas terlindung: ${k.terlindung} — mengubah kebijakan/izin/audit adalah keputusan pemilik`, sesi: sesi0, aksi: k.aksi };
  }
  if (ALAT_TULIS.has(input.tool_name)) return { keputusan: null, alasan: "bukan berkas terlindung", sesi: null };
  const sesi = kenaliSesi(input, K);
  if (!sesi.rudisOne) return { keputusan: null, alasan: "bukan sesi RudisOne", sesi };
  const { aksi, dipahami } = k;
  if (!aksi.length) return { keputusan: null, alasan: "bukan aksi infrastruktur", sesi };
  const nama = sesi.jabatan ? K.jabatan[sesi.jabatan]?.nama ?? sesi.jabatan : "jabatan tak dikenal";
  const tanya = [];
  const namaInduk = sesi.induk ? K.jabatan[sesi.induk]?.nama ?? sesi.induk : null;
  for (const a of aksi) {
    const akses = K.kemampuan[a.kemampuan]?.akses;
    if (sesi.subagent) {
      if (!sesi.induk) { tanya.push(`${a.aksi} — subagent ${nama} dipanggil sesi yang bukan sesi RudisOne`); continue; }
      if (akses && !akses.includes(sesi.induk)) { tanya.push(`${a.aksi} — di luar akses ${namaInduk} (pemanggil subagent ${nama})`); continue; }
      if (a.jenjang === 2) { tanya.push(`${a.aksi} — jenjang 2 tidak dijalankan subagent tanpa prompt`); continue; }
    }
    if (sesi.jabatan && akses && !akses.includes(sesi.jabatan)) { tanya.push(`${a.aksi} — di luar akses ${nama} (${K.kemampuan[a.kemampuan].nama})`); continue; }
    if (a.jenjang === 3) { tanya.push(`${a.aksi} — jenjang 3, keputusan pemilik`); continue; }
    if (a.jenjang === 2) {
      const aturan = K.jenjang2[a.jenis];
      if (!aturan || !sesi.jabatan || !aturan.jabatan.includes(sesi.jabatan)) { tanya.push(`${a.aksi} — jenjang 2 bukan wewenang ${nama}`); continue; }
      if (!dipahami) { tanya.push(`${a.aksi} — jenjang 2 digandeng perintah yang tidak dikenali`); continue; }
      if (a.jenis === "deploy" && !a.app) { tanya.push(`${a.aksi} — app belum terdaftar di kebijakan`); continue; }
      if (a.jenis === "deploy" && !rilisSiap(a.repo, a.sha, K)) { tanya.push(`${a.aksi} — rilis-cek "SIAP DEPLOY" belum tercatat dalam ${K.jenjang2.deploy.rilis_cek_maks_jam} jam atau pemeriksaan ulang langsung tidak SIAP`); continue; }
    }
  }
  if (tanya.length) return { keputusan: "ask", alasan: `RudisOne · ${nama}: ${tanya.join("; ")}`, sesi, aksi };
  if (!dipahami) return { keputusan: null, alasan: "perintah memuat bagian yang tidak dikenali aman oleh kebijakan", sesi, aksi };
  const maks = Math.max(...aksi.map((a) => a.jenjang));
  return { keputusan: "allow", alasan: `RudisOne · ${nama}: jenjang ${maks} — ${aksi.map((a) => a.aksi).join("; ")}`, sesi, aksi };
}

/** Jumlah baris data yang masuk ke transkrip dari keluaran mysql (batch: satu baris per record, minus kepala;
 *  vertikal: penanda "*** n. row ***"). Baris peringatan klien diabaikan. Dihitung dari yang benar-benar dikembalikan
 *  ke agent (setelah | head dsb.) — itulah yang masuk konteks/vendor (X6). */
export function hitungBaris(out, a = {}) {
  const baris = String(out ?? "").split("\n").filter((l) => l.trim() && !/^(mysql: \[Warning\]|Warning:|ERROR \d+)/.test(l));
  if (a.vertikal) return baris.filter((l) => /^\*+ \d+\. row \*+$/.test(l.trim())).length;
  return Math.max(0, baris.length - (a.tanpaKepala ? 0 : 1));
}

export function catatSesudah(input, K) {
  const { aksi, ringkasan, terlindung } = klasifikasi(input, K);
  const sesi = kenaliSesi(input, K);
  if (!sesi.rudisOne && !terlindung) return null;
  const out = typeof input.tool_response === "string" ? input.tool_response : String(input.tool_response?.stdout ?? JSON.stringify(input.tool_response ?? ""));
  const rekam = [];
  if (terlindung) rekam.push({ jenis: "berkas-terlindung", jenjang: 3, kemampuan: null, aksi: `ubah ${terlindung}`.slice(0, 200) });
  if (sesi.rudisOne) for (const a of aksi) {
    if (a.bacaData) rekam.push({ jenis: "baca-data", jenjang: 1, kemampuan: a.kemampuan, aksi: a.aksi, baris: hitungBaris(out, a) });
    else if (a.perkakas === "rilis-cek") rekam.push({ jenis: "rilis-cek", repo: a.args?.[0] ?? null, sha: a.args?.[1] ?? null, hasil: /SIAP DEPLOY/.test(out) ? "SIAP DEPLOY" : "belum siap" });
    else if (a.jenjang >= 2) rekam.push({ jenis: a.jenis ?? "ubah", jenjang: a.jenjang, kemampuan: a.kemampuan, aksi: a.aksi });
  }
  if (!rekam.length) return null;
  const dasar = { waktu: new Date().toISOString(), sesi: input.session_id ?? null, jabatan: sesi.jabatan,
    ...(sesi.subagent ? { subagent: input.agent_type, induk: sesi.induk } : {}), tugas: tugasTerakhir(transkripInduk(input.transcript_path)),
    cwd: input.cwd ?? null, alat: input.tool_name, ringkasan: samarkan(ringkasan) };
  fs.mkdirSync(DIR_AUDIT, { recursive: true });
  for (const r of rekam) tambahAudit({ ...dasar, ...r });
  return rekam;
}

// ---------- pemasangan (dijalankan pengguna) ----------
/** Alat yang dilihat hook. Write/Edit/MultiEdit/NotebookEdit sejak T-20261030-5 (berkas terlindung). */
export const MATCHER = "^(Bash|Write|Edit|MultiEdit|NotebookEdit|mcp__.*)$";
function entriHook() {
  return { matcher: MATCHER, hooks: [{ type: "command", command: `"${process.execPath}" "${INI}" hook`, timeout: 30 }] };
}
const milikKita = (e) => (e?.hooks ?? []).some((h) => String(h?.command ?? "").includes(PENANDA));
function bacaSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
export function statusPasang() {
  const s = bacaSettings();
  return ["PreToolUse", "PostToolUse"].every((ev) => (s.hooks?.[ev] ?? []).some(milikKita));
}
/** Terpasang dengan matcher versi ini? (versi lama tidak melihat Write/Edit → berkas terlindung tidak dijaga) */
export function matcherMutakhir() {
  const s = bacaSettings();
  return ["PreToolUse", "PostToolUse"].every((ev) => (s.hooks?.[ev] ?? []).filter(milikKita).every((e) => e.matcher === MATCHER));
}
/** Program yang dipanggil hook masih ada? (mis. Node versi nvm lama dihapus → hook diam-diam tidak berjalan). */
export function programHookAda() {
  const s = bacaSettings();
  const cmds = Object.values(s.hooks ?? {}).flat().flatMap((e) => e?.hooks ?? []).map((h) => String(h?.command ?? "")).filter((c) => c.includes(PENANDA));
  return cmds.every((c) => [...c.matchAll(/"([^"]+)"/g)].every((m) => fs.existsSync(m[1])));
}
async function konfirmasi(pesan, opsi) {
  if (opsi.includes("--ya")) return true;
  if (!process.stdin.isTTY) { console.error("Bukan terminal interaktif — tambahkan --ya bila memang dijalankan pemilik."); return false; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const j = await new Promise((r) => rl.question(`${pesan} [y/N] `, r)); rl.close();
  return /^y(a|es)?$/i.test(j.trim());
}
function tulisSettings(s) {
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.cadangan-rudisone-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, `${JSON.stringify(s, null, 2)}\n`);
}
async function pasang(opsi) {
  const s = bacaSettings();
  if (statusPasang() && matcherMutakhir()) { console.log(`Sudah terpasang di ${SETTINGS}.`); return 0; }
  console.log(`Akan menambahkan hook kebijakan RudisOne ke ${SETTINGS} (PreToolUse + PostToolUse, alat: Bash, Write/Edit & MCP):`);
  console.log(`  ${entriHook().hooks[0].command}`);
  console.log("Hook hanya bertindak di sesi RudisOne; sesi pribadi dilewati. Aturan izin yang sudah ada tidak diubah; cadangan settings dibuat dulu.");
  if (!(await konfirmasi("Pasang sekarang?", opsi))) { console.log("Dibatalkan."); return 1; }
  s.hooks ??= {};
  for (const ev of ["PreToolUse", "PostToolUse"]) { s.hooks[ev] = (s.hooks[ev] ?? []).filter((e) => !milikKita(e)); s.hooks[ev].push(entriHook()); }
  tulisSettings(s);
  console.log("Terpasang. Claude Code biasanya langsung memakainya, termasuk di sesi yang sedang terbuka; bila belum, mulai ulang sesinya.");
  return 0;
}
async function lepas(opsi) {
  const s = bacaSettings();
  if (!statusPasang() && !["PreToolUse", "PostToolUse"].some((ev) => (s.hooks?.[ev] ?? []).some(milikKita))) { console.log("Tidak terpasang."); return 0; }
  if (!(await konfirmasi(`Hapus hook kebijakan RudisOne dari ${SETTINGS}?`, opsi))) { console.log("Dibatalkan."); return 1; }
  for (const ev of ["PreToolUse", "PostToolUse"]) {
    if (!s.hooks?.[ev]) continue;
    s.hooks[ev] = s.hooks[ev].filter((e) => !milikKita(e));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  tulisSettings(s);
  console.log("Dilepas.");
  return 0;
}

function tampil(K) {
  const nama = (id) => K.jabatan[id]?.nama ?? id;
  console.log("Akses per jabatan (kemampuan → jabatan yang boleh; lainnya selalu ditanya):");
  for (const [, k] of Object.entries(K.kemampuan)) console.log(`  ${k.nama.padEnd(26)} ${k.akses.map(nama).join(", ")}`);
  console.log("\nJenjang 2 (rutin — disetujui sekali di chat COO, berjalan tanpa prompt bila syarat terpenuhi):");
  for (const [, j] of Object.entries(K.jenjang2)) console.log(`  ${j.nama}\n    oleh: ${j.jabatan.map(nama).join(", ")}`);
  console.log("\nPenyedia terdaftar:");
  for (const [id, p] of Object.entries(K.penyedia)) console.log(`  ${id.padEnd(16)} ${p.jenis.padEnd(4)} ${p.server ?? p.perintah ?? p.host}${p.status ? ` (${p.status})` : ""}`);
  console.log(`\nAplikasi deploy jenjang 2: ${Object.keys(K.aplikasi ?? {}).join(", ") || "—"}`);
  console.log("Jenjang 1 = baca (tanpa tanya) · jenjang 3 = ubah berisiko / di luar daftar (selalu ke pemilik).");
}

/** Denyut (D1): hook yang benar-benar dipanggil Claude Code menulis `<audit>/.denyut.json` paling sering 1×/60 dtk.
 *  cek-konsistensi & `cek` membacanya — bukti hook berjalan tanpa mengubah settings. */
export const VERSI_HOOK = (() => { try { return crypto.createHash("sha1").update(fs.readFileSync(INI)).digest("hex").slice(0, 12); } catch { return "?"; } })();
export const FILE_DENYUT = path.join(DIR_AUDIT, ".denyut.json");
function denyut() {
  try { if (Date.now() - fs.statSync(FILE_DENYUT).mtimeMs < 60_000) return; } catch { /* belum ada */ }
  try { fs.mkdirSync(DIR_AUDIT, { recursive: true }); fs.writeFileSync(FILE_DENYUT, JSON.stringify({ waktu: new Date().toISOString(), versi: VERSI_HOOK })); } catch { /* opsional */ }
}

async function bacaStdin() { let s = ""; for await (const c of process.stdin) s += c; return s; }

export async function main(argv) {
  const [perintah, ...opsi] = argv;
  if (perintah === "hook") {
    try {
      const input = JSON.parse(await bacaStdin());
      const K = muatKebijakan();
      denyut();
      if (input.hook_event_name === "PreToolUse") {
        const p = putuskan(input, K);
        if (p.keputusan) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: p.keputusan, permissionDecisionReason: p.alasan } }));
      } else if (input.hook_event_name === "PostToolUse") catatSesudah(input, K);
    } catch { /* gagal terbuka: alur izin biasa berlaku */ }
    return 0;
  }
  if (perintah === "pasang") return pasang(opsi);
  if (perintah === "lepas") return lepas(opsi);
  if (perintah === "cek") {
    let ok = statusPasang();
    console.log(ok ? `Kebijakan RudisOne terpasang di ${SETTINGS}.` : `Belum terpasang — pemilik menjalankan: ${ROOT}/bin/kebijakan.sh pasang`);
    if (ok && !matcherMutakhir()) { ok = false; console.log(`Hook terpasang versi lama (matcher tanpa Write/Edit — berkas terlindung tidak dijaga) — pemilik menjalankan: ${ROOT}/bin/kebijakan.sh pasang`); }
    if (ok && !programHookAda()) { ok = false; console.log(`Program yang dipanggil hook tidak ditemukan (Node berpindah versi?) — pemilik menjalankan ulang: ${ROOT}/bin/kebijakan.sh lepas && ${ROOT}/bin/kebijakan.sh pasang`); }
    try {
      const d = JSON.parse(fs.readFileSync(FILE_DENYUT, "utf8"));
      const jam = (Date.now() - Date.parse(d.waktu)) / 3600e3;
      console.log(`Denyut hook: ${d.waktu} (${jam.toFixed(1)} jam lalu)${d.versi !== VERSI_HOOK ? ` — dari versi lain (${d.versi} ≠ ${VERSI_HOOK})` : ""}`);
    } catch { console.log("Denyut hook: belum ada — hook belum terlihat dipanggil Claude Code sejak versi ini."); }
    try { muatKebijakan(); console.log(`Kebijakan terbaca: ${FILE_KEBIJAKAN}`); } catch (e) { console.log(`Kebijakan rusak: ${e.message}`); return 1; }
    return ok ? 0 : 1;
  }
  if (perintah === "tampil") { tampil(muatKebijakan()); return 0; }
  if (perintah === "audit" && opsi[0] === "--verifikasi") {
    const hasil = verifikasiAudit();
    for (const v of hasil) console.log(`${v.berkas}: ${v.baris} baris, ${v.lama} lama tanpa rantai, ${v.rusak.length ? `RUSAK di baris ${v.rusak.join(", ")}` : "rantai utuh"}`);
    if (!hasil.length) console.log("Belum ada berkas audit.");
    return hasil.some((v) => v.rusak.length) ? 1 : 0;
  }
  if (perintah === "audit") {
    const n = Number(opsi[0] ?? 20);
    for (const r of bacaAudit().slice(-n)) console.log(`${r.waktu}  ${(r.jabatan ?? "?").padEnd(22)} ${r.tugas ?? "—"}  ${r.jenis === "rilis-cek" ? `rilis-cek ${r.repo} ${r.sha} → ${r.hasil}` : `[j${r.jenjang}] ${r.aksi}`}`);
    return 0;
  }
  if (perintah === "uji") {
    TULIS_CACHE = false;
    const input = { session_id: "uji", hook_event_name: "PreToolUse", ...JSON.parse(opsi[0] ?? "{}") };
    const p = putuskan(input, muatKebijakan());
    console.log(JSON.stringify({ keputusan: p.keputusan ?? "alur biasa", alasan: p.alasan, jabatan: p.sesi?.jabatan ?? null, aksi: p.aksi ?? [] }, null, 2));
    return 0;
  }
  console.error(fs.readFileSync(INI, "utf8").split("\n").slice(1, 13).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) main(process.argv.slice(2)).then((k) => { process.exitCode = k; });
