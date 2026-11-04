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
import { diDalamPath } from "../bin/lib/lokasi.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
// Override lewat env hanya untuk pengujian (lihat uji.test.mjs).
const ROOT = process.env.RUDISONE_ROOT || path.resolve(HERE, "..");
const PROJECTS = process.env.RUDISONE_KANTOR_PROJECTS || path.join(HOME, ".claude", "projects");
const TEAM_MD = process.env.RUDISONE_KANTOR_TEAM_MD || path.join(ROOT, "TEAM.md");
const REGISTER = process.env.RUDISONE_KANTOR_REGISTER || path.join(ROOT, "handoff", "register-tugas.md");
/** Sumber kebenaran register (bin/register.sh); bila belum ada, Kantor membaca register-tugas.md lama. */
const REGISTER_JSON = process.env.RUDISONE_KANTOR_REGISTER_JSON || path.join(ROOT, "handoff", "register-tugas.json");
/** Argumen `--<nama>=<nilai>` dari baris perintah server. bin/kantor.mjs di Windows menyalakan server lewat WMI (di luar
 *  job object proses Claude), yang tidak mewariskan env — port dan berkas log karena itu juga lewat argumen. */
const argumen = (nama) => process.argv.slice(2).find((a) => a.startsWith(`--${nama}=`))?.slice(nama.length + 3) || null;
const PORT = Number(argumen("kantor-port") || process.env.RUDISONE_KANTOR_PORT || 7421);
/** Server MCP DNS dari konfigurasi per device (bila ada) — aktivitasnya tampil sebagai "Mengurus domain". */
const MCP_DNS = bacaKonfig()?.dns?.mcp_server ?? null;
// Sidik kode server: bin/kantor.sh membandingkannya dengan file di disk dan memulai ulang server lama.
export const VERSI = crypto.createHash("sha1").update(fs.readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12);

/** Berkas statis halaman: kode 3D (`/app/`) dan pustaka/huruf yang disalin (`/vendor/`) — Kantor tidak memuat apa pun
 *  dari internet. Hanya ekstensi yang dikenal; path di luar folder (`..`, absolut, encoded) → null. */
const STATIS = { "/app/": path.join(HERE, "app"), "/vendor/": path.join(HERE, "vendor") };
const JENIS_STATIS = { ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".woff2": "font/woff2" };
export const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
  + "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";
export function berkasStatis(pathname, statis = STATIS) {
  const awal = Object.keys(statis).find((a) => String(pathname).startsWith(a));
  if (!awal) return null;
  let rel; try { rel = decodeURIComponent(pathname.slice(awal.length)); } catch { return null; }
  if (!rel || rel.includes("\0") || rel.includes("\\") || rel.split("/").some((s) => s === "" || s === "." || s === "..")) return null;
  const jenis = JENIS_STATIS[path.extname(rel).toLowerCase()];
  if (!jenis) return null;
  const dasar = path.resolve(statis[awal]), f = path.resolve(dasar, ...rel.split("/"));
  if (!f.startsWith(dasar + path.sep)) return null;
  return { file: f, jenis };
}

/** Hanya Host lokal yang dilayani — melindungi dari DNS rebinding (situs lain yang mengarahkan namanya ke 127.0.0.1). */
export function hostDiizinkan(host, port = PORT) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(String(host ?? "").toLowerCase());
}

/** Folder di dalam repo RudisOne (sesi COO & divisi tetap)? Path Windows dibandingkan tanpa beda huruf besar/kecil dan
 *  pemisah (transkrip bisa mencatat `d:\…` maupun `D:\…`). */
