// Uji cek kunci .env tanpa nilai (T-20261031-2.3): node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jalankanSh } from "./lib/uji-util.mjs";
import { periksa, statusNilai, uraiEnv, uraiFallback, uraiArgumen, main } from "./env-kunci.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const SH = path.join(SINI, "env-kunci.sh");
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "env-kunci-")));
let nomor = 0;
/** Folder baru berisi berkas { nama: isi }. */
const folder = (berkas = {}) => {
  const d = path.join(tmp, `f${nomor++}`);
  fs.mkdirSync(d);
  for (const [n, isi] of Object.entries(berkas)) fs.writeFileSync(path.join(d, n), isi);
  return d;
};
/** Jalankan main() dengan keluaran ditangkap. */
const jalan = (argv, cwd) => {
  let out = "", err = "";
  const kode = main(argv, { cwd, tulis: (s) => { out += s; }, tulisGalat: (s) => { err += s; } });
  return { kode, out, err };
};
const status = (r) => Object.fromEntries(r.kunci.map((k) => [k.nama, k.status]));

test("statusNilai: kosong, placeholder (semua pola), terisi", () => {
  for (const v of ["", "   "]) assert.equal(statusNilai(v), "kosong");
  for (const v of ["__ISI_TOKEN__", "changeme", "CHANGE_ME", "change-me", "<isi di sini>", "<>", "xxx", "XXXXXX",
    "todo", "TODO", "isi", "isi-di-sini", "your-api-key", "your_token", " changeme "]) assert.equal(statusNilai(v), "placeholder", v);
  for (const v of ["rahasia123", "__abc__", "xx", "<a", "yours", "todo-list", "0", "false"]) assert.equal(statusNilai(v), "terisi", v);
});

test("parser: kunci kosong dipertahankan, export, kutip, komentar — parseEnv dan fallback sepakat soal status", () => {
  const teks = [
    "# komentar", "", "A=", 'B=""', "C=''", "D=``", "export E=nilai", "F = 'q w'", 'G="a\\nb"', "H=x # komentar",
    "I=`b`", "J=changeme", "  K=  ", "1BUKAN=x", "baris tanpa sama dengan", "L.M-N=ok",
  ].join("\r\n");
  for (const paksaFallback of [false, true]) {
    const m = uraiEnv(teks, { paksaFallback });
    const st = Object.fromEntries([...m].map(([k, v]) => [k, statusNilai(v)]));
    assert.deepEqual(st, {
      A: "kosong", B: "kosong", C: "kosong", D: "kosong", E: "terisi", F: "terisi", G: "terisi", H: "terisi",
      I: "terisi", J: "placeholder", K: "kosong", "L.M-N": "terisi",
    }, `paksaFallback=${paksaFallback}`);
  }
  assert.equal(uraiFallback('X="satu\ndua"\nY=1').get("Y"), "1");          // kutip multi-baris tidak menelan kunci berikutnya
  assert.deepEqual([...uraiEnv("Z=1\nB=2\nA=3\n").keys()], ["Z", "B", "A"]); // urutan berkas (parseEnv mengurutkan abjad)
  assert.deepEqual(periksa("A=1\n", { contohTeks: "Z=\nB=\nA=\n" }).kunci.map((k) => k.nama), ["Z", "B", "A"]);
});

test("setiap status: terisi, kosong, placeholder, hilang, tambahan", () => {
  const r = periksa("A=1\nB=\nC=changeme\nE=1\n", { contohTeks: "A=\nB=\nC=\nD=\n" });
  assert.deepEqual(status(r), { A: "terisi", B: "kosong", C: "placeholder", D: "hilang", E: "tambahan" });
  assert.deepEqual(r.kunci.map((k) => k.nama), ["A", "B", "C", "D", "E"]);
  assert.equal(r.exit, 3);
  // tanpa contoh: tidak ada "tambahan"; wajib yang tidak di contoh tidak dianggap tambahan
  assert.deepEqual(status(periksa("A=1\nZ=2\n", {})), { A: "terisi", Z: "terisi" });
  assert.equal(status(periksa("A=1\nZ=2\n", { contohTeks: "A=\n", wajib: ["Z"] })).Z, "terisi");
});

