// Pemeriksa konsistensi RudisOne — READ-ONLY. Menangkap drift antara dokumen, berkas yang dirujuk, dan yang terpasang.
//   node bin/cek-konsistensi.mjs [--repo] [--json] [--ref <ref-lama>] · --serah <branch>  (cek sebelum merge branch itu)
//   --repo  hanya cek isi repo (deterministik; dipakai tes/CI). Tanpa --repo: juga cek device (skill & subagent
//           terpasang, hook + kesehatannya, TEAM.md vs sesi hidup, register, kebersihan catatan/).
//   --proyek <folder> [--serah <branch>] [--json]  kartu proyek vs deteksi mesin (templat/kartu-proyek.md); dengan
//           --serah: spec yang mungkin basi karena kode yang dirujuknya berubah di branch itu.
// Exit: 0 bersih · 1 hanya peringatan · 2 ada galat (--serah tanpa --proyek: 0 · 2).
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bangun as bangunPeran, daftarPeran } from "./peran.mjs";
import { deteksiProyek } from "./perkakas.mjs";
import { agentsCli, backendSesi, folderDesktop, normalAgents } from "./sesi.mjs";

const HOME = os.homedir();
const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const RUMAH = "~/Documents/Neuron/ai-agent/RudisOne";
const SKILLS_USER = process.env.RUDISONE_SKILLS_USER || path.join(HOME, ".claude", "skills");
const AGENTS_USER = process.env.RUDISONE_AGENTS_USER || path.join(HOME, ".claude", "agents");
const DESKTOP = folderDesktop();
export const BATAS_INTI = 200;
/** Batas isi skill yang dipertahankan setelah kompaksi (≈5.000 token; perkiraan 1 token ≈ 4 byte). */
const BATAS_SKILL_BYTE = 20_000;
/** Berkas per device / di luar repo: tidak wajib ada di repo. */
const PER_DEVICE = /^(handoff\/|catatan\/|TEAM\.md$|konfigurasi\/(server\.json|infra\.md|sesi\.json)$|register-tugas\.(json|md)$|(?:^|.*\/)\.claude\/settings\.local\.json$)/;
/** Nama `rudis-…` yang sah selain skill & subagent: perkakas resmi (perkakas.json) dan nama sesi singkat (≤ 24 karakter). */
const NAMA_SESI_SINGKAT = ["rudis-head-of-it-ops", "rudis-sysadmin", "rudis-fin-controller", "rudis-hr-bp",
  // keluaran `bin/perkakas.sh proyek` (jenis proyek), bukan skill
  "rudis-pustaka", "rudis-deploy"];

const temuan = [];
const catat = (tingkat, kode, pesan) => temuan.push({ tingkat, kode, pesan });

