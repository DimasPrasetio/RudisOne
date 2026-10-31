// Uji penjaga kebersihan repo (bin/bersih.mjs + .githooks/pre-commit): kasus tolak & lolos.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dikecualikan, periksaBerkas, periksaStaged, periksaTerlacak } from "./bersih.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SINI, "..");
const jenis = (rel, teks) => periksaBerkas(rel, teks).map((t) => t.jenis);
// ID & tanggal disusun dari potongan agar berkas uji ini sendiri tidak tampak seperti sisa pemakaian
const ID = ["T", "20261031", "4"].join("-");
const TGL = ["2026", "10", "31"].join("-");

test("ID tugas di berkas produk ditolak; ID contoh T-20260101-n dan pola T-YYYYMMDD-n lolos", () => {
  assert.deepEqual(jenis("agents/coo.md", `Pelajaran (${ID}): x.`), ["id-tugas"]);
  assert.deepEqual(jenis("skills/rudis-sdd/SKILL.md", `riset ${ID}.2 §4`), ["id-tugas"]);
  assert.deepEqual(jenis("bin/kebijakan.mjs", `// ${ID}: komentar`), ["id-tugas"]);
  assert.deepEqual(jenis("protokol.md", "mis. `[Tugas dari COO] T-20260101-2 · Perbaikan cetak SJ`"), []);
  assert.deepEqual(jenis("templat/brief-tugas.md", "ID `T-YYYYMMDD-n` (sub-tugas `T-YYYYMMDD-n.k`)"), []);
});

test("kutipan keputusan bertanggal ditolak di berkas apa pun; tanggal teknis di kode dan templat YYYY-MM-DD lolos", () => {
  for (const s of [`(pengguna ${TGL}: "Agent siapkan sendiri")`, `izin tetap sejak ${TGL}`, `**Izin tetap pengguna** (${TGL},`,
    `disetujui ${TGL}`, `${TGL}: "utamakan otomatis"`, `${TGL} — disetujui pemilik`])
    assert.deepEqual(jenis("bin/install-x.mjs", `// ${s}`), ["kutipan-keputusan"], s);
  // di dokumen (*.md) tanggal apa pun juga ditolak sebagai riwayat
  assert.deepEqual(jenis("skills/rudis-sdlc/SKILL.md", `izin tetap sejak ${TGL}`), ["kutipan-keputusan", "tanggal-riwayat"]);
  for (const [rel, s] of [["bin/metrik.mjs", `// contoh --sejak ${TGL} (tanggal teknis)`], ["kantor/server.mjs", `const contoh = "${TGL}T10:00:00Z";`],
    ["templat/intake-proyek.md", "- Disetujui pengguna (kesepakatan pemahaman bersama): YYYY-MM-DD HH:MM — \"<kutipan persis>\""]])
    assert.deepEqual(jenis(rel, s), [], s);
});

test("nama sistem agent pendahulu ditolak; frasa umum 'tim agent' lolos", () => {
  const lama = ["Tim", "Agent"];
  assert.deepEqual(jenis("skills/rudis-operasi/SKILL.md", `(mis. ${lama.join("")}) tidak disentuh`), ["sistem-lama"]);
  assert.deepEqual(jenis("README.md", `sesi ${lama.join(" ")} lama`), ["sistem-lama"]);
  assert.deepEqual(jenis("README.md", "Tim agent Claude Code milik pengguna, di level device"), []);
});

