// Kantor RudisOne — server status lokal (Node ≥18, tanpa dependensi).
// Membaca transkrip sesi Claude Code (~/.claude/projects/*/*.jsonl) secara inkremental, mengenali sesi
// milik RudisOne, menurunkan status tiap agent, lalu menyiarkannya ke halaman lewat Server-Sent Events.
// Hanya listen di 127.0.0.1. Yang dikirim ke halaman hanya metadata aktivitas (nama alat, deskripsi
// perintah, nama file/host) — tidak pernah isi file, isi pesan, atau output perintah.
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bacaKonfig } from "../bin/konfig.mjs";
import { agentsCli, folderDesktop, normalAgents, sumberBaca } from "../bin/sesi.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
// Override lewat env hanya untuk pengujian (lihat uji.test.mjs).
const ROOT = process.env.RUDISONE_ROOT || path.resolve(HERE, "..");
const PROJECTS = process.env.RUDISONE_KANTOR_PROJECTS || path.join(HOME, ".claude", "projects");
const TEAM_MD = process.env.RUDISONE_KANTOR_TEAM_MD || path.join(ROOT, "TEAM.md");
const REGISTER = process.env.RUDISONE_KANTOR_REGISTER || path.join(ROOT, "handoff", "register-tugas.md");
/** Sumber kebenaran register (bin/register.sh); bila belum ada, Kantor membaca register-tugas.md lama. */
const REGISTER_JSON = process.env.RUDISONE_KANTOR_REGISTER_JSON || path.join(ROOT, "handoff", "register-tugas.json");
const PORT = Number(process.env.RUDISONE_KANTOR_PORT || 7421);
/** Server MCP DNS dari konfigurasi per device (bila ada) — aktivitasnya tampil sebagai "Mengurus domain". */
const MCP_DNS = bacaKonfig()?.dns?.mcp_server ?? null;
// Sidik kode server: bin/kantor.sh membandingkannya dengan file di disk dan memulai ulang server lama.
export const VERSI = crypto.createHash("sha1").update(fs.readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12);

/** Hanya Host lokal yang dilayani — melindungi dari DNS rebinding (situs lain yang mengarahkan namanya ke 127.0.0.1). */
export function hostDiizinkan(host, port = PORT) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(String(host ?? "").toLowerCase());
}

/** Folder di dalam repo RudisOne (sesi COO & divisi tetap)? */
const diRoot = (cwd) => { const a = path.resolve(cwd), b = path.resolve(ROOT); return a === b || a.startsWith(b + path.sep); };
/** Tanda sesi RudisOne di pesan masuk: /rudisone, atau pembuka peran "Kamu adalah … di RudisOne". */
const TANDA_RUDISONE = /<command-name>\/rudisone<\/command-name>|Kamu adalah\s[^\n]{1,80}?\sdi RudisOne\b/;
/** Worktree tim engineering RudisOne: <repo>/.claude/worktrees/r<n>-<peran>-<proyek>. */
const RE_WORKTREE = /[\\/]\.claude[\\/]worktrees[\\/]r[1-3]-/;
/** Sesi milik RudisOne — sistem agent lain di device yang sama (nama peran sama) tidak ikut ditampilkan. */
function milikRudisOne(s, d) {
  if (d && teamMap.has(d.localId)) return true;
  if (s.cwd && (diRoot(s.cwd) || RE_WORKTREE.test(s.cwd))) return true;
  return s.rudisone;
}

/** Nama peran kanonik (kunci kursi & tampilan) → id teknis (nilai `agent` di settings.json sesi, nama file agent). */
const ID_PERAN = {
  "COO": "coo", "Tech Lead": "tech-lead", "Business Systems Analyst": "business-systems-analyst",
  "Software Engineer": "software-engineer", "Program Manager": "program-manager", "Technical Writer": "technical-writer",
  "Head of Strategy": "head-of-strategy", "Financial Controller": "financial-controller", "Research Analyst": "research-analyst",
  "HR Business Partner": "hr-business-partner", "Head of IT Operations": "head-of-it-operations",
  "System Administrator": "system-administrator",
};
export const AGENTS = Object.keys(ID_PERAN);
/** Id teknis → nama kanonik. Id (huruf kecil, mis. "coo") hanya dicocokkan utuh. */
const ALIAS = Object.fromEntries(Object.entries(ID_PERAN).map(([nama, id]) => [id, nama]));
const kanonik = (n) => (typeof n === "string" && Object.hasOwn(ALIAS, n) ? ALIAS[n] : n);
/** Nama yang dikenali di teks bebas (judul sesi, tujuan pesan, "Kamu adalah …", TEAM.md), terpanjang dulu agar
 *  "Head of IT Operations" tidak terpotong. Id teknis tidak ikut (mis. "coo" terlalu umum). */
