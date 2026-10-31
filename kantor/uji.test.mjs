// Uji penurunan status dari transkrip contoh. Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-uji-"));
const proj = path.join(tmp, "projects", "-contoh");
const desk = path.join(tmp, "desktop", "akun", "org");
fs.mkdirSync(proj, { recursive: true });
fs.mkdirSync(desk, { recursive: true });
const ROOT = path.join(tmp, "RudisOne");
process.env.RUDISONE_ROOT = ROOT;
process.env.RUDISONE_SERVER = path.join(tmp, "tidak-ada-server.json");
process.env.RUDISONE_KANTOR_PROJECTS = path.join(tmp, "projects");
process.env.RUDISONE_KANTOR_DESKTOP = path.join(tmp, "desktop");
// Fixture metadata berformat Desktop → backend dipaku desktop (backend cli: kantor/sesi-cli.test.mjs).
process.env.RUDISONE_SESI = path.join(tmp, "sesi.json");
fs.writeFileSync(process.env.RUDISONE_SESI, JSON.stringify({ backend: "desktop" }));
process.env.RUDISONE_KANTOR_TEAM_MD = path.join(tmp, "TEAM.md");
process.env.RUDISONE_KANTOR_REGISTER = path.join(tmp, "register-tugas.md");
process.env.RUDISONE_KANTOR_REGISTER_JSON = path.join(tmp, "register-tugas.json");   // belum ada → MD lama dipakai

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
function transkrip(id, baris) {
  fs.writeFileSync(path.join(proj, `${id}.jsonl`), baris.map((b) => JSON.stringify(b)).join("\n") + "\n");
}
const pakaiAlat = (msAgo, idAlat, name, input) =>
  ({ type: "assistant", timestamp: iso(msAgo), message: { content: [{ type: "tool_use", id: idAlat, name, input }] } });
const hasilAlat = (msAgo, idAlat) =>
  ({ type: "user", timestamp: iso(msAgo), message: { content: [{ type: "tool_result", tool_use_id: idAlat }] } });
/** Folder kerja sesi (baris metadata transkrip). */
const diFolder = (cwd) => ({ type: "system", cwd });
/** Pembuka peran RudisOne di pesan pertama. */
const pembuka = (msAgo, teks, cwd) => ({ type: "user", timestamp: iso(msAgo), ...(cwd ? { cwd } : {}), message: { content: teks } });

// System Administrator (agent-setting id teknis, ruang di repo RudisOne) sedang menjalankan ssh → bekerja di server
transkrip("s-server", [
  { type: "agent-setting", agentSetting: "system-administrator" }, { type: "custom-title", customTitle: "System Administrator" },
  diFolder(path.join(ROOT, "ruang", "system-administrator")),
  pakaiAlat(5e3, "t1", "Bash", { command: "ssh vps-uji 'uptime'", description: "Cek uptime server" }),
]);
// Sesi tugas berdasarkan judul, alat sudah selesai baru saja → berpikir (engineer tanpa nomor → kursi #1)
transkrip("s-prog", [
  { type: "custom-title", customTitle: "Software Engineer · infinite scroll" },
  pembuka(40e3, "Kamu adalah Software Engineer di RudisOne. Baca dan patuhi ..."),
  pakaiAlat(30e3, "t2", "Edit", { file_path: "/x/apps/web/ProductGrid.tsx" }), hasilAlat(20e3, "t2"),
]);
// Dikenali dari "Kamu adalah", menunggu jawaban pengguna
transkrip("s-ba", [
  { type: "custom-title", customTitle: "Analisis retur" },
  pembuka(60e3, "Kamu adalah Business Systems Analyst di RudisOne. Baca dan patuhi ..."),
  pakaiAlat(40e3, "t3", "AskUserQuestion", { questions: [] }),
]);
// COO (sesi di repo RudisOne) mengirim pesan ke id sesi Desktop Program Manager
transkrip("s-ork", [
  { type: "agent-setting", agentSetting: "coo" }, { type: "custom-title", customTitle: "COO · rilis" }, diFolder(ROOT),
  pakaiAlat(8e3, "t4", "SendMessage", { to: "local_pm", message: "[Tugas dari COO] Status rilis" }), hasilAlat(7e3, "t4"),
  { type: "assistant", timestamp: iso(6e3), message: { content: [{ type: "text", text: "Sudah dikirim." }] } },
]);
// Tech Lead (judul per proyek) membagi tugas ke engineer bernomor
transkrip("s-eng", [{ type: "custom-title", customTitle: "Tech Lead · kasir" },
  pembuka(9e3, "Kamu adalah Tech Lead di RudisOne untuk proyek kasir."),
  pakaiAlat(4e3, "t7", "SendMessage", { to: "Software Engineer #2 · kasir", message: "[Tugas dari Tech Lead] ubah file rahasia.ts" }), hasilAlat(3e3, "t7")]);
