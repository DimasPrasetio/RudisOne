// Istilah baku Kantor (kantor/app/istilah.mjs; DESAIN.md › Istilah): singkatan & label status satu sumber, kalimat
// aktivitas tanpa perintah mentah atau nama alat internal, dan teks halaman bebas istilah terlarang. Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIM, URUT } from "./app/denah.mjs";
import { keteranganSiap, pembantuTugas, teksSelesai, waktuSelesai } from "./app/jejak.mjs";
import {
  BATAS_RINCIAN, DAFTAR_SINGKATAN, frasaKerja, gabungFrasa, kunciLabel, JEDA_GABUNG_MS, STATUS, STATUS_TUGAS, TAHAP, TERLARANG, URUT_STATUS, durasi, kalimatWaktuTahap,
  kataStatusTugas, kelompokAktivitas, kerjaAktivitas, pimpinan, rincianAman, ringkasan, singkatan, tahapTugas,
} from "./app/istilah.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const terlarang = (teks) => TERLARANG.filter((re) => re.test(teks)).map(String);

test("singkatan jabatan baku = tabel protokol; satu sumber untuk denah, linimasa, dan daftar di 'Tentang'", () => {
  const harap = {
    "COO": "COO", "Head of Strategy": "HoS", "Financial Controller": "FC", "Research Analyst": "RA", "HR Business Partner": "HRBP",
    "Tech Lead · Tim 1": "TL T1", "Business Systems Analyst · Tim 2": "BSA T2", "Software Engineer #1 · Tim 3": "SE1 T3",
    "Software Engineer #2 · Tim 1": "SE2 T1", "Program Manager": "PgM", "Technical Writer": "TW", "Head of IT Operations": "HITO",
    "System Administrator": "SysAdmin",
  };
  for (const [nama, s] of Object.entries(harap)) assert.equal(singkatan(nama), s, nama);
  for (const nama of URUT) assert.equal(TIM[nama].pendek, singkatan(nama), `denah memakai singkatan baku: ${nama}`);
  assert.equal(new Set(URUT.map(singkatan)).size, URUT.length, "singkatan unik per kursi");
  // daftar di "Tentang halaman ini" mencakup setiap singkatan (pola Tn untuk tim)
  const pola = DAFTAR_SINGKATAN.flatMap(([s]) => s.split(" · ")).map((s) => new RegExp(`^${s.replace("Tn", "T\\d")}$`));
  for (const nama of URUT) assert.ok(pola.some((re) => re.test(singkatan(nama))), `daftar singkatan memuat ${singkatan(nama)}`);
  // singkatan lama campuran tidak dipakai lagi
  for (const nama of URUT) assert.doesNotMatch(TIM[nama].pendek, /^(Strategy|Finance|Research|Lead T\d|PM|IT Ops)$/);
});

test("pimpinan = Head of Strategy, Program Manager, Head of IT Operations, Tech Lead tim (bukan COO)", () => {
  assert.deepEqual(URUT.filter(pimpinan), ["Head of Strategy", "Tech Lead · Tim 1", "Tech Lead · Tim 2", "Tech Lead · Tim 3", "Program Manager", "Head of IT Operations"]);
});