const NAMA_TEKS = [...AGENTS].sort((a, b) => b.length - a.length);
const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const POLA_NAMA = NAMA_TEKS.map(escRe).join("|");
/** Nama di awal teks: persis, atau diikuti spasi ("Tech Lead · toko", "Software Engineer #2 · toko"). */
const namaDiAwal = (t) => NAMA_TEKS.find((a) => t === a || t.startsWith(`${a} `)) ?? null;
/** Nama dikenal di mana pun dalam satu baris (dibatasi bukan-huruf/strip). */
const RE_NAMA_BARIS = new RegExp(`(^|[^\\w-])(${POLA_NAMA})(?![\\w-])`);
/** Peran yang bekerja dalam tim engineering per proyek (Tim 1–3). */
const PERAN_TIM = ["Tech Lead", "Business Systems Analyst", "Software Engineer"];
const NOMOR_TIM = [1, 2, 3];
/** Kursi di kantor (organisasi v4): peran tetap + empat kursi per tim engineering. */
export const KURSI = [
  "COO", "Head of Strategy", "Financial Controller", "Research Analyst", "HR Business Partner",
  ...NOMOR_TIM.flatMap((n) => ["Tech Lead", "Business Systems Analyst", "Software Engineer #1", "Software Engineer #2"].map((p) => `${p} · Tim ${n}`)),
  "Program Manager", "Technical Writer", "Head of IT Operations", "System Administrator",
];
/** proyek (nama folder) → nomor tim; dari TEAM.md bila ada, selain itu nomor kosong terkecil saat proyek pertama terlihat. */
const timProyek = new Map();
function nomorTim(proyek) {
  if (!proyek) return 1;
  if (!timProyek.has(proyek)) {
    const dipakai = new Set(timProyek.values());
    timProyek.set(proyek, NOMOR_TIM.find((n) => !dipakai.has(n)) ?? NOMOR_TIM.at(-1));
  }
  return timProyek.get(proyek);
}
/** Nama proyek sebuah sesi: dari folder kerjanya (akar repo, juga dari worktree), atau akhiran judul bila proyeknya dikenal. */
function proyekDari(teks = "", cwd = "") {
  if (cwd && !diRoot(cwd)) {
    const akar = cwd.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0];
    return path.basename(akar.replaceAll("\\", "/"));
  }
  const akhiran = String(teks).split(" · ").slice(1).join(" · ").trim();
  return akhiran && timProyek.has(akhiran) ? akhiran : null;
}
/** Nomor kursi engineer dari teks ("Software Engineer #2"). */
const POLA_NOMOR_ENGINEER = /Software Engineer\s*#(\d)/;
/** Peran + judul sesi / tujuan pesan (+ folder kerja) → kursi. Engineer tanpa nomor duduk di #1. */
function kursiDari(peran, teks = "", cwd = "") {
  if (!PERAN_TIM.includes(peran)) return peran;
  const n = nomorTim(proyekDari(teks, cwd));
  if (peran !== "Software Engineer") return `${peran} · Tim ${n}`;
  const k = Number(String(teks).match(POLA_NOMOR_ENGINEER)?.[1] ?? 1);
  return `Software Engineer #${Math.min(2, Math.max(1, k))} · Tim ${n}`;
}
/** Jenis pesan dari tag di awal pesan saja ("[Tugas dari …]" → tugas). Isi pesan tidak pernah diteruskan. */
const JENIS = [["permintaan staf", "tugas"], ["permintaan layanan", "tugas"], ["hasil tinjauan", "laporan"],
  ["tinjau", "tinjau"], ["antre", "info"], ["diparkir", "info"], ["tugas", "tugas"], ["laporan", "laporan"], ["revisi", "revisi"],
  ["diterima", "diterima"], ["konsultasi", "konsultasi"], ["jawaban", "jawaban"], ["terhambat", "terhambat"],
  ["eskalasi", "eskalasi"], ["info", "info"]];
export function jenisPesan(pesan) {
  const tag = String(pesan ?? "").match(/^\s*\[([^\]]{1,60})\]/)?.[1]?.toLowerCase() ?? "";
  return JENIS.find(([awal]) => tag.startsWith(awal))?.[1] ?? null;
}
const LABEL_JENIS = { tugas: "Tugas", laporan: "Laporan", revisi: "Revisi", diterima: "Diterima", konsultasi: "Konsultasi",
  jawaban: "Jawaban", terhambat: "Terhambat", eskalasi: "Eskalasi", info: "Info", tinjau: "Tinjau" };
const RECENT_FILE_MS = 48 * 3600e3; // file transkrip yang dipindai
const IN_OFFICE_MS = 24 * 3600e3; // sesi dianggap "di kantor"
const TOOL_STALE_MS = 20 * 60e3; // alat yang tak kunjung selesai dianggap terhenti
const THINK_MS = 3 * 60e3; // jeda wajar antara hasil alat dan langkah berikutnya
const MAX_EVENTS = 300; // per sesi; cukup untuk linimasa 60 menit
const TIMELINE_MIN = 60;

// ---------- deskripsi aktivitas ----------
const base = (p) => (typeof p === "string" && p ? path.basename(p) : "");
const clip = (s, n = 70) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const host = (u) => { try { return new URL(u).hostname; } catch { return ""; } };

