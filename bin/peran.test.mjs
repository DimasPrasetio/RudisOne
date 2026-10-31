// Uji pembangkit subagent peran: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SINI, "..");
const { bangkitkan, bangkitkanClaudeMd, bangun: bangunSemua, daftarPeran, pisahFrontmatter, jabatanDari } = await import("./peran.mjs");

function repoMini() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "peran-"));
  fs.mkdirSync(path.join(r, "agents"));
  fs.writeFileSync(path.join(r, "protokol.md"), "# Protokol inti\n\nAturan A.\n");
  fs.writeFileSync(path.join(r, "agents", "coo.md"), "---\nname: coo\ndescription: COO\n---\nPeran: **COO** RudisOne.\n");
  fs.writeFileSync(path.join(r, "agents", "research-analyst.md"), "---\nname: research-analyst\ndescription: Peneliti \"bersitasi\"\ncolor: cyan\n---\n\nPeran: **Research Analyst** di RudisOne.\n");
  return r;
}

const bangun = (r, tulis) => bangunSemua(r, tulis).filter((x) => x.id !== "CLAUDE.md" && x.jenis !== "peran-ruang");

test("frontmatter & jabatan terbaca", () => {
  const { fm, isi } = pisahFrontmatter("---\nname: x\ndescription: d: e\n---\nPeran: **Head of Strategy** di RudisOne.\n");
  assert.equal(fm.name, "x"); assert.equal(fm.description, "d: e");
  assert.equal(jabatanDari(isi, "x"), "Head of Strategy");
});

