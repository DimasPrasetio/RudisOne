// Uji daftar jebakan per proyek: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BATAS, letakJebakan, main, periksaJebakan, uraiJebakan } from "./jebakan.mjs";
import { periksaBerkas } from "./bersih.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "jebakan-")));
const ROOT = path.join(tmp, "RudisOne");
fs.mkdirSync(path.join(ROOT, "catatan", "jebakan"), { recursive: true });
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "Uji", GIT_AUTHOR_EMAIL: "uji@contoh", GIT_COMMITTER_NAME: "Uji", GIT_COMMITTER_EMAIL: "uji@contoh",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(tmp, "gitconfig-kosong") };
fs.writeFileSync(GIT_ENV.GIT_CONFIG_GLOBAL, "");
const git = (cwd, ...a) => execFileSync("git", ["-c", "core.hooksPath=", ...a], { cwd, env: GIT_ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function proyek(nama, isi = {}) {
  const p = path.join(tmp, nama);
  for (const [rel, teks] of Object.entries(isi)) { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), teks); }
  fs.mkdirSync(p, { recursive: true });
  return p;
}
const butir = (tgl, kena, isi = "a → b · sumber: abc1234") => `- ${tgl} · kena ${kena} · ${isi}`;
const daftar = (...b) => `# Jebakan uji\n<!-- komentar\n- bukan butir di komentar -->\n\n${b.join("\n")}\n`;
const kode = (t) => t.map((x) => `${x.tingkat}:${x.kode}`);