// Engineer bernomor duduk di kursinya sendiri
transkrip("s-prog2", [{ type: "custom-title", customTitle: "Software Engineer #2 · kasir" },
  pembuka(9e3, "Kamu adalah Software Engineer #2 di RudisOne."),
  pakaiAlat(2e3, "t8", "Edit", { file_path: "/x/a.ts" })]);
// Tim 2: proyek toko-b dari TEAM.md; sesi di worktree proyek → kursi tim itu; sesi non-tim di folder lain diabaikan
fs.writeFileSync(path.join(tmp, "TEAM.md"), [
  "## Corporate Strategy", "| Agent | Session id | Name | cwd |", "|---|---|---|---|",
  "| Head of Strategy | `local_aaaa0000-1111-2222-3333-444455556666` | `rudis-head-of-strategy` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-strategy` |", "",
  "## Engineering · Tim 2 · toko-b", "Folder proyek: `/x/toko-b`", "",
  "## Engineering · Tim 3 · toko", "Folder proyek: `/x/toko`", "",
  "| Agent | Peran | Session id | Name | Branch / worktree |", "|---|---|---|---|---|",
  "| Tech Lead | leader — atasan Business Systems Analyst | `local_bbbb0000-1111-2222-3333-444455556666` | `r3-lead-toko` | worktree |",
  "| Software Engineer #2 | anggota | `local_cccc0000-1111-2222-3333-444455556666` | `r3-se2-toko` | `/x/toko/.claude/worktrees/r3-se2-toko` |", "",
  "## IT Operations", "| Agent | Peran | Session id | Name | cwd |", "|---|---|---|---|---|",
  "| Head of IT Operations | leader | `local_dddd0000-1111-2222-3333-444455556666` | `rudis-head-of-it-operations` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations` |",
  "",
].join("\n"));
transkrip("s-lead2", [{ type: "custom-title", customTitle: "Tech Lead · toko-b" },
  pembuka(9e3, "Kamu adalah Tech Lead di RudisOne", "/x/toko-b/.claude/worktrees/r2-lead-toko-b"),
  pakaiAlat(3e3, "t9", "SendMessage", { to: "Business Systems Analyst · toko-b", message: "[Tinjau] T-20261024-9 · cek" })]);
// COO (agent-setting "coo") mengirim tugas ke id sesi TEAM.md dan ke nama sesi (kolom Name)
transkrip("s-coo", [{ type: "agent-setting", agentSetting: "coo" }, { type: "custom-title", customTitle: "COO" }, diFolder(ROOT),
  pakaiAlat(12e3, "c1", "SendMessage", { to: "local_aaaa0000-1111-2222-3333-444455556666", message: "[Tugas dari COO] T-20261024-7 · kaji harga" }),
  hasilAlat(11e3, "c1"),
  pakaiAlat(10e3, "c2", "SendMessage", { to: "rudis-head-of-it-operations", message: "[Tugas dari COO] cek server" }), hasilAlat(9e3, "c2"),
  { type: "assistant", timestamp: iso(8e3), message: { content: [{ type: "text", text: "Sudah dibagi." }] } }]);
// Tech Lead Tim 3 dikenali dari "Kamu adalah Tech Lead …" (judul tidak memuat peran); Software Engineer #2 dari judul
transkrip("s-lead3", [{ type: "custom-title", customTitle: "Kerja toko" },
  pembuka(9e3, "Kamu adalah Tech Lead di RudisOne untuk proyek toko.", "/x/toko/.claude/worktrees/r3-lead-toko"),
  pakaiAlat(3e3, "l3", "SendMessage", { to: "r3-se2-toko", message: "[Tugas dari Tech Lead] T-20261024-7 · bagian 2" })]);
