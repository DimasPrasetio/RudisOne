#!/usr/bin/env node
// Kebijakan akses & batas kewenangan RudisOne — hook PreToolUse/PostToolUse Claude Code + perintah pengelola.
// Jenjang & akses jabatan hanya di sesi RudisOne (COO, divisi, tim engineering); sesi pribadi dilewati tanpa jejak,
// KECUALI penulisan nyata ke berkas terlindung (kebijakan, konfigurasi, audit, settings, transkrip, rc shell) → ask di
// sesi mana pun (membaca/menjalankan/menyebut tidak ditanya).
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
    // ~+ (PWD), ~- (OLDPWD), ~user: diekspansi shell ke path yang tidak terlihat pengurai (U3 H1); ~ dan ~/ tetap harfiah
    if (c === "~" && !w && n !== undefined && n !== "/" && !/[\s;&|()<>]/.test(n)) { ekspansi = true; kini().ekspansi = true; }
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
/** Fungsi bawaan MySQL yang boleh muncul di SELECT baca; fungsi lain (mis. stored function MODIFIES SQL DATA) → ask. */
const FUNGSI_BACA = new Set(("count sum avg min max concat concat_ws left right substring substr mid length char_length lower upper trim ltrim " +
  "rtrim replace lpad rpad round floor ceil ceiling abs mod if ifnull nullif coalesce greatest least cast convert date time year month " +
  "day hour minute second now curdate curtime current_date current_timestamp date_format str_to_date date_add date_sub datediff " +
  "timestampdiff unix_timestamp from_unixtime group_concat json_extract json_unquote json_length json_object json_array distinct " +
  "md5 sha1 sha2 hex unhex format instr locate find_in_set field elt in exists not and or interval values database version").split(" "));
