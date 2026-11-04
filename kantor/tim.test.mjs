// Nomor tim Engineering deterministik: baris Tech Lead di TEAM.md (nama sesi `r<n>-lead-…` / "(Tim n)") menang atas sesi
// lama di worktree bernomor lain; sesi COO yang `cd` ke worktree tim tetap COO. Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-tim-"));
const ROOT = path.join(tmp, "RudisOne");
const proj = path.join(tmp, "projects", "-rudisone");
fs.mkdirSync(proj, { recursive: true });
Object.assign(process.env, {
  RUDISONE_ROOT: ROOT, RUDISONE_SESI: path.join(tmp, "sesi.json"), RUDISONE_SERVER: path.join(tmp, "tidak-ada.json"),
  RUDISONE_KANTOR_PROJECTS: path.join(tmp, "projects"), RUDISONE_KANTOR_DESKTOP: path.join(tmp, "desktop-tidak-ada"),
  RUDISONE_KANTOR_TEAM_MD: path.join(tmp, "TEAM.md"), RUDISONE_KANTOR_REGISTER: path.join(tmp, "register-tugas.md"),
  RUDISONE_KANTOR_REGISTER_JSON: path.join(tmp, "register-tugas.json"),
});
fs.writeFileSync(process.env.RUDISONE_SESI, JSON.stringify({ backend: "desktop" }));
const now = Date.now(), iso = (ms) => new Date(now - ms).toISOString();
const tulis = (id, baris) => fs.writeFileSync(path.join(proj, `${id}.jsonl`), baris.map((b) => JSON.stringify(b)).join("\n") + "\n");
const WT1 = path.join(ROOT, ".claude", "worktrees", "r1-lead-rudisone-11"), WT2 = path.join(ROOT, ".claude", "worktrees", "r2-lead-rudisone-b8");

// sesi Tech Lead lama di worktree r2 (paling awal dalam 48 jam) — dulu menentukan nomor tim berdasarkan urutan mulai
tulis("tl-lama", [{ type: "custom-title", customTitle: "Tech Lead · RudisOne" },
  { type: "user", timestamp: iso(30 * 3600e3), cwd: WT2, message: { content: "Kamu adalah Tech Lead di RudisOne." } },
  { type: "assistant", timestamp: iso(20 * 3600e3), message: { content: [{ type: "text", text: "Selesai." }] } }]);
// sesi Tech Lead yang sekarang, worktree r1 (tercatat di TEAM.md)
tulis("tl-kini", [{ type: "custom-title", customTitle: "Tech Lead · RudisOne" },
  { type: "user", timestamp: iso(60e3), cwd: WT1, message: { content: "Kamu adalah Tech Lead di RudisOne." } },
  { type: "assistant", timestamp: iso(5e3), message: { content: [{ type: "tool_use", id: "a", name: "Edit", input: { file_path: `${WT1}/kantor/a.mjs` } }] } }]);
// COO dibuka di akar repo, lalu memeriksa worktree tim (cwd terakhir = worktree) — dibuka paling awal
tulis("coo", [{ type: "agent-setting", agentSetting: "coo" }, { type: "custom-title", customTitle: "COO" },
  { type: "user", timestamp: iso(40 * 3600e3), cwd: ROOT, message: { content: "<command-name>/rudisone</command-name>" } },
  { type: "assistant", timestamp: iso(4e3), cwd: WT2, message: { content: [{ type: "tool_use", id: "c", name: "Bash", input: { command: "git status", description: "Cek worktree" } }] } }]);
fs.writeFileSync(path.join(tmp, "TEAM.md"), ["## Engineering", "| Agent | Proyek | Session id | Name | cwd |", "|---|---|---|---|---|",
  "| Tech Lead · RudisOne (Tim 1) | RudisOne | `local_11112222-3333-4444-5555-666677778888` | `r1-lead-rudisone-11` | worktree |", ""].join("\n"));

const { scan, buildState } = await import("./server.mjs");
scan();
const st = buildState();
const ag = (n) => st.agents.find((a) => a.name === n);

test("nomor tim dari baris Tech Lead di TEAM.md, bukan dari sesi lama di worktree bernomor lain", () => {
  assert.deepEqual(st.tim, [{ n: 1, proyek: "RudisOne" }]);
  assert.equal(ag("Tech Lead · Tim 1").present, true);
  assert.equal(ag("Tech Lead · Tim 1").status, "bekerja");
  assert.equal(ag("Tech Lead · Tim 2").present, false);
});

test("sesi COO yang memeriksa worktree tim tetap di kursi COO (peran dari folder awal sesi)", () => {
  assert.equal(ag("COO").present, true);
  assert.ok(!ag("Tech Lead · Tim 1").sessions.some((s) => s.title === "COO"));
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
