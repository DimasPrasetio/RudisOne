#!/usr/bin/env node
// Suite regresi RudisOne — jalankan perilaku COO satu giliran pada satu versi repo (git ref), aman & identik.
//
//   node uji/suite/jalankan.mjs --ref <git-ref> --nama <label> [--ulang 2] [--paralel 3] [--tugas T1,T3]
//        [--model <m>] [--keluar <dir>] [--anggaran <usd/jalan>] [--batas-waktu <detik>] [--simpan-transkrip] [--kering]
//
// Per label: `git archive <ref>` → <keluar>/varian/<label>/dasar/RudisOne (+ fixture). Per jalan: salinan segar di
// <keluar>/varian/<label>/jalan/<tugas>-<ulang>/{RudisOne,proyek-contoh}, path absolut RudisOne ditulis ulang ke
// salinan itu, skill varian disalin ke proyek-contoh/.claude/skills/. Hasil: <keluar>/hasil-<label>.jsonl (tambah baris),
// keluaran mentah: <keluar>/mentah/<label>/<tugas>-<ulang>.json. Lihat README.md.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { muatTugas, ekstrakRencana, nilaiJalan, metrikRencana } from "./rubrik.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SINI, "..", "..");
const HOME = os.homedir();
const KELUAR_BAWAAN = process.env.RUDISONE_UJI_KELUAR
  || path.join(HOME, "Documents", "Neuron", "ai-agent", "RudisOne", "handoff", "T-20261030-2", "uji");
export const MODE_UJI = () => fs.readFileSync(path.join(SINI, "mode-uji.md"), "utf8").trim();

// ---------- penulisan ulang path ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Pola semua bentuk path absolut repo RudisOne asli (~, $HOME, ${HOME}, /Users/<u>, /home/<u>, HOME mesin ini). */
export function polaRudisOne(home = HOME) {
  const awal = ["~", "\\$HOME", "\\$\\{HOME\\}", "/Users/[^/\\s\"'`)]+", "/home/[^/\\s\"'`)]+", esc(home)].join("|");
  return new RegExp(`(?:${awal})/Documents/Neuron/ai-agent/RudisOne(?![\\w-])`, "g");
}
/** Tulis ulang path RudisOne asli di teks menjadi `tujuan` (path absolut varian). */
export function tulisUlangPath(teks, tujuan, home = HOME) {
  return teks.replace(polaRudisOne(home), () => tujuan);
}
const teksBiner = (buf) => buf.subarray(0, 8000).includes(0);
/** Tulis ulang semua berkas teks di bawah `akar`. → jumlah berkas yang berubah. */
export function tulisUlangFolder(akar, tujuan, home = HOME) {
  let n = 0;
  const jalan = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== ".git") jalan(p); continue; }
      if (!e.isFile()) continue;
      const buf = fs.readFileSync(p);
      if (buf.length > 2e6 || teksBiner(buf)) continue;
      const lama = buf.toString("utf8");
      const baru = tulisUlangPath(lama, tujuan, home);
      if (baru !== lama) { fs.writeFileSync(p, baru); n++; }
    }
  };
  jalan(akar);
  return n;
}

// ---------- pemeriksaan keamanan ----------
/** CLAUDE.md / CLAUDE.local.md di folder leluhur `dari` yang bukan bagian `ruangVarian`. → [path] */
export function claudeMdAsing(dari, ruangVarian) {
  const asing = [];
  const batas = path.resolve(ruangVarian);
  let d = path.resolve(dari);
  for (;;) {
    const dalamVarian = d === batas || d.startsWith(batas + path.sep);
    if (!dalamVarian) for (const n of ["CLAUDE.md", "CLAUDE.local.md", path.join(".claude", "CLAUDE.md")]) {
      const f = path.join(d, n);
      if (fs.existsSync(f)) asing.push(f);
    }
    const atas = path.dirname(d);
    if (atas === d) break;
    d = atas;
  }
  return asing;
}
/** Skill pengguna (~/.claude/skills) yang namanya sama dengan skill varian. */
export function skillBentrok(namaSkillVarian, dirPengguna = path.join(HOME, ".claude", "skills")) {
  let ada = [];
  try { ada = fs.readdirSync(dirPengguna); } catch { return []; }
  return namaSkillVarian.filter((n) => ada.includes(n));
}

