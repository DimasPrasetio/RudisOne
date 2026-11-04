// Istilah baku Kantor (kantor/app/istilah.mjs; DESAIN.md › Istilah): singkatan & label status satu sumber, kalimat
// aktivitas tanpa perintah mentah atau nama alat internal, dan teks halaman bebas istilah terlarang. Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIM, URUT } from "./app/denah.mjs";
import { keteranganSiap, teksSelesai } from "./app/jejak.mjs";
import {
  BATAS_RINCIAN, DAFTAR_SINGKATAN, JEDA_GABUNG_MS, STATUS, STATUS_TUGAS, TAHAP, TERLARANG, URUT_STATUS, durasi, kalimatWaktuTahap,
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
  assert.equal(kerjaAktivitas({ label: "Mengirim pesan ke Tech Lead · Tim 1", detail: "Laporan" }), "mengirim laporan ke Tech Lead · Tim 1");
  assert.equal(kerjaAktivitas({ label: "Menerima pesan dari agent lain" }), "menerima pesan dari rekan");
  assert.equal(kerjaAktivitas({ label: "Membaca kode" }, 6), "membaca 6 berkas");
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