test("riwayat bertanggal, kode temuan lama, dan narasi uji ditolak (juga kantor/*.md); label fungsional & placeholder lolos", () => {
  const masukan = ["Masukan", "pengguna"].join(" ");
  assert.deepEqual(jenis("kantor/DESAIN.md", `${masukan} atas v3: jelek, sempit.`), ["narasi-uji"]);
  assert.deepEqual(jenis("kantor/DESAIN.md", `## v7 — IT Operations saat dibutuhkan (${TGL})`), ["tanggal-riwayat"]);
  assert.deepEqual(jenis("perkakas.json", `"catatan": "versi ${TGL} diuji"`), ["tanggal-riwayat"]);
  assert.deepEqual(jenis("skills/rudisone/backend-cli.md", ["Uji dengan", "pengguna (U4–U6): pengguna menjalankan claude"].join(" ")), ["kode-temuan", "narasi-uji"]);
  assert.deepEqual(jenis("skills/rudis-sdd/SKILL.md", "Dasar: kajian kelayakan (S1–S8, K1–K12), riset"), ["kode-temuan"]);
  assert.deepEqual(jenis("bin/kebijakan.mjs", "// klien mysql dari PATH saja (U3 M1)"), ["kode-temuan"]);
  assert.deepEqual(jenis("skills/rudis-sdd/SKILL.md", "Hanya COO yang bertanya ke pengguna (S6, K5)"), ["kode-temuan"]);
  // lolos: label fungsional yang tampil di keluaran & diuji, placeholder templat, tanggal di kode, frasa umum
  for (const [rel, s] of [["bin/perkakas.mjs", "ragu.push(\"lock rusak (D6)\")"], ["bin/metrik.mjs", "Beban keputusan (X14): 3"],
    ["agents/coo.md", "Ukur: `node bin/metrik.mjs tugas <ID>` (X14)."], ["bin/env-kunci.mjs", "butuh daftar kunci (K1,K2)"],
    ["bin/cek-konsistensi.mjs", "// tabel pemetaan (R7)"], ["templat/catatan.md", "poin `YYYY-MM-DD` + status"],
    ["bin/metrik.mjs", `// contoh: --sejak ${TGL}`], ["skills/rudis-riset-desain/SKILL.md", "saat pengguna mengeluh desain kuno"],
    ["skills/rudis-sdd/SKILL.md", "ikuti tabel §8 (namanya sama)"], ["agents/software-engineer.md", "validasi masukan pengguna di form"],
    ["bin/x.mjs", "// validasi masukan pengguna (user input) di sisi server"], ["skills/x/SKILL.md", "Bila pengguna melaporkan bug, catat di register."],
    ["bin/x.mjs", "const h = hash(x); // (MD5) hanya untuk sidik"], ["bin/cek-konsistensi.mjs", "// aturan baru (R10)"]])
    assert.deepEqual(jenis(rel, s), [], `${rel}: ${s}`);
});

test("laporan uji device, tabel migrasi, dan berkas handoff/ ditolak dari path-nya; suite & simulasi lolos", () => {
  assert.deepEqual(jenis("uji/macos.md", "# Hasil uji"), ["berkas-terlarang"]);
  assert.deepEqual(jenis("docs/pemetaan-aturan-v6.md", "| Kode |"), ["berkas-terlarang"]);
  assert.deepEqual(jenis("handoff/T-20260101-1/hasil.md", "x"), ["berkas-terlarang"]);
  assert.deepEqual(jenis("handoff/.gitkeep", ""), []);
  assert.deepEqual(jenis("uji/suite/README.md", `fixture ${ID}`), []);
  assert.deepEqual(jenis("uji/simulasi-linux/jalankan.sh", `# ${ID}`), []);
});

test("tes & fixture dikecualikan: ID tugas sebagai penanda regresi tetap boleh", () => {
  for (const rel of ["bin/kebijakan.test.mjs", "kantor/uji.test.mjs", "bin/lib/uji-util.mjs", "uji/suite/fixture/TEAM.md", ".github/workflows/ci.yml", ".claude/launch.json"])
    assert.ok(dikecualikan(rel), rel);
  assert.deepEqual(jenis("bin/kebijakan.test.mjs", `test("regresi ${ID}: x", () => {})`), []);
  assert.ok(!dikecualikan("bin/kebijakan.mjs"));
  assert.ok(!dikecualikan("uji/macos.md"));
});

test("repo ini: semua berkas terlacak bersih", () => {
  const t = periksaTerlacak(REPO);
  assert.ok(Array.isArray(t), "bukan repo git?");
  assert.deepEqual(t, []);
});

