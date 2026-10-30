// Pemeriksa konsistensi RudisOne — READ-ONLY. Menangkap drift antara dokumen, berkas yang dirujuk, dan yang terpasang.
//   node bin/cek-konsistensi.mjs [--repo] [--json]
//   --repo  hanya cek isi repo (deterministik; dipakai tes/CI). Tanpa --repo: juga cek device (skill & subagent
//           terpasang, hook, TEAM.md vs sesi hidup, register).
// Exit: 0 bersih · 1 hanya peringatan · 2 ada galat.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bangun as bangunPeran, daftarPeran } from "./peran.mjs";

const HOME = os.homedir();
const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const RUMAH = "~/Documents/Neuron/ai-agent/RudisOne";
const SKILLS_USER = process.env.RUDISONE_SKILLS_USER || path.join(HOME, ".claude", "skills");
const AGENTS_USER = process.env.RUDISONE_AGENTS_USER || path.join(HOME, ".claude", "agents");
const DESKTOP = process.env.RUDISONE_KANTOR_DESKTOP || path.join(HOME, "Library", "Application Support", "Claude", "claude-code-sessions");
export const BATAS_INTI = 200;
/** Batas isi skill yang dipertahankan setelah kompaksi (≈5.000 token; perkiraan 1 token ≈ 4 byte). */
const BATAS_SKILL_BYTE = 20_000;
/** Berkas per device / di luar repo: tidak wajib ada di repo. */
const PER_DEVICE = /^(handoff\/|catatan\/|TEAM\.md$|konfigurasi\/(server\.json|infra\.md)$|register-tugas\.(json|md)$|(?:^|.*\/)\.claude\/settings\.local\.json$)/;
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
  return [...String(teks).matchAll(/^#{1,6}\s+(.+)$/gm)].flatMap((m) => { const h = normal(m[1].replace(/\s*\(.*$/, "")); return [h, h.split(" — ")[0]]; });
}

/** Target rujukan "X.md › Bagian" / "skill `nama` › Bagian" → path relatif berkas sasaran (atau null). */
function sasaranRujukan(nama, root) {
  if (nama.startsWith("skill:")) { const s = nama.slice(6); return fs.existsSync(path.join(root, "skills", s, "SKILL.md")) ? `skills/${s}/SKILL.md` : null; }
  const rel = nama.replace(/^~\/Documents\/Neuron\/ai-agent\/RudisOne\//, "");
  for (const c of [rel, `agents/${path.basename(rel)}`]) if (fs.existsSync(path.join(root, c))) return c;
  return null;
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
  for (const rel of berkasMd(root)) {
    const teks = baca(root, rel);
    // R4 nama rudis-… yang dirujuk (dalam backtick)
    for (const m of teks.matchAll(/`(rudis-[a-z0-9][a-z0-9-]*)`/g)) {
      if (!namaSah.has(m[1]) && !/^rudis-<|^rudis-$/.test(m[1])) catat("galat", "skill-rujukan", `${rel}: \`${m[1]}\` tidak dikenal (bukan skill, subagent, perkakas, atau nama sesi)`);
    }
    // R5 path berkas repo yang dirujuk
    for (const m of teks.matchAll(/`((?:~\/Documents\/Neuron\/ai-agent\/RudisOne\/)?(?:agents|bin|skills|templat|kantor|ruang|agen|uji|konfigurasi)\/[^`\s<>*{}|]+|[A-Za-z][\w-]*\.(?:md|json|sh|mjs))`/g)) {
      let p = m[1].replace(/^~\/Documents\/Neuron\/ai-agent\/RudisOne\//, "").replace(/[),.;:]+$/, "");
      if (PER_DEVICE.test(p) || /\.(md|json|sh|mjs)$/.test(p) === false && !p.endsWith("/")) { if (!fs.existsSync(path.join(root, p)) && !PER_DEVICE.test(p) && p.includes("/")) catat("peringatan", "path", `${rel}: \`${m[1]}\` tidak ada`); continue; }
      if (!p.includes("/")) {
        // nama berkas tanpa folder: cukup ada di akar atau di folder yang lazim
        if (!["", "agents", "templat", "bin"].some((d) => fs.existsSync(path.join(root, d, p)))) continue;   // berkas proyek lain (README.md, AGENTS.md, …)
        continue;
      }
      if (!fs.existsSync(path.join(root, p))) catat("galat", "path", `${rel}: \`${m[1]}\` tidak ada`);
    }
    // R6 rujukan bagian "X.md` › Bagian" dan "skill `nama` › Bagian"
    const pola = /(?:`([\w~/.-]+\.md)`|\b([\w-]+\.md)|skill `(rudis-[a-z-]+)`)\s*›\s*"?([A-Za-z][^`"(),.;:\n—|]*)/g;
    for (const m of teks.matchAll(pola)) {
      const nama = m[3] ? `skill:${m[3]}` : (m[1] ?? m[2]);
      const target = sasaranRujukan(nama, root);
      if (!target) { if (!m[3] && /^(protokol|raci|sdlc|coo|tech-lead|infra|penyedia|README)\b/.test(path.basename(nama))) catat("galat", "rujukan", `${rel}: rujukan ke \`${nama}\` — berkas tidak ada`); continue; }
      if (!cacheJudul.has(target)) cacheJudul.set(target, judul(baca(root, target)));
      const r = normal(m[4]).replace(/\s+(langkah|bagian|baris|tabel)\b.*$/, "");
      if (r.length < 4) continue;
      const ok = cacheJudul.get(target).some((h) => h.startsWith(r) || r.startsWith(h) || h.includes(r));
      if (!ok) catat("galat", "rujukan", `${rel}: "${nama.replace(/^skill:/, "skill ")} › ${m[4].trim()}" — bagian tidak ada di ${target}`);
    }
  }

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
    const lebih = [...kode].filter((k) => !unit.some((u) => u.kode === k));
    if (lebih.length) catat("peringatan", "pemetaan", `${lebih.length} kode pemetaan tidak ada di inventaris ${ref}: ${lebih.slice(0, 8).join(", ")}`);
  }
}