test("exit 0 / 3 / 4 dan urutan: wajib & grup dulu", () => {
  assert.deepEqual([periksa("A=1\nB=2\n", { wajib: ["A", "B"] }).exit, periksa("A=1\nB=2\n", { wajib: ["A", "B"] }).hasil], [0, "lengkap"]);
  assert.equal(periksa("A=1\nB=\n", { wajib: ["A", "B"] }).exit, 3);
  assert.equal(periksa("A=1\n", { wajib: ["A", "B"] }).exit, 3);
  const ph = periksa("A=1\nB=<isi>\n", { wajib: ["A", "B"] });
  assert.deepEqual([ph.exit, ph.hasil], [4, "placeholder"]);
  assert.equal(periksa("A=\nB=<isi>\n", { wajib: ["A", "B"] }).exit, 3);   // kurang menang atas placeholder
  assert.equal(periksa("A=1\nB=\n", { wajib: ["A"] }).exit, 0);            // B bukan wajib
  assert.equal(periksa("A=1\nB=\n", { contohTeks: "A=\nB=\n" }).exit, 3);  // bawaan: semua kunci contoh wajib
  assert.equal(periksa("A=1\nB=\n", { contohTeks: "A=\nB=\n", wajib: ["A"] }).exit, 0);
  assert.equal(periksa("A=1\n", { contohTeks: "A=\nB=\n", salahSatu: [["A"]] }).exit, 0); // hanya grup → contoh tidak wajib
  assert.deepEqual(periksa("Z=1\nB=1\nA=1\n", { wajib: ["A"], salahSatu: [["B"]] }).kunci.map((k) => k.nama), ["A", "B", "Z"]);
  assert.equal(periksa(null, {}).exit, 3);                                    // berkas tidak ada
});

test("--salah-satu DB_DSN,DATABASE_URL", () => {
  const ss = { salahSatu: [["DB_DSN", "DATABASE_URL"]] };
  assert.equal(periksa("DB_DSN=mysql://u@h/db\nDATABASE_URL=\n", ss).exit, 0);
  assert.equal(periksa("DATABASE_URL=postgres://h/db\n", ss).exit, 0);
  assert.equal(periksa("DB_DSN=\nDATABASE_URL=\n", ss).exit, 3);
  assert.equal(periksa("APP=1\n", ss).exit, 3);
  assert.equal(periksa("DB_DSN=changeme\nDATABASE_URL=\n", ss).exit, 4);
  const d = folder({ ".env": "DB_DSN=\nDATABASE_URL=rahasia-sekali\n" });
  assert.equal(jalan(["--salah-satu", "DB_DSN,DATABASE_URL"], d).kode, 0);
  fs.writeFileSync(path.join(d, ".env"), "DB_DSN=\nDATABASE_URL=\n");
  const r = jalan(["--salah-satu=DB_DSN,DATABASE_URL", "--salah-satu", "X"], d);
  assert.equal(r.kode, 3);
  assert.match(r.out, /^DB_DSN\s+kosong$/m);
  assert.match(r.out, /^X\s+hilang$/m);
  assert.match(r.out, /^Hasil: kurang \(exit 3\)$/m);
});

test("CLI: berkas tidak ada → exit 3; contoh bawaan; --contoh; teks & JSON", () => {
  const kosong = folder({ ".env.example": "A=\nB=\n" });
  let r = jalan([], kosong);
  assert.equal(r.kode, 3);
  assert.match(r.out, /^berkas tidak ada: .*\.env$/m);
  assert.match(r.out, /^A\s+hilang$/m);
  assert.equal(jalan(["tidak-ada.env", "--wajib", "A"], folder()).kode, 3);

  const d = folder({ ".env": "A=nilai-satu\nB=\nC=nilai-dua\n", ".env.example": "A=\nB=\n", "app.env": "A=1\n", "app.env.example": "A=\n" });
  r = jalan([], d);
  assert.equal(r.kode, 3);
  assert.equal(r.out, "A  terisi\nB  kosong\nC  tambahan\nHasil: kurang (exit 3)\n");
  assert.equal(r.err, "");
  assert.equal(jalan(["app.env"], d).kode, 0);                                 // <berkas>.example didahulukan
  fs.rmSync(path.join(d, "app.env.example"));
  assert.equal(jalan(["app.env"], d).kode, 3);                                 // lalu .env.example (B hilang)
  assert.equal(jalan(["--contoh", "app.env", ".env"], d).kode, 0);              // --contoh eksplisit: hanya A

  r = jalan(["--json", "--wajib", "A"], d);
  assert.equal(r.kode, 0);
  const j = JSON.parse(r.out);
  assert.deepEqual(Object.keys(j), ["berkas", "contoh", "ada", "kunci", "hasil", "exit"]);
  assert.equal(j.berkas, path.join(d, ".env"));
  assert.equal(j.contoh, path.join(d, ".env.example"));
  assert.deepEqual(j.kunci, [{ nama: "A", status: "terisi" }, { nama: "B", status: "kosong" }, { nama: "C", status: "tambahan" }]);
  assert.deepEqual([j.ada, j.hasil, j.exit], [true, "lengkap", 0]);
  assert.equal(JSON.parse(jalan(["--json"], folder()).out).ada, false);
  assert.equal(JSON.parse(jalan(["--json"], folder()).out).contoh, null);

  r = jalan(["--wajib", "A"], folder({ ".env": "A=__ISI__\n" }));
  assert.deepEqual([r.kode, r.out.trim().split("\n").at(-1)], [4, "Hasil: placeholder (exit 4)"]);
  r = jalan(["--help"], folder());
  assert.equal(r.kode, 0);
  assert.match(r.out, /^Pemakaian: bin\/env-kunci\.sh/);
});

