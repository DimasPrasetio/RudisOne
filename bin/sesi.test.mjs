// Uji backend sesi (bin/sesi.mjs) dengan `claude` tiruan. Jalankan: node --test bin/
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { palsu } from "./lib/uji-util.mjs";

const SKRIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "sesi.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sesi-uji-"));
const ROOT = path.join(tmp, "RudisOne");
const PROYEK = path.join(tmp, "toko"), WT = path.join(PROYEK, ".claude", "worktrees", "r1-lead-toko");
for (const d of [path.join(ROOT, "konfigurasi"), path.join(ROOT, "handoff"), WT]) fs.mkdirSync(d, { recursive: true });
fs.copyFileSync(path.join(path.dirname(SKRIP), "..", "konfigurasi", "sesi-cli.settings.json"), path.join(ROOT, "konfigurasi", "sesi-cli.settings.json"));
fs.writeFileSync(path.join(ROOT, "handoff", "register-tugas.json"), JSON.stringify({ tugas: [{ id: "T-1", folder: `${PROYEK} (branch rudis/T-1)` }] }));
const CLAUDE_JSON = path.join(tmp, "claude.json");
const AGENTS = path.join(tmp, "agents.json"), VERSI = path.join(tmp, "versi.txt"), LOG = path.join(tmp, "claude.log");
// claude tiruan: --version dari VERSI, `agents --json [--all]` dari AGENTS; argumen dicatat
const PALSU = palsu(tmp, "claude-palsu", `import fs from "node:fs";
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(LOG)}, a.join(" ") + "\\n");
if (a[0] === "--version") { process.stdout.write(fs.readFileSync(${JSON.stringify(VERSI)})); process.exit(0); }
if (a[0] === "agents" && a[1] === "--json") { process.stdout.write(fs.readFileSync(${JSON.stringify(AGENTS)})); process.exit(0); }
process.exit(9);
`);
const ENV = { ...process.env, RUDISONE_ROOT: ROOT, RUDISONE_CLAUDE_BIN: PALSU, RUDISONE_CLAUDE_JSON: CLAUDE_JSON,
  RUDISONE_SESI: path.join(ROOT, "konfigurasi", "sesi.json"), RUDISONE_REGISTER: path.join(ROOT, "handoff", "register-tugas.json") };
delete ENV.RUDISONE_KANTOR_DESKTOP;
const sesi = (...a) => spawnSync("node", [SKRIP, ...a], { env: ENV, encoding: "utf8" });
const tulisSesi = (b) => fs.writeFileSync(ENV.RUDISONE_SESI, JSON.stringify({ backend: b }));
fs.writeFileSync(VERSI, "2.1.314 (Claude Code)\n");
fs.writeFileSync(AGENTS, JSON.stringify([
  { pid: 1, cwd: WT, kind: "background", sessionId: "aaaaaaaa-0000-4000-8000-000000000001", name: "r1-lead-toko", state: "blocked", waitingFor: "permission prompt" },
  { pid: 2, cwd: path.join(ROOT, "ruang", "system-administrator"), kind: "background", sessionId: "aaaaaaaa-0000-4000-8000-000000000002", name: "rudis-sysadmin", state: "working" },
  { pid: 3, cwd: "/lain/pribadi", kind: "interactive", sessionId: "aaaaaaaa-0000-4000-8000-000000000003", name: "Catatan pribadi", status: "idle" },
]));

const m = await import(pathToFileURL(SKRIP).href);

test("deteksi & folder Desktop per OS; konfigurasi/sesi.json menang atas deteksi", () => {
  assert.equal(m.deteksi("darwin"), "auto");
  assert.equal(m.deteksi("win32"), "auto");
  assert.equal(m.deteksi("linux"), "cli");
  assert.equal(m.folderDesktop("darwin", {}, "/Users/u"), "/Users/u/Library/Application Support/Claude/claude-code-sessions");
  assert.equal(m.folderDesktop("linux", {}, "/home/u"), "/home/u/.config/Claude/claude-code-sessions");
  assert.equal(m.folderDesktop("linux", { XDG_CONFIG_HOME: "/x" }, "/home/u"), "/x/Claude/claude-code-sessions");
  assert.equal(m.folderDesktop("win32", { APPDATA: "C:/A" }, "C:/u"), path.win32.join("C:/A", "Claude", "claude-code-sessions"));
  assert.equal(m.folderDesktop("linux", { RUDISONE_KANTOR_DESKTOP: "/o" }), "/o");
  fs.rmSync(ENV.RUDISONE_SESI, { force: true });
  assert.match(sesi("backend").stdout, new RegExp(`^${m.deteksi()} \\(deteksi OS`));
  tulisSesi("cli");
  assert.equal(sesi("backend").stdout.trim(), "cli (konfigurasi/sesi.json)");
  tulisSesi("lain");
  assert.match(sesi("backend").stdout, /deteksi OS/, "nilai tak sah diabaikan");
});

test("deteksi --tulis membuat konfigurasi/sesi.json sekali, tidak pernah menimpa", () => {
  fs.rmSync(ENV.RUDISONE_SESI, { force: true });
  let r = sesi("deteksi", "--tulis");
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(ENV.RUDISONE_SESI, "utf8")).backend, m.deteksi());
  tulisSesi("cli");
  r = sesi("deteksi", "--tulis");
  assert.match(r.stdout, /sudah ada — tidak ditimpa/);
  assert.equal(JSON.parse(fs.readFileSync(ENV.RUDISONE_SESI, "utf8")).backend, "cli");
});

