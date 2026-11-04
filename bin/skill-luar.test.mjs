// Uji skill luar (cek & pasang dari sumber resmi) tanpa internet: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { palsu } from "./lib/uji-util.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-luar-"));
const CLAUDE = path.join(tmp, "claude");
fs.mkdirSync(CLAUDE, { recursive: true });
process.env.RUDISONE_CLAUDE_DIR = CLAUDE;

// Sumber git: repo skill dengan skrip pasang (sync) yang menyalin ke folder tujuan.
const SUMBER = path.join(tmp, "sumber-neuron");
fs.mkdirSync(path.join(SUMBER, "scripts"), { recursive: true });
fs.writeFileSync(path.join(SUMBER, "SKILL.md"), "---\nname: docx-neuron\n---\n");
fs.writeFileSync(path.join(SUMBER, "scripts", "sync.sh"), 'mkdir -p "$1" && cp -R "$(dirname "$0")/.." "$1.tmp" && rm -rf "$1" && mv "$1.tmp" "$1"\n');
fs.writeFileSync(path.join(SUMBER, "scripts", "setup.sh"), "exit 0\n");
const g = (...a) => execFileSync("git", ["-C", SUMBER, ...a], { stdio: "ignore" });
g("init", "-q", "-b", "main"); g("add", "-A"); g("-c", "user.name=u", "-c", "user.email=u@x", "commit", "-qm", "awal");

// CLI claude palsu: marketplace add → known_marketplaces.json; plugin install → installed_plugins.json + SKILL.md.
const BIN = palsu(tmp, "claude-palsu", `import fs from "node:fs";
import path from "node:path";
const a = process.argv.slice(2);
const D = path.join(${JSON.stringify(CLAUDE)}, "plugins"); fs.mkdirSync(D, { recursive: true });
const panggilan = (t) => fs.appendFileSync(${JSON.stringify(path.join(tmp, "panggilan"))}, t + "\\n");
if (a[0] === "--version") { console.log("9.9.9 (Claude Code)"); process.exit(0); }
if (a[0] === "plugin" && a[1] === "marketplace") {
  fs.writeFileSync(path.join(D, "known_marketplaces.json"), JSON.stringify({ "anthropic-agent-skills": {} }) + "\\n"); panggilan(a[3]); process.exit(0); }
if (a[0] === "plugin" && a[1] === "install") {
  const P = path.join(D, "cache", "document-skills");
  for (const s of ["docx", "pdf", "pptx", "xlsx", "frontend-design"]) { fs.mkdirSync(path.join(P, "skills", s), { recursive: true }); fs.writeFileSync(path.join(P, "skills", s, "SKILL.md"), "x\\n"); }
  fs.writeFileSync(path.join(D, "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { [a[2]]: [{ installPath: P }] } }) + "\\n"); panggilan("install " + a[2]); process.exit(0); }
process.exit(1);
`);
process.env.RUDISONE_CLAUDE_BIN = BIN;

const { cariSkill, cariEntri, pastikan, laporan } = await import("./skill-luar.mjs");
const DAFTAR = [
  { id: "docx-neuron", jenis: "git", skill: ["docx-neuron"], repo: SUMBER, lokal: path.join(tmp, "simpan", "docx-neuron"), pasang: "scripts/sync.sh", prasyarat: "scripts/setup.sh" },
  { id: "document-skills", jenis: "plugin", skill: ["docx", "pdf", "pptx", "xlsx"], marketplace: { nama: "anthropic-agent-skills", sumber: "anthropics/skills" }, plugin: "document-skills@anthropic-agent-skills" },
  { id: "frontend-design", jenis: "plugin", skill: ["frontend-design"], marketplace: { nama: "claude-plugins-official", sumber: "anthropics/claude-plugins-official" }, plugin: "frontend-design@claude-plugins-official" },
  { id: "claude-docs", jenis: "platform", skill: ["docs"], catatan: "bawaan aplikasi Claude", alternatif: "docx" },
];
const diam = { log: () => {} };

test("entri dicari lewat id, nama skill, atau nama berawalan plugin", () => {
  assert.equal(cariEntri(DAFTAR, "anthropic-skills:pdf").id, "document-skills");
  assert.equal(cariEntri(DAFTAR, "docx-neuron").id, "docx-neuron");
  assert.equal(cariEntri(DAFTAR, "tidak-ada"), null);
  assert.equal(pastikan(DAFTAR, "tidak-ada", diam), 3);
});

