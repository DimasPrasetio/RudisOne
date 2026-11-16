// Uji sinyal langsung hook (bin/kantor-kejadian.mjs → handoff/.kantor/) di server Kantor: kejadian → status, kapan tanda
// hilang, "selesai" pasti, subagent, dan waktu dari kejadian sampai halaman (SSE). Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-kejadian-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const ROOT = path.join(tmp, "RudisOne");
const PROJECTS = path.join(tmp, "projects");
const proj = path.join(PROJECTS, "-rudisone");
const KEJ = path.join(tmp, "kejadian");
fs.mkdirSync(proj, { recursive: true });
fs.mkdirSync(KEJ, { recursive: true });
const ENV = {
  RUDISONE_ROOT: ROOT, RUDISONE_SERVER: path.join(tmp, "tidak-ada-server.json"), RUDISONE_KANTOR_PROJECTS: PROJECTS,
  RUDISONE_KANTOR_DESKTOP: path.join(tmp, "desktop"), RUDISONE_SESI: path.join(tmp, "sesi.json"),
  RUDISONE_KANTOR_TEAM_MD: path.join(tmp, "TEAM.md"), RUDISONE_KANTOR_REGISTER: path.join(tmp, "register-tugas.md"),
  RUDISONE_KANTOR_REGISTER_JSON: path.join(tmp, "register-tugas.json"), RUDISONE_KANTOR_KEJADIAN: KEJ,
  RUDISONE_SETTINGS_USER: path.join(tmp, "settings.json"),
};
fs.writeFileSync(ENV.RUDISONE_SESI, JSON.stringify({ backend: "desktop" }));
Object.assign(process.env, ENV);
const { buildState, gabungKejadian, scan } = await import("./server.mjs");

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const tulisTranskrip = (id, baris, dir = proj) => fs.writeFileSync(path.join(dir, `${id}.jsonl`), baris.map((b) => JSON.stringify(b)).join("\n") + "\n");
const tambahBaris = (id, baris, dir = proj) => fs.appendFileSync(path.join(dir, `${id}.jsonl`), baris.map((b) => JSON.stringify(b)).join("\n") + "\n");
const kepala = (judul, peran) => [{ type: "agent-setting", agentSetting: peran }, { type: "custom-title", customTitle: judul },
  { type: "system", cwd: path.join(ROOT, "ruang", peran) }];
const pakai = (msAgo, id, name, msg = `msg-${id}`, input = {}) => ({ type: "assistant", timestamp: iso(msAgo), message: { id: msg, content: [{ type: "tool_use", id, name, input }] } });
const hasil = (msAgo, id) => ({ type: "user", timestamp: iso(msAgo), message: { content: [{ type: "tool_result", tool_use_id: id }] } });
const teksModel = (msAgo, msg = "msg-akhir") => ({ type: "assistant", timestamp: iso(msAgo), message: { id: msg, content: [{ type: "text", text: "Selesai." }] } });
const prompt = (msAgo, teks = "lanjutkan") => ({ type: "user", timestamp: iso(msAgo), message: { content: teks } });
const kejadian = (nama, isi) => fs.writeFileSync(path.join(KEJ, nama), JSON.stringify(isi));
const agen = (s, nama) => s.agents.find((a) => a.name === nama);
const keadaan = () => { scan(); return buildState(); };

// ---------- fungsi murni gabungKejadian ----------
// Bentuk kejadian sesuai Claude Code 2.1.317: PermissionRequest TIDAK membawa tool_use_id (hanya nama alat `a`);
// PreToolUse AskUserQuestion membawa id `u`; Notification tidak membawa keduanya.
const sesiKosong = () => ({ lastPrompt: 0, lastHasil: 0, asistenTerakhir: { ts: 0, msg: null }, hasilAlat: new Map(), alatInfo: new Map() });
const ST = { status: "bekerja", label: "Menjalankan perintah", detail: "", icon: "terminal", since: 0 };
const KINI = 50_000;
const g = (s, kej, kini = KINI) => gabungKejadian(ST, s, kej, kini).st;