test("normalAgents: judul dari nama, status menunggu → perintah attach, sesi pribadi bukan RudisOne", () => {
  const e = m.normalAgents(JSON.parse(fs.readFileSync(AGENTS, "utf8")));
  assert.deepEqual(e.map((x) => [x.localId, x.title, x.awaiting, x.perintah]), [
    ["r1-lead-toko", "Tech Lead · toko", true, "claude attach r1-lead-toko"],
    ["rudis-sysadmin", "System Administrator", false, null],
    ["Catatan pribadi", "Catatan pribadi", false, null]]);
  assert.deepEqual(e.map((x) => x.rudisOne), [true, true, false]);
  assert.equal(m.judulDariNama("rudis-head-of-it-ops"), "Head of IT Operations");
  assert.equal(m.judulDariNama("rudis-research-analyst"), "Research Analyst");
  assert.equal(m.judulDariNama("acak"), null);
  assert.equal(m.normalAgents([{ sessionId: "x", name: "a", state: "stopped" }])[0].archived, true);
});

test("versiCukup ≥ 2.1.300", () => {
  for (const [v, ok] of [["2.1.300", true], ["2.1.314", true], ["2.2.0", true], ["3.0.0", true], ["2.1.299", false], ["2.0.999", false], [null, false]])
    assert.equal(m.versiCukup(v), ok, String(v));
});

test("daftar (cli): hanya sesi RudisOne + perintah attach; desktop: arahkan ke alat Desktop", () => {
  tulisSesi("cli");
  const r = sesi("daftar");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /r1-lead-toko · aaaaaaaa-0000-4000-8000-000000000001 · blocked \(permission prompt\)/);
  assert.match(r.stdout, /perlu pengguna: claude attach aaaaaaaa-0000-4000-8000-000000000001/);
  assert.match(r.stdout, /rudis-sysadmin/);
  assert.doesNotMatch(r.stdout, /pribadi/);
  assert.match(fs.readFileSync(LOG, "utf8"), /^agents --json --all$/m);
  tulisSesi("desktop");
  assert.match(sesi("daftar").stdout, /backend desktop/);
});

test("cek (cli): versi, pengaman, dan folder yang belum dipercaya (persis, bukan leluhur)", () => {
  tulisSesi("cli");
  fs.writeFileSync(CLAUDE_JSON, JSON.stringify({ projects: { [tmp]: { hasTrustDialogAccepted: true }, [ROOT]: { hasTrustDialogAccepted: true } } }));
  let r = sesi("cek");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /\[ok\] Claude Code 2\.1\.314/);
  assert.match(r.stdout, /\[ok\] pengaman sesi latar/);
  for (const f of [path.join(ROOT, "ruang", "head-of-it-operations"), path.join(ROOT, "ruang", "system-administrator"), PROYEK, WT])
    assert.ok(r.stdout.includes(`cd ${f} && claude`), `${f}\n${r.stdout}`);
  assert.ok(!r.stdout.includes(`cd ${ROOT} && claude`), "akar yang dipercaya tidak didaftar");
  const semua = Object.fromEntries([ROOT, path.join(ROOT, "ruang", "head-of-it-operations"), path.join(ROOT, "ruang", "system-administrator"), PROYEK, WT]
    .map((f) => [f, { hasTrustDialogAccepted: true }]));
  fs.writeFileSync(CLAUDE_JSON, JSON.stringify({ projects: semua }));
  r = sesi("cek");
  assert.equal(r.status, 0, r.stdout);
  fs.writeFileSync(VERSI, "2.1.281 (Claude Code)\n");
  r = sesi("cek");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Claude Code 2\.1\.281 < 2\.1\.300/);
  fs.writeFileSync(VERSI, "2.1.314 (Claude Code)\n");
  tulisSesi("desktop");
  assert.equal(sesi("cek").status, 0);
  assert.equal(sesi("tidak-ada").status, 3);
});

test("normalAgents tahan JSON aneh; nama tak aman tidak dipakai di perintah attach", () => {
  assert.doesNotThrow(() => m.normalAgents([{ sessionId: "a", cwd: 123 }, null, 5, { sessionId: 7 }, { sessionId: "b; rm" }]));
  assert.deepEqual(m.normalAgents([{ sessionId: "a", cwd: 123 }]).map((x) => x.cwd), [null]);
  assert.deepEqual(m.normalAgents({ bukan: "larik" }), []);
  const e = m.normalAgents([{ sessionId: "sid-1", name: "x; rm -rf ~", state: "blocked" }])[0];
  assert.equal(e.perintah, "claude attach sid-1");
});

test("backend auto: sumber baca = cli + desktop; daftar menampilkan sesi CLI; cek informatif dan tidak menggagalkan", () => {
  assert.deepEqual(m.sumberBaca("auto"), ["cli", "desktop"]);
  assert.deepEqual(m.sumberBaca("cli"), ["cli"]);
  assert.deepEqual(m.sumberBaca("desktop"), ["desktop"]);
  tulisSesi("auto");
  assert.equal(sesi("backend").stdout.trim(), "auto (konfigurasi/sesi.json)");
  const d = sesi("daftar");
  assert.equal(d.status, 0, d.stderr);
  assert.match(d.stdout, /r1-lead-toko/);
  assert.match(d.stdout, /backend auto: sesi yang dibentuk lewat alat Desktop tidak tercantum/);
  // folder belum dipercaya CLI + auto: tetap exit 0 (jalur Desktop mungkin yang dipakai)
  fs.writeFileSync(CLAUDE_JSON, JSON.stringify({ projects: {} }));
  const c = sesi("cek");
  assert.equal(c.status, 0, c.stdout);
  assert.match(c.stdout, /backend auto: Desktop dipakai bila alat sesinya ada/);
  assert.match(c.stdout, /folder belum dipercaya CLI/);
  tulisSesi("cli");
  assert.equal(sesi("cek").status, 1, "backend cli murni: folder belum dipercaya = perlu perhatian");
});
