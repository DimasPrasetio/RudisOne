// Uji skill luar (cek & pasang dari sumber resmi) tanpa internet: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
  assert.deepEqual(bacaPenanda(C, "cari"), { id: "cari", repo: R, sha: A, jalur: "skills/cari" });
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