// ---------- prompt ----------
/** Ekspansi slash command /rudisone dari SKILL.md varian (tanpa frontmatter, $ARGUMENTS diganti permintaan). */
export function bangunPrompt(skillMd, permintaan, dirSkill) {
  const isi = skillMd.replace(/^---\n[\s\S]*?\n---\n?/, "").trim().replaceAll("$ARGUMENTS", permintaan);
  return `<command-message>rudisone</command-message>\n<command-name>/rudisone</command-name>\n<command-args>${permintaan}</command-args>\n\n`
    + `Base directory for this skill: ${dirSkill}\n\n${isi}\n`;
}

/** Alat yang dilarang: daftar spesifikasi + "Task" (nama lama Agent) + alat berefek di luar sesi yang ada di CLI 2.1.x
 *  (notifikasi, pemicu jarak jauh, jadwal, artifact, worktree). dontAsk sudah menolak yang tidak diizinkan; ini lapis kedua. */
export const ALAT_DILARANG = ["Bash", "Agent", "Task", "SendMessage", "WebFetch", "WebSearch",
  "PushNotification", "RemoteTrigger", "CronCreate", "CronDelete", "ScheduleWakeup", "Workflow", "Monitor",
  "Artifact", "ArtifactComments", "ArtifactData", "DesignSync", "EnterWorktree", "ShareOnboardingGuide", "NotebookEdit"];

/** Argumen claude -p untuk satu jalan (cwd = proyek-contoh). */
export function argumenClaude({ prompt, rudisone, model, anggaran, simpanTranskrip }) {
  const izin = `/${path.join(rudisone, "handoff")}/**`; // awalan "//" = path absolut di aturan izin
  const a = ["-p", prompt, "--output-format", "json", "--strict-mcp-config", "--permission-mode", "dontAsk",
    "--allowedTools", "Read", "Glob", "Grep", "Skill", `Write(${izin})`, `Edit(${izin})`,
    "--disallowedTools", ...ALAT_DILARANG,
    "--append-system-prompt", MODE_UJI()];
  if (model) a.push("--model", model);
  if (anggaran) a.push("--max-budget-usd", String(anggaran));
  if (!simpanTranskrip) a.push("--no-session-persistence");
  return a;
}