test("izin (nama alat saja): menunggu sampai alat bernama itu selesai; blok lanjutan pesan yang sama & alat paralel lain tidak menjawab", () => {
  const s = sesiKosong();
  s.alatInfo.set("b-lama", { nama: "Bash", ts: 100, msg: "m0" }); s.hasilAlat.set("b-lama", 200);   // Bash sebelumnya, sudah selesai
  s.alatInfo.set("b1", { nama: "Bash", ts: 990, msg: "m1" });
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: null };
  assert.equal(g(s, kej).status, "menunggu");
  assert.equal(g(s, kej).label, "Menunggu izin Anda");
  s.alatInfo.set("w1", { nama: "WebSearch", ts: 991, msg: "m1" }); s.hasilAlat.set("w1", 1500); s.lastHasil = 1500;   // paralel, beda alat
  assert.equal(g(s, kej).status, "menunggu");
  s.asistenTerakhir = { ts: 1200, msg: "m1" };                              // blok berikut dari pesan model yang sama
  assert.equal(g(s, kej).status, "menunggu");
  s.hasilAlat.set("b1", 2000);                                              // dijawab (diizinkan & selesai, atau ditolak)
  assert.deepEqual(gabungKejadian(ST, s, kej, KINI), { st: ST, selesai: null });
});
test("izin: alat belum terbaca dari transkrip (dijalankan sebelum pesannya tertulis) tetap menunggu; baris pesannya menyusul", () => {
  const s = sesiKosong();
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: null };
  assert.equal(g(s, kej).status, "menunggu");
  s.alatInfo.set("b1", { nama: "Bash", ts: 1050, msg: "m1" }); s.asistenTerakhir = { ts: 1050, msg: "m1" };
  assert.equal(g(s, kej).status, "menunggu");
  s.asistenTerakhir = { ts: 1300, msg: "m2" };                              // model melangkah dari pesan baru → sudah dijawab
  assert.equal(g(s, kej), ST);
});
test("izin tanpa pemberitahuan ±6 dtk di sesi yang terbukti mengirim pemberitahuan = jendelanya sudah ditutup (izin diberikan)", () => {
  const s = sesiKosong(); s.alatInfo.set("b1", { nama: "Bash", ts: 990, msg: "m1" });   // perintah panjang masih berjalan
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: 500 };
  assert.equal(g(s, kej, 1000 + 8000).status, "menunggu");                  // belum lewat 6 dtk + kelonggaran
  assert.equal(g(s, kej, 1000 + 9000), ST);                                 // tak ada pemberitahuan → sudah dijawab
  assert.equal(g(s, { ...kej, n: 7000, bt: 7000 }, 1000 + 60e3).status, "menunggu");   // pemberitahuan datang → masih terbuka
  assert.equal(g(s, { ...kej, bt: null }, 1000 + 60e3).status, "menunggu");  // belum terbukti → tidak disimpulkan
  assert.equal(g(s, { ...kej, bt: null }, 1000 + 5 * 3600e3), ST);           // batas umur (proses mati tanpa SessionEnd)
});
test("izin (nama alat): alat bernama sama di pesan model BERIKUTNYA bukan yang ditunggu — langkah itu menjawab izinnya", () => {
  const s = sesiKosong();
  s.alatInfo.set("b1", { nama: "Bash", ts: 990, msg: "m1" });
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: null };
  s.hasilAlat.set("b1", 3000); s.lastHasil = 3000;                          // diizinkan, perintah singkat selesai
  s.alatInfo.set("b2", { nama: "Bash", ts: 5000, msg: "m2" }); s.asistenTerakhir = { ts: 5000, msg: "m2" };   // Bash berikutnya (≤ t+10 dtk), lama
  assert.equal(g(s, kej), ST);
  // alat dijalankan sebelum pesannya tertulis: pemilik = pesan PERTAMA sesudah kejadian, pesan sesudahnya tidak ikut
  const s2 = sesiKosong();
  s2.alatInfo.set("c1", { nama: "Bash", ts: 1200, msg: "m1" }); s2.alatInfo.set("c2", { nama: "Bash", ts: 6000, msg: "m2" });
  s2.asistenTerakhir = { ts: 1200, msg: "m1" };
  assert.equal(g(s2, kej).status, "menunggu");
  s2.hasilAlat.set("c1", 4000); s2.asistenTerakhir = { ts: 6000, msg: "m2" };
  assert.equal(g(s2, kej), ST);
});
test("izin: pemberitahuan SESUDAH jawaban = jendela lain (alat paralel) masih terbuka; hilang setelah ada hasil/langkah sesudahnya", () => {
  const s = sesiKosong();
  s.alatInfo.set("w1", { nama: "WebFetch", ts: 990, msg: "m1" }); s.alatInfo.set("m1x", { nama: "mcp__srv__baca", ts: 990, msg: "m1" });
  const kej = { k: "izin", t: 1000, u: null, a: "mcp__srv__baca", n: 7000, bt: 7000 };   // izin WebFetch tertimpa di berkas
  s.hasilAlat.set("m1x", 3000); s.lastHasil = 3000;
  assert.equal(g(s, kej, 30e3).status, "menunggu");
  s.hasilAlat.set("w1", 9000); s.lastHasil = 9000;                         // jendela WebFetch dijawab
  assert.equal(g(s, kej, 30e3), ST);
});
test("izin (nama alat): alat yatim bernama sama dari pesan model lama bukan pemiliknya", () => {
  const s = sesiKosong();
  s.alatInfo.set("yatim", { nama: "Bash", ts: 100, msg: "m0" });           // tanpa hasil (proses mati / sesi dilanjutkan)
  s.alatInfo.set("r1", { nama: "Read", ts: 500, msg: "m1" }); s.hasilAlat.set("r1", 600);
  s.alatInfo.set("b1", { nama: "Bash", ts: 1300, msg: "m2" }); s.asistenTerakhir = { ts: 1300, msg: "m2" };   // tertulis sesudah kejadian
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: null };
  assert.equal(g(s, kej).status, "menunggu");
  s.hasilAlat.set("b1", 4000); s.lastHasil = 4000;
  assert.equal(g(s, kej), ST);
});
test("izin (nama alat): alat yatim di pesan model TERAKHIR giliran lalu (sebelum pesan masuk terakhir) bukan pemiliknya", () => {
  const s = sesiKosong();
  s.alatInfo.set("yatim", { nama: "Bash", ts: 100, msg: "m0" });           // proses mati sebelum hasilnya tertulis
  s.lastPrompt = 500;                                                       // sesi dilanjutkan: pesan masuk baru
  s.alatInfo.set("b1", { nama: "Bash", ts: 1300, msg: "m1" }); s.asistenTerakhir = { ts: 1300, msg: "m1" };   // tertulis sesudah kejadian
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: null };
  assert.equal(g(s, kej).status, "menunggu");
  s.hasilAlat.set("b1", 4000); s.lastHasil = 4000;
  assert.equal(g(s, kej), ST);
});
test("jendela yang hanya dikenal dari pemberitahuan (tanpa id & nama): langkah subagent sesi ini sesudahnya menjawabnya", () => {
  const s = sesiKosong();
  const kej = { k: "izin", t: 1000, u: null, a: null, n: 1000, bt: null };
  assert.equal(gabungKejadian(ST, s, kej, 60e3, { lain: 900 }).st.status, "menunggu");
  assert.equal(gabungKejadian(ST, s, kej, 60e3, { lain: 2000 }).st, ST);
});
test("bukti pemberitahuan tertunda berlaku untuk seluruh sesi (opsi.bt; 0 = sesi Desktop)", () => {
  const s = sesiKosong(); s.alatInfo.set("b1", { nama: "Bash", ts: 990, msg: "m1" });
  const kej = { k: "izin", t: 1000, u: null, a: "Bash", n: null, bt: null };
  assert.equal(gabungKejadian(ST, s, kej, 10e3).st.status, "menunggu");               // berkas sendiri belum terbukti
  assert.equal(gabungKejadian(ST, s, kej, 10e3, { bt: 0 }).st, ST);                   // sesi Desktop
  assert.equal(gabungKejadian(ST, s, kej, 10e3, { bt: 50e3 }).st, ST);                // terbukti di subagent/induk, kapan pun
  assert.equal(gabungKejadian(ST, s, kej, 10e3, { bt: null }).st.status, "menunggu"); // belum terbukti di mana pun
});
test("tanya (id alat) & Notification saja; pesan masuk baru menjawab semuanya", () => {
  const s = sesiKosong(); s.alatInfo.set("q1", { nama: "AskUserQuestion", ts: 990, msg: "m1" });
  assert.equal(g(s, { k: "tanya", t: 1000, u: "q1" }).label, "Menunggu jawaban Anda");
  assert.equal(g({ ...s, lastPrompt: 1100 }, { k: "tanya", t: 1000, u: "q1" }), ST);
  assert.equal(g({ ...s, lastHasil: 900 }, { k: "izin", t: 1000 }).status, "menunggu");
  assert.equal(g({ ...s, lastHasil: 1100 }, { k: "izin", t: 1000 }), ST);
});
test("selesai/keluar: santai dengan waktu selesai = waktu kejadian; giliran baru sesudahnya mengalahkan", () => {
  const s = sesiKosong(); s.asistenTerakhir = { ts: 900, msg: "m1" };
  for (const k of ["selesai", "keluar"]) {
    const h = gabungKejadian(ST, s, { k, t: 1000 }, KINI);
    assert.equal(h.st.status, "santai"); assert.equal(h.selesai, 1000);
  }
  assert.deepEqual(gabungKejadian(ST, { ...s, lastPrompt: 1200 }, { k: "selesai", t: 1000 }, KINI), { st: ST, selesai: null });
  assert.deepEqual(gabungKejadian(ST, { ...s, asistenTerakhir: { ts: 1200, msg: "m2" } }, { k: "selesai", t: 1000 }, KINI), { st: ST, selesai: null });
  assert.deepEqual(gabungKejadian(ST, s, null, KINI), { st: ST, selesai: null });
});