function mysqlBaca(w) {
  // klien mysql dari PATH atau folder sistem saja — `/tmp/x/mysql`, `./mysql` bukan klien (U3 M1)
  if (!(w[0] === "mysql" || /^\/usr\/(local\/)?(mysql\/)?bin\/mysql$/.test(w[0]))) return false;
  let stmt = null, posisional = 0;
  for (let i = 1; i < w.length; i++) {
    const x = w[i];
    if (x === "-e" || x === "--execute") { if (stmt !== null) return false; stmt = w[++i] ?? ""; continue; }
    if (/^--execute=/.test(x)) { if (stmt !== null) return false; stmt = x.slice(10); continue; }
    if (/^-e./.test(x)) { if (stmt !== null) return false; stmt = x.slice(2); continue; }
    // host hanya lokal server: -h lain membuat server prod menyambung ke host pilihan penyerang dengan kredensialnya (U3 M2)
    const host = x === "-h" || x === "--host" ? w[i + 1] : /^-h./.test(x) ? x.slice(2) : x.startsWith("--host=") ? x.slice(7) : null;
    if (host !== null && !/^(localhost|127\.0\.0\.1|::1)$/.test(host)) return false;
    if (/^-[uhPD]$/.test(x) || x === "--host") { i++; continue; }
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
    && !/\b(load_file|sleep|benchmark|get_lock)\s*\(/i.test(q)
    && [...q.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''").matchAll(/([A-Za-z_][\w$.]*)\s*\(/g)].every((m) => FUNGSI_BACA.has(m[1].toLowerCase()));
}

/** Perintah lokal yang boleh ikut dalam perintah majemuk yang diloloskan — irisan daftar bawaan hook dengan
 *  `lokal_netral` di kebijakan (berkas kebijakan hanya bisa MENYEMPITKAN). awk/sed/tee/git tidak pernah netral. */
// printf -v dan test -v mengevaluasi subskrip array (zsh/bash) → bisa menjalankan $( ) — tidak termasuk.
const BACA_LOKAL = new Set(["cd", "echo", "tail", "head", "grep", "wc", "sort", "uniq", "cut", "jq", "cat", "ls", "tr", "sleep", "true", "date", "column"]);
const RAHASIA_LOKAL = "|\\.ssh(/|$)|\\.aws|\\.netrc|\\.npmrc|\\.pypirc|\\.git-credentials|\\.config/gh|\\.gnupg|\\.docker/config|keychain|(^|/)rahasia(/|$)|\\.kube/config";
/** Lokasi kredensial device ini (absolut, ternormal; juga tujuan symlink-nya). gh: GH_CONFIG_DIR / XDG_CONFIG_HOME/gh. */
let _lokasiRahasia = null;
function lokasiRahasia() {
  if (_lokasiRahasia) return _lokasiRahasia;
  const cfg = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  const xs = [".ssh", ".aws", ".netrc", ".npmrc", ".pypirc", ".git-credentials", ".gnupg", path.join(".docker", "config.json"), ".kube",
    path.join("Library", "Keychains"), path.join(".config", "gh"), path.join(".config", "rudisone", "rahasia")].map((p) => path.join(HOME, p))
    .concat([path.join(cfg, "gh"), path.join(cfg, "rudisone", "rahasia"), process.env.GH_CONFIG_DIR].filter(Boolean));
  return (_lokasiRahasia = [...new Set(xs.flatMap((x) => [path.resolve(rumah(x)), asli(path.resolve(rumah(x)))].filter(Boolean)).map(normal))]);
}
/** Path seperti dibuka kernel: komponen demi komponen, symlink diikuti SEBELUM `..` diterapkan (path.resolve memotong `..`
 *  secara teks — `L/../x` dengan L symlink membuka induk TUJUAN L). */
function jalurFisik(cwd, p) {
  let cur = "/";
  for (const k of (path.isAbsolute(p) ? p : `${cwd}/${p}`).split("/")) {
    if (!k || k === ".") continue;
    if (k === "..") { cur = path.dirname(cur); continue; }
    const berikut = path.join(cur, k);
    try { cur = fs.realpathSync.native(berikut); } catch { cur = berikut; }
  }
  return cur;
}
/** Apakah path argumen `x` (dibaca dari folder `cwd`) berada di lokasi kredensial. Folder tak diketahui + path relatif → ya.
 *  Selalu rahasia: macOS `/.vol/<dev>/<inode>` (buka lewat nomor inode), Linux `/proc/…` & `/dev/fd/…` (`/proc/self/cwd`,
 *  `/proc/self/root` menunjuk folder proses PEMBACA, bukan proses hook ini). */
function jalurRahasia(x, cwd) {
  const p = rumah(x);
  if (!path.isAbsolute(p) && !cwd) return true;
  const abs = path.resolve(cwd ?? "/", p), fisik = jalurFisik(cwd ?? "/", p);
  return [abs, asli(abs), fisik].filter(Boolean).map(normal).some((a) => /^\/(\.vol|proc|dev\/fd)(\/|$)/.test(a)
    || lokasiRahasia().some((l) => dalam(a, l)));
}
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
      // hanya gugus bendera murni (sama dengan daftar-izin mysqlBaca) — `-eSELECT …` bukan bendera (U3 M3)
      vertikal: w.some((x) => (/^-[NBstEr]+$/.test(x) && x.includes("E")) || x === "--vertical") || /\\G\s*$/.test(w.join(" ")),
      tanpaKepala: w.some((x) => (/^-[NBstEr]+$/.test(x) && x.includes("N")) || x === "--skip-column-names")
        || w.filter((x) => /^-[NBstEr]+$/.test(x)).join("").split("s").length - 1 >= 2 || w.filter((x) => x === "--silent").length >= 2 }];
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
  let mentah;
  if (path.isAbsolute(p)) mentah = p;
  // relatif hanya dari folder AWAL perintah (input.cwd, folder fisik proses) — sesudah `cd` di perintah yang sama, cwd
  // tidak bisa dipastikan (cd logis vs fisik, symlink) → bukan perkakas
  else if (/^(\.\/)?bin\/[^/]+$/.test(p) && ctx.cwd && ctx.cwd === ctx.awal) mentah = `${rumah(ctx.awal)}/${p}`;
  else return false;
  // Path diselesaikan seperti kernel (realpath.native, bukan path.resolve yang memotong `..` secara teks): symlink +
  // `..` tidak bisa membawa skrip lain masuk sebagai perkakas resmi (T-20261030-6 U3 H2).
  let asliP = null, asliBin = null;
  try { asliP = fs.realpathSync.native(mentah); } catch { /* tidak ada */ }
  if (!asliP) return path.dirname(path.resolve(mentah)) === path.join(ROOT, "bin");   // berkas tidak ada → tidak ada yang dijalankan
  try { asliBin = fs.realpathSync.native(path.join(ROOT, "bin")); } catch { return false; }
  if (path.dirname(asliP) !== asliBin) return false;
  return perkakasUtuh(path.basename(asliP));
}
/** Perkakas di checkout utama harus sama dengan yang di-commit (di-track, tanpa perubahan) — skrip jenjang 1 yang
 *  ditimpa agent (mis. lewat `~+/…`, U3 H1) tidak lagi diloloskan. ROOT bukan repo git → tidak diperiksa. */
