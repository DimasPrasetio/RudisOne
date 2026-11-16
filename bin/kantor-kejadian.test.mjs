// Uji hook sinyal Kantor (bin/kantor-kejadian.mjs): kejadian → berkas ringkas, privasi, gagal diam-diam, waktu per kejadian,
// dan pemasangan idempoten di settings sementara. Jalankan: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const SKRIP = path.join(SINI, "kantor-kejadian.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-kejadian-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const KEJ = path.join(tmp, "kejadian");
const SETTINGS = path.join(tmp, "claude", "settings.json");
Object.assign(process.env, { RUDISONE_KANTOR_KEJADIAN: KEJ, RUDISONE_SETTINGS_USER: SETTINGS });
const { KEJADIAN_HOOK, bersihkanLama, catatKejadian, daftarKejadian, denganHook, entriHook, kejadianDari, statusPasang, tanpaHook, uraiIsi, uraiNama } = await import("./kantor-kejadian.mjs");

const jalan = (args, input = null, env = {}) => spawnSync(process.execPath, [SKRIP, ...args],
  { encoding: "utf8", input: input ?? "", env: { ...process.env, ...env }, timeout: 20_000 });
const RAHASIA = "ISI-RAHASIA-JANGAN-DISIMPAN";
const masukan = (ev, extra = {}) => ({ session_id: "sesi-1", transcript_path: `/Users/x/.claude/projects/p/${RAHASIA}.jsonl`, cwd: `/x/${RAHASIA}`,
  permission_mode: "default", hook_event_name: ev, ...extra });

test("kejadian Claude Code → jenis ringkas; kejadian lain dan jenis pemberitahuan lain diabaikan", () => {
  const k = (ev, extra) => kejadianDari(masukan(ev, extra), 5)?.k ?? null;
  assert.equal(k("PermissionRequest", { tool_name: "Bash", tool_input: { command: RAHASIA }, tool_use_id: "toolu_1" }), "izin");
  assert.equal(k("Notification", { notification_type: "permission_prompt", message: RAHASIA }), "izin");
  assert.equal(k("Notification", { notification_type: "worker_permission_prompt" }), "izin");
  assert.equal(k("Notification", { notification_type: "elicitation_dialog" }), "tanya");
  assert.equal(k("Notification", { notification_type: "idle_prompt" }), null);   // selesai & menunggu pesan baru ≠ menunggu keputusan
  assert.equal(k("Notification", { notification_type: "auth_success" }), null);
  assert.equal(k("PreToolUse", { tool_name: "AskUserQuestion", tool_use_id: "toolu_2", tool_input: { questions: [RAHASIA] } }), "tanya");
  assert.equal(k("PreToolUse", { tool_name: "Bash" }), null);
  assert.equal(k("Stop", { last_assistant_message: RAHASIA }), "selesai");
  assert.equal(k("StopFailure", { error: "rate_limit" }), "selesai");
  assert.equal(k("SubagentStop", { agent_id: "a1b2", agent_type: "rudis-tech-lead" }), "selesai");
  assert.equal(k("SessionEnd", { reason: "exit" }), "keluar");
  for (const ev of ["PostToolUse", "UserPromptSubmit", "SessionStart", "SubagentStart", "PreCompact", undefined]) assert.equal(k(ev), null);
  assert.equal(kejadianDari(null), null);
  assert.equal(kejadianDari({ ...masukan("Stop"), session_id: "../luar" }), null);    // id yang bukan nama berkas aman
  assert.equal(kejadianDari({ ...masukan("Stop"), session_id: 42 }), null);
  const e = kejadianDari(masukan("SubagentStop", { agent_id: "../x", tool_use_id: "a b" }), 7);
  assert.deepEqual(e, { sesi: "sesi-1", agen: null, k: "selesai", t: 7, u: null });
});

