// Skill luar RudisOne (daftar: perkakas.json › skill_luar; aturan: skill rudis-perkakas › Skill luar). Skill yang dipakai
// agent tetapi tidak dibundel di repo ini: dicek keberadaannya di device, dan dipasang dari sumber resminya saat
// pertama dibutuhkan. Dipanggil lewat bin/perkakas.sh [pastikan <skill>|skill].
//   git       clone repo sumber ke `lokal` (disimpan untuk pemasangan berikutnya), lalu jalankan `pasang`
//   plugin    `claude plugin marketplace add <sumber>` + `claude plugin install <plugin>` (lisensi Anthropic:
//             tidak pernah disalin ke repo sendiri — selalu dari marketplace resmi)
//   platform  bawaan aplikasi Claude (mis. konektor Claude Docs); tidak bisa dipasang → pakai `alternatif`
//   ekosistem skill dari ekosistem terbuka (skills.sh): repo git + `jalur` folder skill + `sha` commit penuh yang dikunci.
//             Diambil dengan git pada sha itu (tanpa menjalankan kode/skrip dari sumber, tanpa `npx skills add`), folder
//             `jalur` disalin ke ~/.claude/skills/<skill> beserta penanda `.rudisone-sumber.json` (repo, sha, jalur).
//             Pin berubah → `pastikan` memasang versi terkunci yang baru; folder tanpa penanda tidak pernah ditimpa.
import { cariBash, jalankan as jalankanProses, posix } from "./lib/platform.mjs";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rumah = (p) => path.normalize(p.replace(/^~(?=\/|$)/, os.homedir()));   // normalize: pemisah path sama di semua OS
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
    const r = jalankan("git", ["clone", "--quiet", "--depth", "1", e.repo, lokal]);   // dangkal: hanya isi terbaru yang dipasang
    if (!r.ok) return catat("!!", `${e.id}: clone ${e.repo} gagal — ${baris1(r.err)}`), false;
    catat("ok", `${e.id}: repo disimpan di ${e.lokal}`);
  } else if (fs.existsSync(path.join(lokal, ".git")) && !jalankan("git", ["-C", lokal, "status", "--porcelain", "--untracked-files=no"]).out) {
    const p = jalankan("git", ["-C", lokal, "pull", "--ff-only", "--quiet"]);
    catat(p.ok ? "ok" : "..", `${e.id}: ${p.ok ? "repo lokal diperbarui" : `pull dilewati (${baris1(p.err)}) — memakai versi lokal`}`);
  }
  const tujuan = path.join(dir, "skills", e.skill[0]);
  const r = jalankan(cariBash() ?? "bash", [posix(path.join(lokal, e.pasang)), tujuan], lokal);
  if (!r.ok) return catat("!!", `${e.id}: ${e.pasang} gagal — ${baris1(r.err || r.out)}`), false;
  if (e.prasyarat) {
    const s = jalankan(cariBash() ?? "bash", [posix(path.join(tujuan, e.prasyarat))], tujuan);
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

// ---------- jenis ekosistem: repo git + jalur + sha terkunci ----------
export const PENANDA = ".rudisone-sumber.json";
const SHA_PENUH = /^[0-9a-f]{40}$/;
const NAMA_SKILL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** Akar repo RudisOne (tempat perkakas.json & berkas `adaptasi`). */
export const akarRudisone = () => process.env.RUDISONE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Penampung versi CLI di berkas adaptasi: diganti nilai `cli` entri saat pasang. */
export const PENAMPUNG_CLI = "{{RUDISONE_CLI}}";
const pathRelatifSah = (j) => Boolean(j) && !path.isAbsolute(j) && !/\\/.test(j) && !String(j).split("/").some((x) => x === ".." || x === "." || x === "");

/** Galat bentuk entri ekosistem (sebelum menyentuh jaringan/disk), atau null. */
export function galatEkosistem(e) {
  if (!e.repo || String(e.repo).startsWith("-")) return `repo kosong atau diawali "-": "${e.repo ?? ""}"`;
  if (!SHA_PENUH.test(String(e.sha ?? ""))) return `sha harus commit penuh 40 hex (bukan cabang/tag/sha pendek): "${e.sha ?? ""}"`;
  if (e.skill?.length !== 1 || !NAMA_SKILL.test(e.skill[0])) return "skill harus tepat satu nama folder yang sah";
  const j = String(e.jalur ?? "");
  if (!pathRelatifSah(j)) return `jalur harus path relatif di repo tanpa ".." (mis. skills/${e.skill[0]}): "${j}"`;
  if (e.adaptasi !== undefined && !pathRelatifSah(String(e.adaptasi))) return `adaptasi harus path relatif di repo RudisOne (mis. adaptasi/${e.id}.patch): "${e.adaptasi}"`;
  if (e.lisensi_berkas !== undefined && !pathRelatifSah(String(e.lisensi_berkas))) return `lisensi_berkas harus path relatif di repo sumber: "${e.lisensi_berkas}"`;
  if (e.cli !== undefined && !/^[a-z0-9][\w.-]*@\d+\.\d+\.\d+$/.test(String(e.cli))) return `cli harus paket@versi persis (mis. skills@1.2.3): "${e.cli}"`;
  return null;
}

/** Segmen nama berkas di folder skill yang aman ditulis di semua OS: bukan ""/"."/".."/".git", tanpa \\ : NUL, bukan penanda. */
export const segmenAman = (s) => Boolean(s) && s !== "." && s !== ".." && s.toLowerCase() !== ".git" && !/[\\:\0]/.test(s) && s !== PENANDA;

/** Versi yang DIKUNCI entri: sha sumber + hash berkas adaptasi (bila ada) + cli. { galat } bila berkas adaptasi tak terbaca. */
export function versiKunci(e, root = akarRudisone()) {
  let adaptasi = null;
  if (e.adaptasi) {
    let isi; try { isi = fs.readFileSync(path.join(root, e.adaptasi)); } catch { return { galat: `berkas adaptasi ${e.adaptasi} tidak ada di ${root}` }; }
    adaptasi = { berkas: e.adaptasi, sha256: crypto.createHash("sha256").update(isi).digest("hex") };
  }
  return { sha: e.sha, adaptasi, cli: e.cli ?? null };
}
/** Penanda terpasang sama dengan versi terkunci (sha sumber, hash adaptasi, cli). */
export const samaVersi = (p, k) => Boolean(p && k && !k.galat) && p.sha === k.sha && (p.adaptasi?.sha256 ?? null) === (k.adaptasi?.sha256 ?? null) && (p.cli ?? null) === k.cli;
const ringkasVersi = (v) => `${String(v?.sha ?? "?").slice(0, 12)}${v?.adaptasi ? ` + adaptasi ${v.adaptasi.sha256.slice(0, 8)}` : ""}`;

/** Penanda versi skill ekosistem yang terpasang: { repo, sha, jalur, adaptasi, cli } atau null (tidak ada / rusak). */
export function bacaPenanda(dir, nama) {
  const j = bacaJson(path.join(dir, "skills", nama, PENANDA));
  return j && typeof j === "object" && SHA_PENUH.test(String(j.sha ?? "")) ? j : null;
}

/** Ambil folder `e.jalur` pada commit `e.sha` dari `e.repo`, terapkan adaptasi RudisOne (`e.adaptasi`: patch di repo
 *  RudisOne, `git apply`; penampung `{{RUDISONE_CLI}}` → `e.cli`), sertakan berkas lisensi sumber (`e.lisensi_berkas` →
 *  LICENSE), lalu ganti ~/.claude/skills/<skill> (hanya versi lama yang berpenanda). Tidak menjalankan apa pun dari sumber;
 *  symlink & submodul ditolak. Adaptasi yang tidak cocok dengan sha terkunci → gagal (skill tidak aktif tanpa adaptasi). */
function pasangEkosistem(e, catat, dir, root = akarRudisone()) {
  const g = galatEkosistem(e);
  if (g) return catat("!!", `${e.id}: entri tidak sah — ${g}`), false;
  const kunci = versiKunci(e, root);
  if (kunci.galat) return catat("!!", `${e.id}: ${kunci.galat}`), false;
  const nama = e.skill[0], tujuan = path.join(dir, "skills", nama);
  let adaTujuan = false; try { fs.lstatSync(tujuan); adaTujuan = true; } catch { /* belum ada */ }
  if (adaTujuan && !bacaPenanda(dir, nama))
    return catat("!!", `${e.id}: ${tujuan} sudah ada tanpa penanda versi RudisOne (dipasang di luar jalur resmi) — tidak ditimpa; pindahkan/hapus folder itu sendiri, lalu jalankan pastikan lagi`), false;
  const kerja = fs.mkdtempSync(path.join(os.tmpdir(), "rudisone-skill-"));
  const git = (...a) => jalankan("git", ["-C", kerja, ...a]);
  try {
    jalankan("git", ["init", "-q", kerja]);
    // sha langsung (protokol v2); server yang menolak → ambil semua cabang lalu cari sha-nya
    // transfer.fsckObjects: git sendiri menolak tree berisi ".."/".git" dan objek rusak
    if (!git("-c", "transfer.fsckObjects=true", "fetch", "-q", "--depth", "1", "--no-tags", e.repo, e.sha).ok) {
      const f = git("-c", "transfer.fsckObjects=true", "fetch", "-q", "--no-tags", e.repo, "+refs/heads/*:refs/remotes/sumber/*");
      if (!f.ok) return catat("!!", `${e.id}: ambil ${e.repo} gagal — ${baris1(f.err)}`), false;
    }
    const sha = git("rev-parse", "--verify", "-q", `${e.sha}^{commit}`);
    if (!sha.ok || sha.out !== e.sha) return catat("!!", `${e.id}: sha terkunci ${e.sha} tidak ada di ${e.repo} — ditolak`), false;
    const ls = jalankanProses("git", ["-C", kerja, "ls-tree", "-r", "-z", "--full-tree", e.sha, "--", e.jalur], { encoding: "utf8" });
    const isi = String(ls.stdout ?? "").split("\0").filter(Boolean).map((b) => { const [kepala, p] = b.split("\t"); const [mode, jenis, oid] = kepala.split(" "); return { mode, jenis, oid, p }; })
      .filter((x) => x.p.startsWith(`${e.jalur}/`));   // pathspec bisa ikut mencocokkan folder bernama awalan sama
    const awalan = `${e.jalur}/`;
    if (ls.status !== 0 || !isi.some((x) => x.p === `${awalan}SKILL.md`)) return catat("!!", `${e.id}: ${e.jalur}/SKILL.md tidak ada pada ${e.sha.slice(0, 12)}`), false;
    const aneh = isi.find((x) => x.jenis !== "blob" || x.mode === "120000");
    if (aneh) return catat("!!", `${e.id}: ${aneh.p} berupa ${aneh.mode === "120000" ? "symlink" : aneh.jenis} — ditolak`), false;
    // nama entri tree tidak dipercaya: tiap segmen harus aman, dan hasilnya tetap di dalam folder baru (semua OS)
    const salah = isi.find((x) => !x.p.slice(awalan.length).split("/").every(segmenAman));
    if (salah) return catat("!!", `${e.id}: nama berkas tidak aman di sumber (${JSON.stringify(salah.p)}) — ditolak`), false;
    // 1) isi sumber pada sha → folder staging di dalam repo kerja (tempat `git apply` berlaku)
    const staging = path.join(kerja, "staging"), di = path.resolve(staging) + path.sep;
    for (const x of isi) {
      const f = path.resolve(staging, ...x.p.slice(awalan.length).split("/"));
      if (!f.startsWith(di)) return catat("!!", `${e.id}: ${x.p} keluar dari folder skill — ditolak`), false;
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, execFileSync("git", ["-C", kerja, "cat-file", "blob", x.oid], { maxBuffer: 256 << 20 }));
      if (x.mode === "100755" && process.platform !== "win32") fs.chmodSync(f, 0o755);
    }
    // 2) adaptasi RudisOne (wajib cocok dengan sha terkunci) + penampung versi CLI
    if (e.adaptasi) {
      const a = git("apply", "--directory=staging", "--whitespace=nowarn", path.join(root, e.adaptasi));
      if (!a.ok) return catat("!!", `${e.id}: adaptasi ${e.adaptasi} tidak cocok dengan ${e.sha.slice(0, 12)} — ${baris1(a.err || a.out)}; perbarui adaptasinya (skill rudis-perkakas › Skill luar)`), false;
    }
    const semua = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? semua(path.join(d, x.name)) : [path.join(d, x.name)]));
    for (const f of semua(staging)) {
      if (fs.lstatSync(f).isSymbolicLink()) return catat("!!", `${e.id}: ${path.relative(staging, f)} symlink setelah adaptasi — ditolak`), false;
      if (!/\.(md|txt)$/i.test(f)) continue;
      const teks = fs.readFileSync(f, "utf8");
      if (!teks.includes(PENAMPUNG_CLI)) continue;
      if (!e.cli) return catat("!!", `${e.id}: ${path.relative(staging, f)} memuat ${PENAMPUNG_CLI} tetapi entri tanpa \`cli\``), false;
      fs.writeFileSync(f, teks.split(PENAMPUNG_CLI).join(e.cli));
    }
    // 3) pemberitahuan lisensi sumber ikut terpasang (mis. MIT mewajibkannya pada salinan yang diubah)
    if (e.lisensi_berkas) {
      const l = git("cat-file", "-e", `${e.sha}:${e.lisensi_berkas}`);
      if (!l.ok) return catat("!!", `${e.id}: berkas lisensi ${e.lisensi_berkas} tidak ada pada ${e.sha.slice(0, 12)}`), false;
      const tujuanLisensi = path.join(staging, fs.existsSync(path.join(staging, "LICENSE")) ? "LICENSE-sumber" : "LICENSE");
      fs.writeFileSync(tujuanLisensi, execFileSync("git", ["-C", kerja, "show", `${e.sha}:${e.lisensi_berkas}`], { maxBuffer: 16 << 20 }));
    }
    const baru = path.join(dir, "skills", `.${nama}.rudisone-baru`), lama = path.join(dir, "skills", `.${nama}.rudisone-lama`);
    fs.rmSync(baru, { recursive: true, force: true }); fs.rmSync(lama, { recursive: true, force: true });
    try {
      fs.cpSync(staging, baru, { recursive: true });
      fs.writeFileSync(path.join(baru, PENANDA), `${JSON.stringify({ id: e.id, repo: e.repo, sha: e.sha, jalur: e.jalur, adaptasi: kunci.adaptasi, cli: kunci.cli }, null, 2)}\n`);
      if (adaTujuan) fs.renameSync(tujuan, lama);
      fs.renameSync(baru, tujuan);
    } catch (err) {
      // gagal di tengah: versi lama dikembalikan bila sudah dipindah, folder sementara dibuang
      try { let adaLama = false; try { fs.lstatSync(lama); adaLama = true; } catch { /* - */ }
        if (adaLama) { let adaT = false; try { fs.lstatSync(tujuan); adaT = true; } catch { /* - */ } if (!adaT) fs.renameSync(lama, tujuan); } } catch { /* biarkan */ }
      fs.rmSync(baru, { recursive: true, force: true });
      return catat("!!", `${e.id}: pemasangan gagal — ${err.message}`), false;
    }
    try { fs.rmSync(lama, { recursive: true, force: true }); } catch { /* sisa versi lama (mis. berkas terkunci di Windows) — dibuang di pemasangan berikutnya */ }
    catat("ok", `${e.id}: ${isi.length} berkas dari ${e.repo} @ ${ringkasVersi(kunci)} (${e.jalur}) → ${tujuan}`);
    return true;
  } finally { fs.rmSync(kerja, { recursive: true, force: true }); }
}

