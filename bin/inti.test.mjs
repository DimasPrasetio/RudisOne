// Uji hook pemuat ulang inti: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inti-"));
const ROOT = path.join(tmp, "RudisOne");
fs.mkdirSync(ROOT, { recursive: true });
Object.assign(process.env, { RUDISONE_ROOT: ROOT, RUDISONE_SETTINGS_USER: path.join(tmp, "claude", "settings.json") });
const { putuskan, kenali, statusPasang } = await import("./inti.mjs");

function transkrip(nama, baris) {
  const f = path.join(tmp, `${nama}.jsonl`);
  fs.writeFileSync(f, baris.map((b) => JSON.stringify(b)).join("\n") + "\n");
  return f;
}
const pengguna = (text) => ({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });
const PROYEK = path.join(tmp, "proyek");

test("Tech Lead di folder proyek → perintah baca ulang peran + inti + tugas terakhir", () => {
  const f = transkrip("tl", [pengguna("[Tugas dari COO] T-20261030-2 · X\n\nKamu adalah Tech Lead di RudisOne. Baca …"), pengguna("[Revisi] T-20261030-2.1 · poin")]);
  const out = putuskan({ hook_event_name: "SessionStart", source: "compact", cwd: PROYEK, transcript_path: f });
  const t = out.hookSpecificOutput.additionalContext;
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(t, /Kamu adalah Tech Lead di RudisOne; tugas terakhir yang terlihat: T-20261030-2\.1/);
  assert.match(t, /protokol\.md · .*agents\/tech-lead\.md · .*catatan\/tech-lead\.md · .*handoff\/T-20261030-2\//);
});

test("COO lewat /rudisone atau Skill rudisone dikenali", () => {
  const a = transkrip("coo1", [pengguna("<command-name>/rudisone</command-name> buat laporan")]);
  assert.equal(kenali(a).jabatan, "COO");
  const b = transkrip("coo2", [pengguna("halo"), { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "rudisone" } }] } }]);
  const out = putuskan({ source: "resume", cwd: PROYEK, transcript_path: b });
  assert.match(out.hookSpecificOutput.additionalContext, /agents\/coo\.md · .*TEAM\.md/);
});

test("Software Engineer #2 dikenali sebagai software-engineer", () => {
  const f = transkrip("se2", [pengguna("Kamu adalah **Software Engineer #2** di RudisOne. Baca …")]);
  assert.deepEqual(kenali(f), { jabatan: "Software Engineer", id: "software-engineer", tugas: null });
});

test("dilewati: sesi pribadi, startup/clear, sesi di dalam folder RudisOne, transkrip hilang", () => {
  const pribadi = transkrip("pribadi", [pengguna("tolong rapikan kode ini")]);
  assert.equal(putuskan({ source: "compact", cwd: PROYEK, transcript_path: pribadi }), null);
  const tl = transkrip("tl2", [pengguna("Kamu adalah Tech Lead di RudisOne.")]);
  assert.equal(putuskan({ source: "startup", cwd: PROYEK, transcript_path: tl }), null);
  assert.equal(putuskan({ source: "clear", cwd: PROYEK, transcript_path: tl }), null);
  assert.equal(putuskan({ source: "compact", cwd: path.join(ROOT, "ruang", "x"), transcript_path: tl }), null);
  assert.equal(putuskan({ source: "compact", cwd: PROYEK, transcript_path: path.join(tmp, "tidak-ada.jsonl") }), null);
  assert.equal(putuskan({ hook_event_name: "PreToolUse", cwd: PROYEK, transcript_path: tl }), null);
});

test("pasang/lepas menjaga hook lain dan bersifat idempoten", async () => {
  const S = process.env.RUDISONE_SETTINGS_USER;
  fs.mkdirSync(path.dirname(S), { recursive: true });
  const lain = { matcher: "compact", hooks: [{ type: "command", command: "\"/x/SistemLain/bin/inti.mjs\" hook" }] };
  fs.writeFileSync(S, JSON.stringify({ hooks: { SessionStart: [lain] }, lainnya: 1 }));
  assert.equal(statusPasang(), false);
  const { execFileSync } = await import("node:child_process");
  const jalan = (...a) => execFileSync(process.execPath, [fileURLToPath(new URL("./inti.mjs", import.meta.url)), ...a], { env: process.env, encoding: "utf8" });
  jalan("pasang", "--ya"); jalan("pasang", "--ya");
  let s = JSON.parse(fs.readFileSync(S, "utf8"));
  assert.equal(s.hooks.SessionStart.length, 2);
  assert.equal(s.lainnya, 1);
  assert.equal(statusPasang(), true);
  jalan("lepas", "--ya");
  s = JSON.parse(fs.readFileSync(S, "utf8"));
  assert.deepEqual(s.hooks.SessionStart, [lain]);
});