const _utuh = new Map();
function perkakasUtuh(nama) {
  if (_utuh.has(nama)) return _utuh.get(nama);
  let ok = true;
  try {
    execFileSync("git", ["-C", ROOT, "rev-parse", "--git-dir"], { stdio: "ignore", timeout: 3000 });
    try {
      execFileSync("git", ["-C", ROOT, "ls-files", "--error-unmatch", `bin/${nama}`], { stdio: "ignore", timeout: 3000 });
      execFileSync("git", ["-C", ROOT, "diff", "--quiet", "HEAD", "--", `bin/${nama}`], { stdio: "ignore", timeout: 3000 });
    } catch { ok = false; }
  } catch { /* bukan repo git */ }
  _utuh.set(nama, ok);
  return ok;
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
  // Backend sesi cli (T-20261030-11): dikenali dari nama program di path mana pun (agar pembatasan tidak lolos lewat
  // ~/.local/bin/claude), tetapi hanya boleh ikut diloloskan bila dipanggil dengan nama standar.
  if (nama === "claude") { const h = klasifikasiClaude(args, dasarAman, ctx); return { ...h, claude: true, aman: h.aman && programStandar(prog) }; }
  // lewat pembungkus (timeout 60 claude …, nohup/env/command/exec/nice claude …): pembatasan tetap berlaku, tidak pernah allow
  if (/^(g?timeout|nohup|command|exec|nice|env|stdbuf|time|caffeinate)$/.test(nama)) {
    let i = 1;
    while (i < w.length && /^(-.*|\d+(\.\d+)?[smhd]?|[A-Za-z_][A-Za-z0-9_]*=.*)$/.test(w[i].nilai)) i++;
    if (path.basename(w[i]?.nilai ?? "") === "claude") return { ...klasifikasiClaude(w.slice(i + 1).map((x) => x.nilai), false, ctx), claude: true, aman: false };
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
    // T-20261030-12: selain teks argumen, path yang BENAR-BENAR dibaca (diselesaikan dari folder sekarang, `.`/`..`/`//`
    // dirapikan, symlink diikuti) tidak boleh berada di lokasi kredensial — `cd ~/.config && cat gh/hosts.yml` dsb.
    // nilai opsi: `--opt=val`, dan opsi pendek yang menempel (`-fFILE`, `-nfFILE`) → setiap sisa sesudah huruf opsi
    const nilai = dibaca.flatMap((x) => (x.startsWith("--") ? (x.includes("=") ? [x.slice(x.indexOf("=") + 1)] : [])
      : x.startsWith("-") ? [...x.slice(2)].map((_, i) => x.slice(2 + i)) : [x])).filter(Boolean);
    const folder = ctx.mungkin ?? [null], bukanBerkas = ["echo", "true", "sleep"].includes(nama);   // argumennya bukan berkas
    const aman = dasarAman
      && !dibaca.some((x) => rahasia.test(x))
      && (bukanBerkas || !nilai.some((x) => folder.some((c) => jalurRahasia(x, c))))
      && (bukanBerkas || nama === "cd" || !folder.some((c) => !c || jalurRahasia(c, c)))
      && !ARG_BERBAHAYA[nama]?.(args) && !ARG_BERBAHAYA_LOKAL[nama]?.(args);
    return { aman };
  }
  return { aman: false };
}

// ---------- backend sesi cli: perintah `claude` (T-20261030-11) ----------
// Membentuk/menghentikan sesi latar = kemampuan "sesi" (hanya COO, jenjang 1). `claude --bg` hanya dikenali aman dengan
// opsi dari daftar tetap DAN tepat satu `--settings` = pengaman RudisOne (bgIsolation none, deny push/rm, bypass mati).
// Selalu ditanya (jenjang 3, semua jabatan): bypassPermissions, `claude rm` (menghapus worktree), `claude attach` (milik
// pengguna di terminalnya), `respawn --all`, opsi di luar daftar. `claude agents --json` = baca, semua jabatan.
const SETTINGS_SESI = path.join(ROOT, "konfigurasi", "sesi-cli.settings.json");
const BAHAYA_CLAUDE = /^--(dangerously-skip-permissions|allow-dangerously-skip-permissions)(=|$)|bypassPermissions/i;
const MODE_AMAN = new Set(["default", "auto", "acceptEdits", "plan", "manual", "dontAsk"]);
// --agent sengaja tidak ada: definisi agent proyek (<cwd>/.claude/agents) bisa menimpa milik pengguna dan membawa hooks/MCP.
const OPSI_BG = new Set(["-n", "--name", "-r", "--resume", "--model", "--permission-mode", "--settings"]);
// Subperintah CLI: commander tetap men-dispatch-nya walau opsi root di depannya → tidak boleh berdiri sebagai "prompt".
const SUB_CLAUDE = new Set(["agents", "attach", "auth", "auto-mode", "config", "doctor", "gateway", "import", "install", "kill", "logs",
  "mcp", "migrate-installer", "plugin", "plugins", "project", "respawn", "rm", "setup-token", "stop", "ultrareview", "update", "upgrade"]);