function berkasMd(root) {
  const hasil = [];
  const jalan = (d) => {
    for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
      const rel = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!/^(\.git|node_modules|handoff|catatan|agen|\.claude|docs)$/.test(e.name)) jalan(rel); }
      else if (e.name.endsWith(".md")) hasil.push(rel);
    }
  };
  jalan("");
  return hasil.sort();
}
const baca = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const normal = (s) => String(s).toLowerCase().replace(/[`*"“”]/g, "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();

/** Judul (#…) sebuah berkas Markdown, dinormalkan. */
function judul(teks) {
  const tanpaKode = String(teks).replace(/^\s*```[\s\S]*?^\s*```/gm, "");   // "# …" di dalam pagar kode bukan judul
  return [...tanpaKode.matchAll(/^#{1,6}\s+(.+)$/gm)].flatMap((m) => { const h = normal(m[1].replace(/\s*\(.*$/, "")); return [h, h.split(" — ")[0]]; });
}

/** Target rujukan "X.md › Bagian" / "skill `nama` › Bagian" → path relatif berkas sasaran (atau null). */
function sasaranRujukan(nama, root) {
  if (nama.startsWith("skill:")) { const s = nama.slice(6); return fs.existsSync(path.join(root, "skills", s, "SKILL.md")) ? `skills/${s}/SKILL.md` : null; }
  const rel = nama.replace(/^~\/Documents\/Neuron\/ai-agent\/RudisOne\//, "");
  for (const c of [rel, `agents/${path.basename(rel)}`]) if (fs.existsSync(path.join(root, c))) return c;
  return null;
}

/** Nama berkas .md di akar repo pada ref lama (default: main sebelum migrasi) — untuk menangkap rujukan ke berkas yang dipindah. */
function berkasAkarLama(root, ref) {
  try {
    const out = execFileSync("git", ["ls-tree", "--name-only", ref || "3b1c888"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return new Set(out.split("\n").filter((f) => /^[\w-]+\.md$/.test(f) && !/^(TEAM|README|CLAUDE)\.md$/.test(f)));
  } catch {
    if (fs.existsSync(path.join(root, ".git"))) catat("peringatan", "path", `ref ${ref || "3b1c888"} tidak terbaca (clone dangkal?) — rujukan ke berkas akar yang dipindah tidak diperiksa`);
    return new Set();
  }
}

export function cekRepo(root = ROOT, opsi = {}) {
  const ref = opsi.refLama ?? null;
  // R1 — inti
  const inti = baca(root, "protokol.md");
  const nBaris = inti.split("\n").length - (inti.endsWith("\n") ? 1 : 0);
  if (nBaris > BATAS_INTI) catat("galat", "inti-ukuran", `protokol.md ${nBaris} baris > ${BATAS_INTI}`);
  if (/^Kamu adalah \*\*/m.test(inti)) catat("peringatan", "persona", "protokol.md memuat kalimat persona");

  // R2 — skill: frontmatter, nama = folder, ukuran
  const skills = fs.existsSync(path.join(root, "skills")) ? fs.readdirSync(path.join(root, "skills")).filter((d) => fs.existsSync(path.join(root, "skills", d, "SKILL.md"))) : [];
  for (const s of skills) {
    const t = baca(root, `skills/${s}/SKILL.md`);
    const nama = t.match(/^---\n[\s\S]*?^name:\s*(\S+)/m)?.[1];
    if (nama !== s) catat("galat", "skill-nama", `skills/${s}/SKILL.md: name "${nama ?? "?"}" ≠ folder`);
    if (!/^description:\s*\S/m.test(t)) catat("galat", "skill-deskripsi", `skills/${s}/SKILL.md tanpa description`);
    if (Buffer.byteLength(t) > BATAS_SKILL_BYTE) catat("peringatan", "skill-ukuran", `skills/${s}/SKILL.md ${Buffer.byteLength(t)} byte (> ±5.000 token; dipotong setelah kompaksi — taruh yang penting di atas)`);
  }

  // R3 — subagent terbangkit
  // R3 — CLAUDE.md (pemuat inti) & subagent terbangkit
  for (const r of bangunPeran(root, false)) if (r.status !== "sama") catat("galat", r.id === "CLAUDE.md" ? "inti-muat" : "subagent", `${r.berkas} ${r.status} — jalankan bin/peran.sh bangun`);

  // R4–R6 — rujukan di semua Markdown
  let perkakas = [];
  try { perkakas = JSON.parse(baca(root, "perkakas.json")).perkakas.map((p) => p.id); } catch { /* opsional */ }
  const peranId = [...daftarPeran(root), "coo"];
  const namaSah = new Set([...skills, ...perkakas, ...peranId.map((p) => `rudis-${p}`), ...NAMA_SESI_SINGKAT]);
  const cacheJudul = new Map();
  const akarLama = berkasAkarLama(root, ref);
  for (const rel of berkasMd(root)) {
    const teks = baca(root, rel);
    // R4 nama rudis-… yang dirujuk (dalam backtick)
    for (const m of teks.matchAll(/`(rudis-[a-z0-9][a-z0-9-]*)`/g)) {
      if (!namaSah.has(m[1]) && !/^rudis-<|^rudis-$/.test(m[1])) catat("galat", "skill-rujukan", `${rel}: \`${m[1]}\` tidak dikenal (bukan skill, subagent, perkakas, atau nama sesi)`);
    }
    // R5 path berkas repo yang dirujuk
    for (const m of teks.matchAll(/`((?:~\/Documents\/Neuron\/ai-agent\/RudisOne\/)?(?:agents|bin|skills|templat|kantor|ruang|agen|uji|konfigurasi)\/[^`\s<>*{}|]+|[A-Za-z][\w-]*\.(?:md|json|sh|mjs))`/g)) {
      let p = m[1].replace(/^~\/Documents\/Neuron\/ai-agent\/RudisOne\//, "").replace(/[),.;:]+$/, "");
      if (PER_DEVICE.test(p)) continue;
      if (!p.includes("/")) {
        // nama berkas tanpa folder: diperiksa bila dulu ada di akar repo (mis. sdlc.md yang dipindah ke skill);
        // nama lain dianggap berkas proyek lain (README.md, AGENTS.md, …)
        if (akarLama.has(p) && !fs.existsSync(path.join(root, p))) catat("galat", "path", `${rel}: \`${p}\` sudah tidak ada di akar repo (dipindah?)`);
        continue;
      }
      if (!fs.existsSync(path.join(root, p))) catat("galat", "path", `${rel}: \`${m[1]}\` tidak ada`);
    }
    // R5b nama berkas akar lama tanpa backtick (mis. "sdlc.md ›", "(sdlc.md)")
    for (const nama of akarLama) {
      if (fs.existsSync(path.join(root, nama))) continue;
      if (new RegExp(`(?<![\\w\`/.-])${nama.replace(/\./g, "\\.")}(?![\\w\`])`).test(teks)) catat("galat", "path", `${rel}: menyebut ${nama}, yang sudah tidak ada di akar repo`);
    }
    // R6 rujukan bagian "X.md` › Bagian" dan "skill `nama` › Bagian"
    const pola = /(?:`([\w~/.-]+\.md)`|\b([\w-]+\.md)|skill `(rudis-[a-z-]+)`)\s*›\s*"?([A-Za-z](?:(?!\s+skill\s+`)[^`"(),.;:\n—|])*)/g;
    for (const m of teks.matchAll(pola)) {
      const nama = m[3] ? `skill:${m[3]}` : (m[1] ?? m[2]);
      const target = sasaranRujukan(nama, root);
      if (target && PER_DEVICE.test(target)) continue;   // berkas per device (TEAM.md, …): isinya beda per device, bukan isi repo
      if (!target) { if (!m[3] && /^(protokol|raci|sdlc|coo|tech-lead|infra|penyedia|README)\b/.test(path.basename(nama))) catat("galat", "rujukan", `${rel}: rujukan ke \`${nama}\` — berkas tidak ada`); continue; }
      if (!cacheJudul.has(target)) cacheJudul.set(target, judul(baca(root, target)));
      const r = normal(m[4]).replace(/\s+(langkah|bagian|baris|tabel)\b.*$/, "");
      if (r.length < 4) continue;
      // cocok: judul diawali rujukan, rujukan = judul (≥ 2 kata atau ≥ 7 huruf) + kata tambahan, atau judul memuat rujukan ≥ 6 huruf
      const ok = cacheJudul.get(target).some((h) => h.startsWith(r) || (r.startsWith(`${h} `) && (h.split(" ").length >= 2 || h.length >= 7)) || (r.length >= 6 && h.includes(r)));
      if (!ok) catat("galat", "rujukan", `${rel}: "${nama.replace(/^skill:/, "skill ")} › ${m[4].trim()}" — bagian tidak ada di ${target}`);
    }
  }

  // R8 — berkas per device yang masih dilacak git padahal di-.gitignore (mis. catatan/ sebelum serah migrasi v5):
  // merge berikutnya bisa batal atau menghapusnya dari disk → README › Serah migrasi v5 ke main
  try {
    const out = execFileSync("git", ["ls-files", "-ci", "--exclude-standard"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) {
      const daftar = out.split("\n");
      const folder = [...new Set(daftar.map((f) => f.split("/")[0]))];
      catat("peringatan", "git-abaikan", `${daftar.length} berkas di-.gitignore tetapi masih dilacak git (${folder.join(", ")}) — keluarkan dari indeks dulu: git rm -r --cached ${folder.join(" ")} && git commit (README › Serah migrasi v5 ke main)`);
    }
  } catch { /* bukan repo git */ }

  // R7 — pemetaan aturan lama → lokasi baru (100%)
  cekPemetaan(root, ref);
  return temuan;
}