/** Repo git sementara dengan hook pre-commit RudisOne aktif (core.hooksPath .githooks), seperti setelah install.sh. */
function repoUji() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "bersih-"));
  const git = (...a) => spawnSync("git", ["-C", r, "-c", "user.email=u@contoh.test", "-c", "user.name=u", "-c", "commit.gpgsign=false", ...a], { encoding: "utf8" });
  git("init", "-q");
  for (const rel of ["bin/bersih.mjs", ".githooks/pre-commit"]) {
    fs.mkdirSync(path.join(r, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(REPO, rel), path.join(r, rel));
  }
  fs.chmodSync(path.join(r, ".githooks", "pre-commit"), 0o755);
  git("config", "core.hooksPath", ".githooks");
  git("add", "-A");
  assert.equal(git("commit", "-qm", "awal").status, 0);
  return { r, git, tulis: (rel, isi) => { fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true }); fs.writeFileSync(path.join(r, rel), isi); } };
}

test("pre-commit: menolak ID tugas, kutipan bertanggal, dan laporan uji device; menerima isi bersih dan tes ber-ID", () => {
  const { r, git, tulis } = repoUji();
  const commit = (pesan) => git("commit", "-qm", pesan);

  tulis("agents/coo.md", `Pelajaran ${ID}: dokumen harus bisa dibuka.\n`);
  git("add", "-A");
  let c = commit("tolak id");
  assert.notEqual(c.status, 0, "commit ber-ID tugas harus ditolak");
  assert.match(c.stderr, /agents\/coo\.md:1 \[id-tugas\]/);
  assert.deepEqual(periksaStaged(r).map((t) => t.jenis), ["id-tugas"]);

  tulis("agents/coo.md", `Izin tetap (pengguna ${TGL}: "siapkan sendiri").\n`);
  git("add", "-A");
  c = commit("tolak kutipan");
  assert.notEqual(c.status, 0);
  assert.match(c.stderr, /\[kutipan-keputusan\]/);

  tulis("agents/coo.md", "Izin tetap (aturan bawaan): agent menyiapkannya sendiri.\n");
  tulis("uji/windows-hasil.md", "# Hasil uji di device pemilik\n");
  git("add", "-f", "-A");
  c = commit("tolak laporan uji");
  assert.notEqual(c.status, 0);
  assert.match(c.stderr, /uji\/windows-hasil\.md \[berkas-terlarang\]/);

  git("rm", "-q", "--cached", "uji/windows-hasil.md");
  tulis("bin/contoh.test.mjs", `test("regresi ${ID}", () => {});\n`);
  git("add", "agents/coo.md", "bin/contoh.test.mjs");
  c = commit(`feat: aturan bawaan (kutipan keputusan ${TGL} cukup di pesan commit)`);
  assert.equal(c.status, 0, c.stderr);
  assert.match(git("log", "-1", "--format=%s").stdout, /aturan bawaan/);
});

test("CLI: exit 0 bersih · 1 temuan · 2 bukan repo git", () => {
  const { r, tulis } = repoUji();
  const jalan = (...a) => spawnSync(process.execPath, [path.join(REPO, "bin", "bersih.mjs"), ...a], { env: { ...process.env, RUDISONE_ROOT: r }, encoding: "utf8" });
  assert.equal(jalan().status, 0);
  tulis("README.md", `Lihat ${ID}.\n`);
  spawnSync("git", ["-C", r, "add", "README.md"]);
  assert.equal(jalan().status, 1);
  assert.equal(jalan("--staged").status, 1);
  const kosong = fs.mkdtempSync(path.join(os.tmpdir(), "bersih-bukan-git-"));
  assert.equal(spawnSync(process.execPath, [path.join(REPO, "bin", "bersih.mjs")], { env: { ...process.env, RUDISONE_ROOT: kosong, GIT_CEILING_DIRECTORIES: path.dirname(kosong) }, encoding: "utf8" }).status, 2);
});