test("skill dari aplikasi Claude (synced) dianggap tersedia, tanpa memasang apa pun", () => {
  const f = path.join(CLAUDE, "skills", "synced", "akun", "docs", "SKILL.md");
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x");
  assert.match(cariSkill("anthropic-skills:docs", CLAUDE).lokasi, /aplikasi Claude/);
  assert.equal(pastikan(DAFTAR, "docs", diam), 0);
  fs.rmSync(path.join(CLAUDE, "skills", "synced"), { recursive: true });
  assert.equal(pastikan(DAFTAR, "docs", diam), 2);   // platform & tidak ada → pakai alternatif
});

test("jenis git: repo disimpan di `lokal`, skill dipasang, pemanggilan kedua tidak memasang ulang", () => {
  assert.equal(pastikan(DAFTAR, "docx-neuron", diam), 0);
  assert.ok(fs.existsSync(path.join(tmp, "simpan", "docx-neuron", ".git")));
  assert.equal(cariSkill("docx-neuron", CLAUDE).lokasi, "pribadi");
  const log = [];
  assert.equal(pastikan(DAFTAR, "docx-neuron", { log: (s) => log.push(s) }), 0);
  assert.match(log.join("\n"), /tersedia \(pribadi\)/);
});

test("jenis plugin: marketplace resmi ditambahkan lalu plugin dipasang; skill plugin lain tidak ikut terhitung", () => {
  assert.equal(pastikan(DAFTAR, "anthropic-skills:pdf", diam), 0);
  const panggilan = fs.readFileSync(path.join(tmp, "panggilan"), "utf8");
  assert.match(panggilan, /anthropics\/skills/);
  assert.match(panggilan, /install document-skills@anthropic-agent-skills/);
  assert.match(cariSkill("xlsx", CLAUDE, DAFTAR).lokasi, /plugin document-skills/);
  // cache document-skills memuat folder frontend-design, tetapi plugin itu tidak menyediakannya
  assert.equal(cariSkill("frontend-design", CLAUDE, DAFTAR), null);
  const baris = laporan(DAFTAR, CLAUDE);
  assert.deepEqual(baris.map(([t]) => t), ["ok", "ok", "..", ".."]);
});