test("hook menulis hanya metadata (jenis, waktu, id) — tanpa isi pesan, perintah, path, atau keluaran — dan tidak mencetak apa pun", () => {
  const r = jalan(["hook"], JSON.stringify(masukan("PermissionRequest", { agent_id: "agen9", tool_name: "Write", tool_use_id: "toolu_9",
    tool_input: { file_path: `/x/${RAHASIA}.md`, content: RAHASIA }, permission_suggestions: [{ rules: [RAHASIA] }] })));
  assert.equal(r.status, 0); assert.equal(r.stdout, ""); assert.equal(r.stderr, "");
  const f = path.join(KEJ, "sesi-1~agen9.json");
  const teks = fs.readFileSync(f, "utf8");
  assert.ok(!teks.includes(RAHASIA));
  assert.deepEqual(Object.keys(JSON.parse(teks)).sort(), ["k", "t", "u"]);
  assert.equal(JSON.parse(teks).u, "toolu_9");
  assert.deepEqual(fs.readdirSync(KEJ).filter((n) => n.endsWith(".tmp")), []);   // tanpa sisa berkas sementara
});

test("berkas kejadian: atomik, mengingat waktu 'selesai' terakhir, nama & isi tervalidasi", () => {
  catatKejadian({ sesi: "s2", agen: null, k: "selesai", t: 100, u: null }, KEJ);
  catatKejadian({ sesi: "s2", agen: null, k: "izin", t: 200, u: "toolu_x" }, KEJ);
  assert.deepEqual(uraiIsi(fs.readFileSync(path.join(KEJ, "s2.json"), "utf8")), { k: "izin", t: 200, u: "toolu_x", s: 100 });
  assert.deepEqual(uraiNama("s2~a-1.json"), { sesi: "s2", agen: "a-1" });
  for (const n of ["../s2.json", "s2.json.123.tmp", "s 2.json", "s2~.json", ".json"]) assert.equal(uraiNama(n), null, n);
  for (const t of ["{", "null", '{"k":"lain","t":1}', '{"k":"izin","t":"x"}']) assert.equal(uraiIsi(t), null, t);
  assert.ok(daftarKejadian(KEJ).some((e) => e.sesi === "s2" && e.k === "izin"));
});

test("pembersihan: hanya berkas kejadian lama berpola kita; berkas lain di folder tidak disentuh", () => {
  const dir = path.join(tmp, "bersih"); fs.mkdirSync(dir);
  for (const n of ["lama.json", "baru.json", "catatan.txt", "lama.json.77.tmp"]) fs.writeFileSync(path.join(dir, n), "{}");
  const lalu = (Date.now() - 4 * 24 * 3600e3) / 1000;
  for (const n of ["lama.json", "catatan.txt", "lama.json.77.tmp"]) fs.utimesSync(path.join(dir, n), lalu, lalu);
  assert.equal(bersihkanLama(dir), 2);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["baru.json", "catatan.txt"]);
});

test("gagal diam-diam: masukan rusak, masukan raksasa, folder tak bisa ditulis → exit 0 tanpa keluaran", () => {
  for (const input of ["", "{rusak", JSON.stringify({ hook_event_name: "Stop" })]) {
    const r = jalan(["hook"], input);
    assert.equal(r.status, 0); assert.equal(r.stdout + r.stderr, "");
  }
  const berkas = path.join(tmp, "bukan-folder"); fs.writeFileSync(berkas, "x");
  let r = jalan(["hook"], JSON.stringify(masukan("Stop")), { RUDISONE_KANTOR_KEJADIAN: path.join(berkas, "kej") });
  assert.equal(r.status, 0); assert.equal(r.stdout + r.stderr, "");
  r = jalan(["hook"], JSON.stringify(masukan("PermissionRequest", { tool_input: { content: "x".repeat(9 * 1024 * 1024) } })));
  assert.equal(r.status, 0); assert.equal(r.stdout + r.stderr, "");
});