// ---------- varian ----------
const salin = (a, b) => fs.cpSync(a, b, { recursive: true, force: true });
function siapkanDasar({ ref, label, ruang }) {
  const sha = execFileSync("git", ["-C", REPO, "rev-parse", "--verify", `${ref}^{commit}`], { encoding: "utf8" }).trim();
  const dasar = path.join(ruang, "dasar");
  fs.rmSync(dasar, { recursive: true, force: true });
  const rudis = path.join(dasar, "RudisOne");
  fs.mkdirSync(rudis, { recursive: true });
  const tar = execFileSync("git", ["-C", REPO, "archive", "--format=tar", sha], { maxBuffer: 1 << 28 });
  execFileSync("tar", ["-x", "-C", rudis], { input: tar });
  // fixture: TEAM.md & register selalu dari fixture; catatan/coo.md hanya bila ref tidak punya
  const fx = path.join(SINI, "fixture");
  fs.copyFileSync(path.join(fx, "TEAM.md"), path.join(rudis, "TEAM.md"));
  fs.mkdirSync(path.join(rudis, "handoff"), { recursive: true });
  fs.copyFileSync(path.join(fx, "handoff", "register-tugas.md"), path.join(rudis, "handoff", "register-tugas.md"));
  const catatan = path.join(rudis, "catatan", "coo.md");
  if (!fs.existsSync(catatan)) { fs.mkdirSync(path.dirname(catatan), { recursive: true }); fs.copyFileSync(path.join(fx, "catatan", "coo.md"), catatan); }
  if (!fs.existsSync(path.join(rudis, "skills", "rudisone", "SKILL.md"))) throw new Error(`ref ${ref} tidak punya skills/rudisone/SKILL.md`);
  fs.writeFileSync(path.join(ruang, "varian.json"), JSON.stringify({ label, ref, sha, dibuat: new Date().toISOString() }, null, 2));
  return { sha, dasar };
}
/** Salinan segar untuk satu jalan. → {rudisone, proyek} */
export function siapkanJalan({ dasar, dirJalan }) {
  fs.rmSync(dirJalan, { recursive: true, force: true });
  fs.mkdirSync(dirJalan, { recursive: true });
  const rudisone = path.join(fs.realpathSync(dirJalan), "RudisOne");
  salin(path.join(dasar, "RudisOne"), rudisone);
  tulisUlangFolder(rudisone, rudisone);
  const proyek = path.join(path.dirname(rudisone), "proyek-contoh");
  fs.mkdirSync(proyek, { recursive: true });
  fs.writeFileSync(path.join(proyek, "README.md"), "# toko-b\n\ntoko-b: aplikasi toko online.\n");
  const git = (...a) => execFileSync("git", ["-C", proyek, "-c", "user.name=uji-suite", "-c", "user.email=uji@contoh.test", ...a], { stdio: "ignore" });
  git("init", "-q");
  git("add", "README.md");
  git("commit", "-q", "-m", "awal");
  const skills = path.join(rudisone, "skills");
  const tujuan = path.join(proyek, ".claude", "skills");
  fs.mkdirSync(tujuan, { recursive: true });
  for (const n of fs.readdirSync(skills)) if (fs.statSync(path.join(skills, n)).isDirectory()) salin(path.join(skills, n), path.join(tujuan, n));
  return { rudisone, proyek };
}
/** Berkas handoff yang ditulis/diubah selama jalan (dibanding dasar). */
function handoffBerubah(dasar, rudisone) {
  const hasil = [];
  const jalan = (d, rel = "") => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = path.join(rel, e.name), p = path.join(d, e.name);
      if (e.isDirectory()) { jalan(p, r); continue; }
      const asal = path.join(dasar, "RudisOne", "handoff", r);
      if (!fs.existsSync(asal)) hasil.push(r);
      else if (tulisUlangPath(fs.readFileSync(asal, "utf8"), rudisone) !== fs.readFileSync(p, "utf8")) hasil.push(`${r} (diubah)`);
    }
  };
  try { jalan(path.join(rudisone, "handoff")); } catch { /* tidak ada */ }
  return hasil;
}

// ---------- eksekusi ----------
function jalankanClaude(args, cwd, batasMs) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    const p = spawn("claude", args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    const t = setTimeout(() => p.kill("SIGTERM"), batasMs);
    p.on("close", (code) => { clearTimeout(t); selesai({ code, out, err, ms: Date.now() - mulai }); });
    p.on("error", (e) => { clearTimeout(t); selesai({ code: -1, out, err: String(e), ms: Date.now() - mulai }); });
  });
}
const kutip = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replaceAll("'", "'\\''")}'`);

