// Skill luar RudisOne (daftar: perkakas.json › skill_luar; aturan: skill rudis-perkakas › Skill luar). Skill yang dipakai
// agent tetapi tidak dibundel di repo ini: dicek keberadaannya di device, dan dipasang dari sumber resminya saat
// pertama dibutuhkan. Dipanggil lewat bin/perkakas.sh [pastikan <skill>|skill].
//   git       clone repo sumber ke `lokal` (disimpan untuk pemasangan berikutnya), lalu jalankan `pasang`
//   plugin    `claude plugin marketplace add <sumber>` + `claude plugin install <plugin>` (lisensi Anthropic:
//             tidak pernah disalin ke repo sendiri — selalu dari marketplace resmi)
//   platform  bawaan aplikasi Claude (mis. konektor Claude Docs); tidak bisa dipasang → pakai `alternatif`
import { jalankan as jalankanProses } from "./lib/platform.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rumah = (p) => p.replace(/^~(?=\/|$)/, os.homedir());
/** Folder konfigurasi Claude Code (~/.claude), bisa dialihkan untuk uji. */
export const folderClaude = () => process.env.RUDISONE_CLAUDE_DIR || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const binClaude = () => process.env.RUDISONE_CLAUDE_BIN || "claude";
const baris1 = (t) => t.split("\n").filter(Boolean).pop() ?? "";

function jalankan(cmd, args, cwd) {
  const r = jalankanProses(cmd, args, { cwd, encoding: "utf8", timeout: 300_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || r.error?.message || "").trim() };
}
const bacaJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

/** Nama skill tanpa awalan plugin, mis. "anthropic-skills:docx" → "docx". */
export const namaPolos = (s) => String(s).split(":").pop();

/** Plugin terpasang: [{ id, installPath }] dari plugins/installed_plugins.json. */
function pluginTerpasang(dir) {
  const isi = bacaJson(path.join(dir, "plugins", "installed_plugins.json"))?.plugins ?? {};
  return Object.entries(isi).flatMap(([id, v]) => (Array.isArray(v) ? v : [v]).map((x) => ({ id, installPath: x?.installPath })));
}

/** Skill yang disediakan plugin `id`: menurut daftar skill_luar, atau (plugin lain) nama plugin itu sendiri.
 *  Cache plugin bisa memuat seluruh repo marketplace, jadi folder skills/<nama> di sana belum tentu milik plugin itu. */
function skillPlugin(id, daftar) {
  const e = daftar.find((x) => x.jenis === "plugin" && x.plugin === id);
  return e ? e.skill : [id.split("@")[0]];
}

/** Di mana skill `nama` tersedia di device ini: { lokasi, skillMd } atau null. */
export function cariSkill(nama, dir = folderClaude(), daftar = []) {
  const n = namaPolos(nama);
  const pribadi = path.join(dir, "skills", n, "SKILL.md");
  if (fs.existsSync(pribadi)) return { lokasi: "pribadi", skillMd: pribadi };
  const synced = path.join(dir, "skills", "synced");
  if (fs.existsSync(synced)) {
    for (const b of fs.readdirSync(synced)) {
      const f = path.join(synced, b, n, "SKILL.md");
      if (fs.existsSync(f)) return { lokasi: `aplikasi Claude (anthropic-skills:${n})`, skillMd: f };
    }
  }
  for (const p of pluginTerpasang(dir)) {
    if (!skillPlugin(p.id, daftar).includes(n)) continue;
    const f = p.installPath && path.join(p.installPath, "skills", n, "SKILL.md");
    if (f && fs.existsSync(f)) return { lokasi: `plugin ${p.id}`, skillMd: f };
  }
  return null;
}

/** Keadaan satu entri skill_luar: { entri, ada: {nama: lokasi|null}, lengkap }. */
export function keadaan(entri, dir = folderClaude(), daftar = [entri]) {
  const ada = Object.fromEntries(entri.skill.map((s) => [s, cariSkill(s, dir, daftar)]));
  return { entri, ada, lengkap: Object.values(ada).every(Boolean) };
}

/** Entri yang memuat skill/ID `target` (boleh berawalan plugin, mis. anthropic-skills:pdf). */
export function cariEntri(daftar, target) {
  const n = namaPolos(target);
  return daftar.find((e) => e.id === target || e.id === n || e.skill.includes(n)) ?? null;
}

