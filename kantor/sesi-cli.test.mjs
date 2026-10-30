// Kantor dengan backend sesi cli: peta sesi dari `claude agents --json` (claude tiruan). Jalankan: node --test kantor/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { palsu } from "../bin/lib/uji-util.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-cli-"));
const proj = path.join(tmp, "projects", "-toko");
fs.mkdirSync(proj, { recursive: true });
const ROOT = path.join(tmp, "RudisOne");
const WT = "/x/toko/.claude/worktrees/r1-lead-toko";
const PALSU = palsu(tmp, "claude-palsu", `if (process.argv[2] === "agents") process.stdout.write(${JSON.stringify(JSON.stringify([
  { cwd: WT, kind: "background", sessionId: "sid-lead", name: "r1-lead-toko", state: "blocked", waitingFor: "permission prompt" },
  { cwd: path.join(ROOT, "ruang", "system-administrator"), kind: "background", sessionId: "sid-sa", name: "rudis-sysadmin", state: "stopped" }]))});\n`);
Object.assign(process.env, {
  RUDISONE_ROOT: ROOT, RUDISONE_SESI: path.join(tmp, "sesi.json"), RUDISONE_CLAUDE_BIN: PALSU,
  RUDISONE_SERVER: path.join(tmp, "tidak-ada.json"), RUDISONE_KANTOR_PROJECTS: path.join(tmp, "projects"),
  RUDISONE_KANTOR_DESKTOP: path.join(tmp, "desktop-tidak-ada"), RUDISONE_KANTOR_TEAM_MD: path.join(tmp, "TEAM.md"),
  RUDISONE_KANTOR_REGISTER: path.join(tmp, "register-tugas.md"), RUDISONE_KANTOR_REGISTER_JSON: path.join(tmp, "register-tugas.json"),
});
fs.writeFileSync(process.env.RUDISONE_SESI, JSON.stringify({ backend: "cli" }));
const ts = new Date(Date.now() - 5e3).toISOString();
const tulis = (id, cwd) => fs.writeFileSync(path.join(proj, `${id}.jsonl`), [
  { type: "user", timestamp: ts, cwd, message: { content: "Kamu adalah Tech Lead di RudisOne. Baca dan patuhi ..." } },
  { type: "assistant", timestamp: ts, message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "git push" } }] } },
].map((b) => JSON.stringify(b)).join("\n") + "\n");
tulis("sid-lead", WT);
tulis("sid-sa", path.join(ROOT, "ruang", "system-administrator"));

const { scan, buildState } = await import("./server.mjs");

test("backend cli: judul dari nama sesi, menunggu izin → perintah claude attach; sesi berhenti tidak tampil", () => {
  scan();
  const st = buildState();
  const tl = st.agents.find((a) => a.name === "Tech Lead · Tim 1");
  assert.equal(tl.present, true);
  assert.equal(tl.status, "menunggu");
  assert.equal(tl.detail, "claude attach r1-lead-toko");
  assert.equal(st.agents.find((a) => a.name === "System Administrator").present, false);
});