const diRoot = (cwd) => diDalamPath(cwd, ROOT);
/** Tanda sesi RudisOne di pesan masuk: /rudisone, atau pembuka peran "Kamu adalah … di RudisOne". */
const TANDA_RUDISONE = /<command-name>\/rudisone<\/command-name>|Kamu adalah\s[^\n]{1,80}?\sdi RudisOne\b/;
const TANDA_COO = /<command-name>\/rudisone<\/command-name>/;
/** Worktree tim engineering RudisOne: <repo>/.claude/worktrees/r<n>-<peran>-<proyek>. */
const RE_WORKTREE = /[\\/]\.claude[\\/]worktrees[\\/]r\d+-/;
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
  // worktree tim (juga worktree platform DI DALAM repo RudisOne) → nama repo induknya; folder lain di RudisOne → dari judul
  if (cwd && (!diRoot(cwd) || RE_WORKTREE.test(cwd))) {
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
/** Kursi yang pekerjaan nyatanya (sesi dengan alat / subagent peran) berakhir < 10 menit lalu → "Baru selesai". */
export const BARU_SELESAI_MS = 10 * 60e3;
const MAX_EVENTS = 300; // per sesi; cukup untuk linimasa 60 menit
const TIMELINE_MIN = 60;

// ---------- deskripsi aktivitas ----------
const base = (p) => (typeof p === "string" && p ? path.basename(p) : "");
/** Rincian aktivitas paling banyak 50 karakter (DESAIN.md › Prinsip, privasi). */
const BATAS_DETAIL = 50;
const clip = (s, n = BATAS_DETAIL) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const host = (u) => { try { return new URL(u).hostname; } catch { return ""; } };

/** Perintah terminal lain → kata kerja yang lebih bermakna, dari deskripsi singkat agent lalu awal perintahnya. Hanya
 *  label yang dipilih; perintah itu sendiri tidak pernah dikirim. */
const JENIS_PERINTAH = [
  ["Menjalankan tes", /\b(run|runs|running|jalankan|menjalankan|execute)\b[^.]*\b(tests?|tes|uji|suite)\b|^\s*(tes|uji)\b/i, null],
  ["Memeriksa riwayat kode", /\bgit\s+(log|status|diff|show)\b|\b(riwayat|history|diff|branches)\b/i, /^\s*git\s+(-C\s+\S+\s+)?(log|status|diff|show|rev-parse|ls-files|blame)\b/],
  ["Menyimpan versi kode", /\b(commit|merge|rebase)\b/i, /^\s*git\s+(-C\s+\S+\s+)?(commit|merge|rebase|switch|checkout|branch|worktree|tag|add|cherry-pick)\b/],
  ["Memotret tampilan", /\b(screenshots?|tangkapan|potret|playwright)\b/i, /playwright|screenshot/],
  ["Memasang dependensi", /\b(install|pasang|dependenc|dependensi)/i, /^\s*(npm|pnpm|yarn)\s+(ci|i|install|add)\b|^\s*brew\s+install\b/],
  ["Mengubah berkas", /\b(write|edit|apply|update|replace|rewrite|fix|ubah|ganti|tulis|perbaiki|tambah|add)\b/i, /^\s*(perl\s+-[^\n]*i|sed\s+-i|cp|mv|mkdir|printf\b.*>|cat\s*>)/],
  ["Memeriksa berkas", /\b(read|show|list|check|inspect|find|search|count|view|baca|lihat|cek|periksa|cari|tampilkan)\b/i, /^\s*(cat|head|tail|sed\s+-n|grep|rg|ls|find|wc|diff|stat|tree)\b/],
];
function jenisPerintah(cmd, deskripsi) {
  for (const [label, polaDesk, polaCmd] of JENIS_PERINTAH) if ((deskripsi && polaDesk.test(deskripsi)) || (polaCmd && polaCmd.test(cmd))) return label;
  return "Menjalankan perintah";
}
/** {label, detail, icon, waiting} untuk satu pemanggilan alat. */
export function describeTool(name, input = {}, resolveAgent = () => null) {
  const cmd = String(input.command ?? "");
  switch (name) {
    case "Bash": {
      // hanya deskripsi singkat yang ditulis agent — perintah mentah tidak pernah dikirim ke halaman
      const detail = clip(input.description);
      if (/deploy\.sh/.test(cmd)) return { label: "Men-deploy rilis", detail, icon: "server" };
      if (/\bssh\s/.test(cmd)) return { label: "Bekerja di server", detail, icon: "server" };
      if (/\bgit\s+(push|commit|merge|pull)\b|\bgh\s/.test(cmd)) return { label: "Mengurus Git", detail, icon: "git" };
      if (/vitest|jest|\bgo\s+test|\btsc\b|npm\s+(run\s+)?(test|verify|lint)|eslint|pytest|node\s+--test/.test(cmd))
        return { label: "Menjalankan tes", detail, icon: "tes" };
      return { label: jenisPerintah(cmd, String(input.description ?? "")), detail, icon: "terminal" };
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
      const to = resolveAgent(String(input.to ?? "")) || "rekan";   // alamat sesi mentah tidak ditampilkan
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
      if (name === "SubagentHandback") return { label: "Menyerahkan hasil", detail: "", icon: "pesan" };
      if (name === "mcp__ccd_turn__update_plan") return { label: "Menyusun rencana", detail: "", icon: "rencana" };
      if (name === "mcp__ccd_turn__wrap_up") return { label: "Menyusun laporan", detail: "", icon: "rencana" };
      if (name.startsWith("mcp__ccd_session_mgmt__")) return { label: "Memeriksa sesi tim", detail: "", icon: "rencana" };
      if (name.startsWith("mcp__Claude_Browser__") || name.startsWith("mcp__claude-in-chrome__"))
        return { label: "Memeriksa di browser", detail: "", icon: "web" };
      return { label: "Bekerja", detail: "", icon: "umum" };   // nama alat internal tidak ditampilkan
  }
}

// ---------- metadata sesi: Claude Desktop (backend desktop) atau `claude agents --json` (backend cli) ----------
// Desktop: format internal aplikasi (bukan API resmi), path per OS (bin/sesi.mjs › folderDesktop). cli: antarmuka resmi
// untuk dibaca dari sesi lain. Bila tidak ada/berubah, kantor tetap jalan dari transkrip saja.
const DESKTOP_SESSIONS = folderDesktop();
/** cliSessionId → {localId, archived, title} */
let desktop = new Map();
let desktopReadAt = 0;
/** Hasil `claude agents --json` terakhir (untuk /health): ok null = belum diperiksa. */
let statusCli = { ok: null, n: 0 };
const desktopCache = new Map(); // file → {mtimeMs, entry}
function loadDesktop(now) {
  if (now - desktopReadAt < 10e3) return;
  desktopReadAt = now;
  const sumber = sumberBaca();   // "auto": sesi dari `claude agents` dan metadata Desktop digabung
  const next = new Map();
  if (sumber.includes("cli")) {
    try {
      const daftar = agentsCli({ timeout: 4000 });
      statusCli = { ok: !!daftar, n: daftar?.length ?? 0 };
      for (const e of normalAgents(daftar)) next.set(e.cli, e);
    } catch { statusCli = { ok: false, n: 0 }; /* CLI tidak ada */ }
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
    let proyek = null, kolomName = -1, kolomProyek = -1;
    // CRLF (TEAM.md yang ditulis di Windows) diperlakukan sama dengan LF
    for (const line of fs.readFileSync(TEAM_MD, "utf8").split(/\r?\n/)) {
      // "## Engineering · Tim 2 · toko-b", juga "… · RudisOne (platform)" / "… · toko — menunggu pengguna"
      const kepala = line.match(/^##\s.*Engineering\s*·\s*(?:Tim\s*(\d+)\s*·\s*)?(.+?)\s*$/);
      if (kepala) {
        // nama proyek = nama folder repo: keterangan dalam kurung dan sesudah " — " dibuang
        const nama = kepala[2].replace(/\s+[—–]\s.*$/, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
        proyek = !nama || nama.includes("layanan") ? null : nama;
        // hanya Tim 1–3 yang punya kursi (protokol: nomor tim 1–3); nomor lain diabaikan agar tidak ada kursi hantu
        if (proyek && NOMOR_TIM.includes(Number(kepala[1]))) timProyek.set(proyek, Number(kepala[1]));
        continue;
      }
      if (/^##\s/.test(line)) proyek = null;
      const sel = /^\|/.test(line) ? line.split("|").slice(1, -1).map((x) => x.replace(/[`*]/g, "").trim()) : [];
      if (sel.length && sel.some((x) => x.toLowerCase() === "agent")) {
        kolomName = sel.findIndex((x) => x.toLowerCase() === "name"); kolomProyek = sel.findIndex((x) => x.toLowerCase() === "proyek"); continue;
      }
      const id = line.match(/local_[0-9a-f-]{8,}/)?.[0];
      // kolom Agent (sel pertama) didahulukan; selain itu nama dikenal di mana pun di baris, terpanjang dulu
      const nama = (sel[0] && namaDiAwal(sel[0])) || line.match(RE_NAMA_BARIS)?.[2];
      const nomor = line.match(POLA_NOMOR_ENGINEER)?.[0] ?? "";
      if (!id || !nama) continue;
      // baris Tech Lead (buku alamat COO) menetapkan nomor timnya: "(Tim n)" di kolom Agent atau nama sesi `r<n>-lead-…`;
      // proyek dari kolom Proyek atau judul bagian. Lebih kuat dari tebakan dari sesi (yang bergantung urutan & jendela 48 jam).
      // hanya baris tabel (bukan komentar riwayat `<!-- … -->` yang juga memuat local_… dan nama peran)
      if (sel.length && kanonik(nama) === "Tech Lead") {
        const nTim = Number(sel[0]?.match(/\(Tim\s*(\d)\)/)?.[1] ?? String(sel[kolomName] ?? "").match(/^r(\d)-lead-/)?.[1]);
        const pTim = String(sel[kolomProyek] ?? "").trim() || proyek;
        if (pTim && NOMOR_TIM.includes(nTim)) {
          for (const [p2, n2] of timProyek) if (n2 === nTim && p2 !== pTim) timProyek.delete(p2);   // nomor itu milik proyek ini
          timProyek.set(pTim, nTim);
        }
      }
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

/** ID tugas (`T-YYYYMMDD-n`, sub-tugas `.k`). */
const RE_ID_TUGAS = /\bT-\d{8}-\d+(?:\.\d+)*\b/;
/** Baris pesan baku: `[Tugas dari COO] T-…`, `[Revisi] T-…`, `[Info dari COO] T-…` (protokol › Format pesan). */
const RE_ID_SETELAH_AWALAN = /(?:^|\n)\s*\[[^\]\n]{2,60}\]\s*(T-\d{8}-\d+(?:\.\d+)*)\b/;
/** Teks pesan tanpa tag pembungkus (`<cross-session-message …>` dll.) — ID tugas dicari di awal isi pesannya. */
const textTanpaPembungkus = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").trim();
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
  if (o.cwd) { s.cwd = o.cwd; s.cwdAwal ??= o.cwd; if (RE_WORKTREE.test(o.cwd)) s.cwdWorktree = o.cwd; }
  switch (o.type) {
    case "agent-setting": s.agentSetting = o.agentSetting ?? s.agentSetting; return;
    case "custom-title": s.title = o.customTitle ?? s.title; return;
    // judul otomatis sesi CLI/VS Code (tanpa judul sidebar Desktop): cadangan bila tidak ada judul lain
    case "ai-title": s.aiTitle = o.aiTitle ?? s.aiTitle; return;
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
      // tugas yang sedang dikerjakan sesi ini = ID di awal pesan masuk terakhir (brief, [Revisi], [Info dari COO] …)
      const isi = textTanpaPembungkus(text);
      const idTugas = isi.slice(0, 4000).match(RE_ID_SETELAH_AWALAN)?.[1] ?? isi.split("\n")[0].match(RE_ID_TUGAS)?.[0];
      if (idTugas) s.tugasKini = idTugas;
      if (TANDA_RUDISONE.test(text)) s.rudisone = true;
      // `/rudisone` menjadikan sesi itu COO (di folder mana pun, juga CLI/VS Code tanpa agent-setting)
      if (TANDA_COO.test(text)) s.coo = true;
      const from = text.match(/<cross-session-message[^>]*from="([^"]+)"/)?.[1];
      if (from) s.events.push({ ts, kind: "pesan-masuk", from, tugas: s.tugasKini ?? null });
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
        if (b.name === "Skill" && b.input?.skill === "rudisone") s.rudisone = s.coo = true;
        s.events.push({ ts, kind: "alat", name: b.name, input: b.input ?? {}, tugas: s.tugasKini ?? null });
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
  const baris = teks.split(/\r?\n/);
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
/** Anggaran waktu per fase (menit) — sasaran Jalur Rakit Paralel, bukan batas keras; pemilik angka ini.
 *  Fase dicocokkan dari awal teks kolom Fase register (mis. "Konstruksi B …" → konstruksi). */
export const ANGGARAN_FASE = [
  [/^(inisiasi|penyelarasan|selaras)/i, 5],
  [/^(analisis|rancangan|desain)/i, 11],
  [/^(konstruksi|rakit|pasang)/i, 25],
  [/^(pengujian|gerbang|tinjau)/i, 10],
  [/^(rilis|penerapan|deploy)/i, 15],
];
/** {menit berjalan, anggaran, lewat} untuk fase tugas, atau null bila fase/waktunya tidak diketahui. */
export function kemajuanFase(t, kini = Date.now()) {
  const fase = String(t?.fase ?? "").trim();
  const mulai = Date.parse(t?.fase_sejak ?? "");
  if (!fase || fase === "—" || Number.isNaN(mulai)) return null;
  const menit = Math.max(0, Math.round((kini - mulai) / 60000));
  const anggaran = ANGGARAN_FASE.find(([re]) => re.test(fase))?.[1] ?? null;
  return { menit, anggaran, lewat: anggaran !== null && menit > anggaran };
}
/** Tugas belum selesai dari register-tugas.json (bin/register.mjs), dalam bentuk yang sama dengan bacaRegister. */
export function tugasDariJson(reg) {
  if (!reg || !Array.isArray(reg.tugas)) throw new Error("register JSON tanpa larik tugas");
  const urutan = { segera: 0, tinggi: 1 };
  return reg.tugas
    .filter((t) => t && /^T-\d{8}-\d+/.test(t.id ?? "") && !SELESAI.test(t.status ?? ""))
    .sort((a, b) => ((urutan[a.prioritas] ?? 2) - (urutan[b.prioritas] ?? 2)) || String(a.dibuat ?? "").localeCompare(String(b.dibuat ?? "")))
    .map((t) => ({ id: t.id, tugas: clip(t.judul, 90), folder: bersih(t.folder).replace(/\/+$/, ""), divisi: bersih(t.divisi),
      pemilik: bersih(t.pemilik), prioritas: bersih(t.prioritas), status: bersih(t.status), fase: bersih(t.fase),
      perkakas: bersih(t.perkakas), diperbarui: waktuLokal(t.diperbarui), dibuat: Number.isNaN(Date.parse(t.dibuat ?? "")) ? null : Date.parse(t.dibuat), faseSejak: t.fase_sejak ?? null, kemajuan: kemajuanFase(t) }))
    .slice(0, 30);
}
const tanggalLokal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`; };
/** Tugas berstatus selesai yang ditutup pada hari yang sama (tanggal lokal device) dengan `kini` — untuk berkas di meja
 *  & papan tugas. Hanya metadata: ID, judul, pemilik, waktu tutup (tanpa bukti/isi). */
export function selesaiDariJson(reg, kini = Date.now()) {
  if (!reg || !Array.isArray(reg.tugas)) return [];
  const hari = tanggalLokal(kini);
  return reg.tugas
    .filter((t) => t && /^T-\d{8}-\d+/.test(t.id ?? "") && /^selesai/i.test(t.status ?? ""))
    .map((t) => {
      // selesai_pada (tanggal lokal register) = penentu hari: `diperbarui` ikut berubah setiap `register.sh ubah`, juga
      // pada tugas yang sudah lama ditutup. Jam tutup hanya dari `diperbarui` bila tanggalnya sama.
      const d = Date.parse(t.diperbarui ?? ""), sp = /^\d{4}-\d{2}-\d{2}/.exec(String(t.selesai_pada ?? ""))?.[0];
      const tgl = sp ?? (Number.isNaN(d) ? "" : tanggalLokal(d));
      return { t, ts: !Number.isNaN(d) && tanggalLokal(d) === tgl ? d : null, tgl };
    })
    .filter((x) => x.tgl === hari)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .map(({ t, ts }) => ({ id: t.id, tugas: clip(t.judul, 90), pemilik: bersih(t.pemilik), ts }))
    .slice(0, 20);
}
let tugasCache = { kunci: "", isi: [], reg: null };
/** register-tugas.json bila ada (dan terbaca), selain itu register-tugas.md lama. */
function muatTugas() {
  for (const [file, urai] of [[REGISTER_JSON, (t) => { const reg = JSON.parse(t); return { isi: tugasDariJson(reg), reg }; }],
    [REGISTER, (t) => ({ isi: bacaRegister(t), reg: null })]]) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    const kunci = `${file}|${st.mtimeMs}|${st.size}`;
    if (kunci === tugasCache.kunci) return segarkanKemajuan(tugasCache.isi);
    try { tugasCache = { kunci, ...urai(fs.readFileSync(file, "utf8")) }; return segarkanKemajuan(tugasCache.isi); } catch { /* rusak → sumber berikutnya */ }
  }
  tugasCache = { kunci: "", isi: [], reg: null };
  return tugasCache.isi;
}
/** Tugas yang selesai hari ini (register JSON yang sudah dimuat `muatTugas`; register MD lama → kosong). */
const muatSelesai = (kini) => selesaiDariJson(tugasCache.reg, kini);
/** Menit berjalan dihitung ulang setiap kali dibaca (cache hanya mengikuti berkas register). */
const segarkanKemajuan = (isi) => isi.map((t) => (t.faseSejak ? { ...t, kemajuan: kemajuanFase({ fase: t.fase, fase_sejak: t.faseSejak }) } : t));

// ---------- penurunan status ----------
/** "Kamu adalah Tech Lead di RudisOne…", "Kamu adalah **Software Engineer #2** di RudisOne …" */
const RE_KAMU_ADALAH = new RegExp(`Kamu adalah\\s+\\**\\s*(${POLA_NAMA})(?![\\w-])`);
/** Peran dari nama worktree tim (`…/.claude/worktrees/r<n>-<peran>-…`). Didahulukan atas agentSetting: worktree DI
 *  DALAM repo RudisOne mewarisi `.claude/settings.json` repo ("agent": "coo"), padahal sesinya Tech Lead/engineer. */
const PERAN_WORKTREE = { lead: "Tech Lead", bsa: "Business Systems Analyst", se1: "Software Engineer", se2: "Software Engineer" };
/** Worktree tim di path mana pun (`/` maupun `\` — di Windows transkrip mencatat `C:\…\.claude\worktrees\r2-lead-…`). */
const RE_PERAN_WORKTREE = /[\\/]\.claude[\\/]worktrees[\\/]r(\d+)-(lead|bsa|se1|se2)-/;
/** Nomor tim dari nama worktree (`r<n>-…`), hanya 1–3 (kursi yang ada), selain itu null. */
const nomorWorktree = (cwd) => { const n = Number(String(cwd ?? "").match(RE_PERAN_WORKTREE)?.[1]); return NOMOR_TIM.includes(n) ? n : null; };
/** Folder tempat sesi dibuka (bukan folder terakhir): sesi COO yang `cd` ke worktree tim untuk memeriksa tetap COO. */
const folderSesi = (s) => s.cwdAwal ?? s.cwd ?? "";
function agentOf(s) {
  const wt = String(folderSesi(s)).match(RE_PERAN_WORKTREE)?.[2];
  if (wt) return PERAN_WORKTREE[wt];
  const setting = kanonik(s.agentSetting);   // id teknis, mis. "system-administrator"
  if (setting && AGENTS.includes(setting)) return setting;
  const byTitle = namaDiAwal(s.title ?? "");
  if (byTitle) return kanonik(byTitle);
  const n = kanonik(s.firstPrompt?.match(RE_KAMU_ADALAH)?.[1]);
  if (n && AGENTS.includes(n)) return n;
  // sesi yang menjalankan /rudisone (mis. COO di VS Code/CLI di folder proyek, tanpa agent-setting & judul peran)
  return s.coo ? "COO" : null;
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
/** Proyek subagent tim yang dipanggil COO (mis. Tech Lead sebagai subagent): dari ID tugas di brief-nya → folder tugas di
 *  register; selain itu dari folder kerja worktree yang pernah dipakainya; terakhir folder kerja terakhir. Folder kerja
 *  awal subagent = folder pemanggil (COO di induk proyek, mis. `d:\proyek`), jadi tidak didahulukan. */
function proyekSubagent(s) {
  const id = String(s.firstPrompt ?? "").match(/\bT-\d{8}-\d+(?:\.\d+)*\b/)?.[0];
  // ID persis dulu, lalu induk terdekat (awalan terpanjang): sub-tugas T-x.2 tidak boleh jatuh ke folder induk T-x
  const tugas = id ? muatTugas() : [];
  const t = tugas.find((x) => x.id === id)
    ?? tugas.filter((x) => id.startsWith(`${x.id}.`)).sort((a, b) => b.id.length - a.id.length)[0];
  const folder = t?.folder?.replace(/\s*\(.*\)\s*$/, "").trim().replace(/^~(?=[\\/]|$)/, HOME);
  // tugas platform RudisOne (folder = repo RudisOne sendiri, bukan worktree tim) → proyek "RudisOne"
  const dariFolder = !folder ? null
    : diRoot(folder) && !RE_WORKTREE.test(folder) ? path.basename(ROOT.replaceAll("\\", "/")) : proyekDari("", folder);
  return dariFolder ?? proyekDari("", s.cwdWorktree ?? s.cwd ?? "");
}
function kursiSubagent(peran, induk, s, terisi) {
  if (!PERAN_TIM.includes(peran)) return peran;
  const n = Number(induk.match(/· Tim (\d)$/)?.[1] ?? 0) || nomorWorktree(s.cwdWorktree) || nomorTim(proyekSubagent(s));
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
    const judulPeran = d?.title ?? s.title;   // judul sidebar Desktop / nama sesi cli / judul yang diberi pengguna
    // Sesi CLI/VS Code hanya punya judul otomatis (ai-title); sesi /rudisone tanpa judul apa pun tetap COO. Uji headless
    // (tanpa judul dan bukan /rudisone) tidak tampil.
    const title = judulPeran ?? s.aiTitle ?? (s.coo ? "COO" : null);
    if (!title) continue;
    if (!milikRudisOne(s, d)) continue; // sesi sistem agent lain / sesi pribadi di device yang sama
    const peran = agentOf({ ...s, title: judulPeran });   // judul otomatis tidak dipakai menebak peran
    if (peran) kandidat.push({ s, d, title, peran });
  }
  // proyek tim engineering (dari folder kerja sesi tim) didaftarkan dulu — urut waktu mulai agar nomor tim stabil —
  // supaya judul "Agent · <proyek>" dan tujuan pesan bisa dipetakan ke timnya. Nomor di nama worktree (`r<n>-lead-…`)
  // dipakai bila TEAM.md belum memetakan proyek itu dan nomornya belum dipakai proyek lain.
  for (const k of [...kandidat].sort((a, b) => (a.s.mulai || 0) - (b.s.mulai || 0))) {
    if (!PERAN_TIM.includes(k.peran)) continue;
    const p = proyekDari("", folderSesi(k.s)), n = nomorWorktree(folderSesi(k.s));
    if (p && n && !timProyek.has(p) && ![...timProyek.values()].includes(n)) timProyek.set(p, n);
    if (p) nomorTim(p);
  }
  const dikenal = [];
  for (const { s, d, title, peran } of kandidat) {
    const agent = kursiDari(peran, title, folderSesi(s));
    if (d) localToAgent.set(d.localId, agent);
    dikenal.push({ s, d, title, agent });
  }
  // Lintasan 2: status per agent dan log kejadian.
  /** Linimasa (pemakaian alat per menit, 60 menit) dan log kejadian satu transkrip untuk satu kursi. */
  const catat = (s, agent) => {
    const jalur = timeline.get(agent);
    if (!jalur) return;   // kursi di luar denah (mis. tim > 3) — jangan sampai satu sesi aneh mematikan server
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
        feed.push({ ts: e.ts, agent, label: d.label, detail: d.detail, icon: d.icon, to: d.to ?? null, jenis: d.jenis ?? null, tugas: e.tugas ?? null });
      } else if (e.kind === "pesan-masuk") {
        const from = resolveAgent(e.from) ?? "agent lain";
        feed.push({ ts: e.ts, agent, label: `Menerima pesan dari ${from}`, detail: "", icon: "pesan", from, tugas: e.tugas ?? null });
      }
    }
  };
  /** kursi → waktu pekerjaan nyata terakhir berakhir (hanya bila < BARU_SELESAI_MS). */
  const selesaiKursi = new Map();
  const tandaiSelesai = (kursi, ts) => {
    if (ts && now - ts < BARU_SELESAI_MS && ts > (selesaiKursi.get(kursi) ?? 0)) selesaiKursi.set(kursi, ts);
  };
  for (const { s, d, title, agent } of dikenal) {
    if (d?.archived || now - s.lastTs > IN_OFFICE_MS) continue; // diarsipkan / sudah lama
    let st = sessionStatus(s, now);
    // giliran kerja yang memakai alat lalu berhenti (bukan sekadar menerima pesan) → baru selesai pada langkah terakhirnya
    if (st.status === "santai") {
      const alat = s.events.findLast((e) => e.kind === "alat");
      if (alat && s.lastTs - alat.ts < 15 * 60e3) tandaiSelesai(agent, s.lastTs);
    }
    if (d?.awaiting && st.status !== "menunggu") // sesi berhenti menunggu keputusan pengguna (mis. izin)
      st = { status: "menunggu", label: "Menunggu keputusan Anda", detail: d.perintah ?? "", icon: "tunggu", since: s.lastTs };
    byAgent.get(agent)?.push({ title, cwd: s.cwd?.replace(HOME, "~") ?? "", lastTs: s.lastTs, ...st });
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
      // kursi saat berjalan diingat: setelah selesai, "baru selesai" & log tetap di kursi yang sama (mis. SE #2 bila #1 terisi)
      const kursi = berjalan ? (s.kursiTerakhir = kursiSubagent(peran, induk, s, byAgent)) : s.kursiTerakhir ?? kursiSubagent(peran, induk, s, null);
      catat(s, kursi);                       // linimasa & log tetap tercatat setelah subagent selesai
      if (!berjalan) { if (selesai) tandaiSelesai(kursi, s.lastTs); continue; }   // selesai → kursi kembali ke katalog
      let st = sessionStatus(s, now);
      if (st.status === "santai") st = { status: "berpikir", label: "Berpikir", detail: "", icon: "pikir", since: s.lastTs };  // subagent berjalan = bekerja
      byAgent.get(kursi)?.push({ title: deskripsi || "Tugas tanpa judul", cwd: s.cwd?.replace(HOME, "~") ?? "", lastTs: s.lastTs, ...st,
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
    const selesaiTs = selesaiKursi.has(name) ? { ts: selesaiKursi.get(name) } : null;
    if (!top) {
      return kursiTetap
        ? { name, present: false, status: "absen", mode: "absen", tetap: true, label: "Belum masuk", detail: "", icon: "absen",
            since: 0, lastTs: 0, subagent: null, selesai: selesaiTs, sessions: [], timeline: timelineAgent }
        : { name, present: false, status: "absen", mode: "katalog", tetap: false, label: "Dipanggil saat perlu", detail: "", icon: "absen",
            since: 0, lastTs: 0, subagent: null, selesai: selesaiTs, sessions: [], timeline: timelineAgent };
    }
    const mode = sessions.some((x) => x.subagent || x.status !== "santai") ? "aktif" : "siaga";
    const kerja = top.status !== "santai";
    return { name, present: true, status: top.status, mode, tetap: kursiTetap, label: top.label, detail: top.detail, icon: top.icon,
      since: top.since, lastTs: Math.max(...sessions.map((x) => x.lastTs)), subagent: sessions.find((x) => x.subagent)?.subagent ?? null,
      selesai: !kerja && selesaiKursi.has(name) ? { ts: selesaiKursi.get(name) } : null, sessions, timeline: timelineAgent };
  });
  feed.sort((a, b) => b.ts - a.ts);
  const tim = [...timProyek].map(([proyek, n]) => ({ n, proyek })).sort((a, b) => a.n - b.n);
  asisten.sort((a, b) => a.mulai - b.mulai);
  const tugas = muatTugas();
  return { now, agents, feed: feed.slice(0, 80), tugas, selesaiHariIni: muatSelesai(now), tim, asisten: asisten.slice(0, 30) };
}

// ---------- kesehatan: versi & sumber data ----------
/** Keadaan tiap sumber data untuk /health (bukan isi datanya). */
export function sumberData() {
  const hasil = [];
  const periksa = (nama, fn) => { try { hasil.push({ nama, ...fn() }); } catch (e) { hasil.push({ nama, terbaca: false, ket: e.code || e.message }); } };
  periksa("transkrip", () => {
    const n = fs.readdirSync(PROJECTS).length;
    const aktif = [...files.values()].filter((s) => !s.asisten).length;
    return { terbaca: true, ket: `${n} folder proyek, ${aktif} transkrip ≤48 jam — ${PROJECTS}` };
  });
  periksa("TEAM.md", () => {
    if (!fs.existsSync(TEAM_MD)) return { terbaca: false, ket: `belum ada — ${TEAM_MD}` };
    fs.accessSync(TEAM_MD, fs.constants.R_OK);
    return { terbaca: true, ket: `${teamMap.size} alamat sesi — ${TEAM_MD}` };
  });
  periksa("register", () => {
    const f = [REGISTER_JSON, REGISTER].find((x) => fs.existsSync(x));
    if (!f) return { terbaca: false, ket: "register-tugas.json/.md belum ada" };
    const isi = muatTugas();
    return { terbaca: tugasCache.kunci.startsWith(`${f}|`), ket: `${isi.length} tugas aktif — ${f}` };
  });
  const sumber = sumberBaca();
  if (sumber.includes("desktop")) periksa("sesi Desktop", () => {
    const ada = fs.existsSync(DESKTOP_SESSIONS);
    const n = [...desktop.values()].filter((e) => String(e.localId ?? "").startsWith("local_")).length;
    return ada ? { terbaca: true, ket: `${n} sesi — ${DESKTOP_SESSIONS}` } : { terbaca: false, ket: `tidak ada (Claude Desktop belum dipakai di device ini) — ${DESKTOP_SESSIONS}` };
  });
  if (sumber.includes("cli")) periksa("sesi CLI", () => (statusCli.ok === null ? { terbaca: false, ket: "belum diperiksa" }
    : statusCli.ok ? { terbaca: true, ket: `${statusCli.n} sesi dari \`claude agents --json\`` } : { terbaca: false, ket: "`claude agents --json` gagal / CLI tidak ada" }));
  return hasil;
}
/** Galat terakhir di siklus pembaruan (server tetap hidup; ditampilkan di /health dan dicatat ke log). */
let galatTerakhir = null;
function catatGalat(asal, e) {
  galatTerakhir = { ts: new Date().toISOString(), asal, pesan: String(e?.stack ?? e).split("\n").slice(0, 4).join(" | ") };
  console.error(`[${galatTerakhir.ts}] galat ${asal}: ${galatTerakhir.pesan}`);
}
/** Isi /health: baris pertama tetap `ok <versi>` (dibaca bin/kantor.mjs), lalu satu baris per sumber data. */
export function teksSehat() {
  const sumber = sumberData();
  return [`ok ${VERSI}`, `versi: ${VERSI} · node ${process.version} · ${process.platform} · pid ${process.pid} · hidup sejak ${MULAI}`,
    ...sumber.map((x) => `sumber ${x.nama}: ${x.terbaca ? "terbaca" : "TIDAK terbaca"} (${x.ket})`),
    `galat terakhir: ${galatTerakhir ? `${galatTerakhir.ts} ${galatTerakhir.asal} — ${galatTerakhir.pesan}` : "-"}`].join("\n");
}
const MULAI = new Date().toISOString();

// ---------- HTTP ----------
const clients = new Set();
let lastJson = "";

function tick() {
  let state;
  try { scan(); state = buildState(); } catch (e) { catatGalat("pembaruan", e); return; }
  const { now, ...rest } = state;
  const json = JSON.stringify(rest);
  if (json === lastJson) return;
  lastJson = json;
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) { try { res.write(payload); } catch (e) { clients.delete(res); catatGalat("kirim SSE", e); } }
}

/** `--log=<berkas>`: keluaran server ditambahkan ke berkas itu (dipakai bila server dinyalakan tanpa stdio, mis. WMI). */
function arahkanLog(berkas) {
  if (!berkas) return;
  try {
    const tulis = (t) => fs.appendFileSync(berkas, `${t}\n`);
    console.log = (...a) => tulis(a.join(" "));
    console.error = (...a) => tulis(a.join(" "));
  } catch { /* log tidak bisa ditulis: tetap jalan */ }
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
      // CSP: halaman hanya boleh memuat & menghubungi server ini sendiri (tanpa CDN/internet)
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": CSP });
      fs.createReadStream(path.join(HERE, "index.html")).pipe(res);
    } else if (berkasStatis(url.pathname)) {
      const { file, jenis } = berkasStatis(url.pathname);
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { "content-type": "text/plain" }); res.end("Tidak ditemukan"); return; }
        res.writeHead(200, { "content-type": jenis, "cache-control": "no-cache", "x-content-type-options": "nosniff" });
        fs.createReadStream(file).pipe(res);
      });
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
      if (url.searchParams.has("json")) {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify({ ok: true, versi: VERSI, node: process.version, platform: process.platform, pid: process.pid, mulai: MULAI,
          sumber: sumberData(), galatTerakhir }));
      } else {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
        res.end(teksSehat());
      }
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
    console.log(`[${new Date().toISOString()}] Kantor RudisOne: http://127.0.0.1:${PORT} (versi ${VERSI}, pid ${process.pid})`);
  });
  // Server status yang hanya membaca: galat tak terduga dicatat lalu server tetap melayani — dulu satu galat di siklus
  // pembaruan mematikan Kantor diam-diam (halaman berhenti update, /health tidak menjawab).
  process.on("uncaughtException", (e) => catatGalat("tak tertangkap", e));
  process.on("unhandledRejection", (e) => catatGalat("promise", e));
  try { scan(); } catch (e) { catatGalat("pindai awal", e); }
  setInterval(tick, 1500);
  setInterval(() => { for (const res of clients) { try { res.write(": ping\n\n"); } catch { clients.delete(res); } } }, 20000);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { arahkanLog(argumen("log")); serve(); }