/** Lapis gagal-tertutup: teks perintah yang menyebut `claude` di posisi perintah dengan aksi sesi/bypass, tetapi bentuknya
 *  tidak dikenali pengurai (bash -c, sudo, xargs, kata kunci shell, $( ), opsi pembungkus bernilai, --bg=…) → jenjang 3. */
const AWAL_CLAUDE = "(?:(?:^|[\\n;&|({`!]|\\$\\(|\\b(?:then|do|else)\\s|-c\\s*[\"'])\\s*"
  + "|\\b(?:sudo|xargs|setsid|exec|env|nohup|g?timeout|stdbuf|nice|command|time|caffeinate)\\s(?:[^;&|\\n`)]*\\s)?)"
  + "(?:[^\\s;&|()`'\"]*\\/)?claude(?:\\.exe)?\\s+";
const CLAUDE_SESI_MENTAH = new RegExp(`${AWAL_CLAUDE}(?:[^;&|\\n\`)]*\\s)?(?:--bg|--background|stop|kill|respawn|rm|attach)\\b`);
const CLAUDE_BYPASS_MENTAH = new RegExp(`${AWAL_CLAUDE}[^;&|\\n\`)]*bypass`, "i");
const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n([\s\S]*?)(?:\n[ \t]*\2[ \t]*(?=\n|$)|$)/g;
const SHELL = "(?:\\S*\\/)?(?:ba|z|da|k)?sh";
const keShell = (semua, off) => new RegExp(`(?:^|[;&|(]\\s*)${SHELL}(?:\\s+-\\S+)*\\s*$`).test(semua.slice(semua.lastIndexOf("\n", off) + 1, off).trimEnd())
  || new RegExp(`\\|\\s*${SHELL}\\b`).test(semua.slice(off, (semua.indexOf("\n", off) + 1 || semua.length + 1) - 1));   // cat <<EOF | bash
/** Potongan badan heredoc (dipecah seperti pengurai: baris, ;, &&, ||, |) yang diberikan ke program selain shell. */
function badanHeredoc(cmd) {
  const b = [];
  for (const m of cmd.matchAll(HEREDOC)) if (!keShell(cmd, m.index)) b.push(...m[3].split(/\n|&&|\|\||[;&|]/).map((x) => x.trim()).filter(Boolean));
  return b;
}
/** Teks yang benar-benar dijalankan shell dari satu segmen: isi kutip (pesan commit, JSON, argumen grep) dan badan heredoc
 *  dibuang, KECUALI argumen `-c` (bash -c "…"), isi `$( )`/backtick di dalam kutip ganda, dan heredoc ke shell (bash <<EOF). */