/** {label, detail, icon, waiting} untuk satu pemanggilan alat. */
export function describeTool(name, input = {}, resolveAgent = () => null) {
  const cmd = String(input.command ?? "");
  switch (name) {
    case "Bash": {
      const detail = clip(input.description || cmd.split("\n")[0]);
      if (/deploy\.sh/.test(cmd)) return { label: "Men-deploy rilis", detail, icon: "server" };
      if (/\bssh\s/.test(cmd)) return { label: "Bekerja di server", detail, icon: "server" };
      if (/\bgit\s+(push|commit|merge|pull)\b|\bgh\s/.test(cmd)) return { label: "Mengurus Git", detail, icon: "git" };
      if (/vitest|jest|\bgo\s+test|\btsc\b|npm\s+(run\s+)?(test|verify|lint)|eslint|pytest/.test(cmd))
        return { label: "Menjalankan tes", detail, icon: "tes" };
      return { label: "Menjalankan perintah", detail, icon: "terminal" };
    }
    case "Read": case "Grep": case "Glob": case "NotebookRead":
      return { label: "Membaca kode", detail: clip(base(input.file_path) || input.pattern || input.path || ""), icon: "baca" };
    case "Edit": case "Write": case "NotebookEdit": case "MultiEdit":
      return { label: "Menulis", detail: clip(base(input.file_path || input.notebook_path)), icon: "kode" };
    case "WebSearch":
      return { label: "Riset di web", detail: clip(input.query), icon: "web" };
    case "WebFetch":
      return { label: "Membaca halaman web", detail: host(input.url), icon: "web" };
    case "SendMessage": {
      const to = resolveAgent(String(input.to ?? "")) || clip(input.to, 30);
      const jenis = jenisPesan(input.message);
      return { label: `Mengirim pesan ke ${to}`, detail: LABEL_JENIS[jenis] ?? "", icon: "pesan", to, jenis };
    }
    case "AskUserQuestion":
      return { label: "Menunggu jawaban Anda", detail: "", icon: "tunggu", waiting: true };
    case "Skill":
      return { label: "Membuka panduan", detail: clip(input.skill), icon: "baca" };
    case "ToolSearch":
      return { label: "Menyiapkan alat", detail: "", icon: "umum" };
    case "Agent": case "Task":
      return { label: "Mendelegasikan subagent", detail: clip(input.description), icon: "pesan" };
    default:
      if (MCP_DNS && name.startsWith(`mcp__${MCP_DNS}__`)) return { label: "Mengurus domain", detail: clip(input.operation || input.query || ""), icon: "domain" };
      if (name === "mcp__ccd_session__start_session") {
        const to = resolveAgent(String(input.title ?? ""));
        return { label: "Memanggil agent", detail: clip(input.title || ""), icon: "pesan", to, jenis: to ? "tugas" : null };
      }
      if (name === "mcp__ccd_turn__update_plan") return { label: "Menyusun rencana", detail: "", icon: "rencana" };
      if (name === "mcp__ccd_turn__wrap_up") return { label: "Menyusun laporan", detail: "", icon: "rencana" };
      if (name.startsWith("mcp__ccd_session_mgmt__")) return { label: "Memeriksa sesi tim", detail: "", icon: "rencana" };
      if (name.startsWith("mcp__Claude_Browser__") || name.startsWith("mcp__claude-in-chrome__"))
        return { label: "Memeriksa di browser", detail: "", icon: "web" };
      return { label: "Bekerja", detail: clip(name.replace(/^mcp__[^_]+__/, ""), 40), icon: "umum" };
  }
}

// ---------- metadata sesi: Claude Desktop (backend desktop) atau `claude agents --json` (backend cli) ----------
// Desktop: format internal aplikasi (bukan API resmi), path per OS (bin/sesi.mjs › folderDesktop). cli: antarmuka resmi
// untuk dibaca dari sesi lain. Bila tidak ada/berubah, kantor tetap jalan dari transkrip saja.
const DESKTOP_SESSIONS = folderDesktop();
/** cliSessionId → {localId, archived, title} */
let desktop = new Map();
let desktopReadAt = 0;
const desktopCache = new Map(); // file → {mtimeMs, entry}
function loadDesktop(now) {
  if (now - desktopReadAt < 10e3) return;
  desktopReadAt = now;
  const sumber = sumberBaca();   // "auto": sesi dari `claude agents` dan metadata Desktop digabung
  const next = new Map();
  if (sumber.includes("cli")) {
    try { for (const e of normalAgents(agentsCli({ timeout: 4000 }))) next.set(e.cli, e); } catch { /* CLI tidak ada */ }
    if (!sumber.includes("desktop")) { desktop = next; return; }
  }
  let accounts = [];
  try { accounts = fs.readdirSync(DESKTOP_SESSIONS); } catch { desktop = next; return; }
  for (const a of accounts) {
    let orgs = [];
    try { orgs = fs.readdirSync(path.join(DESKTOP_SESSIONS, a)); } catch { continue; }
    for (const o of orgs) {
      const dir = path.join(DESKTOP_SESSIONS, a, o);
      let names = [];
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const n of names) {
        if (!/^local_.*\.json$/.test(n)) continue;
        const f = path.join(dir, n);
        try {
          const st = fs.statSync(f);
          let c = desktopCache.get(f);
          if (!c || c.mtimeMs !== st.mtimeMs) {
            const j = JSON.parse(fs.readFileSync(f, "utf8"));
            c = { mtimeMs: st.mtimeMs, entry: j.cliSessionId
              ? { cli: j.cliSessionId, localId: j.sessionId, archived: !!j.isArchived, title: j.title ?? null,
                  awaiting: !!j.interruptedAwaitingPerson } : null };
            desktopCache.set(f, c);
          }
          if (c.entry) next.set(c.entry.cli, c.entry);
        } catch { /* file sedang ditulis */ }
      }
    }
  }
  desktop = next;
}