transkrip("s-se2", [{ type: "custom-title", customTitle: "Software Engineer #2 · toko" },
  pembuka(9e3, "Kamu adalah Software Engineer #2 di RudisOne.", "/x/toko/.claude/worktrees/r3-se2-toko"),
  pakaiAlat(2e3, "e2", "Edit", { file_path: "/x/toko/b.ts" })]);
transkrip("s-lain", [{ type: "custom-title", customTitle: "Catatan pribadi" },
  { type: "user", timestamp: iso(9e3), cwd: "/Users/x/Neuron", message: { content: "halo" } }]);
// Sistem agent lain di device yang sama (nama peran sama, folder & pembuka berbeda) → tidak tampil, tidak memakan nomor tim
transkrip("s-asing", [{ type: "agent-setting", agentSetting: "technical-writer" }, { type: "custom-title", customTitle: "Technical Writer" },
  diFolder("/Users/x/SistemLain/ruang/technical-writer"), pakaiAlat(3e3, "a1", "Edit", { file_path: "/x/doc.md" })]);
transkrip("s-asing2", [{ type: "custom-title", customTitle: "Tech Lead · lain" },
  pembuka(9e3, "Kamu adalah Tech Lead di Tim Lain untuk proyek lain.", "/x/lain/.claude/worktrees/t1-lead-lain"),
  pakaiAlat(3e3, "a2", "Edit", { file_path: "/x/lain/a.ts" })]);
// asisten (subagent) milik Tech Lead Tim 1: satu aktif, satu sudah lama selesai
function asisten(induk, id, meta, baris) {
  const dir = path.join(proj, induk, "subagents"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `agent-${id}.jsonl`), baris.map((b) => JSON.stringify({ ...b, isSidechain: true })).join("\n") + "\n");
  fs.writeFileSync(path.join(dir, `agent-${id}.meta.json`), JSON.stringify(meta));
}
asisten("s-eng", "aktif1", { agentType: "general-purpose", description: "Asisten ubah qty", finished: false },
  [pakaiAlat(2e3, "u1", "Edit", { file_path: "/x/qty.ts" })]);
asisten("s-eng", "lama1", { agentType: "general-purpose", description: "Cek lama", finished: true },
  [pakaiAlat(600e3, "u2", "Read", { file_path: "/x/a.ts" }), hasilAlat(590e3, "u2")]);
transkrip("s-pm", [{ type: "agent-setting", agentSetting: "program-manager" }, { type: "custom-title", customTitle: "Program Manager" },
  diFolder(path.join(ROOT, "ruang", "program-manager")),
  { type: "assistant", timestamp: iso(600e3), message: { content: [{ type: "text", text: "Siap." }] } }]);
// Sesi diarsipkan → tidak tampil; uji headless tanpa judul → tidak tampil
transkrip("s-riset", [{ type: "agent-setting", agentSetting: "research-analyst" }, { type: "custom-title", customTitle: "Research Analyst · lama" },
  diFolder(path.join(ROOT, "ruang", "research-analyst")), pakaiAlat(5e3, "t5", "WebSearch", { query: "x" })]);
transkrip("s-headless", [{ type: "agent-setting", agentSetting: "financial-controller" }, diFolder(path.join(ROOT, "ruang", "financial-controller")),
  pakaiAlat(5e3, "t6", "Read", { file_path: "/a/b.md" })]);

fs.writeFileSync(path.join(desk, "local_pm.json"), JSON.stringify({ sessionId: "local_pm", cliSessionId: "s-pm", isArchived: false, title: "Program Manager" }));
fs.writeFileSync(path.join(desk, "local_riset.json"), JSON.stringify({ sessionId: "local_riset", cliSessionId: "s-riset", isArchived: true, title: "Research Analyst · lama" }));