export function teksKode(t) {
  // badan heredoc dibuang, kecuali heredoc yang diberikan ke shell (`bash <<EOF`, `… | sh <<EOF`)
  t = t.replace(HEREDOC, (m, _q, _d, _b, off, semua) => (keShell(semua, off) ? m : m.slice(0, m.indexOf("\n") + 1)));
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\\") { out += t.slice(i, i + 2); i++; continue; }
    if (c !== "'" && c !== '"') { out += c; continue; }
    let j = i + 1;
    while (j < t.length && t[j] !== c) j += c === '"' && t[j] === "\\" ? 2 : 1;
    const isi = t.slice(i + 1, j);
    if (/-c\s*$/.test(out)) out += ` ; ${isi} ;`;
    else if (c === '"') out += ` ${[...isi.matchAll(/\$\(([^)]*)\)?|`([^`]*)`?/g)].map((m) => `; ${m[1] ?? m[2] ?? ""}`).join(" ")} `;
    else out += " ";
    i = j;
  }
  return out;
}
function klasifikasiClaude(args, dasarAman, ctx) {
  const tanya = (aksi) => ({ aman: false, aksi: [{ kemampuan: "sesi", jenjang: 3, aksi }] });
  if (args.some((a) => BAHAYA_CLAUDE.test(a))) return tanya("claude dengan bypassPermissions — tidak pernah dipakai RudisOne");
  if (args.some((a) => /^--(bg|background)=/.test(a))) return tanya("claude --bg=… — bentuk di luar daftar aman");
  const sub = args[0] ?? "";
  // bantuan (--help/-h) dicetak lalu keluar tanpa menjalankan subperintah → baca
  if (args.some((a) => a === "--help" || a === "-h")) return { aman: dasarAman, aksi: [{ kemampuan: "sesi-baca", jenjang: 1, aksi: "claude --help" }] };
  if (sub === "rm") return tanya("claude rm — menghapus sesi & worktree; RudisOne memakai claude stop");
  if (sub === "attach") return tanya("claude attach — dijalankan pengguna di terminalnya sendiri");
  if (sub === "agents") {
    const r = args.slice(1);
    let ok = r.includes("--json");
    for (let i = 0; ok && i < r.length; i++) {
      if (r[i] === "--json" || r[i] === "--all") continue;
      if (r[i] === "--cwd" && r[i + 1] !== undefined && !r[i + 1].startsWith("-")) { i++; continue; }
      ok = false;
    }
    return ok ? { aman: dasarAman, aksi: [{ kemampuan: "sesi-baca", jenjang: 1, aksi: "claude agents --json" }] } : { aman: false };
  }
  if (["stop", "kill", "respawn", "logs"].includes(sub)) {
    const ok = args.length === 2 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(args[1]);
    return { aman: dasarAman && ok, aksi: [{ kemampuan: "sesi", jenjang: ok ? 1 : 3, aksi: `claude ${args.join(" ")}`.slice(0, 80) }] };
  }
  if (args.includes("--bg") || args.includes("--background")) {
    if (args[0] !== "--bg" && args[0] !== "--background") return tanya("claude --bg harus diletakkan pertama: claude --bg --name … --settings <abs> '<prompt>'");
    let pengaman = 0, settingsLain = 0, prompt = 0, asing = null, namaSesi = "";
    for (let i = 0; i < args.length && !asing; i++) {
      const a = args[i];
      if (a === "--bg" || a === "--background") continue;
      const sama = a.startsWith("--") ? a.indexOf("=") : -1;
      const k = sama > 0 ? a.slice(0, sama) : a;
      if (OPSI_BG.has(k)) {
        const v = sama > 0 ? a.slice(sama + 1) : args[++i];
        if (v === undefined || v === "" || v.startsWith("-")) { asing = `${k} tanpa nilai`; break; }
        if (k === "--permission-mode" && !MODE_AMAN.has(v)) asing = `${k} ${v}`;
        if (k === "-n" || k === "--name") namaSesi = v;
        // hanya path absolut harfiah yang persis sama: CLI tidak mengekspansi `~`, dan path relatif/symlink diselesaikan CLI
        // dari cwd fisik yang tidak selalu sama dengan cwd yang dilacak hook (cd gagal, cd lewat symlink)
        // `..` diselesaikan CLI secara fisik (lewat symlink) → hanya bentuk ternormal tanpa `.`/`..`/`//`
        if (k === "--settings") { if (v.startsWith("/") && path.normalize(v) === v && normal(v) === normal(SETTINGS_SESI)) pengaman++; else settingsLain++; }
        continue;
      }
      if (a.startsWith("-")) { asing = a; break; }
      if (SUB_CLAUDE.has(a)) { asing = `subperintah ${a}`; break; }
      prompt++;
    }
    if (!asing && prompt > 1) asing = "lebih dari satu argumen prompt (kutip prompt dengan tanda kutip tunggal)";
    if (asing) return tanya(`claude --bg dengan opsi di luar daftar aman (${asing})`);
    if (pengaman !== 1 || settingsLain) return tanya("claude --bg tanpa tepat satu --settings pengaman RudisOne (konfigurasi/sesi-cli.settings.json)");
    return { aman: dasarAman, aksi: [{ kemampuan: "sesi", jenjang: 1, aksi: `bentuk sesi latar ${namaSesi}`.trim() }] };
  }
  if (args.some((a) => a === "--settings" || a.startsWith("--settings=")))
    return tanya("claude dengan --settings di luar pembentukan sesi latar — settings tambahan diputuskan pemilik");
  if (args.length === 1 && ["--version", "-v"].includes(sub))
    return { aman: dasarAman, aksi: [{ kemampuan: "sesi-baca", jenjang: 1, aksi: "claude --version" }] };
  return { aman: false };
}