export function uraiArgumen(argv) {
  const o = { ref: null, nama: null, ulang: 2, paralel: 3, tugas: null, model: null, keluar: KELUAR_BAWAAN, anggaran: 5, batasWaktu: 900, kering: false, simpanTranskrip: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === "--ref") o.ref = v();
    else if (a === "--nama") o.nama = v();
    else if (a === "--ulang") o.ulang = Number(v());
    else if (a === "--paralel") o.paralel = Number(v());
    else if (a === "--tugas") o.tugas = v().split(",").map((x) => x.trim()).filter(Boolean);
    else if (a === "--model") o.model = v();
    else if (a === "--keluar") o.keluar = path.resolve(v());
    else if (a === "--anggaran") o.anggaran = Number(v());
    else if (a === "--batas-waktu") o.batasWaktu = Number(v());
    else if (a === "--simpan-transkrip") o.simpanTranskrip = true;
    else if (a === "--kering") o.kering = true;
    else throw new Error(`opsi tidak dikenal: ${a}`);
  }
  if (!o.ref || !o.nama) throw new Error("--ref dan --nama wajib");
  if (!/^[A-Za-z0-9._-]+$/.test(o.nama)) throw new Error("--nama hanya huruf, angka, . _ -");
  if (!(o.ulang >= 1) || !(o.paralel >= 1)) throw new Error("--ulang dan --paralel ≥ 1");
  return o;
}

