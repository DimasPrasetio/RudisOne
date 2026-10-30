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
const { bangkitkan, bangun, daftarPeran, pisahFrontmatter, jabatanDari } = await import("./peran.mjs");

function repoMini() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "peran-"));
  fs.mkdirSync(path.join(r, "agents"));
  fs.writeFileSync(path.join(r, "protokol.md"), "# Protokol inti\n\nAturan A.\n");
  fs.writeFileSync(path.join(r, "agents", "coo.md"), "---\nname: coo\ndescription: COO\n---\nPeran: **COO** RudisOne.\n");
  fs.writeFileSync(path.join(r, "agents", "research-analyst.md"), "---\nname: research-analyst\ndescription: Peneliti \"bersitasi\"\ncolor: cyan\n---\n\nPeran: **Research Analyst** di RudisOne.\n");
  return r;
}

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
