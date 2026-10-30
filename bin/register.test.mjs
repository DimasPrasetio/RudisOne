// Uji register tugas JSON (bin/register.mjs): node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { jalankanSh } from "./lib/uji-util.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const SKRIP = path.join(SINI, "register.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "register-"));
// Kantor diimpor untuk bacaRegister; arahkan semua jalurnya ke folder uji.
Object.assign(process.env, {
  RUDISONE_ROOT: path.join(tmp, "RudisOne"), RUDISONE_SERVER: path.join(tmp, "tidak-ada.json"),
  RUDISONE_KANTOR_PROJECTS: path.join(tmp, "projects"), RUDISONE_KANTOR_DESKTOP: path.join(tmp, "desktop"),
});
const R = await import("./register.mjs");
const { bacaRegister } = await import("../kantor/server.mjs");

let n = 0;
/** Folder register baru per uji. */
function lokasi() {
  const dir = path.join(tmp, `r${++n}`);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, json: path.join(dir, "register-tugas.json"), md: path.join(dir, "register-tugas.md") };
}
const jalankan = (l, ...argv) => spawnSync(process.execPath, [SKRIP, ...argv],
  { encoding: "utf8", env: { ...process.env, RUDISONE_REGISTER_JSON: l.json, RUDISONE_REGISTER_MD: l.md } });
const baca = (l) => JSON.parse(fs.readFileSync(l.json, "utf8"));
const hariIni = R.tanggalLokal().replace(/-/g, "");
const kini = new Date().toISOString();
const tugas = (id, extra = {}) => ({ id, judul: `Tugas ${id}`, folder: "~/Documents/toko", divisi: "Engineering · Tim 1", pemilik: "Tech Lead · toko",
  prioritas: "normal", status: "berjalan", fase: "Konstruksi", kunci: [], bergantung: [], perkakas: "—", dibuat: kini, diperbarui: kini, ...extra });

test("skema: register valid lolos; kolom salah ditolak dengan galat yang jelas", () => {
  assert.deepEqual(R.validasi({ versi: 1, diperbarui: kini, tugas: [tugas("T-20261030-1"), tugas("T-20261030-1.2"),
    tugas("T-20261030-2", { status: "penyelarasan", folder: "?", prioritas: "?", pemilik: "COO" }),
    tugas("T-20261030-3", { status: "selesai", selesai_pada: "2026-10-30", bukti: "ok" })] }), []);
  const g = R.validasi({ versi: 2, diperbarui: "kemarin", tugas: [
    tugas("T-1"), tugas("T-20261030-4", { status: "jalan" }), tugas("T-20261030-4"), tugas("T-20261030-5", { prioritas: "?" }),
    tugas("T-20261030-6", { kunci: "repo:x" }), tugas("T-20261030-7", { status: "selesai" }), tugas("T-20261030-8", { warna: "merah" }),
    tugas("T-20261030-9", { judul: "a | b" }), tugas("T-20261030-10", { folder: "?" }),
  ] }).join("\n");
  for (const pola of [/versi harus 1/, /diperbarui: harus waktu ISO/, /T-1: id harus/, /status harus/, /id ganda/, /prioritas harus/,
    /kunci harus larik/, /wajib selesai_pada/, /kolom tidak dikenal: warna/, /judul tidak boleh/, /folder "\?" hanya boleh/]) assert.match(g, pola);
  assert.deepEqual(R.validasi(null), ["register bukan objek JSON"]);
});