// ---------- dari berkas kejadian sampai /state ----------
test("sesi meminta izin → 'Menunggu Anda' dengan waktu kejadian; tanda hilang begitu hasil alatnya tercatat", () => {
  tulisTranskrip("s-sa", [...kepala("System Administrator", "system-administrator"), prompt(60e3, "cek server"),
    pakai(20e3, "t-ssh", "Bash", "m-ssh", { command: "ssh vps 'uptime'", description: "Cek uptime" })]);
  const t = now - 19e3;
  kejadian("s-sa.json", { k: "izin", t, a: "Bash" });
  let a = agen(keadaan(), "System Administrator");
  assert.equal(a.status, "menunggu"); assert.equal(a.label, "Menunggu izin Anda"); assert.equal(a.since, t);
  tambahBaris("s-sa", [hasil(1e3, "t-ssh")]);
  a = agen(keadaan(), "System Administrator");
  assert.notEqual(a.status, "menunggu");
});
test("izin di sesi yang tidak dikenali Kantor (bukan RudisOne) tidak tampil", () => {
  fs.mkdirSync(path.join(PROJECTS, "-pribadi"), { recursive: true });
  tulisTranskrip("s-pribadi", [{ type: "custom-title", customTitle: "Catatan belanja" }, { type: "system", cwd: path.join(tmp, "pribadi") },
    prompt(30e3, "buat daftar"), pakai(20e3, "t-p", "Bash", "m-p")], path.join(PROJECTS, "-pribadi"));
  kejadian("s-pribadi.json", { k: "izin", t: now - 10e3, u: "t-p" });
  const s = keadaan();
  assert.ok(!JSON.stringify(s).includes("Catatan belanja"));
  assert.ok(!s.agents.some((x) => x.status === "menunggu" && x.sessions.some((y) => y.title === "Catatan belanja")));
});
test("Stop → 'Baru selesai' pada waktu kejadian, bukan setelah ambang berpikir 3 menit", () => {
  tulisTranskrip("s-hos", [...kepala("Head of Strategy", "head-of-strategy"), prompt(70e3, "analisis"),
    pakai(40e3, "t-r", "Read", "m-r", { file_path: "/x/a.md" }), hasil(35e3, "t-r")]);
  // tanpa sinyal: hasil alat 35 dtk lalu → berpikir (ambang 3 menit)
  assert.equal(agen(keadaan(), "Head of Strategy").status, "berpikir");
  kejadian("s-hos.json", { k: "selesai", t: now - 30e3, s: now - 30e3 });
  const a = agen(keadaan(), "Head of Strategy");
  assert.equal(a.status, "santai");
  assert.equal(a.selesai?.ts, now - 30e3);
});
test("sesi yang terbukti mengirim sinyal selesai: berpikir lama tetap berpikir (bukan santai karena jeda waktu)", () => {
  // giliran baru dimulai sesudah selesai terakhir; model berpikir 5 menit setelah hasil alat (> ambang 3 menit)
  tulisTranskrip("s-fc", [...kepala("Financial Controller", "financial-controller"), prompt(9 * 60e3, "rekonsiliasi"),
    pakai(6 * 60e3, "t-f", "Read", "m-f"), hasil(5 * 60e3, "t-f")]);
  kejadian("s-fc.json", { k: "selesai", t: now - 10 * 60e3, s: now - 10 * 60e3 });
  assert.equal(agen(keadaan(), "Financial Controller").status, "berpikir");
  // teks model tanpa alat di tengah giliran juga bukan "selesai" sampai kejadian Stop datang
  tambahBaris("s-fc", [teksModel(4 * 60e3, "m-teks")]);
  assert.equal(agen(keadaan(), "Financial Controller").status, "berpikir");
  kejadian("s-fc.json", { k: "selesai", t: now - 3 * 60e3, s: now - 3 * 60e3 });
  const a = agen(keadaan(), "Financial Controller");
  assert.equal(a.status, "santai"); assert.equal(a.selesai?.ts, now - 3 * 60e3);
});
test("giliran yang dihentikan pengguna (Esc) langsung santai", () => {
  tulisTranskrip("s-ra", [...kepala("Research Analyst", "research-analyst"), prompt(60e3, "riset"),
    pakai(40e3, "t-w", "WebSearch", "m-w", { query: "x" }), hasil(30e3, "t-w"), prompt(20e3, "[Request interrupted by user]")]);
  kejadian("s-ra.json", { k: "selesai", t: now - 50 * 60e3, s: now - 50 * 60e3 });
  assert.equal(agen(keadaan(), "Research Analyst").status, "santai");
});
test("subagent peran: izin di subagent → kursinya 'Menunggu Anda' + percakapan pemanggil; SubagentStop → selesai pada waktu kejadian", () => {
  tulisTranskrip("s-coo", [...kepala("COO", "coo"), { type: "system", cwd: ROOT }, prompt(120e3, "/rudisone audit"),
    pakai(100e3, "t-ag", "Agent", "m-ag", { description: "Analisis model bisnis" })]);
  const dir = path.join(proj, "s-coo", "subagents");
  fs.mkdirSync(dir, { recursive: true });
  tulisTranskrip("agent-a1", [{ ...prompt(90e3, "Kamu adalah Program Manager di RudisOne …"), isSidechain: true },
    { ...pakai(60e3, "t-pm", "Bash", "m-pm", { command: "gh issue list" }), isSidechain: true }], dir);
  fs.writeFileSync(path.join(dir, "agent-a1.meta.json"), JSON.stringify({ agentType: "rudis-program-manager", description: "Status proyek" }));
  kejadian("s-coo~a1.json", { k: "izin", t: now - 55e3, a: "Bash" });
  let s = keadaan(), pm = agen(s, "Program Manager");
  assert.equal(pm.status, "menunggu");
  assert.equal(pm.sessions[0].bukaDi, "COO");
  tambahBaris("agent-a1", [{ ...hasil(50e3, "t-pm"), isSidechain: true }, { ...teksModel(45e3, "m-pm2"), isSidechain: true }], dir);
  kejadian("s-coo~a1.json", { k: "selesai", t: now - 40e3, s: now - 40e3 });
  s = keadaan(); pm = agen(s, "Program Manager");
  assert.notEqual(pm.status, "menunggu");
  assert.equal(pm.present, false);                       // selesai → kursi kembali ke katalog
  assert.equal(pm.selesai?.ts, now - 40e3);
});
test("asisten biasa (bukan peran) menunggu izin → sesi pemanggilnya ikut 'Menunggu Anda' tanpa sesi tambahan", () => {
  const dir = path.join(proj, "s-coo", "subagents");
  tulisTranskrip("agent-b2", [{ ...prompt(30e3, "cari berkas"), isSidechain: true }, { ...pakai(20e3, "t-gp", "Bash", "m-gp"), isSidechain: true }], dir);
  fs.writeFileSync(path.join(dir, "agent-b2.meta.json"), JSON.stringify({ agentType: "general-purpose", description: "Cari berkas" }));
  kejadian("s-coo~b2.json", { k: "izin", t: now - 15e3, a: "Bash" });
  const coo = agen(keadaan(), "COO");
  assert.equal(coo.status, "menunggu"); assert.equal(coo.label, "Menunggu izin Anda");
  assert.equal(coo.sessions.length, 1);
});
test("izin yang diberikan cepat untuk perintah panjang: tanda hilang tanpa menunggu perintahnya selesai (sesi yang terbukti mengirim pemberitahuan)", () => {
  tulisTranskrip("s-hito", [...kepala("Head of IT Operations", "head-of-it-operations"), prompt(60e3, "cek log"),
    pakai(20e3, "t-log", "Bash", "m-log", { command: "ssh vps journalctl", description: "Baca log" })]);
  kejadian("s-hito.json", { k: "izin", t: now - 19e3, a: "Bash", bt: now - 600e3 });   // tanpa pemberitahuan untuk jendela ini
  const a = agen(keadaan(), "Head of IT Operations");
  assert.equal(a.status, "bekerja");
  kejadian("s-hito.json", { k: "izin", t: now - 19e3, a: "Bash", n: now - 13e3, bt: now - 13e3 });   // masih terbuka 6 dtk kemudian
  assert.equal(agen(keadaan(), "Head of IT Operations").status, "menunggu");
});
test("izin subagent tidak lagi menunggu setelah sesi induknya keluar", () => {
  tulisTranskrip("s-tl", [...kepala("Tech Lead · kasir", "tech-lead"), { type: "system", cwd: "/x/kasir/.claude/worktrees/r1-lead-kasir" },
    prompt(120e3, "Kamu adalah Tech Lead di RudisOne"), pakai(100e3, "t-ag2", "Agent", "m-ag2", { description: "Analisis" })]);
  const dir = path.join(proj, "s-tl", "subagents"); fs.mkdirSync(dir, { recursive: true });
  tulisTranskrip("agent-c3", [{ ...prompt(90e3, "Kamu adalah Business Systems Analyst di RudisOne …"), isSidechain: true },
    { ...pakai(60e3, "t-bsa", "Bash", "m-bsa"), isSidechain: true }], dir);
  fs.writeFileSync(path.join(dir, "agent-c3.meta.json"), JSON.stringify({ agentType: "rudis-business-systems-analyst", description: "Analisis" }));
  kejadian("s-tl~c3.json", { k: "izin", t: now - 55e3, a: "Bash" });
  assert.equal(agen(keadaan(), "Business Systems Analyst · Tim 1").status, "menunggu");
  kejadian("s-tl.json", { k: "keluar", t: now - 30e3 });
  assert.notEqual(agen(keadaan(), "Business Systems Analyst · Tim 1").status, "menunggu");
});
test("izin subagent diberikan cepat: bukti tunda dari berkas induknya berlaku; sesi induk dilanjutkan sesudah keluar tidak menghidupkan izin lama", () => {
  tulisTranskrip("s-ra", [...kepala("COO", "coo"), { type: "system", cwd: ROOT }, prompt(120e3, "/rudisone riset"),
    pakai(100e3, "t-ag3", "Agent", "m-ag3", { description: "Riset harga" })]);
  const dir = path.join(proj, "s-ra", "subagents"); fs.mkdirSync(dir, { recursive: true });
  tulisTranskrip("agent-d4", [{ ...prompt(90e3, "Kamu adalah Research Analyst di RudisOne …"), isSidechain: true },
    { ...pakai(30e3, "t-ra", "Bash", "m-ra"), isSidechain: true }], dir);
  fs.writeFileSync(path.join(dir, "agent-d4.meta.json"), JSON.stringify({ agentType: "rudis-research-analyst", description: "Riset harga" }));
  kejadian("s-ra~d4.json", { k: "izin", t: now - 29e3, a: "Bash" });
  assert.equal(agen(keadaan(), "Research Analyst").status, "menunggu");          // sesi belum terbukti
  kejadian("s-ra.json", { k: "selesai", t: now - 200e3, s: now - 200e3, bt: now - 300e3 });   // induk pernah terbukti
  assert.notEqual(agen(keadaan(), "Research Analyst").status, "menunggu");
  // keluar lalu dilanjutkan: x tetap menandai izin subagent sebelum keluar sebagai mati
  kejadian("s-ra.json", { k: "selesai", t: now - 5e3, s: now - 5e3, x: now - 20e3 });
  assert.notEqual(agen(keadaan(), "Research Analyst").status, "menunggu");
});
test("jendela tanpa PermissionRequest (hanya pemberitahuan, tercatat di induk) selagi subagent berjalan: hilang begitu subagent melangkah lagi", () => {
  tulisTranskrip("s-hos", [...kepala("Head of Strategy", "head-of-strategy"), prompt(120e3, "kelayakan"),
    pakai(100e3, "t-ag5", "Agent", "m-ag5", { description: "Kelayakan" })]);
  const dir = path.join(proj, "s-hos", "subagents"); fs.mkdirSync(dir, { recursive: true });
  tulisTranskrip("agent-e5", [{ ...prompt(90e3, "cari data"), isSidechain: true }, { ...pakai(40e3, "t-e5", "Edit", "m-e5"), isSidechain: true }], dir);
  fs.writeFileSync(path.join(dir, "agent-e5.meta.json"), JSON.stringify({ agentType: "general-purpose", description: "Cari data" }));
  kejadian("s-hos.json", { k: "izin", t: now - 30e3, n: now - 30e3 });
  assert.equal(agen(keadaan(), "Head of Strategy").status, "menunggu");
  tambahBaris("agent-e5", [{ ...hasil(20e3, "t-e5"), isSidechain: true }], dir);
  assert.notEqual(agen(keadaan(), "Head of Strategy").status, "menunggu");
});
test("berkas kejadian aneh diabaikan: nama di luar pola, terlalu besar, bukan berkas biasa, isi rusak", () => {
  tulisTranskrip("s-hr", [...kepala("HR Business Partner", "hr-business-partner"), prompt(60e3, "kebijakan cuti"), teksModel(50e3)]);
  kejadian("..~x.json", { k: "izin", t: now });
  kejadian("s-hr.json.bak", { k: "izin", t: now });
  fs.writeFileSync(path.join(KEJ, "s-hr.json"), JSON.stringify({ k: "izin", t: now, pad: "x".repeat(5000) }));
  assert.notEqual(agen(keadaan(), "HR Business Partner").status, "menunggu");
  fs.writeFileSync(path.join(KEJ, "s-hr.json"), "{rusak");
  assert.notEqual(agen(keadaan(), "HR Business Partner").status, "menunggu");
  fs.rmSync(path.join(KEJ, "s-hr.json"));
  if (process.platform !== "win32") {
    fs.writeFileSync(path.join(tmp, "luar.json"), JSON.stringify({ k: "izin", t: now }));
    fs.symlinkSync(path.join(tmp, "luar.json"), path.join(KEJ, "s-hr.json"));
    assert.notEqual(agen(keadaan(), "HR Business Partner").status, "menunggu");
    fs.rmSync(path.join(KEJ, "s-hr.json"));
  }
});