// ---------- berkas terlindung (T-20261030-5 · F2) ----------
// Berkas yang menentukan keputusan hook ini atau izin Claude Code. Write/Edit/MultiEdit/NotebookEdit ke sana, dan
// perintah Bash yang MENULISNYA secara nyata (targetTulis), SELALU "ask" — di semua sesi. Membaca/menjalankan/menyebut
// tidak (A9). Batas: penulisan yang disamarkan (variabel, glob, interpreter, skrip) tidak terlihat; penegakan kerasnya
// permissions.deny + sandbox (skills/rudis-operasi › Berkas terlindung).
const NAMA_TERLINDUNG = [
  /kebijakan-akses\.json/i, /kebijakan\.(mjs|sh)/i, /konfig\.(mjs|sh)/i, /inti\.(mjs|sh)/i, /rilis-cek\.(sh|mjs)/i,
  /(^|\/)konfigurasi(\/|$)/i, /handoff\/audit/i, /(^|\/)\.sesi(\/|$)/i, /(^|\/)\d{4}-\d{2}\.jsonl$/i,
  // ~/.claude: hanya bagian yang memengaruhi izin/identitas — bukan tool-results, plans, memory, worktrees
  // agents/skills/commands/shell-snapshots hanya di ~/.claude milik pengguna (skill proyek di repo = kerja Engineering biasa)
  /^(~|\$\{?HOME\}?|\/Users\/[^/]+|\/home\/[^/]+)\/\.claude\/?$/i, /\.claude\.json/i, /\.claude\/projects\/.*\.jsonl$/i,
  /^(~|\$\{?HOME\}?|\/Users\/[^/]+|\/home\/[^/]+)\/\.claude\/(agents|skills|commands|shell-snapshots|hooks)(\/|$)/i,
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
      if (boleh && sasaran.some((t) => dalam(t, c))) return `folder induk berkas terlindung ${c}`;
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

/** Target penulisan satu segmen: [{ path, leluhur }]. `leluhur` = menghapus/memindah folder induk juga terhitung
 *  (rm -rf handoff, mv <ROOT> …). Penulisan yang tidak bisa ditentukan (interpreter, skrip, sudo/xargs) → tidak ada
 *  target → alur izin biasa; permissions.deny/ask (Edit) & sandbox yang menjaganya. */
const TULIS_SEMUA = /^(rm|rmdir|unlink|truncate|chmod|chown|chflags|touch|tee|shred|trash|mv|srm)$/;
const HAPUS_INDUK = /^(rm|rmdir|trash|mv|srm)$/;
const TULIS_TUJUAN = /^(cp|ln|install|rsync|ditto|gcp)$/;
const SUNTING_DI_TEMPAT = /^(sed|gsed|perl|ruby)$/;
const GIT_TULIS_PATH = /^(checkout|restore|rm|mv|clean|reset|stash|apply|am|checkout-index)$/;
export function targetTulis(s, cwd) {
  const out = [];
  for (const a of s.alih) if (/>/.test(a.op) && !/&$/.test(a.op) && a.target && !/^\/dev\//.test(a.target)) out.push({ path: a.target, leluhur: false });
  const w = s.kata.map((x) => x.nilai);
  let i = 0;
  while (i < w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i])) i++;
  const prog = path.basename(w[i] ?? "");
  const args = w.slice(i + 1);
  const bukanOpsi = (xs) => { const r = []; let habis = false; for (const x of xs) { if (habis || !x.startsWith("-") || x === "-") r.push(x); else if (x === "--") habis = true; } return r; };
  const keDir = (tujuan, sumber) => {
    let dir = /\/$/.test(tujuan);
    if (!dir && cwd) { try { dir = fs.statSync(path.resolve(cwd, rumah(tujuan))).isDirectory(); } catch { /* belum ada */ } }
    return dir ? [tujuan, ...sumber.map((x) => path.join(tujuan, path.basename(x)))] : [tujuan];
  };
  if (TULIS_SEMUA.test(prog)) for (const x of bukanOpsi(args)) out.push({ path: x, leluhur: HAPUS_INDUK.test(prog) });
  else if (TULIS_TUJUAN.test(prog)) {
    const p = bukanOpsi(args);
    const t = args.findIndex((x) => x === "-t" || x === "--target-directory");
    const tujuan = t >= 0 ? args[t + 1] : (args.find((x) => x.startsWith("--target-directory="))?.slice(19) ?? p.at(-1));
    if (tujuan && (p.length > 1 || t >= 0)) for (const x of keDir(tujuan, p.filter((x) => x !== tujuan))) out.push({ path: x, leluhur: false });
  } else if (SUNTING_DI_TEMPAT.test(prog) && args.some((x) => /^-[A-Za-z]*i/.test(x) || /^--in-place/.test(x))) {
    for (const x of bukanOpsi(args)) out.push({ path: x, leluhur: false });
  } else if (prog === "dd") {
    for (const x of args) if (x.startsWith("of=")) out.push({ path: x.slice(3), leluhur: false });
  } else if (prog === "tar" || prog === "unzip" || prog === "bsdtar") {
    const ekstrak = prog === "unzip" || args.some((x) => /^(-[A-Za-z]*x|--extract|x[A-Za-z]*$)/.test(x));
    if (ekstrak) {
      const dir = args.map((x, j) => (x === "-C" || x === "--directory" || x === "-d" ? args[j + 1] : /^-C./.test(x) ? x.slice(2) : x.startsWith("--directory=") ? x.slice(12) : null)).find(Boolean);
      out.push({ path: dir ?? ".", leluhur: false });
    }
  } else if (prog === "git") {
    let j = 0; const pre = [];
    while (j < args.length && args[j].startsWith("-")) { if (["-C", "-c", "--git-dir", "--work-tree"].includes(args[j])) { if (args[j] === "-C") pre.push(args[j + 1]); j += 2; } else j++; }
    if (GIT_TULIS_PATH.test(args[j] ?? "")) {
      const basis = pre.at(-1);
      for (const x of bukanOpsi(args.slice(j + 1))) out.push({ path: basis ? path.join(basis, x) : x, leluhur: true });
    }
  }
  return out.filter((t) => t.path);
}