test("tambah: ID baru berurutan untuk tanggal hari ini, ID eksplisit & sub-tugas, ID ganda ditolak", () => {
  const l = lokasi();
  const a = jalankan(l, "tambah", "--judul", "Pertama");
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout.trim(), `T-${hariIni}-1`);
  assert.equal(jalankan(l, "tambah", "--judul", "Kedua", "--id", "baru").stdout.trim(), `T-${hariIni}-2`);
  assert.equal(jalankan(l, "tambah", "--judul", "Sub", "--id", `T-${hariIni}-2.1`, "--status", "berjalan", "--folder", "~/x",
    "--divisi", "Engineering", "--pemilik", "Software Engineer", "--kunci", "repo:x:a, branch b").stdout.trim(), `T-${hariIni}-2.1`);
  assert.equal(jalankan(l, "tambah", "--judul", "Ketiga").stdout.trim(), `T-${hariIni}-3`);    // sub-tugas tidak menggeser nomor
  const ganda = jalankan(l, "tambah", "--judul", "Ganda", "--id", `T-${hariIni}-1`);
  assert.equal(ganda.status, 1);
  assert.match(ganda.stderr, /ID sudah ada/);
  const reg = baca(l);
  assert.deepEqual(R.validasi(reg), []);
  const t1 = reg.tugas.find((t) => t.id === `T-${hariIni}-1`);
  assert.equal(t1.status, "penyelarasan");                         // bawaan: penyelarasan, Pemilik COO, kolom belum jelas "?"
  assert.equal(t1.pemilik, "COO");
  assert.deepEqual(reg.tugas.find((t) => t.id === `T-${hariIni}-2.1`).kunci, ["repo:x:a", "branch b"]);
  assert.match(fs.readFileSync(l.md, "utf8"), /DIBANGKITKAN dari register-tugas\.json/);     // setiap tulis membangkitkan MD
  const tidakSah = jalankan(l, "tambah", "--judul", "Tanpa folder", "--status", "berjalan");
  assert.equal(tidakSah.status, 1);
  assert.match(tidakSah.stderr, /tidak valid — tidak ditulis/);
  assert.equal(baca(l).tugas.length, 4);                           // register tidak berubah
});

test("ubah: kolom diperbarui; selesai/dibatalkan mengisi selesai_pada; kembali aktif menghapusnya", () => {
  const l = lokasi();
  const id = jalankan(l, "tambah", "--judul", "Ubah saya").stdout.trim();
  assert.equal(jalankan(l, "ubah", id, "--status", "berjalan", "--folder", "~/x", "--divisi", "IT Operations", "--pemilik", "Head of IT Operations",
    "--prioritas", "segera", "--fase", "—", "--kunci", "deploy:x").status, 0);
  assert.equal(jalankan(l, "ubah", id, "--status", "selesai", "--bukti", "log ok").status, 0);
  let t = baca(l).tugas[0];
  assert.equal(t.selesai_pada, R.tanggalLokal());
  assert.equal(t.bukti, "log ok");
  assert.equal(t.prioritas, "segera");
  assert.equal(jalankan(l, "ubah", id, "--status", "berjalan").status, 0);
  t = baca(l).tugas[0];
  assert.equal("selesai_pada" in t, false);
  assert.equal(jalankan(l, "ubah", "T-20990101-1", "--status", "selesai").status, 1);
  assert.equal(jalankan(l, "ubah", id, "--warna", "merah").status, 1);
  const tampil = jalankan(l, "tampil", "--json");
  assert.deepEqual(JSON.parse(tampil.stdout).map((x) => x.id), [id]);
});