// ---------- ujung ke ujung: hook nyata → server nyata → SSE ----------
/** Menyalakan server Kantor sungguhan (proses terpisah, port acak) dengan folder uji ini. */
async function nyalakanServer() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(process.execPath, [path.join(HERE, "server.mjs"), `--kantor-port=${port}`], { env: { ...process.env, ...ENV }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((ok, gagal) => { p.stdout.once("data", ok); p.once("exit", (c) => gagal(new Error(`server keluar ${c}`))); });
  return { port, p };
}
/** Langganan SSE: menunggu sampai `syarat(state)` benar; kembalikan waktu (ms sejak `mulai`). */
function tunggu(port, syarat, mulai, batasMs = 5000) {
  return new Promise((ok, gagal) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/events" }, (res) => {
      let sisa = "";
      res.on("data", (c) => {
        sisa += c;
        let i;
        while ((i = sisa.indexOf("\n\n")) >= 0) {
          const blok = sisa.slice(0, i); sisa = sisa.slice(i + 2);
          if (!blok.startsWith("data: ")) continue;
          if (syarat(JSON.parse(blok.slice(6)))) { const ms = Date.now() - mulai(); req.destroy(); ok(ms); return; }
        }
      });
    });
    req.on("error", () => {});
    setTimeout(() => { req.destroy(); gagal(new Error("tidak tercapai dalam batas waktu")); }, batasMs);
  });
}
function jalankanHook(input) {
  const p = spawn(process.execPath, [path.join(HERE, "..", "bin", "kantor-kejadian.mjs"), "hook"], { env: { ...process.env, ...ENV }, stdio: ["pipe", "pipe", "pipe"] });
  p.stdin.end(JSON.stringify(input));
  return new Promise((ok) => p.on("exit", (c) => ok(c)));
}