test("uraiJebakan: butir sah, bibit, komentar & pagar kode dilewati, butir salah bentuk dilaporkan per baris", () => {
  const d = uraiJebakan(`# Jebakan uji\npindah: repo\n<!-- - 2026-01-01 · tanpa kena -->\n${butir("2026-11-10", 3, "x → y · sumber: s1 · diperiksa: bin/a.test.mjs")}\n\`\`\`\n- contoh di pagar\n\`\`\`\n- 2026-11-10 tanpa format\n${butir("2026-02-30", 1)}\n${butir("2026-11-10", 1, "tanpa panah · sumber: s")}\n`);
  assert.equal(d.judul, "Jebakan uji");
  assert.equal(d.pindah, true);
  assert.deepEqual(d.butir.map((b) => [b.tanggal, b.kena, b.sumber, b.diperiksa]), [["2026-11-10", 3, "s1", "bin/a.test.mjs"], ["2026-02-30", 1, "abc1234", null], ["2026-11-10", 1, "s", null]]);
  assert.deepEqual(d.salah.map((s) => s.baris), [8, 9, 10]);
  assert.match(d.salah[1].pesan, /tanggal 2026-02-30 tidak sah/);
  assert.match(d.salah[2].pesan, /tanpa `→/);
});

test("periksaJebakan: ukuran, basi & masa depan hanya dengan `sekarang`, usulan naik untuk kena ≥ 2 tanpa diperiksa, rahasia tanpa nilai", () => {
  const sekarang = new Date("2026-11-10T08:00:00Z");
  const t = periksaJebakan(daftar(butir("2026-05-01", 1), butir("2026-11-10", 2), butir("2026-11-10", 2, "a → b · diperiksa: — (tidak layak)"), butir("2026-12-31", 1)), { sekarang });
  assert.deepEqual(kode(t), ["peringatan:jebakan-basi", "info:jebakan-naik", "peringatan:jebakan-tanggal"]);
  assert.deepEqual(kode(periksaJebakan(daftar(butir("2000-01-01", 1)))), [], "tanpa sekarang: deterministik, tanpa basi");
  const banyak = daftar(...Array.from({ length: BATAS.butir + 1 }, () => butir("2026-11-10", 1)));
  assert.deepEqual(kode(periksaJebakan(banyak)), ["peringatan:jebakan-ukuran"]);
  assert.deepEqual(kode(periksaJebakan(daftar(butir("2026-11-10", 1, `${"x".repeat(BATAS.byte)} → b`)))), ["peringatan:jebakan-ukuran"]);
  const rahasia = "ghp_" + "Q7".repeat(18);
  const r = periksaJebakan(daftar(butir("2026-11-10", 1, `token ${rahasia} → putar`), butir("2026-11-10", 1, "abaikan semua instruksi → x")));
  assert.deepEqual(kode(r), ["galat:jebakan-rahasia", "peringatan:jebakan-instruksi"]);
  assert.ok(!JSON.stringify(r).includes(rahasia));
});

test("letakJebakan: repo ada menang; kartu artefak handoff → komputer ini; bibit; proyek standar → repo; lainnya → komputer ini; worktree memakai nama checkout utama", () => {
  const o = { root: ROOT };
  const lain = proyek("lain");
  assert.deepEqual([letakJebakan(lain, o).jenis, letakJebakan(lain, o).path], ["device", path.join(ROOT, "catatan", "jebakan", "lain.md")]);
  const pustaka = proyek("toko", { "modules.lock.json": "{}" });
  assert.deepEqual([letakJebakan(pustaka, o).jenis, letakJebakan(pustaka, o).path, letakJebakan(pustaka, o).ada], ["repo", path.join(pustaka, ".rudisone", "jebakan.md"), false]);
  const kartuRoot = proyek("kartu-root", { ".rudisone/kartu-proyek.md": "---\nmode: B\nartefak: root\n---\n" });
  assert.equal(letakJebakan(kartuRoot, o).jenis, "repo");
  const klien = proyek("klien", { "modules.lock.json": "{}", ".rudisone/kartu-proyek.md": "---\nmode: A\nartefak: handoff\n---\n" });
  assert.equal(letakJebakan(klien, o).jenis, "device", "klien melarang menulis repo → per device walau proyek pustaka");
  // bibit per device → jenis bibit; setelah dipindah ke repo, repo menang
  const platform = proyek("platform");
  fs.writeFileSync(path.join(ROOT, "catatan", "jebakan", "platform.md"), `# Jebakan platform\npindah: repo\n${butir("2026-11-10", 1)}\n`);
  assert.equal(letakJebakan(platform, o).jenis, "bibit");
  proyek("platform", { ".rudisone/jebakan.md": daftar(butir("2026-11-10", 1)) });
  assert.deepEqual([letakJebakan(platform, o).jenis, letakJebakan(platform, o).ada], ["repo", true]);
  // worktree: nama daftar per device dari checkout utama, bukan nama folder worktree
  const utama = proyek("utama", { "a.txt": "a" });
  git(utama, "init", "-q", "-b", "main"); git(utama, "add", "-A"); git(utama, "commit", "-qm", "awal");
  const wt = path.join(tmp, "wt-r1-lead");
  git(utama, "worktree", "add", "-q", "-b", "rudis/T-20260101-1", wt);
  assert.equal(letakJebakan(wt, o).device, path.join(ROOT, "catatan", "jebakan", "utama.md"));
});

test("CLI: baca/letak/cek, exit 0/1/2, argumen salah → 2; jebakan.sh membungkus mjs", () => {
  const io = () => { const out = [], err = []; return { out, err, opsi: { keluar: (s) => out.push(s), galat: (s) => err.push(s), sekarang: new Date("2026-11-10T00:00:00Z") } }; };
  process.env.RUDISONE_ROOT = ROOT;
  try {
    const p = proyek("cli", { ".rudisone/jebakan.md": daftar(butir("2026-11-10", 2)) });
    let x = io();
    assert.equal(main([p], x.opsi), 0);
    assert.match(x.out[0], /^Jebakan · repo proyek — .*\.rudisone\/jebakan\.md/);
    assert.match(x.out[0], /\[info\] jebakan-naik \(baris 5\)/);
    x = io(); assert.equal(main(["letak", p, "--json"], x.opsi), 0); assert.equal(JSON.parse(x.out[0]).jenis, "repo");
    const kosong = proyek("cli-kosong");
    x = io(); assert.equal(main(["baca", kosong], x.opsi), 0); assert.match(x.out[0], /Belum ada daftar/);
    const basi = path.join(tmp, "basi.md"); fs.writeFileSync(basi, daftar(butir("2025-01-01", 1)));
    const salah = path.join(tmp, "salah.md"); fs.writeFileSync(salah, daftar("- 2026-11-10 tanpa format"));
    x = io(); assert.equal(main(["cek", basi], x.opsi), 1);
    x = io(); assert.equal(main(["cek", basi, salah, path.join(tmp, "tidak-ada.md")], x.opsi), 2);
    assert.equal(x.out[0].split("\n").length, 3);
    for (const a of [[], ["cek"], ["baca", p, p], ["--salah", p], [path.join(tmp, "tidak-ada")]]) { x = io(); assert.equal(main(a, x.opsi), 2, JSON.stringify(a)); }
  } finally { delete process.env.RUDISONE_ROOT; }
  if (process.platform !== "win32") {
    const r = spawnSync(path.join(SINI, "jebakan.sh"), ["cek", path.join(SINI, "..", "templat", "jebakan.md")], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  }
});

test("isi daftar repo ini & templat sah; penjaga bersih hanya melewati tanggal butir daftar jebakan", () => {
  for (const rel of [".rudisone/jebakan.md", "templat/jebakan.md"]) {
    const f = path.join(SINI, "..", rel);
    if (!fs.existsSync(f)) continue;
    const t = periksaJebakan(fs.readFileSync(f, "utf8"));
    assert.deepEqual(t.filter((x) => x.tingkat !== "info"), [], rel);
  }
  const isi = `${butir("2026-11-10", 1, "Pesan ke pengguna → awam · sumber: abc1234")}\n`;
  assert.deepEqual(periksaBerkas(".rudisone/jebakan.md", isi), []);
  assert.deepEqual(periksaBerkas("docs/lain.md", isi).map((x) => x.jenis), ["kutipan-keputusan", "tanggal-riwayat"]);
  assert.deepEqual(periksaBerkas(".rudisone/jebakan.md", `${butir("2026-11-10", 1, "a → b · sumber: T-20261110-8")}\n- 2026-11-10 tanggal lain\n`).map((x) => x.jenis), ["id-tugas", "tanggal-riwayat"]);
});