test("jalur SDD: mode/jalur_awal/jalur_akhir/reroute di-set lewat tambah & ubah, divalidasi, tampil di MD & ringkasan, bisa dihapus", () => {
  const l = lokasi();
  const id = jalankan(l, "tambah", "--judul", "Bug stok", "--status", "berjalan", "--folder", "~/x", "--divisi", "Engineering",
    "--pemilik", "Tech Lead · x", "--mode-saat-mulai", "b", "--jalur-awal", "Tracer").stdout.trim();
  let t = baca(l).tugas[0];
  assert.equal(t.id, id);
  assert.equal(t.mode_saat_mulai, "B");                                // dinormalkan: huruf besar
  assert.equal(t.jalur_awal, "tracer");                                // dinormalkan: huruf kecil
  assert.equal("jalur_akhir" in t, false);
  let md = fs.readFileSync(l.md, "utf8");
  assert.ok(md.includes("## Jalur (skill rudis-sdd)\n\n| ID | Mode | Jalur awal | Jalur akhir | Re-route |\n|---|---|---|---|---|\n"));
  assert.ok(md.includes(`| ${id} | B | tracer | — | — |`));
  // re-route tanpa alasan ditolak, register tidak berubah
  const tanpaAlasan = jalankan(l, "ubah", id, "--jalur-akhir", "redesign");
  assert.equal(tanpaAlasan.status, 1);
  assert.match(tanpaAlasan.stderr, /jalur_akhir \(redesign\) ≠ jalur_awal \(tracer\) wajib reroute/);
  assert.equal("jalur_akhir" in baca(l).tugas[0], false);
  const r = jalankan(l, "ubah", id, "--jalur-akhir", "redesign", "--reroute", "tracer: perilaku sesuai brd, permintaan = fitur");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /· jalur B:tracer→redesign$/m);
  t = baca(l).tugas[0];
  assert.deepEqual([t.jalur_akhir, t.reroute], ["redesign", "tracer: perilaku sesuai brd, permintaan = fitur"]);
  md = fs.readFileSync(l.md, "utf8");
  assert.ok(md.includes(`| ${id} | B | tracer | redesign | tracer: perilaku sesuai brd, permintaan = fitur |`));
  assert.match(jalankan(l, "tampil").stdout, /jalur B:tracer→redesign/);
  // jalur akhir = awal tidak butuh alasan; nilai tidak sah ditolak
  assert.equal(jalankan(l, "ubah", id, "--jalur-akhir", "tracer", "--reroute", "").status, 0);
  assert.equal("reroute" in baca(l).tugas[0], false);
  for (const [k, v, pola] of [["--mode-saat-mulai", "C", /mode_saat_mulai harus A\|B\|-/], ["--jalur-awal", "red design", /jalur_awal harus nilai pendek/],
    ["--jalur-awal", "x".repeat(41), /jalur_awal harus nilai pendek/], ["--reroute", "a | b", /reroute harus alasan satu baris/]]) {
    const g = jalankan(l, "ubah", id, k, v);
    assert.equal(g.status, 1, `${k} ${v}`);
    assert.match(g.stderr, pola);
  }
  assert.equal(jalankan(l, "ubah", id, "--mode-saat-mulai", "—").status, 0);
  assert.equal(baca(l).tugas[0].mode_saat_mulai, "-");
  assert.equal(jalankan(l, "ubah", id, "--jalur-awal", "").status, 1);  // jalur_akhir masih ada → butuh jalur_awal
  // hapus semua kolom jalur → bagian Jalur hilang dari MD
  const h = jalankan(l, "ubah", id, "--mode-saat-mulai", "", "--jalur-awal", "", "--jalur-akhir", "");
  assert.equal(h.status, 0, h.stderr);
  t = baca(l).tugas[0];
  for (const k of R.JALUR) assert.equal(k in t, false, k);
  assert.doesNotMatch(fs.readFileSync(l.md, "utf8"), /## Jalur/);
  assert.deepEqual(R.validasi(baca(l)), []);
});

