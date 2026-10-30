// Uji pemeriksa konsistensi: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SINI, "..");
const SKRIP = path.join(SINI, "cek-konsistensi.mjs");

/** Repo mini yang bersih; `ubah` memodifikasi sebelum pemeriksaan. */
function repoMini(ubah = () => {}) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "cek-"));
  const tulis = (rel, isi) => { fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true }); fs.writeFileSync(path.join(r, rel), isi); };
  tulis("protokol.md", "# Protokol inti\n\n## Model sesi\nAturan A: sesi inti.\n\nLihat skill `rudis-contoh` › Langkah dan `raci.md`.\n");
  tulis("raci.md", "# RACI\n\n## Matriks\nx\n");
  tulis("agents/coo.md", "---\nname: coo\ndescription: COO\n---\nPeran: **COO** RudisOne. Lihat `protokol.md` › Model sesi.\n");
  tulis("agents/research-analyst.md", "---\nname: research-analyst\ndescription: RA\n---\nPeran: **Research Analyst** di RudisOne.\n");
  tulis("skills/rudis-contoh/SKILL.md", "---\nname: rudis-contoh\ndescription: contoh\n---\n# Contoh\n## Langkah\n1. a\n");
  tulis("docs/pemetaan-aturan-v5.md", "| Kode | Aturan lama | Lokasi baru | Jangkar | Status |\n|---|---|---|---|---|\n| P-001 | x | protokol.md | Aturan A: sesi inti. | tetap |\n| P-002 | y | dihapus | kalimat persona | dihapus |\n");
  ubah(tulis, r);
  execFileSync(process.execPath, [path.join(SINI, "peran.mjs"), "bangun"], { env: { ...process.env, RUDISONE_ROOT: r }, stdio: "ignore" });
  return r;
}
function periksa(r, ...arg) {
  const p = spawnSync(process.execPath, [SKRIP, "--repo", "--json", ...arg], { env: { ...process.env, RUDISONE_ROOT: r }, encoding: "utf8" });
  return { kode: p.status, temuan: JSON.parse(p.stdout || "[]") };
}
const kodeTemuan = (h) => h.temuan.filter((t) => t.tingkat === "galat").map((t) => t.kode).sort();

test("repo mini bersih → exit 0", () => {
  const h = periksa(repoMini());
  assert.deepEqual(h.temuan, []);
  assert.equal(h.kode, 0);
});

test("path yang dirujuk tidak ada → galat path", () => {
  const h = periksa(repoMini((t) => t("agents/coo.md", "---\nname: coo\ndescription: d\n---\nPakai `bin/tidak-ada.sh` dan `templat/x.md`; `handoff/<ID>/` & `TEAM.md` per device.\n")));
  assert.deepEqual(kodeTemuan(h), ["path", "path"]);
  assert.equal(h.kode, 2);
});

test("rujukan bagian yang tidak ada → galat rujukan; yang ada lolos", () => {
  const h = periksa(repoMini((t) => t("agents/coo.md", "---\nname: coo\ndescription: d\n---\nLihat `protokol.md` › Bagian Hantu dan skill `rudis-contoh` › Langkah.\n")));
  assert.deepEqual(kodeTemuan(h), ["rujukan"]);
  assert.match(h.temuan[0].pesan, /Bagian Hantu/);
});

test("nama rudis-… tak dikenal → galat; skill, subagent rudis-<peran>, dan nama sesi singkat sah", () => {
  const h = periksa(repoMini((t) => t("agents/coo.md", "---\nname: coo\ndescription: d\n---\nPakai `rudis-hantu`, `rudis-contoh`, `rudis-research-analyst`, `rudis-sysadmin`.\n")));
  assert.deepEqual(kodeTemuan(h), ["skill-rujukan"]);
  assert.match(h.temuan[0].pesan, /rudis-hantu/);
});

test("inti > 200 baris dan CLAUDE.md/subagent basi → galat", () => {
  const r = repoMini();
  fs.appendFileSync(path.join(r, "protokol.md"), "x\n".repeat(200));
  const h = periksa(r);
  assert.deepEqual(kodeTemuan(h), ["inti-muat", "inti-ukuran", "subagent"]);
});

test("skill: name ≠ folder → galat", () => {
  const h = periksa(repoMini((t) => t("skills/rudis-contoh/SKILL.md", "---\nname: lain\ndescription: d\n---\n## Langkah\n")));
  assert.deepEqual(kodeTemuan(h), ["skill-nama"]);
});

test("pemetaan: jangkar tidak ada, lokasi tidak ada, dihapus tanpa alasan → galat", () => {
  const h = periksa(repoMini((t) => t("docs/pemetaan-aturan-v5.md", "| Kode | Aturan lama | Lokasi baru | Jangkar | Status |\n|---|---|---|---|---|\n| P-001 | x | protokol.md | Teks yang tidak ada | tetap |\n| P-002 | y | skills/hantu.md | z | tetap |\n| P-003 | z | dihapus |  | dihapus |\n")));
  assert.deepEqual(kodeTemuan(h), ["pemetaan", "pemetaan", "pemetaan"]);
});

test("pemetaan: jangkar dengan \\| dan baris baru di sumber tetap cocok", () => {
  const h = periksa(repoMini((t) => {
    t("protokol.md", "# Protokol inti\n\n## Model sesi\n| a | b |\n|---|---|\n| LULUS \\| PERLU | baris\nlanjut |\n");
    t("docs/pemetaan-aturan-v5.md", "| Kode | Aturan lama | Lokasi baru | Jangkar | Status |\n|---|---|---|---|---|\n| P-001 | x | protokol.md | LULUS \\\\| PERLU \\| baris lanjut | tetap |\n");
  }));
  assert.deepEqual(kodeTemuan(h), []);
});

test("repo ini: --repo bersih (rujukan, path, skill, inti, subagent, pemetaan 100% terhadap 3b1c888)", () => {
  const p = spawnSync(process.execPath, [SKRIP, "--repo", "--json", "--ref", "3b1c888"], { cwd: REPO, env: { ...process.env, RUDISONE_ROOT: REPO }, encoding: "utf8" });
  const t = JSON.parse(p.stdout || "[]");
  assert.deepEqual(t.filter((x) => x.tingkat !== "info"), []);
  assert.equal(p.status, 0);
});

test("pencocokan bagian tidak longgar: judul satu kata + kata palsu, dan judul di dalam pagar kode", () => {
  const h = periksa(repoMini((t) => {
    t("skills/rudis-contoh/SKILL.md", "---\nname: rudis-contoh\ndescription: contoh\n---\n# Contoh\n## Akun\nx\n```\n# Hantu\n```\n## Langkah\n1. a\n");
    t("agents/coo.md", "---\nname: coo\ndescription: d\n---\nLihat skill `rudis-contoh` › Akun palsu xyz dan skill `rudis-contoh` › Hantu.\n");
  }));
  assert.deepEqual(kodeTemuan(h), ["rujukan", "rujukan"]);
});

test("rujukan bagian ke berkas per device (TEAM.md) tidak diperiksa, walau berkasnya ada di device", () => {
  const h = periksa(repoMini((t) => {
    t("TEAM.md", "# TEAM\n\n## Engineering · Tim 2 · proyek-x\n");
    t("agents/coo.md", "---\nname: coo\ndescription: d\n---\nLihat `TEAM.md` › Engineering · Tim <n>.\n");
  }));
  assert.deepEqual(kodeTemuan(h), []);
});
