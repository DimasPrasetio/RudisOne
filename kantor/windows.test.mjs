// Uji Kantor untuk keadaan Windows yang nyata (T-20261030-2.1, jebakan #15): TEAM.md/register ber-CRLF, path `D:\` dan
// `C:\…\.claude\worktrees\…`, COO yang berjalan di VS Code/CLI (tanpa judul sidebar, hanya ai-title), Tech Lead sebagai
// subagent COO, dan nomor tim di luar denah. Data diambil dari bentuk transkrip asli di Windows 11 (Claude Code 2.1.302).
// Berjalan di semua OS (path bergaya Windows dikenali dari teksnya). Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-win-"));
const proj = path.join(tmp, "projects", "d--PENGEMBANGAN-RUDIS");
fs.mkdirSync(proj, { recursive: true });
fs.mkdirSync(path.join(tmp, "desktop"), { recursive: true });
process.env.RUDISONE_ROOT = path.join(tmp, "RudisOne");
process.env.RUDISONE_SERVER = path.join(tmp, "tidak-ada-server.json");
process.env.RUDISONE_KANTOR_PROJECTS = path.join(tmp, "projects");
process.env.RUDISONE_KANTOR_DESKTOP = path.join(tmp, "desktop");
process.env.RUDISONE_SESI = path.join(tmp, "sesi.json");
fs.writeFileSync(process.env.RUDISONE_SESI, JSON.stringify({ backend: "desktop" }));   // tanpa memanggil `claude agents`
process.env.RUDISONE_KANTOR_TEAM_MD = path.join(tmp, "TEAM.md");
process.env.RUDISONE_KANTOR_REGISTER = path.join(tmp, "register-tugas.md");
process.env.RUDISONE_KANTOR_REGISTER_JSON = path.join(tmp, "register-tugas.json");

const PROYEK = String.raw`D:\PENGEMBANGAN-RUDIS\inventory`;
const WT_INV = String.raw`D:\PENGEMBANGAN-RUDIS\inventory\.claude\worktrees\r1-lead-inventory`;
const WT_R1 = String.raw`C:\Users\u\Documents\Neuron\ai-agent\RudisOne\.claude\worktrees\r2-lead-rudisone-9fd64d`;
const WT_R4 = String.raw`C:\Users\u\Documents\Neuron\ai-agent\rudis-modules\.claude\worktrees\r4-lead-rudis-modules-28beb9`;

// TEAM.md ditulis COO di Windows: CRLF, judul tim berketerangan, dan satu tim di luar denah (Tim 4)
fs.writeFileSync(process.env.RUDISONE_KANTOR_TEAM_MD, [
  "# Tim RudisOne", "",
  "## Engineering · Tim 2 · RudisOne (platform)", "| Agent | Session id | Name | cwd |", "|---|---|---|---|",
  "| Tech Lead | `local_aaaa0000-1111-2222-3333-444455556666` | `r2-lead-rudisone` | worktree |", "",
  "## Engineering · Tim 4 · rudis-modules (platform) — menunggu pengguna mempercayai repo", "",
].join("\r\n"));
// register ber-CRLF dengan folder `D:\` (format JSON bin/register.mjs)
fs.writeFileSync(process.env.RUDISONE_KANTOR_REGISTER_JSON, JSON.stringify({ versi: 1, tugas: [
  { id: "T-20261030-1", judul: "Aplikasi gudang inventory", folder: PROYEK, pemilik: "Tech Lead", status: "berjalan", prioritas: "normal", dibuat: "2026-10-30T01:00:00Z" },
] }, null, 2).replaceAll("\n", "\r\n"));

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const tulis = (file, baris) => fs.writeFileSync(file, baris.map((b) => JSON.stringify(b)).join("\r\n") + "\r\n");   // CRLF juga di transkrip
const pakai = (msAgo, id, name, input, cwd) => ({ type: "assistant", timestamp: iso(msAgo), cwd, message: { content: [{ type: "tool_use", id, name, input }] } });