test("jenis ekosistem: dipasang dari repo git pada sha terkunci (tanpa menjalankan kode sumber); sha tak cocok/pendek ditolak; pin baru → versi baru", async () => {
  const { galatEkosistem, bacaPenanda, PENANDA } = await import("./skill-luar.mjs");
  const C = path.join(tmp, "claude-eko"); fs.mkdirSync(C, { recursive: true });
  const R = path.join(tmp, "ekosistem-tiruan");
  const tulis = (rel, isi, mode) => { const f = path.join(R, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, isi); if (mode) fs.chmodSync(f, mode); };
  const gr = (...a) => execFileSync("git", ["-C", R, "-c", "user.name=u", "-c", "user.email=u@x", "-c", "commit.gpgsign=false", ...a], { encoding: "utf8" }).trim();
  fs.mkdirSync(R, { recursive: true }); gr("init", "-q", "-b", "main");
  tulis("skills/cari/SKILL.md", "---\nname: cari\n---\nversi A\n");
  tulis("skills/cari/scripts/x.sh", "touch dijalankan\n", 0o755);
  tulis("skills/cari-lain/SKILL.md", "folder lain berawalan sama\n");
  tulis("src/cli.ts", "kode CLI — tidak ikut\n");
  gr("add", "-A"); gr("commit", "-qm", "A"); const A = gr("rev-parse", "HEAD");
  tulis("skills/cari/SKILL.md", "---\nname: cari\n---\nversi B\n"); gr("commit", "-qam", "B"); const B = gr("rev-parse", "HEAD");
  const entri = (sha, extra = {}) => [{ id: "cari", jenis: "ekosistem", skill: ["cari"], repo: R, sha, jalur: "skills/cari", lisensi: "MIT", ...extra }];
  const log = []; const catat = { dir: C, log: (s) => log.push(s) };
  const skillMd = path.join(C, "skills", "cari", "SKILL.md");

  // sha terkunci A (bukan ujung cabang) → isi versi A, penanda, skrip tidak dijalankan, folder lain & kode CLI tidak ikut
  assert.equal(pastikan(entri(A), "cari", catat), 0, log.join("\n"));
  assert.match(fs.readFileSync(skillMd, "utf8"), /versi A/);
  assert.deepEqual(bacaPenanda(C, "cari"), { id: "cari", repo: R, sha: A, jalur: "skills/cari", adaptasi: null, cli: null });
  assert.deepEqual(fs.readdirSync(path.join(C, "skills", "cari")).sort(), [PENANDA, "SKILL.md", "scripts"].sort());
  assert.ok(!fs.existsSync(path.join(R, "dijalankan")) && !fs.existsSync(path.join(C, "skills", "cari", "dijalankan")));
  if (process.platform !== "win32") assert.ok(fs.statSync(path.join(C, "skills", "cari", "scripts", "x.sh")).mode & 0o100);
  assert.deepEqual(fs.readdirSync(path.join(C, "skills")).filter((x) => x.startsWith(".")), []);   // tanpa sisa folder sementara
  assert.equal(pastikan(entri(A), "cari", catat), 0);
  assert.match(log.at(-1), new RegExp(`tersedia \\(pribadi @ ${A.slice(0, 12)}\\)`));
  assert.deepEqual(laporan(entri(A), C)[0][0], "ok");

  // sha yang tidak ada di repo, sha pendek, cabang, jalur keluar repo → ditolak, versi terpasang tidak berubah
  for (const [e, pola] of [[entri("0123456789abcdef0123456789abcdef01234567"), /tidak ada di|ambil .* gagal/], [entri(A.slice(0, 7)), /40 hex/],
    [entri("main"), /40 hex/], [entri(B, { jalur: "../luar" }), /jalur/], [entri(B, { jalur: "skills/tidak-ada" }), /SKILL\.md tidak ada/]]) {
    log.length = 0;
    assert.equal(pastikan(e, "cari", catat), 1, JSON.stringify(e));
    assert.match(log.join("\n"), pola);
    assert.match(fs.readFileSync(skillMd, "utf8"), /versi A/);
  }
  assert.match(galatEkosistem(entri(A, { skill: ["../x"] })[0]), /nama folder/);

  // pin diganti ke B (keputusan pembaruan) → laporan menandai beda versi, pastikan memasang versi terkunci baru
  assert.match(laporan(entri(B), C)[0][1], /versi terpasang .* ≠ terkunci/);
  assert.equal(pastikan(entri(B), "cari", catat), 0);
  assert.match(fs.readFileSync(skillMd, "utf8"), /versi B/);
  assert.equal(bacaPenanda(C, "cari").sha, B);

  // folder skill bernama sama tanpa penanda (dipasang di luar jalur resmi, mis. npx skills add) → tidak pernah ditimpa
  fs.rmSync(path.join(C, "skills", "cari", PENANDA));
  log.length = 0;
  assert.equal(pastikan(entri(A), "cari", catat), 1);
  assert.match(log.join("\n"), /di luar jalur RudisOne/);
  assert.match(fs.readFileSync(skillMd, "utf8"), /versi B/);
  assert.match(laporan(entri(A), C)[0][1], /di luar jalur RudisOne/);

  // symlink di folder skill → ditolak
  if (process.platform !== "win32") {
    fs.rmSync(path.join(C, "skills", "cari"), { recursive: true });
    fs.symlinkSync("/etc/hosts", path.join(R, "skills", "cari", "tautan")); gr("add", "-A"); gr("commit", "-qm", "C"); const S = gr("rev-parse", "HEAD");
    log.length = 0;
    assert.equal(pastikan(entri(S), "cari", catat), 1);
    assert.match(log.join("\n"), /symlink — ditolak/);
    assert.ok(!fs.existsSync(path.join(C, "skills", "cari")));
  }
});