/** Pastikan skill `target` tersedia; pasang dari sumber resminya bila belum. Exit: 0 tersedia · 1 gagal · 2 tak bisa dipasang · 3 tak terdaftar. */
export function pastikan(daftar, target, { dir = folderClaude(), log = console.log, root = akarRudisone() } = {}) {
  const e = cariEntri(daftar, target);
  if (!e) { log(`Skill luar "${target}" tidak terdaftar di perkakas.json › skill_luar — minta COO mendaftarkannya (skill rudis-perkakas › Skill luar).`); return 3; }
  const nama = e.skill.includes(namaPolos(target)) ? namaPolos(target) : e.skill[0];
  const sudah = cariSkill(nama, dir, daftar);
  const catat = (t, s) => log(`[${t}]   ${s}`);
  if (sudah && e.jenis === "ekosistem" && sudah.lokasi === "pribadi") {
    // ekosistem: tersedia hanya bila versi terpasang = versi terkunci
    const p = bacaPenanda(dir, nama), k = versiKunci(e, root);
    if (samaVersi(p, k)) { log(`[ok]   ${nama}: tersedia (pribadi @ ${ringkasVersi(k)}) — ${sudah.skillMd}`); return 0; }
    if (!p) { catat("!!", `${nama}: ${path.dirname(sudah.skillMd)} terpasang di luar jalur RudisOne (tanpa penanda versi) — tidak ditimpa; pindahkan/hapus folder itu sendiri, lalu jalankan pastikan lagi`); return 1; }
    catat("..", `${nama}: versi terpasang ${ringkasVersi(p)} ≠ terkunci ${k.galat ? "?" : ringkasVersi(k)} — memasang versi terkunci`);
  } else if (sudah) { log(`[ok]   ${nama}: tersedia (${sudah.lokasi}) — ${sudah.skillMd}`); return 0; }
  if (e.jenis === "platform") {
    catat("!!", `${nama}: ${e.catatan}${e.alternatif ? ` — pakai \`${e.alternatif}\` (\`bin/perkakas.sh pastikan ${e.alternatif}\`)` : ""}`);
    return 2;
  }
  if (!sudah) catat("..", `${nama}: belum terpasang — memasang ${e.id} dari ${e.jenis === "plugin" ? e.marketplace.sumber : e.repo}${e.jenis === "ekosistem" ? ` @ ${String(e.sha).slice(0, 12)}` : ""}`);
  const ok = e.jenis === "git" ? pasangGit(e, catat, dir) : e.jenis === "plugin" ? pasangPlugin(e, catat, dir)
    : e.jenis === "ekosistem" ? pasangEkosistem(e, catat, dir, root) : (catat("!!", `${e.id}: jenis "${e.jenis}" tidak dikenal`), false);
  const hasil = ok && cariSkill(nama, dir, daftar);
  if (!hasil) { if (ok) catat("!!", `${nama}: pemasangan selesai tetapi SKILL.md tidak ditemukan`); return 1; }
  catat("ok", `${nama}: terpasang (${hasil.lokasi}). Berlaku otomatis di sesi baru; di sesi ini baca langsung ${hasil.skillMd}`);
  return 0;
}

/** Baris laporan untuk `siapkan`/`cek`/`skill`: skill yang belum ada bukan masalah sampai dibutuhkan. */
export function laporan(daftar, dir = folderClaude(), root = akarRudisone()) {
  return daftar.map((e) => {
    const k = keadaan(e, dir, daftar);
    const kurang = Object.entries(k.ada).filter(([, v]) => !v).map(([s]) => s);
    if (k.lengkap && e.jenis === "ekosistem" && k.ada[e.skill[0]].lokasi === "pribadi") {
      const p = bacaPenanda(dir, e.skill[0]);
      if (!p) return ["..", `skill ${e.id}: terpasang di luar jalur RudisOne (tanpa penanda versi; terkunci ${String(e.sha).slice(0, 12)}) — tidak ditimpa otomatis`];
      const k = versiKunci(e, root);
      if (!samaVersi(p, k)) return ["..", `skill ${e.id}: versi terpasang ${ringkasVersi(p)} ≠ terkunci ${k.galat ? "?" : ringkasVersi(k)} — bin/perkakas.sh pastikan ${e.skill[0]}`];
      return ["ok", `skill ${e.id}: tersedia (pribadi @ ${ringkasVersi(k)})`];
    }
    if (k.lengkap) return ["ok", `skill ${e.id}: tersedia (${[...new Set(Object.values(k.ada).map((v) => v.lokasi))].join(", ")})`];
    if (e.jenis === "platform") return ["..", `skill ${e.id}: ${kurang.join(", ")} tidak ada di device ini (${e.catatan})${e.alternatif ? ` — alternatif ${e.alternatif}` : ""}`];
    return ["..", `skill ${e.id}: ${kurang.join(", ")} belum terpasang — dipasang saat dibutuhkan (bin/perkakas.sh pastikan ${kurang[0]})`];
  });
}