test("waktu per kejadian < 100 ms (proses hook utuh, termasuk masukan Write 2 MB)", (t) => {
  const ukur = (input, n) => {
    const ms = [];
    for (let i = 0; i < n; i++) { const a = process.hrtime.bigint(); const r = jalan(["hook"], input); ms.push(Number(process.hrtime.bigint() - a) / 1e6); assert.equal(r.status, 0); }
    ms.sort((a, b) => a - b);
    return { median: ms[Math.floor(n / 2)], p90: ms[Math.floor(n * 0.9)] };
  };
  const kecil = ukur(JSON.stringify(masukan("Stop")), 15);
  const besar = ukur(JSON.stringify(masukan("PermissionRequest", { tool_name: "Write", tool_use_id: "toolu_b", tool_input: { content: "x".repeat(2 * 1024 * 1024) } })), 5);
  t.diagnostic(`hook Stop: median ${kecil.median.toFixed(1)} ms, p90 ${kecil.p90.toFixed(1)} ms · PermissionRequest 2 MB: median ${besar.median.toFixed(1)} ms`);
  assert.ok(kecil.median < 100, `${kecil.median} ms`);
  assert.ok(besar.median < 100, `${besar.median} ms`);
});

test("pemasangan: semua kejadian terpasang async (kecuali SessionEnd), idempoten, entri sistem lain utuh, lepas bersih", () => {
  const lain = { hooks: { PreToolUse: [{ matcher: "^Bash$", hooks: [{ type: "command", command: "\"/usr/bin/node\" \"/x/kebijakan.mjs\" hook" }] }],
    Stop: [{ hooks: [{ type: "command", command: "plugin-lain stop" }] }] }, permissions: { deny: ["Read(.env)"] } };
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(lain));
  assert.equal(jalan(["cek"]).status, 1);
  let r = jalan(["pasang", "--ya"]);
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  assert.ok(statusPasang(s));
  for (const k of Object.keys(KEJADIAN_HOOK)) {
    const h = s.hooks[k][0].hooks[0];
    assert.match(h.command, /kantor-kejadian\.mjs" hook$/);
    assert.ok(!h.command.includes("\\"), "perintah memakai / di semua OS");
    assert.equal(h.async === true, k !== "SessionEnd", k);
  }
  assert.equal(s.hooks.PreToolUse[1].hooks[0].command, lain.hooks.PreToolUse[0].hooks[0].command);   // entri lain utuh, sesudah entri kita
  assert.equal(s.hooks.PreToolUse[0].matcher, "^AskUserQuestion$");
  assert.equal(s.hooks.Stop[1].hooks[0].command, "plugin-lain stop");
  assert.deepEqual(s.permissions, lain.permissions);
  assert.equal(jalan(["cek"]).status, 0);
  const cadangan = () => fs.readdirSync(path.dirname(SETTINGS)).filter((n) => n.includes("cadangan-rudisone")).length;
  const sebelum = cadangan();
  r = jalan(["pasang", "--ya"]);
  assert.match(r.stdout, /Sudah terpasang/);
  assert.equal(cadangan(), sebelum, "pemasangan ulang tidak menulis settings");
  // entri usang (mis. node dipindah) diperbarui, tidak digandakan
  const usang = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  usang.hooks.Stop[0].hooks[0].command = `"/node/lama" "${SKRIP.replaceAll("\\", "/")}" hook`;
  fs.writeFileSync(SETTINGS, JSON.stringify(usang));
  assert.equal(jalan(["cek"]).status, 1);
  assert.equal(jalan(["pasang", "--ya"]).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(SETTINGS, "utf8")).hooks.Stop.length, 2);
  assert.equal(jalan(["lepas", "--ya"]).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(SETTINGS, "utf8")), lain);
  // fungsi murni setara
  assert.deepEqual(tanpaHook(denganHook(lain)), lain);
  assert.ok(statusPasang(denganHook(denganHook({}))));
  assert.deepEqual(entriHook("Notification").matcher.split("|").sort(), ["agent_needs_input", "elicitation_dialog", "elicitation_url_dialog", "permission_prompt", "worker_permission_prompt"]);
});