test("jenis ekosistem: tree sumber berisi '..', '.git', atau nama ber-backslash ditolak — tidak ada berkas tertulis di luar folder skill", async () => {
  const { segmenAman, PENANDA } = await import("./skill-luar.mjs");
  for (const s of ["", ".", "..", ".git", ".GIT", "..\\..\\x", "a:b", "a\0b", PENANDA]) assert.equal(segmenAman(s), false, JSON.stringify(s));
  for (const s of ["SKILL.md", ".hidden", "a..b", "scripts"]) assert.equal(segmenAman(s), true, s);
  const C = path.join(tmp, "claude-jahat"); fs.mkdirSync(path.join(C, "skills"), { recursive: true });
  const R = path.join(tmp, "ekosistem-jahat"); fs.mkdirSync(R);
  const gr = (a, input) => execFileSync("git", ["-C", R, "-c", "user.name=u", "-c", "user.email=u@x", "-c", "commit.gpgsign=false", ...a], { encoding: "utf8", input }).trim();
  gr(["init", "-q", "-b", "main"]);
  const blob = (isi) => gr(["hash-object", "-w", "--stdin"], isi);
  const pohon = (baris) => gr(["mktree"], baris.map(([m, j, o, n]) => `${m} ${j} ${o}\t${n}`).join("\n") + "\n");
  const skill = blob("---\nname: cari\n---\n"), jahat = blob("JAHAT\n");
  const kasus = {
    dotdot: [["040000", "tree", pohon([["100644", "blob", jahat, "pwn.txt"]]), ".."]],
    backslash: [["100644", "blob", jahat, "..\\..\\pwn2.txt"]],
    dotgit: [["040000", "tree", pohon([["100644", "blob", jahat, "config"]]), ".git"]],
  };
  for (const [nama, tambahan] of Object.entries(kasus)) {
    const cari = pohon([["100644", "blob", skill, "SKILL.md"], ...tambahan]);
    const akar = pohon([["040000", "tree", pohon([["040000", "tree", cari, "cari"]]), "skills"]]);
    const sha = gr(["commit-tree", akar, "-m", nama]);
    gr(["update-ref", `refs/heads/${nama}`, sha]);
    const log = [];
    const e = [{ id: "cari", jenis: "ekosistem", skill: ["cari"], repo: R, sha, jalur: "skills/cari" }];
    assert.equal(pastikan(e, "cari", { dir: C, log: (s) => log.push(s) }), 1, `${nama}: ${log.join("\n")}`);
    assert.deepEqual(fs.readdirSync(path.join(C, "skills")), [], nama);       // tidak ada folder skill / sisa sementara
    assert.ok(!fs.existsSync(path.join(C, "pwn.txt")) && !fs.existsSync(path.join(C, "pwn2.txt")) && !fs.existsSync(path.join(tmp, "pwn2.txt")), nama);
  }
  // repo diawali "-" (injeksi opsi ke git) ditolak sebelum git dijalankan
  const log = [];
  assert.equal(pastikan([{ id: "cari", jenis: "ekosistem", skill: ["cari"], repo: "--upload-pack=touch /tmp/x", sha: "0".repeat(40), jalur: "skills/cari" }], "cari", { dir: C, log: (s) => log.push(s) }), 1);
  assert.match(log.join("\n"), /diawali "-"/);
});

