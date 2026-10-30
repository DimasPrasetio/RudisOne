// Uji kebijakan akses untuk Windows dan alat PowerShell: node --test bin/
// Logika PowerShell & transkrip berlaku di semua OS; uji path ber-backslash hanya dijalankan di Windows.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WIN = process.platform === "win32";
const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kebijakan-win-"));
const ROOT = path.join(tmp, "RudisOne");
const RUMAH = path.join(tmp, "rumah");
const PROYEK = path.join(tmp, "proyek-pribadi");
for (const d of [path.join(ROOT, "ruang", "system-administrator"), path.join(RUMAH, ".claude"), PROYEK]) fs.mkdirSync(d, { recursive: true });
Object.assign(process.env, {
  HOME: RUMAH, USERPROFILE: RUMAH,
  RUDISONE_ROOT: ROOT,
  RUDISONE_KEBIJAKAN: path.join(SINI, "..", "kebijakan-akses.json"),
  RUDISONE_AUDIT: path.join(tmp, "audit"),
  RUDISONE_SETTINGS_USER: path.join(RUMAH, ".claude", "settings.json"),
  RUDISONE_SERVER: path.join(tmp, "tidak-ada.json"),
  RUDISONE_REGISTER: path.join(tmp, "register-tugas.json"),
});
const { putuskan, muatKebijakan, transkripInduk, MATCHER } = await import("./kebijakan.mjs");
const K = muatKebijakan();

const SA = path.join(ROOT, "ruang", "system-administrator");
let n = 0;
const alat = (cwd, tool_name, tool_input) => ({ session_id: `w${++n}`, cwd, tool_name, tool_input, hook_event_name: "PreToolUse" });
const ps = (cwd, command) => alat(cwd, "PowerShell", { command });
const kep = (i) => putuskan(i, K).keputusan;

test("matcher hook mencakup PowerShell (tanpa itu perintah PowerShell lolos dari kebijakan)", () => {
  assert.match(MATCHER, /PowerShell/);
  assert.ok(new RegExp(MATCHER).test("PowerShell"));
  assert.ok(new RegExp(MATCHER).test("Bash"));
});

test("PowerShell di sesi RudisOne: selalu ditanya (tidak diurai kebijakan)", () => {
  for (const c of ["Get-ChildItem", "ssh vps-uji uptime", "& .\\bin\\server-cek.sh", "Get-Content README.md"]) assert.equal(kep(ps(SA, c)), "ask", c);
  assert.equal(kep(ps(ROOT, "Get-Date")), "ask");
});

test("PowerShell di sesi pribadi: yang menulis berkas terlindung ditanya, yang lain tidak mengganggu", () => {
  const settings = path.join(RUMAH, ".claude", "settings.json");
  for (const c of [`Set-Content -Path '${settings}' -Value '{}'`, `'x' | Out-File "${settings}"`, `Remove-Item ${path.join(ROOT, "kebijakan-akses.json")}`,
    `Add-Content ~\\.claude\\settings.json x`, `[IO.File]::WriteAllText('${settings}','x')`, `echo x > ${settings}`]) {
    assert.equal(kep(ps(PROYEK, c)), "ask", c);
  }
  for (const c of ["Get-ChildItem", `Get-Content '${settings}'`, "npm test", "Set-Content -Path out.txt -Value hai"]) assert.equal(kep(ps(PROYEK, c)), null, c);
});

test("transkrip subagent dipetakan ke sesi induk dengan pemisah / maupun \\", () => {
  assert.equal(transkripInduk("/h/.claude/projects/p/abc/subagents/agent-1.jsonl"), "/h/.claude/projects/p/abc.jsonl");
  assert.equal(transkripInduk("C:\\h\\.claude\\projects\\p\\abc\\subagents\\agent-1.jsonl"), "C:\\h\\.claude\\projects\\p\\abc.jsonl");
  assert.equal(transkripInduk("C:\\h\\.claude\\projects\\p\\abc.jsonl"), "C:\\h\\.claude\\projects\\p\\abc.jsonl");
});

test("Windows: Write ke berkas terlindung dengan path asli (backslash, huruf besar-kecil) → ask", { skip: !WIN && "khusus Windows" }, () => {
  const tulis = (f) => kep(alat(PROYEK, "Write", { file_path: f, content: "{}" }));
  for (const f of [path.join(RUMAH, ".claude", "settings.json"), path.join(RUMAH, ".CLAUDE", "SETTINGS.JSON"), path.join(RUMAH, ".claude", "settings.local.json"),
    path.join(RUMAH, ".claude.json"), path.join(ROOT, "kebijakan-akses.json"), path.join(ROOT, "KEBIJAKAN-AKSES.JSON"), path.join(ROOT, "bin", "kebijakan.mjs"),
    path.join(RUMAH, ".claude", "skills", "x", "SKILL.md"), path.join(RUMAH, ".claude", "agents", "rudis-x.md")]) {
    assert.equal(tulis(f), "ask", f);
  }
  assert.equal(tulis(path.join(PROYEK, "src", "a.ts")), null);
});

test("Windows: path gaya Git Bash (/c/Users/…) dikenali sebagai berkas terlindung", { skip: !WIN && "khusus Windows" }, () => {
  const drive = RUMAH[0].toLowerCase();
  const gb = `/${drive}${RUMAH.slice(2).replaceAll("\\", "/")}`;
  for (const c of [`echo x > ${gb}/.claude/settings.json`, `rm -rf ${gb}/.claude/skills`, `cp /tmp/x ${gb}/.claude/agents/rudis-x.md`, `echo x >> ${gb}/.bashrc`]) {
    assert.equal(kep({ session_id: `w${++n}`, cwd: PROYEK, tool_name: "Bash", tool_input: { command: c }, hook_event_name: "PreToolUse" }), "ask", c);
  }
});

test("Windows: /proc, /dev/fd dan /.vol (Git Bash/MSYS) tetap dianggap lokasi rahasia", { skip: !WIN && "khusus Windows" }, () => {
  for (const c of ["cat /proc/self/cwd/gh/hosts.yml", "cat /dev/fd/3", "cat /.vol/1/2/x"]) {
    assert.notEqual(kep({ session_id: `w${++n}`, cwd: SA, tool_name: "Bash", tool_input: { command: `gh pr list && ${c}` }, hook_event_name: "PreToolUse" }), "allow", c);
  }
});