test("jalur SDD: register lama tanpa kolom jalur tetap valid & MD tanpa bagian Jalur; bagian Jalur tidak terbaca sebagai tugas oleh Kantor/impor", () => {
  const lama = { versi: 1, diperbarui: kini, tugas: [tugas("T-20261030-1"), tugas("T-20261030-2", { status: "selesai", selesai_pada: "2026-10-30" })] };
  assert.deepEqual(R.validasi(lama), []);
  assert.doesNotMatch(R.bangkitkanMd(lama), /## Jalur/);
  const baru = { ...lama, tugas: [...lama.tugas, tugas("T-20261030-3", { mode_saat_mulai: "A", jalur_awal: "pasang+sesuaikan" }),
    tugas("T-20261030-4", { status: "selesai", selesai_pada: "2026-10-30", mode_saat_mulai: "B", jalur_awal: "upgrade", jalur_akhir: "tracer", reroute: "upgrade ternyata bug" })] };
  assert.deepEqual(R.validasi(baru), []);
  const md = R.bangkitkanMd(baru);
  assert.ok(md.includes("| T-20261030-3 | A | pasang+sesuaikan | — | — |"));
  assert.ok(md.includes("| T-20261030-4 | B | upgrade | tracer | upgrade ternyata bug |"));   // tugas selesai ikut (bahan metrik akurasi jalur)
  assert.deepEqual(bacaRegister(md).map((t) => t.id), ["T-20261030-1", "T-20261030-3"]);
  assert.deepEqual(R.imporMd(md).tugas.map((t) => t.id).sort(), ["T-20261030-1", "T-20261030-2", "T-20261030-3", "T-20261030-4"]);
  assert.match(R.validasi({ ...lama, tugas: [tugas("T-20261030-5", { jalur_akhir: "redesign" })] }).join("\n"), /jalur_akhir butuh jalur_awal/);
});

test("kunci-cek: bentrok dengan tugas aktif (termasuk awalan repo:x ⊃ repo:x:a), bebas bila hanya tugas tutup/penyelarasan", () => {
  const l = lokasi();
  fs.writeFileSync(l.json, JSON.stringify({ versi: 1, diperbarui: kini, tugas: [
    tugas("T-20261030-1", { kunci: ["repo:toko:modules/pos", "deploy:toko"] }),
    tugas("T-20261030-2", { kunci: ["repo:toko"], status: "selesai", selesai_pada: "2026-10-30" }),
    tugas("T-20261030-3", { kunci: ["prod-db:toko"], status: "penyelarasan" }),
    tugas("T-20261030-4", { kunci: ["repo:toko"], status: "antre" }),
  ] }));
  const bentrok = jalankan(l, "kunci-cek", "T-20261030-4");
  assert.equal(bentrok.status, 1);
  assert.match(bentrok.stdout, /T-20261030-1 .*repo:toko:modules\/pos/);
  assert.doesNotMatch(bentrok.stdout, /T-20261030-2|T-20261030-4 \(/);
  assert.equal(jalankan(l, "kunci-cek", "--kunci", "deploy:toko", "--kecuali", "T-20261030-1").status, 0);
  assert.equal(jalankan(l, "kunci-cek", "--kunci", "prod-db:toko").status, 0);         // penyelarasan tidak memegang kunci
  assert.equal(jalankan(l, "kunci-cek", "--kunci", "repo:tokobaru").status, 0);        // bukan awalan pada batas ":"
  assert.equal(jalankan(l, "kunci-cek", "--kunci", "deploy:toko").status, 1);
  assert.equal(R.kunciBentrok("repo:x", "repo:x/a"), true);
  assert.equal(R.kunciBentrok("repo:x", "repo:xy"), false);
});

test("validasi & rapikan lewat CLI", () => {
  const l = lokasi();
  assert.equal(jalankan(l, "validasi").status, 1);                                     // belum ada
  const lama = new Date(Date.now() - 20 * 864e5);
  fs.writeFileSync(l.json, JSON.stringify({ versi: 1, diperbarui: kini, tugas: [
    tugas("T-20261001-1", { status: "selesai", selesai_pada: R.tanggalLokal(lama) }),
    tugas("T-20261001-2", { status: "dibatalkan", selesai_pada: R.tanggalLokal() }),
    tugas("T-20261001-3"),
  ] }));
  assert.equal(jalankan(l, "validasi").status, 0);
  const r = jalankan(l, "rapikan");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Dibuang 1 tugas/);
  assert.deepEqual(baca(l).tugas.map((t) => t.id), ["T-20261001-2", "T-20261001-3"]);
  fs.writeFileSync(l.json, "{ rusak");
  assert.equal(jalankan(l, "validasi").status, 1);
});

test("bangkitkan: format tabel templat; bacaRegister Kantor membaca baris aktif yang sama", () => {
  const l = lokasi();
  const reg = { versi: 1, diperbarui: kini, tugas: [
    tugas("T-20261030-1", { prioritas: "normal", dibuat: "2026-10-30T01:00:00.000Z", kunci: ["repo:toko:pos", "branch b"], bergantung: ["T-20261029-1"] }),
    tugas("T-20261030-2", { prioritas: "segera", pemilik: "Head of IT Operations", divisi: "IT Operations", folder: "~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations" }),
    tugas("T-20261030-3", { status: "selesai", selesai_pada: "2026-10-30", bukti: "handoff/x.md" }),
    tugas("T-20261030-4", { status: "penyelarasan", folder: "?", divisi: "?", pemilik: "COO", prioritas: "?" }),
  ] };
  fs.writeFileSync(l.json, JSON.stringify(reg));
  const b = jalankan(l, "bangkitkan");
  assert.equal(b.status, 0, b.stderr);
  const md = fs.readFileSync(l.md, "utf8");
  assert.ok(md.includes("| ID | Tugas | Folder | Divisi | Pemilik | Prioritas | Status | Fase | Kunci | Bergantung | Perkakas | Diperbarui |\n|---|---|---|---|---|---|---|---|---|---|---|---|"));
  assert.ok(md.includes("| ID | Tanggal | Tugas | Folder | Pemilik | Status | Perkakas | Bukti / hasil |\n|---|---|---|---|---|---|---|---|"));
  assert.ok(md.includes("| T-20261030-3 | 2026-10-30 | Tugas T-20261030-3 | `~/Documents/toko` | Tech Lead · toko | selesai | — | handoff/x.md |"));
  assert.match(md, /\| T-20261030-1 \| Tugas T-20261030-1 \| `~\/Documents\/toko` \| Engineering · Tim 1 \| Tech Lead · toko \| normal \| berjalan \| Konstruksi \| repo:toko:pos, branch b \| T-20261029-1 \| — \| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \|/);
  const kantor = bacaRegister(md);
  const aktifJson = R.urut(reg.tugas.filter(R.aktif));
  assert.deepEqual(kantor.map((t) => t.id), aktifJson.map((t) => t.id));
  assert.deepEqual(kantor.map((t) => t.id), ["T-20261030-2", "T-20261030-1", "T-20261030-4"]);
  for (const t of kantor) {
    const j = reg.tugas.find((x) => x.id === t.id);
    assert.equal(t.tugas, j.judul);
    assert.equal(t.folder, j.folder);
    assert.equal(t.pemilik, j.pemilik);
    assert.equal(t.status, j.status);
    assert.equal(t.prioritas, j.prioritas);
  }
});

test("impor dari MD lama (isi templat + 2 baris): menolak bila JSON ada, --timpa menimpa, MD tulisan tangan dicadangkan", () => {
  const l = lokasi();
  // fixture dirakit dari bentuk LF (salinan Windows bisa ber-CRLF); impor CRLF diuji terpisah di bawah
  const templat = fs.readFileSync(path.join(SINI, "..", "templat", "register-tugas.md"), "utf8").replace(/\r\n/g, "\n");
  const aktifBaris = "| T-20261030-2 | Migrasi F4 | `~/Documents/Neuron/ai-agent/RudisOne` | Engineering · Tim 2 | Tech Lead · RudisOne | tinggi | berjalan | Konstruksi | repo:RudisOne, branch rudis/T-20261030-2 | T-20261030-1 | rudis@f6f4e12 | 2026-10-30 09:15 |";
  const selesaiBaris = "| T-20261030-1 | 2026-10-30 | Riset orkestrasi | ~/Documents/Neuron/ai-agent/RudisOne | Research Analyst | selesai | — | handoff/T-20261030-1/riset.md |";
  const md = templat
    .replace(/(\| T-YYYYMMDD-1 [^\n]*\n)/, `$1${aktifBaris}\n`)
    .replace(/(## Selesai\n\n\| ID \| Tanggal[^\n]*\n\|[-|]+\|\n)/, `$1${selesaiBaris}\n`);
  assert.ok(md.includes(aktifBaris) && md.includes(selesaiBaris), "templat berubah bentuk — perbarui uji");
  fs.writeFileSync(l.md, md);
  const r = jalankan(l, "impor");
  assert.equal(r.status, 0, r.stderr);
  const reg = baca(l);
  assert.deepEqual(R.validasi(reg), []);
  assert.deepEqual(reg.tugas.map((t) => t.id).sort(), ["T-20261030-1", "T-20261030-2"]);   // baris contoh T-YYYYMMDD-1 dilewati
  const a = reg.tugas.find((t) => t.id === "T-20261030-2");
  assert.deepEqual(a.kunci, ["repo:RudisOne", "branch rudis/T-20261030-2"]);
  assert.deepEqual(a.bergantung, ["T-20261030-1"]);
  assert.equal(a.prioritas, "tinggi");
  assert.equal(a.folder, "~/Documents/Neuron/ai-agent/RudisOne");
  assert.equal(R.waktuLokal(a.diperbarui), "2026-10-30 09:15");
  const s = reg.tugas.find((t) => t.id === "T-20261030-1");
  assert.equal(s.selesai_pada, "2026-10-30");
  assert.equal(s.bukti, "handoff/T-20261030-1/riset.md");
  assert.equal(s.perkakas, "—");
  assert.equal(fs.readFileSync(`${l.md}.sebelum-impor`, "utf8"), md);
  assert.match(fs.readFileSync(l.md, "utf8"), /DIBANGKITKAN/);
  const lagi = jalankan(l, "impor", "--dari", `${l.md}.sebelum-impor`);
  assert.equal(lagi.status, 1);
  assert.match(lagi.stderr, /sudah ada/);
  assert.equal(jalankan(l, "impor", "--dari", `${l.md}.sebelum-impor`, "--timpa").status, 0);
  assert.equal(baca(l).tugas.length, 2);
  // MD yang sama ber-CRLF (disunting di Windows) → hasil impor identik, tanpa "\r" tersisa di nilai sel
  const lf = R.imporMd(md), crlf = R.imporMd(md.replace(/\n/g, "\r\n"));
  assert.deepEqual(crlf, lf);
  assert.ok(!JSON.stringify(crlf).includes("\\r"));
});

test("kunci berkas: kunci basi (> 30 dtk) dibersihkan dan dicatat; kunci segar ditunggu", () => {
  const l = lokasi();
  fs.writeFileSync(`${l.json}.lock`, "99999 lama\n");
  const lalu = new Date(Date.now() - 60e3);
  fs.utimesSync(`${l.json}.lock`, lalu, lalu);
  const r = jalankan(l, "tambah", "--judul", "Setelah kunci basi");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /kunci basi/);
  assert.equal(fs.existsSync(`${l.json}.lock`), false);
  // kunci segar dipegang "proses lain" lalu dilepas → penulis menunggu lalu berhasil
  fs.writeFileSync(`${l.json}.lock`, "1 segar\n");
  setTimeout(() => fs.unlinkSync(`${l.json}.lock`), 300);
  return new Promise((selesai, gagal) => {
    const p = spawn(process.execPath, [SKRIP, "tambah", "--judul", "Menunggu kunci"], { env: { ...process.env, RUDISONE_REGISTER_JSON: l.json, RUDISONE_REGISTER_MD: l.md } });
    p.on("exit", (kode) => { try { assert.equal(kode, 0); assert.equal(baca(l).tugas.length, 2); selesai(); } catch (e) { gagal(e); } });
  });
});

test("penulisan bersamaan: 12 proses tambah paralel → semua tugas ada, JSON valid, ID unik, tanpa sisa berkas", async () => {
  const l = lokasi();
  const N = 12;
  const kode = await Promise.all(Array.from({ length: N }, (_, i) => new Promise((selesai) => {
    const p = spawn(process.execPath, [SKRIP, "tambah", "--judul", `Paralel ${i}`],
      { env: { ...process.env, RUDISONE_REGISTER_JSON: l.json, RUDISONE_REGISTER_MD: l.md }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("exit", (k) => selesai({ k, out: out.trim(), err }));
  })));
  for (const h of kode) assert.equal(h.k, 0, h.err);
  const reg = baca(l);
  assert.deepEqual(R.validasi(reg), []);
  assert.equal(reg.tugas.length, N);
  assert.equal(new Set(reg.tugas.map((t) => t.id)).size, N);
  assert.deepEqual(reg.tugas.map((t) => t.judul).sort(), Array.from({ length: N }, (_, i) => `Paralel ${i}`).sort());
  assert.deepEqual(kode.map((h) => h.out).sort(), reg.tugas.map((t) => t.id).sort());          // ID yang dicetak = ID yang tersimpan
  assert.equal(bacaRegister(fs.readFileSync(l.md, "utf8")).length, N);                        // MD terakhir memuat semuanya
  assert.deepEqual(fs.readdirSync(l.dir).sort(), ["register-tugas.json", "register-tugas.md"]); // tanpa .lock / .tmp tersisa
});

test("bin/register.sh meneruskan ke register.mjs", () => {
  const l = lokasi();
  const r = jalankanSh(path.join(SINI, "register.sh"), ["tampil"], { encoding: "utf8", env: { ...process.env, RUDISONE_REGISTER_JSON: l.json, RUDISONE_REGISTER_MD: l.md } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /tidak ada tugas aktif/);
  assert.equal(jalankanSh(path.join(SINI, "register.sh"), ["tidak-dikenal"], { encoding: "utf8" }).status, 2);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("impor --timpa menyalin register JSON lama lebih dulu (bukti tidak hilang)", async () => {
  const { execFileSync } = await import("node:child_process");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "reg-timpa-"));
  const env = { ...process.env, RUDISONE_REGISTER_JSON: path.join(d, "register-tugas.json"), RUDISONE_REGISTER_MD: path.join(d, "register-tugas.md") };
  const jalan = (...a) => execFileSync(process.execPath, [fileURLToPath(new URL("./register.mjs", import.meta.url)), ...a], { env, encoding: "utf8" });
  jalan("tambah", "--judul", "uji", "--status", "baru", "--folder", "/x", "--divisi", "Engineering", "--pemilik", "Tech Lead", "--bukti", "sha abc");
  jalan("impor", "--timpa");
  const cadangan = fs.readdirSync(d).filter((f) => f.startsWith("register-tugas.json.sebelum-impor-"));
  assert.equal(cadangan.length, 1);
  assert.match(fs.readFileSync(path.join(d, cadangan[0]), "utf8"), /sha abc/);
});