test("jenis ekosistem + adaptasi RudisOne: patch diterapkan sebelum aktif, versi CLI diisi, lisensi ikut, penanda = sha + hash adaptasi + cli; adaptasi tak cocok → tidak dipasang", async () => {
  const { bacaPenanda } = await import("./skill-luar.mjs");
  const C = path.join(tmp, "claude-adaptasi"); fs.mkdirSync(path.join(C, "skills"), { recursive: true });
  const R = path.join(tmp, "ekosistem-adaptasi"), ROOT = path.join(tmp, "rudisone-adaptasi");
  const tulis = (akar, rel, isi) => { const f = path.join(akar, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, isi); };
  const gr = (...a) => execFileSync("git", ["-C", R, "-c", "user.name=u", "-c", "user.email=u@x", "-c", "commit.gpgsign=false", ...a], { encoding: "utf8" }).trim();
  fs.mkdirSync(R, { recursive: true }); gr("init", "-q", "-b", "main");
  const asli = "---\nname: cari\ndescription: discover and install skills\n---\n# Cari\n\nSearch: `npx skills find q`\n\nInstall: `npx skills add owner/repo -g -y`\n";
  tulis(R, "LICENSE", "MIT License\n\nCopyright (c) Contoh\n"); tulis(R, "skills/cari/SKILL.md", asli);
  gr("add", "-A"); gr("commit", "-qm", "A"); const A = gr("rev-parse", "HEAD");
  tulis(R, "skills/cari/SKILL.md", asli.replace("Search:", "Cari:")); gr("commit", "-qam", "B"); const B = gr("rev-parse", "HEAD");
  // patch adaptasi (seperti adaptasi/<id>.patch di repo RudisOne): dibuat dengan git diff --no-index
  const kerja = fs.mkdtempSync(path.join(tmp, "buat-patch-"));
  tulis(kerja, "a/SKILL.md", asli);
  const buatPatch = (diadaptasi) => {
    tulis(kerja, "b/SKILL.md", diadaptasi);
    const p = spawnSync("git", ["diff", "--no-index", "--no-color", "a/SKILL.md", "b/SKILL.md"], { cwd: kerja, encoding: "utf8" }).stdout
      .replaceAll("a/a/SKILL.md", "a/SKILL.md").replaceAll("b/b/SKILL.md", "b/SKILL.md");
    tulis(ROOT, "adaptasi/cari.patch", p);
  };
  const adaptasi1 = asli.replace("discover and install skills", "search only (RudisOne)").replace("`npx skills find q`", "`npx -y {{RUDISONE_CLI}} find q`")
    .replace("Install: `npx skills add owner/repo -g -y`", "Install: hanya lewat bin/perkakas.sh pastikan");
  buatPatch(adaptasi1);
  const entri = (extra = {}) => [{ id: "cari", jenis: "ekosistem", skill: ["cari"], repo: R, sha: A, jalur: "skills/cari", adaptasi: "adaptasi/cari.patch",
    lisensi_berkas: "LICENSE", cli: "skills@1.2.3", ...extra }];
  const log = []; const opsi = { dir: C, root: ROOT, log: (s) => log.push(s) };
  const skillMd = () => fs.readFileSync(path.join(C, "skills", "cari", "SKILL.md"), "utf8");

  assert.equal(pastikan(entri(), "cari", opsi), 0, log.join("\n"));
  assert.match(skillMd(), /search only \(RudisOne\)/);
  assert.match(skillMd(), /`npx -y skills@1\.2\.3 find q`/);
  assert.doesNotMatch(skillMd(), /npx skills add|-g -y|\{\{RUDISONE_CLI\}\}/);
  assert.match(fs.readFileSync(path.join(C, "skills", "cari", "LICENSE"), "utf8"), /MIT License/);
  const p = bacaPenanda(C, "cari");
  assert.equal(p.sha, A);
  assert.equal(p.cli, "skills@1.2.3");
  assert.equal(p.adaptasi.berkas, "adaptasi/cari.patch");
  assert.equal(p.adaptasi.sha256, crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "adaptasi/cari.patch"))).digest("hex"));
  assert.equal(pastikan(entri(), "cari", opsi), 0);
  assert.match(log.at(-1), /tersedia \(pribadi @ [0-9a-f]{12} \+ adaptasi [0-9a-f]{8} \+ skills@1\.2\.3\)/);
  // core.autocrlf=true global (bawaan Git for Windows) tidak membuat hasil adaptasi ber-CRLF
  fs.rmSync(path.join(C, "skills", "cari"), { recursive: true });
  const envLama = { ...process.env };
  Object.assign(process.env, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "true" });
  try { assert.equal(pastikan(entri(), "cari", opsi), 0, log.join("\n")); }
  finally { for (const k of ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"]) if (envLama[k] === undefined) delete process.env[k]; else process.env[k] = envLama[k]; }
  assert.doesNotMatch(skillMd(), /\r/);
  assert.match(skillMd(), /search only \(RudisOne\)/);

  // adaptasi diubah (hash beda) atau cli diganti → versi ≠ terkunci → dipasang ulang dengan versi baru
  buatPatch(adaptasi1.replace("search only (RudisOne)", "search only (RudisOne v2)"));
  assert.match(laporan(entri(), C, ROOT)[0][1], /≠ terkunci/);
  assert.equal(pastikan(entri(), "cari", opsi), 0);
  assert.match(skillMd(), /RudisOne v2/);
  assert.equal(pastikan(entri({ cli: "skills@1.2.4" }), "cari", opsi), 0);
  assert.match(skillMd(), /skills@1\.2\.4 find q/);

  // pin ke sha B (SKILL.md berubah) tanpa memperbarui adaptasi → adaptasi tidak cocok → gagal, versi lama tetap aktif
  log.length = 0;
  assert.equal(pastikan(entri({ sha: B, cli: "skills@1.2.4" }), "cari", opsi), 1);
  assert.match(log.join("\n"), /adaptasi adaptasi\/cari\.patch tidak cocok/);
  assert.match(skillMd(), /RudisOne v2/);
  assert.deepEqual(fs.readdirSync(path.join(C, "skills")), ["cari"]);
  // berkas adaptasi tidak ada, penampung tanpa cli, lisensi tak ada, cli bukan versi persis → ditolak
  for (const [extra, pola] of [[{ adaptasi: "adaptasi/tidak-ada.patch" }, /tidak ada/], [{ cli: undefined }, /tanpa `cli`/],
    [{ lisensi_berkas: "TIDAK-ADA" }, /berkas lisensi/], [{ cli: "skills@latest" }, /versi persis/], [{ adaptasi: "../luar.patch" }, /adaptasi harus/]]) {
    fs.rmSync(path.join(C, "skills", "cari"), { recursive: true, force: true });
    log.length = 0;
    assert.equal(pastikan(entri(extra), "cari", opsi), 1, JSON.stringify(extra));
    assert.match(log.join("\n"), pola);
    assert.ok(!fs.existsSync(path.join(C, "skills", "cari")));
  }
});