// ---------- device ----------
function sesiDesktop() {
  const m = new Map();
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
    for (const m of teks.matchAll(/^\|\s*([^|]+?)\s*\|.*?`(local_[0-9a-f-]{8,})`/gm)) {
      const [, peran, id] = m;
      if (!sesi) { catat("info", "team", "metadata sesi Desktop tidak terbaca — TEAM.md tidak dicocokkan"); break; }
      const s = sesi.get(id);
      if (!s) catat("peringatan", "team", `TEAM.md: ${peran} → ${id} tidak ditemukan di sesi Desktop`);
      else if (s.arsip) catat("peringatan", "team", `TEAM.md: ${peran} → ${id} terarsip`);
    }
  }
  // D5 register
  const reg = path.join(root, "handoff", "register-tugas.json");
  if (!fs.existsSync(reg)) catat("peringatan", "register", "handoff/register-tugas.json belum ada — COO menjalankan: bin/register.sh impor");
  else if (fs.existsSync(path.join(root, "bin", "register.mjs"))) {
    try { execFileSync(process.execPath, [path.join(root, "bin", "register.mjs"), "validasi"], { stdio: "ignore" }); }
    catch { catat("galat", "register", "register-tugas.json tidak valid — bin/register.sh validasi"); }
  }
  return temuan;
}

function utama(argv) {
  const repoSaja = argv.includes("--repo");
  const iRef = argv.indexOf("--ref");
  cekRepo(ROOT, { refLama: iRef >= 0 ? argv[iRef + 1] : null });
  if (!repoSaja) cekDevice(ROOT);
  if (argv.includes("--json")) console.log(JSON.stringify(temuan, null, 2));
  else {
    for (const t of temuan) console.log(`  [${t.tingkat}] ${t.kode}: ${t.pesan}`);
    const n = (x) => temuan.filter((t) => t.tingkat === x).length;
    console.log(`Hasil: ${n("galat")} galat, ${n("peringatan")} peringatan, ${n("info")} info${repoSaja ? " (hanya repo)" : ""}.`);
  }
  return temuan.some((t) => t.tingkat === "galat") ? 2 : temuan.some((t) => t.tingkat === "peringatan") ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = utama(process.argv.slice(2));