test("COO tidak dibangkitkan; berkas memuat peran, mode subagent, dan inti", () => {
  const r = repoMini();
  assert.deepEqual(daftarPeran(r), ["research-analyst"]);
  const t = bangkitkan("research-analyst", r);
  assert.match(t, /^---\nname: rudis-research-analyst\ndescription: "RudisOne · Research Analyst/);
  assert.match(t, /color: cyan/);
  assert.match(t, /Kamu adalah Research Analyst di RudisOne, dipanggil sebagai \*\*subagent\*\*/);
  assert.match(t, /Jawaban akhirmu adalah laporanmu/);
  assert.match(t, /# Protokol inti RudisOne[^\n]*\nAturan A\./);
  // deskripsi berkutip tetap YAML/JSON sah
  assert.doesNotThrow(() => JSON.parse(t.match(/^description: (.*)$/m)[1]));
});

test("bangun → cek mutakhir; sumber berubah → basi; berkas yatim dihapus", () => {
  const r = repoMini();
  assert.deepEqual(bangun(r).map((x) => x.status), ["baru"]);
  assert.deepEqual(bangun(r, false).map((x) => x.status), ["sama"]);
  fs.appendFileSync(path.join(r, "protokol.md"), "Aturan B.\n");
  assert.deepEqual(bangun(r, false).map((x) => x.status), ["basi"]);
  fs.writeFileSync(path.join(r, "agen", "rudis-lama.md"), "x");
  const h = bangun(r);
  assert.ok(h.some((x) => x.status === "yatim"));
  assert.equal(fs.existsSync(path.join(r, "agen", "rudis-lama.md")), false);
});

test("repo ini: agen/ mutakhir terhadap agents/ + protokol.md", () => {
  const out = execFileSync(process.execPath, [path.join(SINI, "peran.mjs"), "cek"], { env: { ...process.env, RUDISONE_ROOT: REPO }, encoding: "utf8" });
  assert.match(out, /mutakhir/);
});

test("CLAUDE.md = salinan protokol.md (tanpa impor @) dan ikut diperiksa", () => {
  const r = repoMini();
  const c = bangkitkanClaudeMd(r);
  assert.match(c, /^<!-- DIBANGKITKAN/);
  assert.ok(c.endsWith("# Protokol inti\n\nAturan A.\n"));
  assert.doesNotMatch(c, /^@/m);
  assert.equal(bangunSemua(r).find((x) => x.id === "CLAUDE.md").status, "baru");
  fs.appendFileSync(path.join(r, "protokol.md"), "Aturan C.\n");
  assert.equal(bangunSemua(r, false).find((x) => x.id === "CLAUDE.md").status, "basi");
});

test("salinan peran di ruang sesi: dibangkitkan, basi bila sumber berubah, symlink lama diganti berkas biasa", () => {
  const r = repoMini();
  fs.mkdirSync(path.join(r, "ruang", "research-analyst", ".claude"), { recursive: true });
  fs.mkdirSync(path.join(r, "ruang", "tanpa-peran", ".claude"), { recursive: true });
  const ruang = (tulis) => bangunSemua(r, tulis).filter((x) => x.jenis === "peran-ruang");
  assert.deepEqual(ruang(true).map((x) => [x.berkas, x.status]),
    [[".claude/agents/coo.md", "baru"], ["ruang/research-analyst/.claude/agents/research-analyst.md", "baru"]]);
  const f = path.join(r, "ruang", "research-analyst", ".claude", "agents", "research-analyst.md");
  assert.equal(fs.readFileSync(f, "utf8"), fs.readFileSync(path.join(r, "agents", "research-analyst.md"), "utf8"));
  assert.ok(ruang(false).every((x) => x.status === "sama"));
  fs.appendFileSync(path.join(r, "agents", "research-analyst.md"), "Tambahan.\n");
  assert.equal(ruang(false)[1].status, "basi");
  assert.equal(ruang(true)[1].status, "basi");
  assert.ok(ruang(false).every((x) => x.status === "sama"));
});

test("symlink peran lama dianggap basi dan diganti berkas biasa tanpa mengubah sumbernya", (t) => {
  const r = repoMini();
  fs.mkdirSync(path.join(r, ".claude", "agents"), { recursive: true });
  const f = path.join(r, ".claude", "agents", "coo.md");
  try { fs.symlinkSync(path.join("..", "..", "agents", "coo.md"), f); } catch (e) { if (e.code === "EPERM") return t.skip("symlink tidak diizinkan di device ini"); throw e; }
  const sumber = fs.readFileSync(path.join(r, "agents", "coo.md"), "utf8");
  assert.equal(bangunSemua(r, false).find((x) => x.berkas === ".claude/agents/coo.md").status, "basi");
  bangunSemua(r, true);
  assert.equal(fs.lstatSync(f).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(f, "utf8"), sumber);
  assert.equal(fs.readFileSync(path.join(r, "agents", "coo.md"), "utf8"), sumber);
});

test("salinan CRLF (Windows tanpa .gitattributes): sidik & isi sama dengan salinan LF, cek tidak menganggap basi", () => {
  const lf = repoMini();
  bangunSemua(lf, true);
  const crlf = repoMini();
  bangunSemua(crlf, true);
  // ubah SEMUA berkas teks (sumber dan hasil bangkitan) ke CRLF, seperti salinan zip/editor di Windows
  const keCrlf = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) keCrlf(f); else fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/\r?\n/g, "\r\n"));
  } };
  keCrlf(crlf);
  assert.deepEqual(bangunSemua(crlf, false).filter((x) => x.status !== "sama"), [], "CRLF tidak boleh dianggap basi");
  assert.equal(bangkitkan("research-analyst", crlf), bangkitkan("research-analyst", lf), "sidik dihitung atas bentuk LF");
  assert.equal(bangkitkanClaudeMd(crlf), bangkitkanClaudeMd(lf));
});

test("gerbang_stop → hook Stop di frontmatter subagent (T-20261031-2.3)", async () => {
  const { hookStop, bangkitkan } = await import("./peran.mjs");
  assert.deepEqual(hookStop(undefined), []);
  assert.throws(() => hookStop("x; rm -rf ~"), /tidak sah/);
  const tl = bangkitkan("tech-lead");
  const fm = tl.split("\n---\n")[0];
  assert.match(fm, /\nhooks:\n {2}Stop:\n {4}- hooks:\n {8}- type: command\n {10}command: node ~\/.+\/bin\/gerbang-tl\.mjs --hook\n {10}timeout: 60$/);
  assert.doesNotMatch(bangkitkan("software-engineer").split("\n---\n")[0], /hooks:/);
});