async function main(argv) {
  let o;
  try { o = uraiArgumen(argv); } catch (e) {
    console.error(`${e.message}\nPakai: node uji/suite/jalankan.mjs --ref <git-ref> --nama <label> [--ulang 2] [--paralel 3] [--tugas T1,T3] [--model m] [--keluar dir] [--anggaran usd] [--batas-waktu detik] [--simpan-transkrip] [--kering]`);
    return 2;
  }
  const semua = muatTugas();
  const dipilih = o.tugas ? semua.filter((t) => o.tugas.includes(t.id)) : semua;
  if (o.tugas && dipilih.length !== o.tugas.length) { console.error(`tugas tidak dikenal: ${o.tugas.filter((x) => !semua.some((t) => t.id === x)).join(", ")}`); return 2; }
  fs.mkdirSync(o.keluar, { recursive: true });
  const keluar = fs.realpathSync(o.keluar);
  const ruang = path.join(keluar, "varian", o.nama);
  fs.mkdirSync(ruang, { recursive: true });
  const { sha, dasar } = siapkanDasar({ ref: o.ref, label: o.nama, ruang });
  const namaSkill = fs.readdirSync(path.join(dasar, "RudisOne", "skills"));
  console.log(`Varian ${o.nama}: ${o.ref} = ${sha.slice(0, 12)} · ${dipilih.length} tugas × ${o.ulang} ulang · paralel ${o.paralel}${o.model ? ` · model ${o.model}` : ""}`);
  // keamanan
  const asing = claudeMdAsing(ruang, ruang);
  if (asing.length) { console.error(`DITOLAK: CLAUDE.md asing di folder leluhur ruang varian (akan ikut termuat):\n  ${asing.join("\n  ")}\nPakai --keluar di lokasi lain.`); return 3; }
  const bentrok = skillBentrok(namaSkill);
  // Gagal tertutup: bila skill pribadi bernama sama didahulukan, varian tidak lagi diuji dengan skill-nya sendiri dan
  // perbandingan sebelum/sesudah tidak sah. Override hanya bila sudah dipastikan aman.
  if (bentrok.length && process.env.RUDISONE_UJI_IZINKAN_SKILL_BENTROK !== "1")
    throw new Error(`~/.claude/skills berisi skill bernama sama dengan skill varian: ${bentrok.join(", ")} — perbandingan varian tidak sah. Jalankan dengan HOME/CLAUDE_CONFIG_DIR terpisah, atau RUDISONE_UJI_IZINKAN_SKILL_BENTROK=1 bila sudah dipastikan aman.`);
  if (bentrok.length) console.warn(`PERINGATAN: skill bernama sama diizinkan lewat env: ${bentrok.join(", ")}`);
  if (fs.existsSync(path.join(HOME, ".claude", "CLAUDE.md"))) console.warn("PERINGATAN: ~/.claude/CLAUDE.md (memori pengguna) ikut termuat di semua jalan (sama untuk semua varian).");

  const daftarJalan = [];
  for (const t of dipilih) for (let u = 1; u <= o.ulang; u++) daftarJalan.push({ t, u });
  const hasilFile = path.join(keluar, `hasil-${o.nama}.jsonl`);
  const mentahDir = path.join(keluar, "mentah", o.nama);
  fs.mkdirSync(mentahDir, { recursive: true });

  const satu = async ({ t, u }) => {
    const dirJalan = path.join(ruang, "jalan", `${t.id}-${u}`);
    const { rudisone, proyek } = siapkanJalan({ dasar, dirJalan });
    const asingJalan = claudeMdAsing(proyek, ruang);
    if (asingJalan.length) throw new Error(`CLAUDE.md asing: ${asingJalan.join(", ")}`);
    const dirSkill = path.join(proyek, ".claude", "skills", "rudisone");
    const prompt = bangunPrompt(fs.readFileSync(path.join(dirSkill, "SKILL.md"), "utf8"), t.permintaan, dirSkill);
    const args = argumenClaude({ prompt, rudisone, model: o.model, anggaran: o.anggaran, simpanTranskrip: o.simpanTranskrip });
    if (o.kering) {
      console.log(`\n# ${t.id}-${u}\ncd ${kutip(proyek)} && claude ${args.map(kutip).join(" ")}`);
      return;
    }
    console.log(`→ ${t.id}-${u} mulai`);
    const r = await jalankanClaude(args, proyek, o.batasWaktu * 1000);
    fs.writeFileSync(path.join(mentahDir, `${t.id}-${u}.json`), r.out || JSON.stringify({ stderr: r.err, code: r.code }));
    let j = null;
    try { j = JSON.parse(r.out); } catch { /* keluaran bukan JSON */ }
    const teks = j?.result ?? "";
    const { rencana, galat } = ekstrakRencana(teks);
    const isError = j ? !!j.is_error : true;
    const cek = nilaiJalan(t, { teks, rencana, is_error: isError });
    const rec = {
      label: o.nama, ref: o.ref, sha, tugas: t.id, ulang: u, waktu: new Date().toISOString(),
      rencana, galat_rencana: galat, cek,
      lulus_wajib: cek.filter((c) => c.wajib).every((c) => c.lulus),
      skor: cek.filter((c) => c.lulus).length / cek.length,
      metrik_rencana: metrikRencana(rencana),
      total_cost_usd: j?.total_cost_usd ?? null, usage: j?.usage ?? null, modelUsage: j?.modelUsage ?? null,
      duration_ms: j?.duration_ms ?? r.ms, num_turns: j?.num_turns ?? null,
      permission_denials: j?.permission_denials ?? null, is_error: isError, subtype: j?.subtype ?? null,
      exit_code: r.code, stderr: r.err ? r.err.slice(0, 2000) : "",
      handoff_ditulis: handoffBerubah(dasar, rudisone),
      result: teks,
    };
    fs.appendFileSync(hasilFile, `${JSON.stringify(rec)}\n`);
    const gagal = cek.filter((c) => !c.lulus).map((c) => `${c.wajib ? "W" : "T"}:${c.kode}`);
    console.log(`✓ ${t.id}-${u} ${rec.lulus_wajib ? "LULUS" : "GAGAL"} · USD ${rec.total_cost_usd ?? "?"} · ${Math.round(rec.duration_ms / 1000)} dtk · turns ${rec.num_turns ?? "?"}${gagal.length ? ` · gagal: ${gagal.join(", ")}` : ""}`);
  };
  const antre = [...daftarJalan];
  const pekerja = Array.from({ length: Math.min(o.paralel, antre.length) }, async () => {
    while (antre.length) {
      const x = antre.shift();
      try { await satu(x); } catch (e) { console.error(`✗ ${x.t.id}-${x.u}: ${e.message}`); process.exitCode = 1; }
    }
  });
  await Promise.all(pekerja);
  if (!o.kering) console.log(`\nHasil: ${hasilFile}\nNilai: node uji/suite/nilai.mjs ${o.nama} --keluar ${kutip(keluar)}`);
  return process.exitCode ?? 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
}