// Model "inti kecil + subagent": subagent peran (agentType rudis-<id-peran>) duduk di kursi peran itu
asisten("s-lead2", "se-a", { agentType: "rudis-software-engineer", description: "Kerjakan diskon", finished: false },
  [pembuka(5e3, "Kamu adalah Software Engineer di RudisOne."), pakaiAlat(2e3, "sa1", "Edit", { file_path: "/x/toko-b/diskon.ts" })]);
asisten("s-lead2", "se-b", { agentType: "rudis-software-engineer", description: "Tes diskon", finished: false },
  [pakaiAlat(3e3, "sb1", "Bash", { command: "npm test", description: "Tes diskon" })]);
asisten("s-coo", "strat1", { agentType: "rudisone:rudis-head-of-strategy", description: "Kaji harga", finished: false },
  [pakaiAlat(4e3, "hs1", "WebSearch", { query: "harga" })]);
// subagent peran yang sudah selesai: tidak menduduki kursi, tidak tampil sebagai asisten, log tetap tercatat
asisten("s-coo", "hr1", { agentType: "rudis-hr-business-partner", description: "Draf JD", finished: true },
  [pakaiAlat(200e3, "hr1", "Write", { file_path: "/x/jd.md" }), hasilAlat(190e3, "hr1")]);
// meta tanpa agentType → dikenali dari pembuka "Kamu adalah <Jabatan> …"
asisten("s-coo", "pm1", { description: "Rekap rilis", finished: false },
  [pembuka(6e3, "Kamu adalah Program Manager di RudisOne. Rekap rilis."), pakaiAlat(1e3, "pm1", "Read", { file_path: "/x/rilis.md" })]);
// subagent general-purpose tetap asisten walau pembukanya menyebut jabatan
asisten("s-coo", "gp1", { agentType: "general-purpose", description: "Asisten riset", finished: false },
  [pembuka(6e3, "Kamu adalah Research Analyst di RudisOne."), pakaiAlat(1e3, "gp1", "WebSearch", { query: "x" })]);

const kepalaRegister = ["## Aktif", "", "| ID | Tugas | Folder | Divisi | Pemilik | Prioritas | Status | Diperbarui |", "|---|---|---|---|---|---|---|---|"];
fs.writeFileSync(path.join(tmp, "register-tugas.md"), [...kepalaRegister,
  "| T-20261024-7 | Harga toko | `~/Documents/toko` | Engineering · Tim 3 | Tech Lead · toko | normal | berjalan | 2026-10-24 10:00 |"].join("\n"));

const { scan, buildState, describeTool, hostDiizinkan, VERSI, jenisPesan, KURSI, bacaRegister } = await import("./server.mjs");
scan();
const st = buildState();
const ag = (n) => st.agents.find((a) => a.name === n);