test("label status satu sumber: legenda halaman = STATUS, berurutan; ringkasan & status tugas berkata biasa", () => {
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const legenda = html.match(/<ul class="arti"[\s\S]*?<\/ul>/)[0];
  const label = [...legenda.matchAll(/<\/i>([^<]+)<\/li>/g)].map((m) => m[1].trim());
  assert.deepEqual(label, URUT_STATUS.map((k) => STATUS[k].label));
  const simbol = [...legenda.matchAll(/class="simbol (\w+)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(simbol, URUT_STATUS.map((k) => [k, STATUS[k].simbol]));
  assert.equal(STATUS.siap.label, "Siap dipanggil");
  assert.equal(kataStatusTugas("berjalan"), "Dikerjakan");
  assert.equal(kataStatusTugas("diparkir"), "Ditunda");
  assert.equal(kataStatusTugas("penyelarasan"), "Menyamakan persepsi");
  assert.equal(kataStatusTugas("aneh"), "Aneh");
  for (const v of Object.values(STATUS_TUGAS)) assert.ok(v.split(" ").length <= 2 && /^[A-Z][a-z ]+$/.test(v), v);   // ≤ 2 kata, sentence case
});

test("teks statis halaman (index.html) bebas istilah terlarang", () => {
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const atribut = [...html.matchAll(/\b(?:aria-label|title)="([^"]*)"/g)].map((m) => m[1]);
  const teks = `${html.replace(/<[^>]+>/g, " ")} ${atribut.join(" ")}`.replace(/&amp;/g, "&").replace(/\s+/g, " ");
  assert.deepEqual(terlarang(teks), []);
  assert.doesNotMatch(teks, /\bbin\/|kantor\.sh/, "catatan kaki tanpa nama skrip");
});

test("daftar terlarang menangkap contoh nyata dari halaman lama", () => {
  for (const contoh of ["Siap dipanggil · di meja, sesekali ngopi", "subagent · Lead T1", "Head of Strategy leader", "Buka sesi “x” di sidebar",
    "Bekerja — SubagentHandback", "perl -0pi -e 's/a/b/'", "Jalankan bin/kantor.sh bila server mati", "Strategy", "mcp__ccd_turn__x"])
    assert.ok(terlarang(contoh).length, contoh);
  for (const sah of ["Head of Strategy", "Corporate Strategy", "Research Analyst", "TL T1 menunggu jawaban Anda", "Menyimpan versi kode"])
    assert.deepEqual(terlarang(sah), [], sah);
});

test("kalimat aktivitas: setiap label server punya kata kerja; perintah mentah & nama alat internal tidak pernah tampil", async () => {
  process.env.RUDISONE_ROOT ??= path.join(HERE, "..");
  const { describeTool } = await import("./server.mjs");
  const alat = [
    ["Bash", { command: "perl -0pi -e 's/rahasia/x/' a.mjs" }], ["Bash", { command: "./deploy.sh app", description: "Deploy" }],
    ["Bash", { command: "ssh vps 'uptime'" }], ["Bash", { command: "git commit -m x" }], ["Bash", { command: "npm test" }],
    ["Bash", { command: "cat x", description: "Read notes" }], ["Bash", { command: "git -C r log -1" }],
    ["Bash", { command: "node potret.mjs", description: "Take screenshots with Playwright" }], ["Bash", { command: "npm ci" }],
    ["Bash", { command: "sed -i '' s/a/b/ f" }], ["Bash", { command: "zzz" }], ["Read", { file_path: "/a/b.ts" }], ["Edit", { file_path: "/a/b.ts" }],
    ["WebSearch", { query: "q" }], ["WebFetch", { url: "https://contoh.id/x" }], ["SendMessage", { to: "x", message: "[Laporan ke COO] T-20260101-1" }],
    ["AskUserQuestion", {}], ["Skill", { skill: "rudis-sdlc" }], ["Agent", { description: "Cari" }], ["SubagentHandback", {}],
    ["mcp__ccd_session__start_session", { title: "Tech Lead · x" }], ["mcp__ccd_turn__update_plan", {}], ["mcp__ccd_turn__wrap_up", {}],
    ["mcp__ccd_session_mgmt__list_sessions", {}], ["mcp__Claude_Browser__navigate", {}], ["mcp__lain__alat_rahasia", {}],
  ];
  for (const [nama, input] of alat) {
    const d = describeTool(nama, input, () => null);
    assert.ok(!/perl|sed -i|git commit|npm|ssh|cat x/.test(d.detail), `${nama}: detail tanpa perintah (${d.detail})`);
    assert.ok(d.detail.length <= BATAS_RINCIAN, `${nama}: detail ≤ ${BATAS_RINCIAN}`);
    const kerja = kerjaAktivitas(d);
    if (nama !== "mcp__lain__alat_rahasia") assert.notEqual(kerja, "memakai alat kerja", `${nama} (${d.label}) punya kata kerja sendiri`);
    assert.deepEqual(terlarang(kerja), [], `${nama}: ${kerja}`);
    assert.deepEqual(terlarang(rincianAman(d.detail, d.label)), [], `${nama}: rincian ${d.detail}`);
  }
  assert.equal(describeTool("mcp__lain__alat_rahasia", {}).detail, "", "nama alat internal tidak dikirim");
  assert.equal(describeTool("SubagentHandback", {}).label, "Menyerahkan hasil");
  assert.equal(describeTool("SendMessage", { to: "local_6f21bb52-aaaa", message: "[Info] x" }, () => null).label, "Mengirim pesan ke rekan", "alamat sesi mentah tidak tampil");
  for (const [d, label] of [["Show diff from main to the task branch", "Memeriksa riwayat kode"], ["List worktree branches", "Memeriksa riwayat kode"],
    ["Commit full build on task branch", "Menyimpan versi kode"], ["Run full test suites", "Menjalankan tes"]])
    assert.equal(describeTool("Bash", { command: "cd /r && x", description: d }).label, label, d);
  assert.equal(kerjaAktivitas({ label: "Mengirim pesan ke Tech Lead · Tim 1", detail: "Laporan" }), "mengirim laporan ke Tech Lead · Tim 1");
  assert.equal(kerjaAktivitas({ label: "Menerima pesan dari agent lain" }), "menerima pesan dari rekan");
  assert.equal(kerjaAktivitas({ label: "Membaca kode" }, 6), "membaca 6 berkas");
  // label keadaan sesi (bukan alat) juga berkata kerja sendiri — panel Tim memakai kalimat ini
  const labelServer = [...fs.readFileSync(path.join(HERE, "server.mjs"), "utf8").matchAll(/label: "([^"]+)"/g)].map((m) => m[1])
    .filter((l) => !["Bekerja", "Belum masuk", "Dipanggil saat perlu"].includes(l));
  for (const l of new Set(labelServer)) assert.notEqual(kerjaAktivitas({ label: l }), "memakai alat kerja", `label server "${l}" punya kata kerja`);
});

test("rincian aman: ≤ 50 karakter, tanpa perintah mentah & nama alat internal", () => {
  for (const d of ["perl -0pi -e 's/x/y/' f", "git push origin main", "R=/a; ls", "for i in 1 2; do x; done", "cat a | b", "bin/register.sh ubah",
    "SubagentHandback", "mcp__ccd_turn__wrap_up", "ToolSearch", "/Users/x/rahasia.txt"]) assert.equal(rincianAman(d, "Menjalankan perintah"), "", d);
  assert.equal(rincianAman("Run kantor tests"), "Run kantor tests");
  assert.equal(rincianAman("server.mjs"), "server.mjs");
  assert.equal(rincianAman("x".repeat(80)).length, BATAS_RINCIAN);
  assert.equal(rincianAman("Laporan", "Mengirim pesan ke COO"), "", "jenis pesan sudah ada di kalimatnya");
});

test("aktivitas per tugas: langkah seorang pelaku digabung jadi satu kalimat; pesan & menunggu Anda tetap sendiri", () => {
  const t0 = 1_800_000_000_000, j = { "T-20260101-2": "Perbaikan cetak", "T-20260101-3": "Insiden" };
  const f = (dtk, agent, label, extra = {}) => ({ ts: t0 - dtk * 1000, agent, label, detail: "", tugas: "T-20260101-2", ...extra });
  const feed = [
    f(1, "Tech Lead · Tim 1", "Menjalankan tes", { detail: "Run tests" }),
    f(2, "Research Analyst", "Membaca halaman web", { tugas: "T-20260101-2.1", detail: "nngroup.com" }),
    f(3, "Tech Lead · Tim 1", "Membaca kode", { detail: "a.mjs" }),
    f(4, "Tech Lead · Tim 1", "Membaca kode", { detail: "perl -pi x" }),
    f(5, "Research Analyst", "Membaca halaman web"),
    f(6, "Tech Lead · Tim 1", "Mengirim pesan ke COO", { detail: "Laporan" }),
    f(7, "Tech Lead · Tim 1", "Menulis"),
    f(8, "Business Systems Analyst · Tim 1", "Menunggu jawaban Anda"),
    f(9, "Head of IT Operations", "Bekerja di server", { tugas: "T-20260101-3" }),
    f(10, "COO", "Menyiapkan alat", { tugas: null }),
    f(11, "COO", "Menyusun laporan", { tugas: null }),
    f(20 * 60, "Tech Lead · Tim 1", "Menulis"),
  ];
  const g = kelompokAktivitas(feed, j);
  assert.deepEqual(g.map((x) => [x.id, x.judul]), [["T-20260101-2", "Perbaikan cetak"], ["T-20260101-3", "Insiden"], [null, null]]);
  const baris = g[0].baris.map((b) => `${b.agent}: ${b.kerja}`);
  assert.deepEqual(baris, [
    "Tech Lead · Tim 1: menjalankan tes dan membaca 2 berkas",   // langkah RA di sela-selanya tidak memutus gabungan
    "Research Analyst: membaca 2 halaman web",                   // sub-tugas T-…-2.1 ikut induknya
    "Tech Lead · Tim 1: mengirim laporan ke COO",                // pesan selalu sendiri dan memutus gabungan
    "Tech Lead · Tim 1: mengubah berkas",
    "Business Systems Analyst · Tim 1: menunggu jawaban Anda",
    "Tech Lead · Tim 1: mengubah berkas",                        // jeda > 10 mnt → baris baru
  ]);
  assert.deepEqual(g[0].baris[0].rincian, ["Run tests", "a.mjs"], "rincian aman saja, tanpa perintah mentah");
  assert.deepEqual(g[2].baris.map((b) => b.kerja), ["menyusun ringkasan"], "'Menyiapkan alat' tidak ditampilkan");
  assert.equal(JEDA_GABUNG_MS, 10 * 60e3);
  assert.equal(kelompokAktivitas(feed, j, { maksBaris: 2 }).flatMap((x) => x.baris).length, 2);
  const banyak = kelompokAktivitas(["Menjalankan perintah", "Membaca kode", "Menulis", "Riset di web"].map((l, i) => f(i, "COO", l)), j);
  assert.equal(banyak[0].baris[0].kerja, "menjalankan perintah, membaca berkas, mengubah berkas, dan langkah lain");
  for (const x of g) for (const b of x.baris) assert.deepEqual(terlarang(`${b.agent} ${b.kerja}`), []);
});

test("tahap tugas, waktu dalam kalimat, durasi", () => {
  assert.deepEqual(tahapTugas("Konstruksi B (modul kasir)"), { ke: 2, dari: 5, nama: "Konstruksi" });
  assert.equal(tahapTugas("—"), null);
  assert.equal(tahapTugas("Riset"), null);
  assert.deepEqual(TAHAP.map((t) => t.nama), ["Inisiasi", "Analisis", "Konstruksi", "Pengujian", "Rilis"]);
  assert.deepEqual(kalimatWaktuTahap({ menit: 31, anggaran: 25 }), { teks: "Melewati perkiraan tahap 6 mnt", lewat: true });
  assert.deepEqual(kalimatWaktuTahap({ menit: 12, anggaran: 25 }), { teks: "Tahap ini 12 mnt dari perkiraan 25 mnt", lewat: false });
  assert.deepEqual(kalimatWaktuTahap({ menit: 3, anggaran: null }), { teks: "Tahap ini berjalan 3 mnt", lewat: false });
  assert.equal(kalimatWaktuTahap(null), null);
  assert.equal(durasi(45), "45 mnt");
  assert.equal(durasi(120), "2 jam");
  assert.equal(durasi(125), "2 jam 5 mnt");
});

test("ringkasan atas: menunggu, sedang bekerja (bekerja + berpikir), tugas berjalan, selesai hari ini", () => {
  const r = ringkasan({ a: "menunggu", b: "bekerja", c: "berpikir", d: "siap", e: "selesai", f: "kosong" },
    [{ status: "berjalan" }, { status: "antre" }, { status: "berjalan (Konstruksi)" }], [{}, {}], (s) => String(s).split(/[\s(]/)[0]);
  assert.deepEqual(r, { menunggu: ["a"], bekerja: ["b", "c"], tugas: { semua: 3, berjalan: 2, lain: 1 }, selesai: 2 });
});

test("keterangan siap dipanggil & baru selesai bebas istilah internal", () => {
  for (const mode of ["siaga", "katalog", "absen"]) assert.deepEqual(terlarang(keteranganSiap({ mode })), [], mode);
  assert.deepEqual(terlarang(teksSelesai(Date.now() - 3 * 60e3)), []);
});

test("kartu tugas: 'dibantu' hanya anggota pemilik atau peran yang dipanggilnya — bukan COO/pemberi tugas", () => {
  const TL = "Tech Lead · Tim 1";
  const k = [{ nama: "COO", dari: null }, { nama: "Business Systems Analyst · Tim 1", dari: null }, { nama: "Research Analyst", dari: TL },
    { nama: "Financial Controller", dari: "COO" }, { nama: "Software Engineer #1 · Tim 2", dari: null }, { nama: TL, dari: null }];
  assert.deepEqual(pembantuTugas(TL, k), ["Business Systems Analyst · Tim 1", "Research Analyst"]);
  assert.deepEqual(pembantuTugas("Head of IT Operations", [{ nama: "System Administrator", dari: null }, { nama: "COO", dari: null }]), ["System Administrator"]);
  assert.deepEqual(pembantuTugas(null, k), []);
});

test("aktivitas: satu kata kerja hanya sekali per kalimat (label bermakna sama digabung, berkas dihitung berbeda)", () => {
  const t0 = 1_800_000_000_000;
  const f = (i, label, detail = "") => ({ ts: t0 - i * 1000, agent: "Tech Lead · Tim 1", label, detail, tugas: "T-20260101-2" });
  const feed = [
    ...["a.mjs", "b.mjs", "a.mjs", "c.mjs"].map((d, i) => f(i, "Menulis", d)),                       // 3 berkas berbeda, 4 langkah
    ...Array.from({ length: 5 }, (_, i) => f(10 + i, "Mengubah berkas", "Apply edits")),              // perintah terminal yang mengubah berkas
    ...Array.from({ length: 3 }, (_, i) => f(20 + i, i ? "Memeriksa berkas" : "Membaca kode", i ? "Read notes" : "x.md")),
    f(30, "Mengurus Git"), f(31, "Menyimpan versi kode"), f(32, "Menjalankan tes"), f(33, "Menjalankan tes"),
  ];
  const kerja = kelompokAktivitas(feed, { "T-20260101-2": "x" })[0].baris[0].kerja;
  assert.equal(kerja, "mengubah 3 berkas (9 langkah), membaca berkas (3 langkah), menyimpan versi kode (2 langkah), dan langkah lain");
  // setiap pasangan & tiga sekaligus dari SEMUA label server yang bisa digabung: tiap kata kerja (kata pertama) muncul sekali
  const sumberServer = fs.readFileSync(path.join(HERE, "server.mjs"), "utf8");
  const label = [...new Set([...sumberServer.matchAll(/label: "([^"]+)"/g), ...sumberServer.matchAll(/^\s*\["([A-Z][^"]+)", \//gm)].map((m) => m[1]))]
    .filter((l) => !/^(Mengirim|Menerima|Menunggu|Men-deploy|Memanggil agent|Menyerahkan|Menyiapkan alat|Santai|Belum masuk|Dipanggil saat perlu)/.test(l));
  assert.ok(label.length >= 20, `label server terbaca: ${label.length}`);
  // semua kata kerja yang mungkin (kata pertama setiap frasa label server); tiap kata kerja paling banyak sekali per kalimat
  const KATA_KERJA = new Set(label.map((l) => kerjaAktivitas({ label: l }).split(" ")[0]));
  const kataKerja = (k) => k.split(/[\s,]+/).filter((w) => KATA_KERJA.has(w));
  for (const a of label) for (const b of label) for (const c of [a, label[0], label.at(-1)]) {
    const k2 = kelompokAktivitas([f(1, a, "p.mjs"), f(2, b, "q.mjs"), f(3, c, "r.mjs")], { "T-20260101-2": "x" })[0].baris[0].kerja;
    const kk = kataKerja(k2);
    assert.equal(new Set(kk).size, kk.length, `${a} + ${b} + ${c} → ${k2}`);
  }
  assert.equal(gabungFrasa(["menjalankan 2 perintah", "menjalankan tes (3×)"]), "menjalankan 2 perintah dan tes (3×)");
  assert.equal(gabungFrasa(["membaca 3 berkas", "membaca 2 halaman web", "mengubah berkas"]), "membaca 3 berkas serta 2 halaman web dan mengubah berkas");
  assert.equal(gabungFrasa(["menyusun ringkasan", "menyusun rencana kerja"]), "menyusun ringkasan dan rencana kerja");
  assert.equal(kunciLabel("Mengubah berkas"), "Menulis");
  assert.equal(frasaKerja("Membaca kode", 6, new Set(["a", "b", "c", "d", "e", "f"])), "membaca 6 berkas");
  assert.equal(frasaKerja("Menulis", 1), "mengubah berkas");
});

test("status 'Baru selesai' ditulis satu cara di semua tempat (label STATUS + waktu)", () => {
  const kini = 1_800_000_000_000;
  assert.equal(teksSelesai(kini - 20e3, kini), `${STATUS.selesai.label} · baru saja`);
  assert.equal(teksSelesai(kini - 61e3, kini), "Baru selesai · 1 mnt lalu");
  assert.equal(waktuSelesai(kini - 3 * 60e3, kini), "3 mnt lalu");
  const sumber = ["app/kantor.mjs", "app/jejak.mjs", "app/label.mjs", "app/adegan.mjs", "index.html"].map((b) => fs.readFileSync(path.join(HERE, b), "utf8")).join("\n");
  assert.doesNotMatch(sumber, /Selesai (baru saja|\$\{|\d+ mnt)/, "tidak ada bentuk 'Selesai …' kedua");
  assert.ok(terlarang("Selesai baru saja").length && terlarang("Selesai 4 mnt lalu").length);
  assert.deepEqual(terlarang("Baru selesai · 4 mnt lalu"), []);
});