// COO di VS Code (entrypoint claude-vscode): cwd `d:\…` huruf kecil, hanya ai-title, tanpa agent-setting/custom-title
const COO = "a550846e-d552-49d6-9ae8-556c31cfb501";
tulis(path.join(proj, `${COO}.jsonl`), [
  { type: "user", timestamp: iso(600e3), cwd: String.raw`d:\PENGEMBANGAN-RUDIS`, entrypoint: "claude-vscode",
    message: { content: "<command-message>rudisone</command-message>\n<command-name>/rudisone</command-name>\n<command-args>buat aplikasi</command-args>" } },
  { type: "ai-title", aiTitle: "PowerShell && separator error", sessionId: COO },
  pakai(5e3, "c1", "Agent", { description: "Tech Lead: analisis & rancangan inventory", subagent_type: "rudis-tech-lead" }, String.raw`d:\PENGEMBANGAN-RUDIS`),
]);
// Tech Lead sebagai subagent COO: mulai di folder COO, brief menyebut ID tugas; masih bekerja
const sub = path.join(proj, COO, "subagents");
fs.mkdirSync(sub, { recursive: true });
fs.writeFileSync(path.join(sub, "agent-aef33e60ae9a9bf61.meta.json"), JSON.stringify({ agentType: "rudis-tech-lead", description: "Tech Lead: analisis & rancangan inventory" }));
tulis(path.join(sub, "agent-aef33e60ae9a9bf61.jsonl"), [
  { type: "user", timestamp: iso(60e3), isSidechain: true, cwd: String.raw`d:\PENGEMBANGAN-RUDIS`, message: { content: "[Tugas dari COO] T-20261030-1 · Aplikasi gudang \"inventory\" — Analisis" } },
  { ...pakai(3e3, "s1", "Bash", { command: "go build ./...", description: "Build backend" }, String.raw`d:\PENGEMBANGAN-RUDIS`), isSidechain: true },
]);
// Peninjau (subagent rudis-software-engineer) di worktree proyek, selesai lama → tidak duduk, linimasa tetap
fs.writeFileSync(path.join(sub, "agent-a89dd276061a47580.meta.json"), JSON.stringify({ agentType: "rudis-software-engineer", description: "Tinjauan silang kode inventory", finished: true }));
tulis(path.join(sub, "agent-a89dd276061a47580.jsonl"), [
  { ...pakai(30e3, "r1", "Read", { file_path: "x.go" }, WT_INV), isSidechain: true },
]);

// Sesi Tech Lead di worktree DI DALAM repo RudisOne (path `\`): agent-setting "coo" diwarisi dari settings repo, tetapi
// nama worktree r2-lead-… menang → kursi Tech Lead · Tim 2 (bukan COO)
tulis(path.join(proj, "tl-rudisone.jsonl"), [
  { type: "agent-setting", agentSetting: "coo" }, { type: "custom-title", customTitle: "Tech Lead · RudisOne" },
  pakai(4e3, "t1", "Edit", { file_path: "server.mjs" }, WT_R1),
]);
// Sesi di subfolder worktree platform DI DALAM repo RudisOne, hanya ai-title (judul bukan peran) → tetap tim RudisOne
tulis(path.join(proj, "tl-rudisone-sub.jsonl"), [
  { type: "ai-title", aiTitle: "balas satu kata ok" },
  pakai(6e3, "t3", "Read", { file_path: "a.md" }, path.join(process.env.RUDISONE_ROOT, ".claude", "worktrees", "r2-lead-rudisone-9fd64d", "sub")),
]);
// Tech Lead tim 4 (di luar denah 1–3): tidak boleh mematikan buildState
tulis(path.join(proj, "tl-modules.jsonl"), [
  { type: "custom-title", customTitle: "Tech Lead · rudis-modules" }, pakai(4e3, "t2", "Bash", { command: "go test ./..." }, WT_R4),
]);
// Uji headless: tanpa judul dan bukan /rudisone → tidak tampil
tulis(path.join(proj, "headless.jsonl"), [
  { type: "user", timestamp: iso(5e3), cwd: String.raw`d:\PENGEMBANGAN-RUDIS`, message: { content: "Jalankan perintah ini" } },
  pakai(4e3, "h1", "Bash", { command: "ls" }, String.raw`d:\PENGEMBANGAN-RUDIS`),
]);