test("System Administrator (agent-setting id baru) bekerja di server dengan deskripsi perintah", () => {
  assert.equal(ag("System Administrator").status, "bekerja");
  assert.equal(ag("System Administrator").label, "Bekerja di server");
  assert.equal(ag("System Administrator").detail, "Cek uptime server");
});
test("sesi tugas dikenali dari judul dan berstatus berpikir setelah alat selesai (tanpa nomor → kursi #1)", () => {
  assert.equal(ag("Software Engineer #1 · Tim 1").status, "berpikir");
});
test("engineer bernomor menempati kursinya sendiri", () => {
  assert.equal(ag("Software Engineer #2 · Tim 1").status, "bekerja");
  assert.equal(ag("Software Engineer #1 · Tim 3").present, false);
  assert.equal(st.agents.length, KURSI.length);
});
test("agent dikenali dari 'Kamu adalah' dan menunggu jawaban pengguna", () => {
  assert.equal(ag("Business Systems Analyst · Tim 1").status, "menunggu");
});
test("pesan ke id sesi Desktop diterjemahkan ke nama agent di log", () => {
  assert.ok(st.feed.some((f) => f.agent === "COO" && f.icon === "pesan" && f.to === "Program Manager"));
  assert.equal(ag("COO").status, "santai");
});
test("leader divisi & anggota kolam bernomor dikenali", () => {
  assert.equal(ag("Tech Lead · Tim 1").present, true);
  const kirim = st.feed.find((f) => f.agent === "Tech Lead · Tim 1" && f.icon === "pesan");
  assert.equal(kirim?.to, "Software Engineer #2 · Tim 1");
  assert.equal(kirim?.jenis, "tugas");
  assert.equal(kirim?.detail, "Tugas");            // hanya jenis, bukan isi pesan
});
test("tim per proyek: nomor dari TEAM.md, worktree dikenali, sesi non-tim tidak memakan nomor", () => {
  assert.equal(ag("Tech Lead · Tim 2").present, true);
  const kirim = st.feed.find((f) => f.agent === "Tech Lead · Tim 2" && f.icon === "pesan");
  assert.equal(kirim?.to, "Business Systems Analyst · Tim 2");
  assert.equal(kirim?.jenis, "tinjau");
  assert.ok(st.tim.some((x) => x.n === 2 && x.proyek === "toko-b"));
  assert.ok(!st.tim.some((x) => x.proyek === "Neuron"));
});
test("asisten (subagent) tampil di kursi pemanggilnya; yang lama selesai tidak", () => {
  const a = st.asisten.find((x) => x.id === "aktif1");
  assert.equal(a?.induk, "Tech Lead · Tim 1");
  assert.equal(a?.status, "aktif");
  assert.equal(a?.label, "Menulis");
  assert.equal(a?.deskripsi, "Asisten ubah qty");
  assert.ok(!st.asisten.some((x) => x.id === "lama1"));
  assert.equal(ag("Tech Lead · Tim 1").status === "absen", false);   // transkrip asisten tidak dihitung sebagai sesi
});
test("sesi yang diarsipkan dan uji headless tanpa judul tidak tampil", () => {
  assert.equal(ag("Research Analyst").present, false);
  assert.equal(ag("Financial Controller").present, false);
  assert.equal(ag("Technical Writer").present, false);
});
test("jenis pesan hanya dari tag awal", () => {
  assert.equal(jenisPesan("[Laporan ke Tech Lead] x"), "laporan");
  assert.equal(jenisPesan("[Permintaan staf dari Program Manager] y"), "tugas");
  assert.equal(jenisPesan("[Diterima] z — bersihkan konteksmu"), "diterima");
  assert.equal(jenisPesan("halo [Tugas] bukan di awal"), null);
});
test("deskripsi alat tidak membocorkan isi pesan atau perintah panjang", () => {
  const d = describeTool("Bash", { command: "a".repeat(500) });
  assert.ok(d.detail.length <= 70);
  assert.equal(describeTool("Bash", { command: "./deploy.sh abc" }).label, "Men-deploy rilis");
  assert.equal(describeTool("Read", { file_path: "/rahasia/dir/file.ts" }).detail, "file.ts");
});

test("hanya Host lokal yang dilayani (DNS rebinding)", () => {
  assert.equal(hostDiizinkan("127.0.0.1:7421", 7421), true);
  assert.equal(hostDiizinkan("LOCALHOST:7421", 7421), true);
  assert.equal(hostDiizinkan("jahat.example:7421", 7421), false);
  assert.equal(hostDiizinkan("127.0.0.1:80", 7421), false);
  assert.equal(hostDiizinkan(undefined, 7421), false);
});
test("versi server = sidik kode", () => {
  assert.match(VERSI, /^[0-9a-f]{12}$/);
});