// ---------- peta id sesi → agent (dari metadata Desktop dan TEAM.md) ----------
let teamMap = new Map();
let teamMtime = 0;
const localToAgent = new Map();
function loadTeam() {
  try {
    const st = fs.statSync(TEAM_MD);
    if (st.mtimeMs === teamMtime) return;
    teamMtime = st.mtimeMs;
    const m = new Map();
    let proyek = null, kolomName = -1;
    for (const line of fs.readFileSync(TEAM_MD, "utf8").split("\n")) {
      // "## Engineering · Tim 2 · toko-b"
      const kepala = line.match(/^##\s.*Engineering\s*·\s*(?:Tim\s*(\d)\s*·\s*)?(.+?)\s*$/);
      if (kepala) {
        proyek = kepala[2].includes("layanan") ? null : kepala[2];
        if (proyek && kepala[1]) timProyek.set(proyek, Number(kepala[1]));
        continue;
      }
      if (/^##\s/.test(line)) proyek = null;
      const sel = /^\|/.test(line) ? line.split("|").slice(1, -1).map((x) => x.replace(/[`*]/g, "").trim()) : [];
      if (sel.length && sel.some((x) => x.toLowerCase() === "agent")) { kolomName = sel.findIndex((x) => x.toLowerCase() === "name"); continue; }
      const id = line.match(/local_[0-9a-f-]{8,}/)?.[0];
      // kolom Agent (sel pertama) didahulukan; selain itu nama dikenal di mana pun di baris, terpanjang dulu
      const nama = (sel[0] && namaDiAwal(sel[0])) || line.match(RE_NAMA_BARIS)?.[2];
      const nomor = line.match(POLA_NOMOR_ENGINEER)?.[0] ?? "";
      if (!id || !nama) continue;
      const kursi = kursiDari(kanonik(nama), `${nomor || nama} · ${proyek ?? ""}`);
      m.set(id, kursi);
      // nilai kolom Name (mis. `rudis-head-of-strategy`, `r1-lead-<proyek>`) juga dipakai sebagai tujuan pesan
      const namaSesi = kolomName >= 0 ? sel[kolomName] : "";
      if (namaSesi && /^[a-z0-9][a-z0-9._-]*$/.test(namaSesi)) m.set(namaSesi, kursi);
    }
    teamMap = m;
  } catch { /* TEAM.md belum ada */ }
}
function resolveAgent(to) {
  if (!to) return null;
  if (localToAgent.has(to)) return localToAgent.get(to);
  if (teamMap.has(to)) return teamMap.get(to);
  if (Object.hasOwn(ALIAS, to)) return kursiDari(ALIAS[to], to);   // id teknis utuh, mis. "head-of-strategy"
  const n = namaDiAwal(to);
  return n ? kursiDari(kanonik(n), to) : null;
}

// ---------- pembacaan transkrip inkremental ----------
/** @type {Map<string, any>} */
const files = new Map();

function newFileState() {
  return { offset: 0, partial: "", agentSetting: null, title: null, firstPrompt: null, cwd: null, rudisone: false,
    lastTs: 0, lastKind: null, pending: new Map(), events: [], sidechain: 0 };
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  return "";
}

function ingestLine(s, line) {
  let o;
  try { o = JSON.parse(line); } catch { return; }
  if (o.isSidechain && !s.asisten) return; // langkah subagent di transkrip induk; transkrip asisten sendiri dibaca terpisah
  const ts = o.timestamp ? Date.parse(o.timestamp) : 0;
  if (ts && !s.mulai) s.mulai = ts;
  if (o.cwd) s.cwd = o.cwd;
  switch (o.type) {
    case "agent-setting": s.agentSetting = o.agentSetting ?? s.agentSetting; return;
    case "custom-title": s.title = o.customTitle ?? s.title; return;
    case "queue-operation":
      if (o.operation === "enqueue" && ts) { s.lastTs = Math.max(s.lastTs, ts); s.lastKind = "tugas"; }
      return;
    case "user": {
      if (ts) s.lastTs = Math.max(s.lastTs, ts);
      const c = o.message?.content;
      if (Array.isArray(c) && c.some((b) => b?.type === "tool_result")) {
        for (const b of c) if (b?.type === "tool_result") s.pending.delete(b.tool_use_id);
        s.lastKind = "pikir";
        return;
      }
      const text = textOf(c);
      if (!text) return;
      if (!s.firstPrompt) s.firstPrompt = text.slice(0, 400);
      if (TANDA_RUDISONE.test(text)) s.rudisone = true;
      const from = text.match(/<cross-session-message[^>]*from="([^"]+)"/)?.[1];
      if (from) s.events.push({ ts, kind: "pesan-masuk", from });
      s.lastKind = "tugas";
      return;
    }
    case "assistant": {
      if (ts) s.lastTs = Math.max(s.lastTs, ts);
      const c = o.message?.content;
      if (!Array.isArray(c)) return;
      let tool = false;
      for (const b of c) {
        if (b?.type !== "tool_use") continue;
        tool = true;
        s.pending.set(b.id, { name: b.name, input: b.input ?? {}, ts });
        if (b.name === "Skill" && b.input?.skill === "rudisone") s.rudisone = true;
        s.events.push({ ts, kind: "alat", name: b.name, input: b.input ?? {} });
      }
      if (!tool && c.some((b) => b?.type === "text")) s.lastKind = "selesai";
      else if (tool) s.lastKind = "alat";
      return;
    }
    default:
  }
}

function readFileIncremental(file, s) {
  const st = fs.statSync(file);
  if (st.size < s.offset) Object.assign(s, newFileState()); // file ditulis ulang
  if (st.size === s.offset) return;
  const fd = fs.openSync(file, "r");
  try {
    const len = st.size - s.offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, s.offset);
    s.offset = st.size;
    const chunk = s.partial + buf.toString("utf8");
    const lines = chunk.split("\n");
    s.partial = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) ingestLine(s, l);
    if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
  } finally {
    fs.closeSync(fd);
  }
}

export function scan() {
  const now = Date.now();
  let dirs = [];
  try { dirs = fs.readdirSync(PROJECTS); } catch { return; }
  for (const d of dirs) {
    const dir = path.join(PROJECTS, d);
    let names;
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith(".jsonl")) continue;
      const file = path.join(dir, n);
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (now - st.mtimeMs > RECENT_FILE_MS) { files.delete(file); continue; }
      let s = files.get(file);
      if (!s) { s = newFileState(); s.cli = n.slice(0, -".jsonl".length); files.set(file, s); }
      try { readFileIncremental(file, s); } catch { /* file sedang ditulis */ }
      scanAsisten(path.join(dir, s.cli), s.cli, now);
    }
  }
}
/** Asisten (subagent) sebuah sesi: <proyek>/<sesi>/subagents/agent-*.jsonl + .meta.json (jenis, deskripsi, selesai). */
function scanAsisten(dirSesi, induk, now) {
  const dir = path.join(dirSesi, "subagents");
  let names;
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (!/^agent-.*\.jsonl$/.test(n)) continue;
    const file = path.join(dir, n);
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (now - st.mtimeMs > IN_OFFICE_MS) { files.delete(file); continue; }
    let s = files.get(file);
    if (!s) { s = newFileState(); s.asisten = { induk, id: n.slice(6, -6), meta: {}, metaMtime: 0 }; files.set(file, s); }
    try {
      const fm = file.replace(/\.jsonl$/, ".meta.json"), mst = fs.statSync(fm);
      if (mst.mtimeMs !== s.asisten.metaMtime) { s.asisten.meta = JSON.parse(fs.readFileSync(fm, "utf8")); s.asisten.metaMtime = mst.mtimeMs; }
    } catch { /* meta belum ada */ }
    try { readFileIncremental(file, s); } catch { /* sedang ditulis */ }
  }
}

// ---------- register tugas (papan "Tugas berjalan") ----------
const KOLOM = { id: ["id"], tugas: ["tugas"], folder: ["folder"], divisi: ["divisi"], pemilik: ["pemilik", "leader/staf"],
  prioritas: ["prioritas"], status: ["status"], fase: ["fase"], perkakas: ["perkakas"], diperbarui: ["diperbarui", "tanggal"] };
const SELESAI = /^(selesai|dibatalkan)/i;
const bersih = (t) => String(t ?? "").replace(/`/g, "").replace(/\*\*/g, "").trim();
/** Baris tugas yang belum selesai dari semua tabel di register tugas (format lama maupun baru). */
export function bacaRegister(teks) {
  const hasil = [];
  const baris = teks.split("\n");
  for (let i = 0; i < baris.length - 1; i++) {
    if (!/^\|/.test(baris[i]) || !/^\|\s*-{3}/.test(baris[i + 1])) continue;
    const kepala = baris[i].split("|").slice(1, -1).map((k) => k.trim().toLowerCase());
    const indeks = Object.fromEntries(Object.entries(KOLOM).map(([k, nama]) => [k, kepala.findIndex((h) => nama.includes(h))]));
    if (indeks.id < 0 || indeks.status < 0) continue;
    for (let j = i + 2; j < baris.length && /^\|/.test(baris[j]); j++) {
      const sel = baris[j].split("|").slice(1, -1).map(bersih);
      const r = Object.fromEntries(Object.entries(indeks).map(([k, x]) => [k, x >= 0 ? sel[x] ?? "" : ""]));
      if (!/^T-\d{8}-\d+/.test(r.id) || SELESAI.test(r.status)) continue;
      hasil.push({ ...r, tugas: clip(r.tugas, 90), folder: r.folder.replace(/\/+$/, "") });
    }
  }
  const urutan = { segera: 0, tinggi: 1 };
  return hasil.sort((a, b) => (urutan[a.prioritas] ?? 2) - (urutan[b.prioritas] ?? 2)).slice(0, 30);
}
const dua = (n) => String(n).padStart(2, "0");
const waktuLokal = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())} ${dua(d.getHours())}:${dua(d.getMinutes())}`; };
/** Tugas belum selesai dari register-tugas.json (bin/register.mjs), dalam bentuk yang sama dengan bacaRegister. */
export function tugasDariJson(reg) {
  if (!reg || !Array.isArray(reg.tugas)) throw new Error("register JSON tanpa larik tugas");
  const urutan = { segera: 0, tinggi: 1 };
  return reg.tugas
    .filter((t) => t && /^T-\d{8}-\d+/.test(t.id ?? "") && !SELESAI.test(t.status ?? ""))
    .sort((a, b) => ((urutan[a.prioritas] ?? 2) - (urutan[b.prioritas] ?? 2)) || String(a.dibuat ?? "").localeCompare(String(b.dibuat ?? "")))
    .map((t) => ({ id: t.id, tugas: clip(t.judul, 90), folder: bersih(t.folder).replace(/\/+$/, ""), divisi: bersih(t.divisi),
      pemilik: bersih(t.pemilik), prioritas: bersih(t.prioritas), status: bersih(t.status), fase: bersih(t.fase),
      perkakas: bersih(t.perkakas), diperbarui: waktuLokal(t.diperbarui) }))
    .slice(0, 30);
}
let tugasCache = { kunci: "", isi: [] };
/** register-tugas.json bila ada (dan terbaca), selain itu register-tugas.md lama. */
function muatTugas() {
  for (const [file, urai] of [[REGISTER_JSON, (t) => tugasDariJson(JSON.parse(t))], [REGISTER, bacaRegister]]) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    const kunci = `${file}|${st.mtimeMs}|${st.size}`;
    if (kunci === tugasCache.kunci) return tugasCache.isi;
    try { tugasCache = { kunci, isi: urai(fs.readFileSync(file, "utf8")) }; return tugasCache.isi; } catch { /* rusak → sumber berikutnya */ }
  }
  tugasCache = { kunci: "", isi: [] };
  return tugasCache.isi;
}

// ---------- penurunan status ----------
/** "Kamu adalah Tech Lead di RudisOne…", "Kamu adalah **Software Engineer #2** di RudisOne …" */
const RE_KAMU_ADALAH = new RegExp(`Kamu adalah\\s+\\**\\s*(${POLA_NAMA})(?![\\w-])`);
/** Peran dari nama worktree tim (`…/.claude/worktrees/r<n>-<peran>-…`). Didahulukan atas agentSetting: worktree DI
 *  DALAM repo RudisOne mewarisi `.claude/settings.json` repo ("agent": "coo"), padahal sesinya Tech Lead/engineer. */
const PERAN_WORKTREE = { lead: "Tech Lead", bsa: "Business Systems Analyst", se1: "Software Engineer", se2: "Software Engineer" };
function agentOf(s) {
  const wt = String(s.cwd ?? "").match(/\/\.claude\/worktrees\/r[1-3]-(lead|bsa|se1|se2)-/)?.[1];
  if (wt) return PERAN_WORKTREE[wt];
  const setting = kanonik(s.agentSetting);   // id teknis, mis. "system-administrator"
  if (setting && AGENTS.includes(setting)) return setting;
  const byTitle = namaDiAwal(s.title ?? "");
  if (byTitle) return kanonik(byTitle);
  const n = kanonik(s.firstPrompt?.match(RE_KAMU_ADALAH)?.[1]);
  return n && AGENTS.includes(n) ? n : null;
}

const RANK = { menunggu: 4, bekerja: 3, berpikir: 2, santai: 1 };

function sessionStatus(s, now) {
  const pend = [...s.pending.values()].filter((p) => now - p.ts < TOOL_STALE_MS).sort((a, b) => b.ts - a.ts);
  if (pend.length) {
    const d = describeTool(pend[0].name, pend[0].input, resolveAgent);
    return { status: d.waiting ? "menunggu" : "bekerja", ...d, since: pend[0].ts };
  }
  if ((s.lastKind === "pikir" || s.lastKind === "tugas") && now - s.lastTs < THINK_MS)
    return { status: "berpikir", label: s.lastKind === "tugas" ? "Menerima tugas" : "Berpikir", detail: "", icon: "pikir", since: s.lastTs };
  return { status: "santai", label: "Santai", detail: "", icon: "santai", since: s.lastTs };
}

/** Tipe agent subagent peran: `rudis-<id-peran>` (boleh berawalan plugin, mis. `rudisone:rudis-software-engineer`). */
const RE_TIPE_PERAN = /^(?:[\w.-]+:)?rudis-([a-z][a-z-]*)$/;
/** Peran RudisOne sebuah subagent: dari `agentType` di <id>.meta.json; bila field itu tidak ada (meta lama/hilang),
 *  dari pembuka prompt "Kamu adalah <Jabatan> …". Tipe lain (general-purpose, Explore, …) → null (asisten biasa). */
function peranSubagent(s) {
  const tipe = s.asisten.meta.agentType;
  if (typeof tipe === "string" && tipe) {
    const id = tipe.match(RE_TIPE_PERAN)?.[1];
    return id && Object.hasOwn(ALIAS, id) ? ALIAS[id] : null;
  }
  const n = kanonik(s.firstPrompt?.match(RE_KAMU_ADALAH)?.[1]);
  return n && AGENTS.includes(n) ? n : null;
}
/** Kursi subagent peran: peran tim memakai tim pemanggilnya (atau proyek folder kerja); engineer memakai nomor di
 *  deskripsi/pembuka ("#2"), selain itu kursi engineer pertama yang masih kosong (`terisi` = byAgent). */
function kursiSubagent(peran, induk, s, terisi) {
  if (!PERAN_TIM.includes(peran)) return peran;
  const n = Number(induk.match(/· Tim (\d)$/)?.[1] ?? 0) || nomorTim(proyekDari("", s.cwd ?? ""));
  if (peran !== "Software Engineer") return `${peran} · Tim ${n}`;
  const k = `${s.asisten.meta.description ?? ""} ${s.firstPrompt ?? ""}`.match(POLA_NOMOR_ENGINEER)?.[1];
  if (k) return `Software Engineer #${Math.min(2, Math.max(1, Number(k)))} · Tim ${n}`;
  const kursi = [1, 2].map((x) => `Software Engineer #${x} · Tim ${n}`);
  return kursi.find((x) => !terisi?.get(x)?.length) ?? kursi[0];
}

export function buildState(now = Date.now()) {
  loadTeam();
  loadDesktop(now);
  const byAgent = new Map(KURSI.map((a) => [a, []]));
  const timeline = new Map(KURSI.map((a) => [a, Array.from({ length: TIMELINE_MIN }, () => ({ n: 0, icon: null }))]));
  const feed = [];
  // Lintasan 1: kenali agent tiap sesi (juga peta id sesi Desktop → agent untuk tujuan pesan).
  localToAgent.clear();
  const kandidat = [];
  for (const s of files.values()) {
    if (s.asisten) continue;
    const d = desktop.get(s.cli);
    const title = d?.title ?? s.title;
    if (!title) continue; // hanya sesi sidebar (punya judul), bukan uji headless
    if (!milikRudisOne(s, d)) continue; // sesi sistem agent lain / sesi pribadi di device yang sama
    const peran = agentOf({ ...s, title });
    if (peran) kandidat.push({ s, d, title, peran });
  }
  // proyek tim engineering (dari folder kerja sesi tim) didaftarkan dulu — urut waktu mulai agar nomor tim stabil —
  // supaya judul "Agent · <proyek>" dan tujuan pesan bisa dipetakan ke timnya
  for (const k of [...kandidat].sort((a, b) => (a.s.mulai || 0) - (b.s.mulai || 0)))
    if (PERAN_TIM.includes(k.peran)) { const p = proyekDari("", k.s.cwd); if (p) nomorTim(p); }
  const dikenal = [];
  for (const { s, d, title, peran } of kandidat) {
    const agent = kursiDari(peran, title, s.cwd);
    if (d) localToAgent.set(d.localId, agent);
    dikenal.push({ s, d, title, agent });
  }
  // Lintasan 2: status per agent dan log kejadian.
  /** Linimasa (pemakaian alat per menit, 60 menit) dan log kejadian satu transkrip untuk satu kursi. */
  const catat = (s, agent) => {
    const jalur = timeline.get(agent);
    for (const e of s.events) {
      if (e.kind !== "alat") continue;
      const menit = Math.floor((now - e.ts) / 60e3);
      if (menit < 0 || menit >= TIMELINE_MIN) continue;
      const kolom = TIMELINE_MIN - 1 - menit;
      jalur[kolom].n++;
      jalur[kolom].icon = describeTool(e.name, e.input, resolveAgent).icon;
    }
    for (const e of s.events) {
      if (now - e.ts > IN_OFFICE_MS) continue;
      if (e.kind === "alat") {
        const d = describeTool(e.name, e.input, resolveAgent);
        if (["ToolSearch"].includes(e.name)) continue;
        feed.push({ ts: e.ts, agent, label: d.label, detail: d.detail, icon: d.icon, to: d.to ?? null, jenis: d.jenis ?? null });
      } else if (e.kind === "pesan-masuk") {
        const from = resolveAgent(e.from) ?? "agent lain";
        feed.push({ ts: e.ts, agent, label: `Menerima pesan dari ${from}`, detail: "", icon: "pesan", from });
      }
    }
  };
  for (const { s, d, title, agent } of dikenal) {
    if (d?.archived || now - s.lastTs > IN_OFFICE_MS) continue; // diarsipkan / sudah lama
    let st = sessionStatus(s, now);
    if (d?.awaiting && st.status !== "menunggu") // sesi berhenti menunggu keputusan pengguna (mis. izin)
      st = { status: "menunggu", label: "Menunggu keputusan Anda", detail: d.perintah ?? "", icon: "tunggu", since: s.lastTs };
    byAgent.get(agent).push({ title, cwd: s.cwd?.replace(HOME, "~") ?? "", lastTs: s.lastTs, ...st });
    catat(s, agent);
  }
  // Lintasan 3: subagent sesi RudisOne. Subagent peran (tipe `rudis-<id-peran>`) duduk dan bekerja di kursi peran itu
  // (penanda "subagent dari <pemanggil>"); subagent lain tampil sebagai asisten di kursi pemanggilnya.
  const cliKeKursi = new Map(dikenal.map(({ s, agent }) => [s.cli, agent]));
  const asisten = [];
  const subagen = [...files.values()].filter((s) => s.asisten).sort((a, b) => (a.mulai ?? a.lastTs) - (b.mulai ?? b.lastTs));
  for (const s of subagen) {
    const induk = cliKeKursi.get(s.asisten.induk);
    if (!induk) continue;
    const selesai = !!s.asisten.meta.finished;
    const deskripsi = clip(s.asisten.meta.description ?? "", 50);
    const peran = peranSubagent(s);
    if (peran) {
      const berjalan = !selesai && now - s.lastTs <= TOOL_STALE_MS;
      const kursi = kursiSubagent(peran, induk, s, berjalan ? byAgent : null);
      catat(s, kursi);                       // linimasa & log tetap tercatat setelah subagent selesai
      if (!berjalan) continue;               // selesai → kursi kembali ke katalog
      let st = sessionStatus(s, now);
      if (st.status === "santai") st = { status: "berpikir", label: "Berpikir", detail: "", icon: "pikir", since: s.lastTs };  // subagent berjalan = bekerja
      byAgent.get(kursi).push({ title: deskripsi || "subagent", cwd: s.cwd?.replace(HOME, "~") ?? "", lastTs: s.lastTs, ...st,
        subagent: { dari: induk, id: s.asisten.id, deskripsi } });
      continue;
    }
    if (selesai ? now - s.lastTs > 90e3 : now - s.lastTs > TOOL_STALE_MS) continue;
    const st = sessionStatus(s, now);
    asisten.push({ id: s.asisten.id, induk, status: selesai ? "selesai" : "aktif", jenis: s.asisten.meta.agentType ?? "",
      deskripsi, label: st.label, icon: st.icon, mulai: s.mulai ?? s.lastTs });
  }
  // Model sesi "inti kecil + subagent": sesi tetap hanya COO dan Tech Lead tim yang punya proyek. IT Operations dibentuk
  // saat dibutuhkan (protokol.md › Model sesi) — tanpa sesi hidup kursinya katalog, bukan "belum masuk".
  const timAktif = new Set(timProyek.values());
  const tetap = (name) => name === "COO"
    || (/^Tech Lead · Tim \d$/.test(name) && timAktif.has(Number(name.slice(-1))));
  const agents = KURSI.map((name) => {
    const sessions = byAgent.get(name).sort((a, b) => (RANK[b.status] - RANK[a.status]) || (b.lastTs - a.lastTs));
    const top = sessions[0];
    const timelineAgent = timeline.get(name);
    const kursiTetap = tetap(name);
    if (!top) {
      return kursiTetap
        ? { name, present: false, status: "absen", mode: "absen", tetap: true, label: "Belum masuk", detail: "", icon: "absen",
            since: 0, lastTs: 0, subagent: null, sessions: [], timeline: timelineAgent }
        : { name, present: false, status: "absen", mode: "katalog", tetap: false, label: "Dipanggil saat perlu", detail: "", icon: "absen",
            since: 0, lastTs: 0, subagent: null, sessions: [], timeline: timelineAgent };
    }
    const mode = sessions.some((x) => x.subagent || x.status !== "santai") ? "aktif" : "siaga";
    return { name, present: true, status: top.status, mode, tetap: kursiTetap, label: top.label, detail: top.detail, icon: top.icon,
      since: top.since, lastTs: Math.max(...sessions.map((x) => x.lastTs)), subagent: sessions.find((x) => x.subagent)?.subagent ?? null,
      sessions, timeline: timelineAgent };
  });
  feed.sort((a, b) => b.ts - a.ts);
  const tim = [...timProyek].map(([proyek, n]) => ({ n, proyek })).sort((a, b) => a.n - b.n);
  asisten.sort((a, b) => a.mulai - b.mulai);
  return { now, agents, feed: feed.slice(0, 80), tugas: muatTugas(), tim, asisten: asisten.slice(0, 30) };
}

// ---------- HTTP ----------
const clients = new Set();
let lastJson = "";

function tick() {
  scan();
  const state = buildState();
  const { now, ...rest } = state;
  const json = JSON.stringify(rest);
  if (json === lastJson) return;
  lastJson = json;
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) res.write(payload);
}

function serve() {
  const server = http.createServer((req, res) => {
    if (!hostDiizinkan(req.headers.host)) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("Host tidak diizinkan");
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      fs.createReadStream(path.join(HERE, "index.html")).pipe(res);
    } else if (url.pathname === "/state") {
      scan();
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(buildState()));
    } else if (url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify(buildState())}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
    } else if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`ok ${VERSI}`);
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Tidak ditemukan");
    }
  });
  server.on("error", (err) => {
    console.error(err.code === "EADDRINUSE" ? `Port ${PORT} sudah dipakai — kantor mungkin sudah berjalan.` : err.message);
    process.exit(1);
  });
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Kantor RudisOne: http://127.0.0.1:${PORT}`);
  });
  scan();
  setInterval(tick, 1500);
  setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 20000);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