const { scan, buildState, bacaRegister, teksSehat, VERSI } = await import("./server.mjs");
scan();
const st = buildState(now);
const ag = (n) => st.agents.find((a) => a.name === n);

test("COO di VS Code (hanya ai-title, cwd d:\\…) tampil di kursi COO", () => {
  const coo = ag("COO");
  assert.equal(coo.present, true, JSON.stringify(st.agents.filter((a) => a.present).map((a) => a.name)));
  assert.equal(coo.sessions[0].title, "PowerShell && separator error");
});

test("Tech Lead sebagai subagent COO duduk di kursi Tech Lead tim proyeknya (dari ID tugas → folder D:\\ di register)", () => {
  const nTim = st.tim.find((t) => t.proyek === "inventory")?.n;
  assert.ok(nTim, JSON.stringify(st.tim));
  const tl = ag(`Tech Lead · Tim ${nTim}`);
  assert.equal(tl.present, true);
  assert.equal(tl.subagent?.dari, "COO");
  assert.equal(tl.status, "bekerja");
  assert.ok(!st.tim.some((t) => /PENGEMBANGAN/.test(t.proyek)), "folder induk COO bukan proyek");
});

test("subagent peninjau yang sudah selesai tidak menduduki kursi, tetapi aktivitasnya tetap di log", () => {
  assert.ok(st.feed.some((f) => f.label === "Membaca kode" && /Software Engineer/.test(f.agent)), JSON.stringify(st.feed.map((f) => f.agent)));
});

test("sesi di worktree berpath `\\` (r2-lead-…) adalah Tech Lead Tim 2, bukan COO; nomor tim dari TEAM.md CRLF berketerangan", () => {
  assert.equal(st.tim.find((t) => t.proyek === "RudisOne")?.n, 2, JSON.stringify(st.tim));
  assert.ok(ag("Tech Lead · Tim 2").sessions.some((x) => x.title === "Tech Lead · RudisOne"));
  assert.ok(!ag("COO").sessions.some((x) => x.title === "Tech Lead · RudisOne"));
  assert.ok(ag("Tech Lead · Tim 2").sessions.some((x) => x.title === "balas satu kata ok"), "subfolder worktree di dalam RudisOne → tim RudisOne");
  assert.ok(!st.tim.some((t) => t.n > 3), "tim di luar denah tidak dibuat");
});

test("uji headless tanpa judul tetap tidak tampil", () => {
  assert.ok(!st.agents.some((a) => a.sessions.some((x) => x.title === "Jalankan perintah ini")));
});

test("register ber-CRLF (MD) terbaca; register JSON ber-CRLF dengan folder D:\\ terbaca", () => {
  const md = ["| ID | Tugas | Folder | Status |", "|---|---|---|---|", "| T-20261030-1 | Gudang | `D:\\PENGEMBANGAN-RUDIS\\inventory` | berjalan |", ""].join("\r\n");
  const r = bacaRegister(md);
  assert.equal(r.length, 1);
  assert.equal(r[0].folder, String.raw`D:\PENGEMBANGAN-RUDIS\inventory`);
  assert.equal(r[0].status, "berjalan", "tanpa \\r tersisa");
  assert.equal(st.tugas[0]?.folder, PROYEK);
});

test("/health: baris pertama `ok <versi>`, lalu versi dan keadaan tiap sumber data", () => {
  const h = teksSehat().split("\n");
  assert.equal(h[0], `ok ${VERSI}`);
  assert.match(h[1], new RegExp(`^versi: ${VERSI} · node v\\d+`));
  for (const s of ["transkrip", "TEAM.md", "register"]) assert.ok(h.some((l) => l.startsWith(`sumber ${s}: terbaca`)), `${s}\n${h.join("\n")}`);
  assert.ok(h.some((l) => l.startsWith("galat terakhir: -")));
});

test("buildState tahan data aneh (tidak pernah melempar galat yang mematikan server)", () => {
  fs.writeFileSync(path.join(proj, "aneh.jsonl"), "{rusak\r\n" + JSON.stringify({ type: "custom-title", customTitle: "Tech Lead · Tim 9" }) + "\r\n");
  assert.doesNotThrow(() => { scan(); buildState(Date.now()); });
});