test("CLI exit 1: argumen salah, contoh tidak ada, berkas tak terbaca — pesan tanpa isi", () => {
  const d = folder({ ".env": "A=nilai-rahasia\n" });
  for (const argv of [["--entah"], ["--wajib"], ["--wajib", ","], ["--wajib", "1X"], ["a", "b"], ["--", "a", "b"],
    ["--contoh", "tidak-ada"], ["--contoh", ""], [""]]) {
    const r = jalan(argv, d);
    assert.equal(r.kode, 1, JSON.stringify(argv));
    assert.equal(r.out, "");
    assert.match(r.err, /^\[env-kunci\] galat: /);
  }
  fs.mkdirSync(path.join(d, "folder.env"));
  const r = jalan(["folder.env"], d);
  assert.equal(r.kode, 1);
  assert.match(r.err, /berkas tak terbaca: .*folder\.env \(EISDIR\)/);
  assert.equal(jalan(["--contoh", "folder.env"], d).kode, 1);
  assert.deepEqual(uraiArgumen(["--", "-aneh.env"]).berkas, "-aneh.env");
  assert.equal(jalan(["--", ".env"], d).kode, 0);
});

test("pembungkus shell memanggil modul (exit dan keluaran diteruskan)", () => {
  const d = folder({ ".env": "DB_DSN=\nDATABASE_URL=nilai-pembungkus\n", ".env.example": "DB_DSN=\nDATABASE_URL=\n" });
  let r = jalankanSh(SH, ["--salah-satu", "DB_DSN,DATABASE_URL"], { cwd: d, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "DB_DSN        kosong\nDATABASE_URL  terisi\nHasil: lengkap (exit 0)\n");
  assert.ok(!(r.stdout + r.stderr).includes("nilai-pembungkus"));
  r = jalankanSh(SH, [], { cwd: d, encoding: "utf8" });
  assert.equal(r.status, 3);
  r = jalankanSh(SH, ["--entah"], { cwd: d, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
});

// ---- Uji properti: nilai tidak pernah bocor ----------------------------------------------------------------------
/** PRNG deterministik (mulberry32) agar kegagalan bisa diulang. */
function prng(benih) {
  return () => {
    benih = (benih + 0x6d2b79f5) | 0;
    let t = Math.imul(benih ^ (benih >>> 15), 1 | benih);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HURUF = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-/:";
const KHUSUS = " \t'\"`=#$\\@%^&*;<>?~|!()[]{},+\n\r";
const PENANDA = "@%^&*;<>?~|!";                     // tiap nilai memuat ≥ 1 penanda → tidak mungkin cocok dengan nama kunci/path
const acak = prng(20261031);
const pilih = (s) => s[Math.floor(acak() * s.length)];
function nilaiAcak() {
  const n = 4 + Math.floor(acak() * 36);
  let v = "";
  while (v.length < n) v += acak() < 0.55 ? pilih(HURUF) : pilih(KHUSUS);
  const i = Math.floor(acak() * v.length);
  return v.slice(0, i) + pilih(PENANDA) + v.slice(i + 1);
}
const NILAI = Array.from({ length: 100 }, nilaiAcak);

/** Satu baris env untuk nilai v dengan gaya ke-g (polos, kutip, export, spasi, komentar, rusak). */
function baris(k, v, g) {
  switch (g % 10) {
    case 0: return `${k}=${v}`;
    case 1: return `${k}="${v}"`;
    case 2: return `${k}='${v}'`;
    case 3: return `${k}=\`${v}\``;
    case 4: return `export ${k} = ${v}`;
    case 5: return `# ${k}=${v}`;                          // nilai di komentar
    case 6: return `${k}="${v}`;                            // kutip tak tertutup
    case 7: return `${v}`;                                  // baris tanpa kunci
    case 8: return `${k}==${v}\n\n`;                        // sama-dengan ganda + baris kosong
    default: return `  ${k}\t=\t${v}  # ${v}`;
  }
}
const ISI = [
  NILAI.map((v, i) => baris(`K${i}`, v, i)).join("\n"),
  NILAI.map((v, i) => baris(`K${i}`, v, i + 3)).join("\r\n"),
  "﻿" + NILAI.map((v, i) => baris(`k_${i}.x-y`, v, i * 7)).join("\n\n"),
  NILAI.map((v, i) => `${v}\0${baris(`K${i}`, v, i)}\u0001=${v}`).join("\n") + `\n${NILAI[0]}`,  // biner/aneh
  `A="${NILAI.join("")}`,                                   // satu kutip tak tertutup sepanjang berkas
  NILAI.map((v) => `=${v}\n1X=${v}\n${v}=${v}`).join("\n"),  // kunci tidak sah
];
const POLA_BARIS = /^(berkas tidak ada: .*|[A-Za-z_][A-Za-z0-9_.-]* +(terisi|kosong|placeholder|hilang|tambahan)|Hasil: (lengkap|kurang|placeholder) \(exit [034]\))$/;

/** Keluaran hanya boleh berupa baris berstruktur; tidak ada nilai (≥ 4 karakter) maupun nilai hasil urai yang muncul. */
function pastikanBersih(keluaran, teks, label) {
  for (const v of NILAI) assert.ok(!keluaran.includes(v), `${label}: nilai bocor`);
  for (const v of uraiEnv(teks).values()) if (v.length >= 4 && [...PENANDA].some((c) => v.includes(c))) assert.ok(!keluaran.includes(v), `${label}: nilai urai bocor`);
  for (const v of uraiEnv(teks, { paksaFallback: true }).values()) if (v.length >= 4 && [...PENANDA].some((c) => v.includes(c))) assert.ok(!keluaran.includes(v), `${label}: nilai urai (fallback) bocor`);
}

test("properti: 100 nilai acak × berkas normal/rusak — keluaran (main) tidak pernah memuat nilai", () => {
  assert.equal(NILAI.length, 100);
  assert.ok(NILAI.every((v) => v.length >= 4));
  for (const [i, teks] of ISI.entries()) {
    const d = folder({ ".env": teks, ".env.example": ISI[(i + 1) % ISI.length] });
    for (const argv of [[], ["--json"], ["--wajib", "K1,K2,A"], ["--salah-satu", "K3,K4", "--json"], ["--contoh", ".env"], ["--entah"]]) {
      const r = jalan(argv, d);
      const label = `isi#${i} ${argv.join(" ")}`;
      pastikanBersih(r.out + r.err, teks, label);
      pastikanBersih(r.out + r.err, ISI[(i + 1) % ISI.length], `${label} (contoh)`);
      if (r.kode === 1) continue;
      if (argv.includes("--json")) {
        const j = JSON.parse(r.out);
        for (const k of j.kunci) assert.match(k.nama, /^[A-Za-z_][A-Za-z0-9_.-]*$/, label);
      } else for (const b of r.out.trimEnd().split("\n")) assert.match(b, POLA_BARIS, `${label}: baris tak berstruktur`);
    }
    for (const paksaFallback of [false, true]) {
      const r = periksa(teks, { contohTeks: ISI[0], wajib: ["K1"], paksaFallback });
      pastikanBersih(JSON.stringify(r), teks, `periksa isi#${i} fallback=${paksaFallback}`);
    }
  }
});

test("properti: lewat pembungkus .sh (stdout + stderr) — tidak pernah memuat nilai", () => {
  for (const [i, teks] of ISI.entries()) {
    const d = folder({ ".env": teks });
    for (const argv of [["--wajib", "K1"], ["--json"]]) {
      const r = jalankanSh(SH, argv, { cwd: d, encoding: "utf8" });
      assert.ok([0, 3, 4].includes(r.status), `isi#${i}: exit ${r.status}`);
      pastikanBersih(r.stdout + r.stderr, teks, `sh isi#${i} ${argv.join(" ")}`);
    }
  }
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("hanya berkas bernama env (T-20261031-2.3 tinjauan): berkas lain → exit 1 tanpa isi", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "env-kunci-nama-"));
  fs.writeFileSync(path.join(d, "id_rsa"), "QUJDREVGR0g=\n");
  const keluar = []; const galat = [];
  assert.equal(main(["id_rsa"], { cwd: d, tulis: (x) => keluar.push(x), tulisGalat: (x) => galat.push(x) }), 1);
  assert.match(galat.join(""), /bukan berkas env/);
  assert.ok(!keluar.join("").includes("QUJD"));
  for (const n of [".env", ".env.local", "prod.env", ".env.example", ".envrc"]) fs.writeFileSync(path.join(d, n), "A=1\n");
  for (const n of [".env", ".env.local", "prod.env", ".env.example", ".envrc"]) assert.notEqual(main([n], { cwd: d, tulis: () => {}, tulisGalat: () => {} }), 1, n);
});