function pasangGit(e, catat, dir) {
  const lokal = rumah(e.lokal);
  if (!fs.existsSync(lokal)) {
    const r = jalankan("git", ["clone", "--quiet", e.repo, lokal]);
    if (!r.ok) return catat("!!", `${e.id}: clone ${e.repo} gagal — ${baris1(r.err)}`), false;
    catat("ok", `${e.id}: repo disimpan di ${e.lokal}`);
  } else if (fs.existsSync(path.join(lokal, ".git")) && !jalankan("git", ["-C", lokal, "status", "--porcelain", "--untracked-files=no"]).out) {
    const p = jalankan("git", ["-C", lokal, "pull", "--ff-only", "--quiet"]);
    catat(p.ok ? "ok" : "..", `${e.id}: ${p.ok ? "repo lokal diperbarui" : `pull dilewati (${baris1(p.err)}) — memakai versi lokal`}`);
  }
  const tujuan = path.join(dir, "skills", e.skill[0]);
  const r = jalankan("bash", [path.join(lokal, e.pasang), tujuan], lokal);
  if (!r.ok) return catat("!!", `${e.id}: ${e.pasang} gagal — ${baris1(r.err || r.out)}`), false;
  if (e.prasyarat) {
    const s = jalankan("bash", [path.join(tujuan, e.prasyarat)], tujuan);
    catat(s.ok ? "ok" : "!!", `${e.id}: prasyarat ${s.ok ? "siap" : `belum lengkap — ${baris1(s.err || s.out)}`}`);
  }
  return true;
}

function pasangPlugin(e, catat, dir) {
  const v = jalankan(binClaude(), ["--version"]);
  if (!v.ok) return catat("!!", `${e.id}: CLI \`claude\` tidak ditemukan — pasang Claude Code dulu`), false;
  const dikenal = bacaJson(path.join(dir, "plugins", "known_marketplaces.json")) ?? {};
  if (!dikenal[e.marketplace.nama]) {
    const m = jalankan(binClaude(), ["plugin", "marketplace", "add", e.marketplace.sumber]);
    if (!m.ok && !/already/i.test(m.err + m.out)) return catat("!!", `${e.id}: marketplace ${e.marketplace.sumber} gagal ditambahkan — ${baris1(m.err || m.out)}`), false;
    catat("ok", `${e.id}: marketplace ${e.marketplace.nama} (${e.marketplace.sumber}) ditambahkan`);
  }
  const r = jalankan(binClaude(), ["plugin", "install", e.plugin, "--scope", "user"]);
  if (!r.ok) return catat("!!", `${e.id}: claude plugin install ${e.plugin} gagal — ${baris1(r.err || r.out)}`), false;
  catat("ok", `${e.id}: plugin ${e.plugin} dipasang`);
  return true;
}

/** Pastikan skill `target` tersedia; pasang dari sumber resminya bila belum. Exit: 0 tersedia · 1 gagal · 2 tak bisa dipasang · 3 tak terdaftar. */
export function pastikan(daftar, target, { dir = folderClaude(), log = console.log } = {}) {
  const e = cariEntri(daftar, target);
  if (!e) { log(`Skill luar "${target}" tidak terdaftar di perkakas.json › skill_luar — minta COO mendaftarkannya (skill rudis-perkakas › Skill luar).`); return 3; }
  const nama = e.skill.includes(namaPolos(target)) ? namaPolos(target) : e.skill[0];
  const sudah = cariSkill(nama, dir, daftar);
  if (sudah) { log(`[ok]   ${nama}: tersedia (${sudah.lokasi}) — ${sudah.skillMd}`); return 0; }
  const catat = (t, s) => log(`[${t}]   ${s}`);
  if (e.jenis === "platform") {
    catat("!!", `${nama}: ${e.catatan}${e.alternatif ? ` — pakai \`${e.alternatif}\` (\`bin/perkakas.sh pastikan ${e.alternatif}\`)` : ""}`);
    return 2;
  }
  catat("..", `${nama}: belum terpasang — memasang ${e.id} dari ${e.jenis === "git" ? e.repo : e.marketplace.sumber}`);
  const ok = e.jenis === "git" ? pasangGit(e, catat, dir) : e.jenis === "plugin" ? pasangPlugin(e, catat, dir) : false;
  const hasil = ok && cariSkill(nama, dir, daftar);
  if (!hasil) { if (ok) catat("!!", `${nama}: pemasangan selesai tetapi SKILL.md tidak ditemukan`); return 1; }
  catat("ok", `${nama}: terpasang (${hasil.lokasi}). Berlaku otomatis di sesi baru; di sesi ini baca langsung ${hasil.skillMd}`);
  return 0;
}

/** Baris laporan untuk `siapkan`/`cek`/`skill`: skill yang belum ada bukan masalah sampai dibutuhkan. */
export function laporan(daftar, dir = folderClaude()) {
  return daftar.map((e) => {
    const k = keadaan(e, dir, daftar);
    const kurang = Object.entries(k.ada).filter(([, v]) => !v).map(([s]) => s);
    if (k.lengkap) return ["ok", `skill ${e.id}: tersedia (${[...new Set(Object.values(k.ada).map((v) => v.lokasi))].join(", ")})`];
    if (e.jenis === "platform") return ["..", `skill ${e.id}: ${kurang.join(", ")} tidak ada di device ini (${e.catatan})${e.alternatif ? ` — alternatif ${e.alternatif}` : ""}`];
    return ["..", `skill ${e.id}: ${kurang.join(", ")} belum terpasang — dipasang saat dibutuhkan (bin/perkakas.sh pastikan ${kurang[0]})`];
  });
}