/** Analisis lengkap satu perintah Bash. */
function analisisBash(input, K) {
  const cmd = String(input.tool_input?.command ?? "");
  const u = urai(cmd);
  // cwd berjalan: `cd <path harfiah>` diikuti; cd lain (variabel, -, pushd/popd) → tidak diketahui (null)
  const ctx = { cwd: input.cwd ? rumah(input.cwd) : HOME };
  ctx.awal = ctx.cwd;
  // Folder yang MUNGKIN aktif (T-20261030-12): cd bisa gagal (`cd x; …`, `cd x || …`) atau berjalan di subshell (`cd x | …`,
  // `cd x &`), jadi folder sebelumnya tidak pernah dibuang; null = tak diketahui.
  ctx.mungkin = ctx.cwd ? [ctx.cwd] : null;
  const hasil = [];
  let sebut = null, ubahSendiri = false;
  // urai memecah badan heredoc menjadi segmen; baris badan heredoc ke program selain shell bukan perintah claude
  const badan = badanHeredoc(cmd);
  for (const s of u.segmen) {
    let h = klasifikasiSegmen(s, K, ctx);
    if (h.claude) { const t = s.teks.trim(), n = badan.indexOf(t); if (t && n >= 0) { badan.splice(n, 1); h = { aman: false }; } }
    hasil.push(h);
    if (h.ubahSendiri) ubahSendiri = true;
    // T-20261030-6 A9: hanya TARGET PENULISAN nyata yang diperiksa (pengalihan keluar, tee, sed/perl -i, cp/mv/rm/…,
    // git checkout/restore/… dengan path). Membaca, menjalankan, menguji, atau sekadar menyebut path → bukan urusan ini.
    for (const t of targetTulis(s, ctx.cwd)) {
      if (sebut) break;
      if (NAMA_TERLINDUNG.some((r) => r.test(t.path))) { sebut = t.path; break; }
      if (ctx.cwd) sebut = sebabTerlindung(path.resolve(ctx.cwd, rumah(t.path)), false, t.leluhur ? "semua" : false);
    }
    const k0 = s.kata[0]?.nilai ?? "";
    if (/^(pushd|popd)$/.test(k0)) ctx.cwd = null;
    else if (k0 === "cd") {
      const arg = s.kata.slice(1).filter((x) => !/^-[LP]$/.test(x.nilai));
      ctx.cwd = arg.length === 0 ? HOME : arg.length === 1 && ctx.cwd && !arg[0].ekspansi && !arg[0].glob && arg[0].nilai !== "-" ? path.resolve(ctx.cwd, rumah(arg[0].nilai)) : null;
      if (!ctx.cwd || !ctx.mungkin) ctx.mungkin = null;
      else if (arg.length === 0) ctx.mungkin.push(HOME);
      // cd logis (`..` teks) dan fisik (cd -P, `..` lewat symlink) dari setiap folder yang mungkin
      else ctx.mungkin = [...new Set([...ctx.mungkin, ...ctx.mungkin.flatMap((c) => [path.resolve(c, rumah(arg[0].nilai)), jalurFisik(c, rumah(arg[0].nilai))])])];
    }
  }
  const aksi = hasil.flatMap((h) => h.aksi ?? []);
  // backend sesi cli: segmen yang menyebut `claude` di posisi perintah dengan aksi sesi/bypass tetapi tidak diurai sebagai
  // perintah claude (bash -c, sudo, xargs, kata kunci shell, $( ) …) → ditanya
  // dihitung atas teks kode seluruh perintah (heredoc ke program lain & isi kutip bukan kode): lebih banyak kemunculan daripada
  // segmen claude yang sudah diurai → ada bentuk yang lolos dari pengurai
  const sesiMentah = (k) => [...k.matchAll(new RegExp(CLAUDE_SESI_MENTAH.source, "g"))].length
    + [...k.matchAll(new RegExp(CLAUDE_BYPASS_MENTAH.source, "gi"))].length;
  if (sesiMentah(teksKode(cmd)) > u.segmen.reduce((n, s, i) => n + (hasil[i].claude ? sesiMentah(teksKode(s.teks)) : 0), 0))
    aksi.push({ kemampuan: "sesi", jenjang: 3, aksi: "perintah claude untuk sesi latar dalam bentuk yang tidak dikenali" });
  const aman = !u.kompleks && !u.ekspansi && hasil.length > 0 && hasil.every((h) => h.aman);
  const terlindung = ubahSendiri ? "pengelola kebijakan/hook (pasang, lepas, …)" : sebut;
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
  const baris = String(out ?? "").split("\n").filter((l) => l.trim() && !/^(mysql: \[Warning\]|ERROR \d+ \(\w+\))/.test(l));
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
/** PostToolUseFailure: perintah yang gagal (exit ≠ 0) tetap bisa sudah mengembalikan data prod ke transkrip (U3 M3). */
const PERISTIWA = ["PreToolUse", "PostToolUse", "PostToolUseFailure"];
function entriHook() {
  return { matcher: MATCHER, hooks: [{ type: "command", command: `"${process.execPath}" "${INI}" hook`, timeout: 30 }] };
}
const milikKita = (e) => (e?.hooks ?? []).some((h) => String(h?.command ?? "").includes(PENANDA));
function bacaSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
export function statusPasang() {
  const s = bacaSettings();
  return ["PreToolUse", "PostToolUse"].every((ev) => (s.hooks?.[ev] ?? []).some(milikKita));
}
/** Terpasang dengan matcher & peristiwa versi ini? (versi lama tidak melihat Write/Edit atau PostToolUseFailure) */
export function matcherMutakhir() {
  const s = bacaSettings();
  return PERISTIWA.every((ev) => (s.hooks?.[ev] ?? []).some(milikKita) && (s.hooks?.[ev] ?? []).filter(milikKita).every((e) => e.matcher === MATCHER));
}
/** `disableAllHooks: true` di settings pengguna mematikan semua hook walau entrinya ada (U3 L2). */
export function hookDimatikan() { return bacaSettings().disableAllHooks === true; }
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
  for (const ev of PERISTIWA) { s.hooks[ev] = (s.hooks[ev] ?? []).filter((e) => !milikKita(e)); s.hooks[ev].push(entriHook()); }
  tulisSettings(s);
  console.log("Terpasang. Claude Code biasanya langsung memakainya, termasuk di sesi yang sedang terbuka; bila belum, mulai ulang sesinya.");
  return 0;
}
async function lepas(opsi) {
  const s = bacaSettings();
  if (!statusPasang() && !PERISTIWA.some((ev) => (s.hooks?.[ev] ?? []).some(milikKita))) { console.log("Tidak terpasang."); return 0; }
  if (!(await konfirmasi(`Hapus hook kebijakan RudisOne dari ${SETTINGS}?`, opsi))) { console.log("Dibatalkan."); return 1; }
  for (const ev of PERISTIWA) {
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
      if (PERISTIWA.includes(input.hook_event_name) && input.session_id && input.tool_name) denyut();
      if (input.hook_event_name === "PreToolUse") {
        const p = putuskan(input, K);
        if (p.keputusan) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: p.keputusan, permissionDecisionReason: p.alasan } }));
      } else if (input.hook_event_name === "PostToolUse" || input.hook_event_name === "PostToolUseFailure") catatSesudah(input, K);
    } catch { /* gagal terbuka: alur izin biasa berlaku */ }
    return 0;
  }
  if (perintah === "pasang") return pasang(opsi);
  if (perintah === "lepas") return lepas(opsi);
  if (perintah === "cek") {
    let ok = statusPasang();
    console.log(ok ? `Kebijakan RudisOne terpasang di ${SETTINGS}.` : `Belum terpasang — pemilik menjalankan: ${ROOT}/bin/kebijakan.sh pasang`);
    if (ok && !matcherMutakhir()) { ok = false; console.log(`Hook terpasang versi lama (matcher/peristiwa tidak lengkap: Write/Edit, PostToolUseFailure) — pemilik menjalankan: ${ROOT}/bin/kebijakan.sh pasang`); }
    if (ok && hookDimatikan()) { ok = false; console.log(`Semua hook dimatikan (disableAllHooks: true di ${SETTINGS}) — kebijakan tidak berjalan.`); }
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