test("register tugas: hanya tugas belum selesai, semua tabel, segera di atas", () => {
  const md = [
    "## Aktif", "",
    "| ID | Tugas | Folder | Divisi | Pemilik | Prioritas | Status | Kunci | Bergantung | Diperbarui |",
    "|---|---|---|---|---|---|---|---|---|---|",
    "| T-20261024-2 | Perbaikan cetak SJ | `~/Documents/kasir` | Engineering | Tech Lead · kasir | normal | berjalan | repo:kasir:print | — | 2026-10-24 09:10 |",
    "| T-20261024-3 | Insiden stok minus | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations` | IT Operations | Head of IT Operations | segera | berjalan | prod-db:kasir | — | 2026-10-24 09:12 |",
    "", "## Selesai", "",
    "| ID | Tanggal | Tugas | Folder | Pemilik | Status | Bukti / hasil |", "|---|---|---|---|---|---|---|",
    "| T-20261023-1 | 2026-10-23 | Lama | `~/x` | Research Analyst | selesai | ok |", "",
    "| ID | Tanggal | Tugas | Divisi | Leader/staf | Bergantung pada | Status | Bukti / hasil |", "|---|---|---|---|---|---|---|---|",
    "| T-20261022-9 | 2026-10-22 | Format lain | Staf | Research Analyst | — | antre | — |",
  ].join("\n");
  const t = bacaRegister(md);
  assert.deepEqual(t.map((x) => x.id), ["T-20261024-3", "T-20261024-2", "T-20261022-9"]);
  assert.equal(t[0].folder, "~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations");
  assert.equal(t[0].pemilik, "Head of IT Operations");
  assert.equal(t[1].pemilik, "Tech Lead · kasir");
  assert.equal(t[2].pemilik, "Research Analyst");
  assert.ok(Array.isArray(st.tugas));
});
test("register-tugas.md dibaca; register tidak ada → papan kosong", () => {
  assert.deepEqual(st.tugas.map((x) => x.id), ["T-20261024-7"]);
  assert.equal(st.tugas[0].pemilik, "Tech Lead · toko");
  fs.rmSync(path.join(tmp, "register-tugas.md"));
  assert.deepEqual(buildState().tugas, []);
});

test("sesi sistem agent lain di device yang sama tidak tampil dan tidak memakan nomor tim", () => {
  assert.equal(ag("Technical Writer").present, false);
  assert.ok(!st.tim.some((x) => x.proyek === "lain"));
  assert.ok(!st.feed.some((f) => f.detail === "doc.md"));
});

test("nama & id peran baru: agent-setting id, judul, 'Kamu adalah …' berspasi, TEAM.md (kolom Agent & Name)", () => {
  assert.equal(ag("COO").present, true);                                  // agent-setting "coo"
  assert.ok(st.feed.some((f) => f.agent === "COO" && f.to === "Head of Strategy"));         // id sesi dari TEAM.md
  assert.ok(st.feed.some((f) => f.agent === "COO" && f.to === "Head of IT Operations"));    // kolom Name TEAM.md
  assert.equal(ag("Tech Lead · Tim 3").present, true);                    // "Kamu adalah Tech Lead di RudisOne"
  const kirim = st.feed.find((f) => f.agent === "Tech Lead · Tim 3" && f.icon === "pesan");
  assert.equal(kirim?.to, "Software Engineer #2 · Tim 3");                // `r3-se2-toko` dari TEAM.md
  assert.equal(ag("Software Engineer #2 · Tim 3").status, "bekerja");     // judul "Software Engineer #2 · toko"
  assert.ok(st.tim.some((x) => x.n === 3 && x.proyek === "toko"));
  assert.ok(KURSI.includes("Head of IT Operations") && !KURSI.some((k) => /Agent|ChiefAI|TechLead/.test(k)));
});