test("ujung ke ujung: hook izin → halaman 'Menunggu Anda' ≤ 2 dtk; dijawab → hilang ≤ 2 dtk; Stop → 'Baru selesai' ≤ 2 dtk", async (t) => {
  tulisTranskrip("s-tw", [...kepala("Technical Writer", "technical-writer"), prompt(20e3, "tulis SOP"),
    pakai(2e3, "t-tw", "Write", "m-tw", { file_path: "/x/sop.md", content: "RAHASIA-ISI" })]);
  const { port, p } = await nyalakanServer();
  t.after(() => p.kill());
  const tw = (s) => s.agents.find((a) => a.name === "Technical Writer");
  await tunggu(port, (s) => tw(s)?.present, () => Date.now());   // server sudah membaca transkrip

  let mulai = 0;
  const menunggu = tunggu(port, (s) => tw(s)?.status === "menunggu", () => mulai);
  mulai = Date.now();
  assert.equal(await jalankanHook({ hook_event_name: "PermissionRequest", session_id: "s-tw", tool_name: "Write",
    tool_input: { file_path: "/x/sop.md", content: "RAHASIA-ISI" }, permission_suggestions: [] }), 0);
  const msMenunggu = await menunggu;
  t.diagnostic(`izin → "Menunggu Anda" di halaman: ${msMenunggu} ms`);
  assert.ok(msMenunggu <= 2000, `${msMenunggu} ms`);

  const hilang = tunggu(port, (s) => tw(s)?.status !== "menunggu", () => mulai);
  mulai = Date.now();
  tambahBaris("s-tw", [{ ...hasil(0, "t-tw"), timestamp: new Date().toISOString() }]);   // pengguna menjawab, alatnya selesai
  const msHilang = await hilang;
  t.diagnostic(`dijawab → tanda hilang: ${msHilang} ms`);
  assert.ok(msHilang <= 2000, `${msHilang} ms`);

  const selesai = tunggu(port, (s) => tw(s)?.status === "santai" && tw(s)?.selesai, () => mulai);
  tambahBaris("s-tw", [{ ...teksModel(0, "m-tw2"), timestamp: new Date().toISOString() }]);
  mulai = Date.now();
  assert.equal(await jalankanHook({ hook_event_name: "Stop", session_id: "s-tw", stop_hook_active: false, last_assistant_message: "RAHASIA-ISI" }), 0);
  const msSelesai = await selesai;
  t.diagnostic(`Stop → "Baru selesai": ${msSelesai} ms`);
  assert.ok(msSelesai <= 2000, `${msSelesai} ms`);
  // privasi: yang tersimpan & yang dikirim ke halaman tidak memuat isi alat / pesan
  assert.ok(!fs.readFileSync(path.join(KEJ, "s-tw.json"), "utf8").includes("RAHASIA"));
  const state = await new Promise((ok) => http.get({ host: "127.0.0.1", port, path: "/state" }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => ok(b)); }));
  assert.ok(!state.includes("RAHASIA"));
});

