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
const sesiKosong = () => ({ lastPrompt: 0, lastHasil: 0, asistenTerakhir: { ts: 0, msg: null }, hasilAlat: new Map(), pesanAlat: new Map() });
const ST = { status: "bekerja", label: "Menjalankan perintah", detail: "", icon: "terminal", since: 0 };

test("izin: menunggu sampai hasil alat itu tercatat; hasil alat lain (paralel) dan baris model dari pesan yang sama tidak menjawab", () => {
  const s = sesiKosong(); s.pesanAlat.set("u1", "m1");
  const kej = { k: "izin", t: 1000, u: "u1", s: null };
  assert.equal(gabungKejadian(ST, s, kej).st.status, "menunggu");
  assert.equal(gabungKejadian(ST, s, kej).st.label, "Menunggu izin Anda");
  s.hasilAlat.set("u2", 1500); s.lastHasil = 1500;                          // alat lain yang berjalan bersamaan selesai
  assert.equal(gabungKejadian(ST, s, kej).st.status, "menunggu");
  s.asistenTerakhir = { ts: 1200, msg: "m1" };                              // blok berikut dari pesan model yang sama
  assert.equal(gabungKejadian(ST, s, kej).st.status, "menunggu");
  s.hasilAlat.set("u1", 2000);                                              // dijawab (diizinkan & selesai, atau ditolak)
  assert.deepEqual(gabungKejadian(ST, s, kej), { st: ST, selesai: null });
});
test("izin: langkah model dari pesan baru atau pesan masuk baru = sudah dijawab; Notification tanpa id alat → hasil alat apa pun", () => {
  const s = sesiKosong(); s.pesanAlat.set("u1", "m1");
  assert.equal(gabungKejadian(ST, { ...s, asistenTerakhir: { ts: 1100, msg: "m2" } }, { k: "izin", t: 1000, u: "u1" }).st, ST);
  assert.equal(gabungKejadian(ST, { ...s, lastPrompt: 1100 }, { k: "tanya", t: 1000, u: "u1" }).st, ST);
  assert.equal(gabungKejadian(ST, { ...s, lastPrompt: 900 }, { k: "tanya", t: 1000, u: "u1" }).st.label, "Menunggu jawaban Anda");
  assert.equal(gabungKejadian(ST, { ...s, lastHasil: 900 }, { k: "izin", t: 1000, u: null }).st.status, "menunggu");
  assert.equal(gabungKejadian(ST, { ...s, lastHasil: 1100 }, { k: "izin", t: 1000, u: null }).st, ST);
});
test("selesai/keluar: santai dengan waktu selesai = waktu kejadian; giliran baru sesudahnya mengalahkan", () => {
  const s = sesiKosong(); s.asistenTerakhir = { ts: 900, msg: "m1" };
  for (const k of ["selesai", "keluar"]) {
    const g = gabungKejadian(ST, s, { k, t: 1000 });
    assert.equal(g.st.status, "santai"); assert.equal(g.selesai, 1000);
  }
  assert.deepEqual(gabungKejadian(ST, { ...s, lastPrompt: 1200 }, { k: "selesai", t: 1000 }), { st: ST, selesai: null });
  assert.deepEqual(gabungKejadian(ST, { ...s, asistenTerakhir: { ts: 1200, msg: "m2" } }, { k: "selesai", t: 1000 }), { st: ST, selesai: null });
  assert.deepEqual(gabungKejadian(ST, s, null), { st: ST, selesai: null });
});

// ---------- dari berkas kejadian sampai /state ----------
test("sesi meminta izin → 'Menunggu Anda' dengan waktu kejadian; tanda hilang begitu hasil alatnya tercatat", () => {
  tulisTranskrip("s-sa", [...kepala("System Administrator", "system-administrator"), prompt(60e3, "cek server"),
    pakai(20e3, "t-ssh", "Bash", "m-ssh", { command: "ssh vps 'uptime'", description: "Cek uptime" })]);
  const t = now - 19e3;
  kejadian("s-sa.json", { k: "izin", t, u: "t-ssh" });
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
  kejadian("s-coo~a1.json", { k: "izin", t: now - 55e3, u: "t-pm" });
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
  kejadian("s-coo~b2.json", { k: "izin", t: now - 15e3, u: "t-gp" });
  const coo = agen(keadaan(), "COO");
  assert.equal(coo.status, "menunggu"); assert.equal(coo.label, "Menunggu izin Anda");
  assert.equal(coo.sessions.length, 1);
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
  assert.equal(await jalankanHook({ hook_event_name: "PermissionRequest", session_id: "s-tw", tool_name: "Write", tool_use_id: "t-tw",
    tool_input: { file_path: "/x/sop.md", content: "RAHASIA-ISI" } }), 0);
  const msMenunggu = await menunggu;
  t.diagnostic(`izin → "Menunggu Anda" di halaman: ${msMenunggu} ms`);
  assert.ok(msMenunggu <= 2000, `${msMenunggu} ms`);

  const hilang = tunggu(port, (s) => tw(s)?.status !== "menunggu", () => mulai);
  mulai = Date.now();
  tambahBaris("s-tw", [hasil(0, "t-tw")]);   // pengguna menjawab, alatnya selesai
  const msHilang = await hilang;
  t.diagnostic(`dijawab → tanda hilang: ${msHilang} ms`);
  assert.ok(msHilang <= 2000, `${msHilang} ms`);

  const selesai = tunggu(port, (s) => tw(s)?.status === "santai" && tw(s)?.selesai, () => mulai);
  tambahBaris("s-tw", [teksModel(0, "m-tw2")]);
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