test("register-tugas.json dibaca bila ada (tanpa MD pun); JSON rusak → kembali ke MD lama", async () => {
  const fileJson = path.join(tmp, "register-tugas.json"), fileMd = path.join(tmp, "register-tugas.md");
  const t = (id, judul, prioritas, status, dibuat, extra = {}) => ({ id, judul, folder: "~/Documents/toko/", divisi: "Engineering · Tim 3",
    pemilik: "Tech Lead · toko", prioritas, status, fase: "Konstruksi", kunci: ["repo:toko"], bergantung: [], perkakas: "—",
    dibuat, diperbarui: dibuat, ...extra });
  fs.writeFileSync(fileJson, JSON.stringify({ versi: 1, diperbarui: new Date().toISOString(), tugas: [
    t("T-20261030-1", "Normal lama", "normal", "berjalan", "2026-10-30T01:00:00.000Z"),
    t("T-20261030-2", "Segera", "segera", "antre", "2026-10-30T03:00:00.000Z"),
    t("T-20261030-3", "Sudah selesai", "segera", "selesai", "2026-10-30T00:00:00.000Z", { selesai_pada: "2026-10-30" }),
    t("T-20261030-3.1", "Sub-tugas", "normal", "berjalan", "2026-10-30T02:00:00.000Z"),
  ] }));
  const tugas = buildState().tugas;
  assert.deepEqual(tugas.map((x) => x.id), ["T-20261030-2", "T-20261030-1", "T-20261030-3.1"]);
  assert.equal(tugas[0].tugas, "Segera");
  assert.equal(tugas[0].folder, "~/Documents/toko");
  assert.equal(tugas[0].pemilik, "Tech Lead · toko");
  assert.match(tugas[0].diperbarui, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  fs.writeFileSync(fileMd, [...kepalaRegister, "| T-20261024-8 | Dari MD | `~/x` | IT Operations | Head of IT Operations | normal | berjalan | 2026-10-24 10:00 |"].join("\n"));
  fs.writeFileSync(fileJson, "{ rusak");
  assert.deepEqual(buildState().tugas.map((x) => x.id), ["T-20261024-8"]);
});

test("subagent peran (agentType rudis-<id-peran>) bekerja di kursi peran itu, bukan sebagai asisten", () => {
  const se1 = ag("Software Engineer #1 · Tim 2"), se2 = ag("Software Engineer #2 · Tim 2");
  assert.equal(se1.present, true);
  assert.equal(se1.mode, "aktif");
  assert.equal(se1.status, "bekerja");
  assert.equal(se1.label, "Menulis");
  assert.deepEqual(se1.subagent, { dari: "Tech Lead · Tim 2", id: "se-a", deskripsi: "Kerjakan diskon" });
  assert.equal(se2.subagent?.id, "se-b");                            // subagent engineer kedua → kursi #2 yang kosong
  assert.equal(se2.label, "Menjalankan tes");
  const hs = ag("Head of Strategy");                                  // tipe berawalan plugin, dipanggil COO
  assert.equal(hs.mode, "aktif");
  assert.equal(hs.subagent?.dari, "COO");
  assert.ok(st.feed.some((f) => f.agent === "Head of Strategy" && f.label === "Riset di web"));
  for (const id of ["se-a", "se-b", "strat1", "hr1", "pm1"]) assert.ok(!st.asisten.some((x) => x.id === id), id);
});
test("subagent peran: selesai → kursi katalog lagi (log tetap); tanpa agentType → dari 'Kamu adalah'; general-purpose → asisten", () => {
  const hr = ag("HR Business Partner");
  assert.equal(hr.present, false);
  assert.equal(hr.mode, "katalog");
  assert.ok(st.feed.some((f) => f.agent === "HR Business Partner" && f.label === "Menulis"));
  const pm = ag("Program Manager");                                   // sesi lama santai + subagent berjalan → aktif
  assert.equal(pm.mode, "aktif");
  assert.equal(pm.subagent?.dari, "COO");
  assert.equal(pm.sessions.length, 2);
  const gp = st.asisten.find((x) => x.id === "gp1");
  assert.equal(gp?.induk, "COO");
  assert.equal(ag("Research Analyst").present, false);
});
test("keadaan peran: aktif / siaga / katalog (dipanggil saat perlu) / absen hanya untuk sesi tetap", () => {
  assert.equal(ag("COO").mode, "siaga");                              // sesi tetap hidup, diam
  assert.equal(ag("COO").tetap, true);
  assert.equal(ag("System Administrator").mode, "aktif");
  assert.equal(ag("System Administrator").present, true);             // sesi IT Operations yang hidup
  assert.equal(ag("Head of IT Operations").mode, "katalog");          // IT Operations dibentuk saat dibutuhkan
  assert.equal(ag("Head of IT Operations").tetap, false);
  const tw = ag("Technical Writer");
  assert.equal(tw.mode, "katalog");
  assert.equal(tw.label, "Dipanggil saat perlu");
  assert.equal(tw.status, "absen");                                   // kompatibel dengan klien lama
  assert.equal(ag("Business Systems Analyst · Tim 3").mode, "katalog");
  assert.equal(ag("Tech Lead · Tim 3").tetap, true);                  // tim 3 punya proyek
  for (const a of st.agents) assert.ok(["aktif", "siaga", "katalog", "absen"].includes(a.mode), a.name);
  assert.ok(st.agents.filter((a) => a.mode === "absen").every((a) => a.tetap));
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