test("ujung ke ujung: izin diberikan cepat (tanpa pemberitahuan 6 dtk) untuk perintah panjang → tanda hilang ±8,5 dtk setelah jendela muncul", async (t) => {
  tulisTranskrip("s-pgm", [...kepala("Program Manager", "program-manager"), prompt(20e3, "status"),
    { ...pakai(0, "t-pgm", "Bash", "m-pgm", { command: "npm test" }), timestamp: new Date().toISOString() }]);
  // sesi ini pernah mengirim pemberitahuan izin (bukti), lalu PermissionRequest baru tanpa pemberitahuan menyusul
  kejadian("s-pgm.json", { k: "selesai", t: Date.now() - 60e3, s: Date.now() - 60e3, bt: Date.now() - 120e3 });
  const { port, p } = await nyalakanServer();
  t.after(() => p.kill());
  const pm = (s) => s.agents.find((a) => a.name === "Program Manager");
  let mulai = 0;
  const menunggu = tunggu(port, (s) => pm(s)?.status === "menunggu", () => mulai);
  mulai = Date.now();
  assert.equal(await jalankanHook({ hook_event_name: "PermissionRequest", session_id: "s-pgm", tool_name: "Bash", tool_input: { command: "npm test" } }), 0);
  t.diagnostic(`izin → "Menunggu Anda": ${await menunggu} ms`);
  const hilang = await tunggu(port, (s) => pm(s)?.present && pm(s)?.status !== "menunggu", () => mulai, 15000);
  t.diagnostic(`izin diberikan < 6 dtk, perintah masih berjalan → tanda hilang ${hilang} ms setelah jendela muncul`);
  assert.ok(hilang >= 6000 && hilang <= 11000, `${hilang} ms`);
});