/** Tabel pemetaan: | Kode | Aturan lama | Lokasi baru | Jangkar | — jangkar harus ada (persis, spasi dinormalkan) di lokasi baru. */
export function cekPemetaan(root = ROOT, ref = null) {
  const f = path.join(root, "docs", "pemetaan-aturan-v5.md");
  if (!fs.existsSync(f)) { catat("galat", "pemetaan", "docs/pemetaan-aturan-v5.md tidak ada"); return; }
  const baris = fs.readFileSync(f, "utf8").split("\n").filter((l) => /^\|\s*[A-Z]+-\d+/.test(l));
  const kode = new Set();
  const isiBerkas = new Map();
  const rata = (s) => s.replace(/\s+/g, " ").trim();
  for (const l of baris) {
    const sel = l.split(/(?<!\\)\|/).slice(1, -1).map((x) => x.trim());
    const [k, , lokasi, jangkar] = sel;
    kode.add(k);
    if (/^dihapus\b|^ditiadakan\b/i.test(lokasi ?? "")) { if (!jangkar) catat("galat", "pemetaan", `${k}: dihapus tanpa alasan`); continue; }
    const target = (lokasi ?? "").match(/[\w./-]+\.md/)?.[0];
    if (!target || !fs.existsSync(path.join(root, target))) { catat("galat", "pemetaan", `${k}: lokasi "${lokasi}" tidak ada`); continue; }
    if (!isiBerkas.has(target)) isiBerkas.set(target, rata(fs.readFileSync(path.join(root, target), "utf8")));
    const j = rata(String(jangkar ?? "").replace(/^`|`$/g, "").replace(/\\\|/g, "|"));
    if (!j || !isiBerkas.get(target).includes(j)) catat("galat", "pemetaan", `${k}: jangkar tidak ditemukan di ${target}: "${j.slice(0, 80)}"`);
  }
  if (ref) {
    let unit = [];
    try { unit = JSON.parse(execFileSync(process.execPath, [path.join(path.dirname(INI), "inventaris-aturan.mjs"), "--ref", ref, "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); }
    catch { catat("peringatan", "pemetaan", `inventaris aturan dari ${ref} tidak bisa dibuat (git?) — cakupan 100% tidak diperiksa`); return; }
    const hilang = unit.filter((u) => !kode.has(u.kode));
    if (hilang.length) catat("galat", "pemetaan", `${hilang.length} aturan lama tanpa pemetaan: ${hilang.slice(0, 8).map((u) => u.kode).join(", ")}${hilang.length > 8 ? " …" : ""}`);
    // N-nnn = aturan BARU sesudah migrasi (tidak ada di inventaris lama); jangkarnya tetap diperiksa di atas
    const lebih = [...kode].filter((k) => !/^N-/.test(k) && !unit.some((u) => u.kode === k));
    if (lebih.length) catat("peringatan", "pemetaan", `${lebih.length} kode pemetaan tidak ada di inventaris ${ref}: ${lebih.slice(0, 8).join(", ")}`);
  }
}

// ---------- device ----------
function sesiDesktop() {
  const m = new Map();
  // backend cli: sesi dari `claude agents --json --all`, dikenali lewat session id dan nama (`--name`)
  if (backendSesi().backend === "cli") {
    const d = agentsCli();
    if (!d) return null;
    for (const e of normalAgents(d)) { const v = { arsip: e.archived, judul: e.title ?? "" }; m.set(e.cli, v); m.set(e.localId, v); }
    return m;
  }
  let akun = [];
  try { akun = fs.readdirSync(DESKTOP); } catch { return null; }
  for (const a of akun) {
    let orgs = []; try { orgs = fs.readdirSync(path.join(DESKTOP, a)); } catch { continue; }
    for (const o of orgs) {
      let nama = []; try { nama = fs.readdirSync(path.join(DESKTOP, a, o)); } catch { continue; }
      for (const n of nama) {
        if (!/^local_.*\.json$/.test(n)) continue;
        try { const j = JSON.parse(fs.readFileSync(path.join(DESKTOP, a, o, n), "utf8")); m.set(j.sessionId ?? n.slice(0, -5), { arsip: !!j.isArchived, judul: j.title ?? "" }); } catch { /* sedang ditulis */ }
      }
    }
  }
  return m;
}

export function cekDevice(root = ROOT) {
  // D1 skill & subagent terpasang (tautan ke repo ini)
  const tautKe = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
  const rootAsli = tautKe(root) ?? root;
  for (const s of fs.readdirSync(path.join(root, "skills"))) {
    if (!fs.existsSync(path.join(root, "skills", s, "SKILL.md"))) continue;
    const t = tautKe(path.join(SKILLS_USER, s));
    if (!t) catat("peringatan", "skill-terpasang", `skill ${s} belum terpasang di ~/.claude/skills — jalankan install.sh dari checkout utama`);
    else if (!t.startsWith(rootAsli + path.sep)) catat("peringatan", "skill-terpasang", `~/.claude/skills/${s} menunjuk ke luar repo ini (${t})`);
  }
  for (const id of daftarPeran(root)) {
    const t = tautKe(path.join(AGENTS_USER, `rudis-${id}.md`));
    if (!t) catat("peringatan", "subagent-terpasang", `subagent rudis-${id} belum tertaut di ~/.claude/agents — jalankan install.sh`);
    else if (!t.startsWith(rootAsli + path.sep)) catat("peringatan", "subagent-terpasang", `~/.claude/agents/rudis-${id}.md menunjuk ke luar repo ini (${t})`);
  }
  // D2 skill sistem lain (mis. TimAgent) — tidak disentuh, hanya diberitahukan
  try {
    for (const n of fs.readdirSync(SKILLS_USER)) {
      const p = path.join(SKILLS_USER, n);
      if (!fs.lstatSync(p).isSymbolicLink()) continue;
      const t = tautKe(p);
      if (t && !t.startsWith(rootAsli + path.sep)) catat("info", "skill-lain", `~/.claude/skills/${n} milik sistem lain (${t}) — tidak disentuh`);
    }
  } catch { /* folder belum ada */ }
  // D3 hook
  for (const [s, nama] of [["kebijakan", "hook kebijakan akses"], ["inti", "hook pemuat ulang inti"]]) {
    try { execFileSync(process.execPath, [path.join(root, "bin", `${s}.mjs`), "cek"], { stdio: "ignore" }); }
    catch { catat("peringatan", `hook-${s}`, `${nama} belum terpasang — pemilik menjalankan: ${root}/bin/${s}.sh pasang`); }
  }
  // D4 TEAM.md vs sesi hidup
  const team = path.join(root, "TEAM.md");
  if (!fs.existsSync(team)) catat("peringatan", "team", "TEAM.md belum ada (ditulis COO pada /rudisone)");
  else {
    const sesi = sesiDesktop();
    const teks = fs.readFileSync(team, "utf8");
    // Sesi saat dibutuhkan (termasuk IT Operations) boleh terarsip: dipulihkan COO saat ada tugasnya; bagian kosong = belum dibentuk.
    let bagian = "";
    for (const baris of teks.split("\n")) {
      if (/^## /.test(baris)) { bagian = baris; continue; }
      // id sesi Desktop `local_…`, atau (backend cli) session id UUID / nama sesi di kolom Name
      const m = baris.match(/^\|\s*([^|]+?)\s*\|.*?`(local_[0-9a-f-]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`/);
      if (!m) continue;
      const [, peran, id] = m;
      const asal = backendSesi().backend === "cli" ? "claude agents --json --all" : "sesi Desktop";
      if (!sesi) { catat("info", "team", `metadata ${asal} tidak terbaca — TEAM.md tidak dicocokkan`); break; }
      const s = sesi.get(id);
      if (!s) catat("peringatan", "team", `TEAM.md: ${peran} → ${id} tidak ditemukan di ${asal}`);
      else if (s.arsip) {
        const saatPerlu = /^## (IT Operations|Sesi saat dibutuhkan)\b/.test(bagian);
        catat(saatPerlu ? "info" : "peringatan", "team", `TEAM.md: ${peran} → ${id} terarsip${saatPerlu ? " (dipulihkan saat dibutuhkan)" : ""}`);
      }
    }
  }
  // D5 register
  const reg = path.join(root, "handoff", "register-tugas.json");
  if (!fs.existsSync(reg)) catat("peringatan", "register", "handoff/register-tugas.json belum ada — COO menjalankan: bin/register.sh impor");
  else if (fs.existsSync(path.join(root, "bin", "register.mjs"))) {
    try { execFileSync(process.execPath, [path.join(root, "bin", "register.mjs"), "validasi"], { stdio: "ignore" }); }
    catch { catat("galat", "register", "register-tugas.json tidak valid — bin/register.sh validasi"); }
  }
  // D6 kesehatan hook kebijakan (X15) · D7 kebersihan catatan/ (X12)
  cekKesehatanHook(root);
  cekCatatan(root);
  return temuan;
}

const SEHARI_MS = 24 * 60 * 60 * 1000;

/** Hook kebijakan benar-benar bekerja: uji dua kasus pasti, denyut dari hook yang dipanggil Claude Code, rantai audit.
 *  Kemampuan yang belum didukung bin/kebijakan.mjs → info, bukan galat. */
export function cekKesehatanHook(root = ROOT) {
  const skrip = path.join(root, "bin", "kebijakan.mjs");
  if (!fs.existsSync(skrip)) { catat("info", "hook-uji", "bin/kebijakan.mjs tidak ada — kesehatan hook tidak diperiksa"); return temuan; }
  const isi = fs.readFileSync(skrip);
  const sumber = isi.toString("utf8");
  const jalan = (args, env = {}) => spawnSync(process.execPath, [skrip, ...args], { cwd: root, encoding: "utf8", timeout: 20_000, env: { ...process.env, ...env } });

  // Uji keputusan: audit uji ditulis ke folder sementara, bukan ke handoff/audit
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rudisone-cek-hook-"));
  try {
    let sesuai = 0;
    for (const [perintah, harusAllow] of [["gh pr list", true], ["gh pr list && git reset --hard", false]]) {
      const r = jalan(["uji", JSON.stringify({ cwd: root, tool_name: "Bash", tool_input: { command: perintah } })], { RUDISONE_AUDIT: tmp });
      let k;
      try { k = JSON.parse(r.stdout).keputusan; } catch { /* bukan JSON */ }
      if (typeof k !== "string") {
        catat("info", "hook-uji", `kebijakan.mjs uji tidak bisa dipakai (exit ${r.status ?? r.signal ?? r.error?.code}) — keputusan hook tidak diuji`);
        break;
      }
      if ((k === "allow") === harusAllow) { sesuai++; continue; }
      if (harusAllow) catat("peringatan", "hook-uji", `uji \`${perintah}\` (cwd RudisOne) → ${k}, seharusnya allow — hook terlalu ketat atau kebijakan berubah`);
      else catat("galat", "hook-uji", `uji \`${perintah}\` (cwd RudisOne) → allow — perintah majemuk berbahaya lolos dari hook`);
    }
    if (sesuai === 2) catat("info", "hook-uji", "uji hook: 2 kasus pasti sesuai (gh pr list → allow; … && git reset --hard → bukan allow)");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  // Denyut: ditulis hook saat dipanggil Claude Code (≤ 1×/60 dtk)
  if (!sumber.includes(".denyut")) catat("info", "hook-denyut", "kebijakan.mjs versi ini belum menulis denyut — tidak diperiksa");
  else {
    const f = path.join(root, "handoff", "audit", ".denyut.json");
    let d = null;
    try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* tidak ada / rusak */ }
    const waktu = Date.parse(d?.waktu ?? "");
    if (!d) catat("peringatan", "hook-denyut", "handoff/audit/.denyut.json tidak ada atau rusak — hook tidak terlihat berjalan");
    else if (Number.isNaN(waktu)) catat("peringatan", "hook-denyut", "denyut tanpa waktu yang sah — hook tidak terlihat berjalan");
    else if (Date.now() - waktu > SEHARI_MS) catat("peringatan", "hook-denyut", `denyut terakhir ${d.waktu} (> 24 jam) — hook tidak terlihat berjalan`);
    const sidik = crypto.createHash("sha1").update(isi).digest("hex").slice(0, 12);
    if (d && d.versi !== sidik) catat("peringatan", "hook-denyut", `denyut dari versi hook lain (${d.versi ?? "?"} ≠ ${sidik} isi bin/kebijakan.mjs sekarang) — sesi memakai hook lama atau berkas berubah`);
  }

  // Rantai hash audit
  if (!sumber.includes("--verifikasi")) { catat("info", "hook-audit", "kebijakan.mjs versi ini belum mendukung audit --verifikasi — tidak diperiksa"); return temuan; }
  const a = jalan(["audit", "--verifikasi"]);
  const ringkas = (a.stdout || a.stderr || "").trim().split("\n").filter(Boolean).pop() ?? "";
  if (a.status === 0) catat("info", "hook-audit", "rantai hash audit utuh");
  else if (a.status === 1) catat("galat", "hook-audit", `rantai hash audit rusak${ringkas ? ` — ${ringkas}` : ""} (bin/kebijakan.sh audit --verifikasi)`);
  else if (a.status === 3) catat("info", "hook-audit", "audit --verifikasi belum dikenal kebijakan.mjs — tidak diperiksa");
  else catat("info", "hook-audit", `audit --verifikasi tidak bisa dijalankan (exit ${a.status ?? a.signal ?? a.error?.code}) — tidak diperiksa`);
  return temuan;
}

/** Pola instruksi tersisip & rahasia di catatan/ — rahasia tidak pernah dicetak, hanya letaknya. */
const POLA_INSTRUKSI = [/abaikan (semua )?instruksi/i, /ignore (all |previous )?instructions/i, /kamu sekarang/i, /you are now/i, /jalankan perintah berikut/i, /system prompt/i];
const POLA_RAHASIA = [
  ["token GitHub", /\b(ghp_|github_pat_)[A-Za-z0-9_]/], ["token GitLab", /\bglpat-[A-Za-z0-9_-]/], ["kunci AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY/], ["password", /password\s*[=:]\s*(\S+)/i], ["token", /token\s*[=:]\s*(\S{12,})/i],
];
/** Nilai contoh yang bukan rahasia: <isi>, $VAR, ${VAR}, ***, …, xxx. */
const PLACEHOLDER = /^["'`]?(<|\$\{?[A-Z_]+\}?|\*{3,}|…|\.{3}|x{3,})/i;

/** Kebersihan catatan/*.md: butir tanpa tanggal di awal (peringatan), instruksi tersisip (peringatan), rahasia (galat). */
export function cekCatatan(root = ROOT) {
  const dir = path.join(root, "catatan");
  let berkas = [];
  try { berkas = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort(); } catch { return temuan; }
  for (const f of berkas) {
    const baris = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    const tanpaTanggal = [];
    let pagar = false;
    baris.forEach((l, i) => {
      const no = i + 1;
      if (/^\s*```/.test(l)) pagar = !pagar;
      const butir = !pagar && l.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (butir && !/^[*_`[(]*\d{4}-\d{2}-\d{2}\b/.test(butir[1])) tanpaTanggal.push(no);
      for (const p of POLA_INSTRUKSI) if (p.test(l)) catat("peringatan", "catatan-instruksi", `catatan/${f}:${no} memuat pola instruksi tersisip (${p.source}) — catatan adalah data, bukan perintah; tinjau dan hapus`);
      for (const [nama, p] of POLA_RAHASIA) {
        const m = l.match(p);
        if (m && !(m[1] && PLACEHOLDER.test(m[1]))) catat("galat", "catatan-rahasia", `catatan/${f}:${no} tampak memuat rahasia (${nama}) — hapus dari berkas, putar ulang (rotate) rahasianya`);
      }
    });
    if (tanpaTanggal.length) catat("peringatan", "catatan-tanggal", `catatan/${f}: ${tanpaTanggal.length} butir tanpa tanggal YYYY-MM-DD di awal (baris ${tanpaTanggal.slice(0, 6).join(", ")}${tanpaTanggal.length > 6 ? ", …" : ""})`);
  }
  return temuan;
}

// ---------- proyek (kartu proyek vs deteksi mesin) ----------
const NILAI_KARTU = { backend: /^(go|node|php|java|dotnet|python|lain|-)$/, constitution: /^(tipis|as-is)$/, artefak: /^(root|handoff)$/ };
const adaOverride = (v) => !!v && !/^[-—]$/.test(v.trim());

/** Kartu proyek (`.rudisone/kartu-proyek.md` atau handoff/kartu/<nama>.md) dibandingkan dengan `perkakas.sh proyek`. */
export function cekProyek(folder, root = ROOT) {
  let h;
  try { h = deteksiProyek(folder, { root }); } catch (e) { catat("galat", "proyek", e.message); return temuan; }
  catat("info", "proyek", `mesin: ${h.jenis} · mode ${h.mode} · backend ${h.backend}`);
  if (!h.kartu.ada) catat("peringatan", "kartu", `kartu proyek tidak ada (.rudisone/kartu-proyek.md atau handoff/kartu/${path.basename(folder)}.md) — buat dari templat/kartu-proyek.md dan konfirmasi ke pengguna; mode mesin sekarang ${h.mode}`);
  else {
    const d = h.kartu.data, nama = h.kartu.path.startsWith(folder + path.sep) ? path.relative(folder, h.kartu.path) : h.kartu.path;
    if (!/^[AB]$/.test(d.mode ?? "")) catat("galat", "kartu", `${nama}: mode "${d.mode ?? ""}" tidak valid — wajib A atau B (keputusan pengguna)`);
    else if (d.mode !== h.mode && !adaOverride(d.override)) catat("galat", "kartu", `${nama}: mode ${d.mode} ≠ mode mesin sekarang ${h.mode}, tanpa override — tulis alasannya di override atau validasi ulang dengan pengguna`);
    if (!/^(A|B|ragu)$/.test(d.mode_mesin ?? "")) catat("peringatan", "kartu", `${nama}: mode_mesin "${d.mode_mesin ?? ""}" tidak valid (A|B|ragu)`);
    else if (d.mode_mesin !== h.mode) catat("peringatan", "kartu-basi", `${nama}: mode_mesin di kartu ${d.mode_mesin} ≠ mesin sekarang ${h.mode} — kartu basi, minta validasi ulang ke pengguna`);
    for (const [k, pola] of Object.entries(NILAI_KARTU)) if (!pola.test(d[k] ?? "")) catat("peringatan", "kartu", `${nama}: ${k} "${d[k] ?? ""}" tidak valid`);
    if (d.artefak === "root") for (const s of artefakLuarLetak(folder)) catat("peringatan", "artefak", `artefak: root, tetapi ${s}`);
    if (d.artefak === "handoff") for (const a of ["specs", "docs/brd"]) if (fs.existsSync(path.join(folder, a))) catat("peringatan", "artefak", `artefak: handoff, tetapi ${a}/ ada di repo proyek`);
  }
  if (h.perluTrace && !h.traceDiabaikan) catat("peringatan", "trace-reports", "docs/trace-reports/ atau docs/test-reports/ belum di-gitignore (bisa memuat data hasil penelusuran) — tambahkan ke .gitignore proyek");
  return temuan;
}

/** Artefak SDD di luar letak baku: folder specs/ yang bukan <NNN>-<slug>, atau spec/plan/tasks.md di luar specs/. */
function artefakLuarLetak(folder) {
  const hasil = [];
  try {
    for (const e of fs.readdirSync(path.join(folder, "specs"), { withFileTypes: true })) {
      if (e.isDirectory() && !/^\d{3}-[a-z0-9][a-z0-9-]*$/.test(e.name)) hasil.push(`specs/${e.name}/ bukan <NNN>-<slug>`);
    }
  } catch { /* tidak ada specs/ */ }
  const lewati = /^(\.git|\.rudis|node_modules|vendor|dist|build|specs)$/;
  (function jalan(rel, dalam) {
    if (dalam > 4) return;
    let isi = [];
    try { isi = fs.readdirSync(path.join(folder, rel), { withFileTypes: true }); } catch { return; }
    for (const e of isi) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!lewati.test(e.name)) jalan(r, dalam + 1); }
      else if (/^(spec|plan|tasks)\.md$/.test(e.name) && rel) hasil.push(`${r} di luar specs/<NNN>-<slug>/`);
    }
  })("", 0);
  return hasil;
}

/** Drift spec saat serah (G10): spec yang plan.md/tasks.md-nya menyebut path (dalam backtick) yang berubah di
 *  <base>...<branch>, sementara folder spec itu sendiri tidak berubah. <base> = merge-base dengan HEAD. */
export function cekDriftSpec(folder, branch) {
  const g = (...a) => execFileSync("git", a, { cwd: folder, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  let ubah, berkas;
  try {
    const base = g("merge-base", "HEAD", branch);
    ubah = g("diff", "--name-only", `${base}...${branch}`).split("\n").filter(Boolean);
    berkas = g("ls-tree", "-r", "--name-only", branch, "--", "specs").split("\n").filter((f) => /^specs\/[^/]+\/(plan|tasks)\.md$/.test(f));
  } catch { catat("galat", "serah", `branch ${branch} tidak terbaca di ${folder} (atau tanpa merge-base dengan HEAD)`); return temuan; }
  const perSpec = new Map();
  for (const f of berkas) { const s = f.split("/").slice(0, 2).join("/"); perSpec.set(s, [...(perSpec.get(s) ?? []), f]); }
  let basi = 0;
  for (const [spec, daftar] of perSpec) {
    if (ubah.some((f) => f.startsWith(`${spec}/`))) continue;
    const rujukan = new Set();
    for (const f of daftar) {
      for (const m of g("show", `${branch}:${f}`).matchAll(/`([^`\s]+)`/g)) {
        const p = m[1].replace(/^\.\//, "").replace(/(:\d+(-\d+)?)?[),.;:]*$/, "").replace(/\/+$/, "");
        if (/[/.]/.test(p) && !p.startsWith("specs/") && !/^[a-z]+:\/\//.test(p)) rujukan.add(p);
      }
    }
    const kena = [...rujukan].filter((p) => ubah.some((f) => f === p || f.startsWith(`${p}/`) || (p.includes("/") && f.endsWith(`/${p}`))));
    if (kena.length) { basi++; catat("peringatan", "spec-basi", `spec mungkin basi: ${spec}/ — menyebut ${kena.slice(0, 4).map((p) => `\`${p}\``).join(", ")}${kena.length > 4 ? " …" : ""} yang berubah di ${branch}, tetapi spec-nya tidak diubah`); }
  }
  if (!basi) catat("info", "spec-basi", `${perSpec.size} spec diperiksa terhadap ${ubah.length} berkas berubah di ${branch} — tidak ada yang tampak basi`);
  return temuan;
}

/** Sebelum serah: berkas yang masih dilacak di checkout ini tetapi di-.gitignore oleh branch yang akan di-merge.
 *  Merge biasa akan batal (perubahan lokal) atau menghapus berkas itu dari disk. */
export function cekSerah(root, ref) {
  let abaikan;
  try { abaikan = execFileSync("git", ["show", `${ref}:.gitignore`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { catat("galat", "serah", `${ref}:.gitignore tidak terbaca`); return temuan; }
  const tmp = path.join(os.tmpdir(), `rudisone-serah-${process.pid}.gitignore`);
  fs.writeFileSync(tmp, abaikan);
  try {
    const out = execFileSync("git", ["ls-files", "-ci", `--exclude-from=${tmp}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) {
      const folder = [...new Set(out.split("\n").map((f) => f.split("/")[0]))];
      const ubah = execFileSync("git", ["status", "--porcelain", "--", ...folder], { cwd: root, encoding: "utf8" }).trim();
      catat("galat", "serah", `${out.split("\n").length} berkas dilacak di sini tetapi di-.gitignore oleh ${ref} (${folder.join(", ")}${ubah ? `; ${ubah.split("\n").length} berubah lokal` : ""}) — merge langsung akan batal atau menghapusnya dari disk. Dulu: git rm -r -q --cached ${folder.join(" ")} && git commit, baru merge`);
    } else catat("info", "serah", `tidak ada berkas dilacak yang di-.gitignore oleh ${ref} — aman di-merge dari sisi ini`);
  } finally { fs.rmSync(tmp, { force: true }); }
  return temuan;
}

function cetak(json, label = "") {
  if (json) { console.log(JSON.stringify(temuan, null, 2)); return; }
  for (const t of temuan) console.log(`  [${t.tingkat}] ${t.kode}: ${t.pesan}`);
  const n = (x) => temuan.filter((t) => t.tingkat === x).length;
  console.log(`Hasil: ${n("galat")} galat, ${n("peringatan")} peringatan, ${n("info")} info${label}.`);
}
const kodeKeluar = () => (temuan.some((t) => t.tingkat === "galat") ? 2 : temuan.some((t) => t.tingkat === "peringatan") ? 1 : 0);

function utama(argv) {
  const iSerah = argv.indexOf("--serah");
  const iProyek = argv.indexOf("--proyek");
  if (iProyek >= 0) {
    const arg = argv[iProyek + 1];
    if (!arg || arg.startsWith("--")) { console.error("Pemakaian: bin/cek-konsistensi.sh --proyek <folder> [--serah <branch>] [--json]"); return 2; }
    const folder = path.resolve(arg.replace(/^~(?=\/|$)/, HOME));
    cekProyek(folder, ROOT);
    if (iSerah >= 0 && fs.existsSync(folder)) {
      if (!argv[iSerah + 1] || argv[iSerah + 1].startsWith("--")) catat("galat", "serah", "--serah butuh <branch>");
      else cekDriftSpec(folder, argv[iSerah + 1]);
    }
    cetak(argv.includes("--json"), ` (proyek ${folder})`);
    return kodeKeluar();
  }
  if (iSerah >= 0) {
    cekSerah(ROOT, argv[iSerah + 1]);
    for (const x of temuan) console.log(`  [${x.tingkat}] ${x.kode}: ${x.pesan}`);
    return temuan.some((x) => x.tingkat === "galat") ? 2 : 0;
  }
  const repoSaja = argv.includes("--repo");
  const iRef = argv.indexOf("--ref");
  cekRepo(ROOT, { refLama: iRef >= 0 ? argv[iRef + 1] : null });
  if (!repoSaja) cekDevice(ROOT);
  cetak(argv.includes("--json"), repoSaja ? " (hanya repo)" : "");
  return kodeKeluar();
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = utama(process.argv.slice(2));
