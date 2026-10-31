// Uji penjaga .env (T-20261031-2.3): membaca isi .env* di sesi RudisOne → deny tanpa prompt + audit; kapabilitas
// aplikasi/tes/skrip yang memuat .env sendiri tetap (tanpa keputusan baru). node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "kebijakan-env-")));
const ROOT = path.join(tmp, "RudisOne");
const P = path.join(ROOT, "ruang", "tech-lead-uji");   // folder kerja sesi RudisOne (COO karena di bawah ROOT)
const NONGIT = path.join(ROOT, "ruang", "nongit");
const LUAR = path.join(tmp, "pribadi");                // sesi bukan RudisOne
for (const d of [P, path.join(P, "apps", "api"), NONGIT, LUAR, path.join(ROOT, "bin"), path.join(P, ".venv-env", ".env")]) fs.mkdirSync(d, { recursive: true });
const NILAI = "rahasia-SANGAT-panjang-123";
for (const f of [".env", ".env.local", ".env.production"]) fs.writeFileSync(path.join(P, f), `DB_DSN=${NILAI}\n`);
fs.writeFileSync(path.join(P, ".env.example"), "DB_DSN=\n");
fs.writeFileSync(path.join(P, "apps", "api", ".env.contoh"), "DB_DSN=\n");
fs.writeFileSync(path.join(NONGIT, ".env"), `X=${NILAI}\n`);
fs.writeFileSync(path.join(LUAR, ".env"), `X=${NILAI}\n`);
let ADA_SYMLINK = true;
try { fs.symlinkSync(".env", path.join(P, "config.txt")); } catch { ADA_SYMLINK = false; }
// P = repo git yang meng-ignore .env (grep bawaan Claude Code menghormati .gitignore)
const g = (...a) => execFileSync("git", ["-C", P, ...a], { stdio: "ignore" });
g("init", "-q"); fs.writeFileSync(path.join(P, ".gitignore"), ".env\n.env.*\n!.env.example\n");
// perkakas env-kunci palsu yang di-commit di ROOT/bin (perkakasAsli memeriksa berkas di-track tanpa perubahan)
fs.writeFileSync(path.join(ROOT, "bin", "env-kunci.sh"), "#!/bin/sh\necho ok\n", { mode: 0o755 });
fs.writeFileSync(path.join(ROOT, "bin", "env-kunci.mjs"), "console.log('ok')\n");
execFileSync("git", ["-C", ROOT, "init", "-q"]);
execFileSync("git", ["-C", ROOT, "add", "bin"]);
execFileSync("git", ["-C", ROOT, "-c", "user.email=u@contoh.test", "-c", "user.name=u", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "awal"]);

const AUDIT = path.join(tmp, "audit");
Object.assign(process.env, {
  RUDISONE_ROOT: ROOT,
  RUDISONE_KEBIJAKAN: path.join(SINI, "..", "kebijakan-akses.json"),
  RUDISONE_AUDIT: AUDIT,
  RUDISONE_SETTINGS_USER: path.join(tmp, "claude", "settings.json"),
  RUDISONE_REGISTER: path.join(tmp, "register.json"),
  RUDISONE_SERVER: path.join(tmp, "server-tidak-ada.json"),
});
const { putuskan, muatKebijakan, namaEnv, catatTolakEnv, bacaAudit, samarkan, settingsTerpasang, kekuranganIzin, ATURAN_IZIN_ENV, MATCHER } = await import("./kebijakan.mjs");
const K = muatKebijakan();
let n = 0;
const bash = (command, cwd = P) => ({ session_id: `e${++n}`, cwd, tool_name: "Bash", tool_input: { command }, hook_event_name: "PreToolUse" });
const kep = (i) => putuskan(i, K).keputusan ?? "—";
const harap = (daftar, hasil, cwd = P) => { for (const c of daftar) assert.equal(kep(bash(c, cwd)), hasil, `${c} (cwd ${path.relative(tmp, cwd)})`); };

test("nama berkas env: rahasia vs contoh", () => {
  for (const f of [".env", ".env.local", ".env.production", ".env.development.local", "prod.env", ".envrc"]) assert.ok(namaEnv(f, K), f);
  for (const f of [".env.example", ".env.contoh", ".env.sample", ".env.template", "env.txt", "dotenv.js", "environment.ts", ".environment"]) assert.ok(!namaEnv(f, K), f);
});

test("Read tool: berkas env → deny; contoh, symlink, folder", () => {
  const read = (f, cwd = P) => kep({ session_id: `r${++n}`, cwd, tool_name: "Read", tool_input: { file_path: f }, hook_event_name: "PreToolUse" });
  for (const f of [".env", ".env.local", ".env.production"]) assert.equal(read(path.join(P, f)), "deny", f);
  assert.equal(read(path.join(P, ".env.example")), "—");
  assert.equal(read(path.join(P, "apps", "api", ".env.contoh")), "—");
  assert.equal(read(path.join(P, "README.md")), "—");
  if (ADA_SYMLINK) assert.equal(read(path.join(P, "config.txt")), "deny");
  assert.equal(read(path.join(LUAR, ".env"), LUAR), "—", "sesi pribadi: dijaga permissions.deny, bukan hook");
});

test("Grep/Glob tool", () => {
  const grep = (ti) => kep({ session_id: `g${++n}`, cwd: P, tool_name: "Grep", tool_input: ti, hook_event_name: "PreToolUse" });
  assert.equal(grep({ pattern: "DB", path: path.join(P, ".env"), output_mode: "content" }), "deny");
  assert.equal(grep({ pattern: "DB", glob: ".env*", output_mode: "content" }), "deny");
  assert.equal(grep({ pattern: "DB", path: path.join(P, ".env") }), "—", "files_with_matches: tanpa isi");
  assert.equal(grep({ pattern: "DB", path: path.join(P, ".env"), output_mode: "count" }), "—");
  assert.equal(kep({ session_id: "gl", cwd: P, tool_name: "Glob", tool_input: { pattern: "**/.env" }, hook_event_name: "PreToolUse" }), "—");
});

test("Bash: pengeluar isi → deny", () => {
  harap(["cat .env", "head -n3 .env.local", "tail .env.production", "sed -n 1p .env", "awk -F= '{print $2}' .env",
    "cut -d= -f2 < .env", "grep DB_ .env", "grep -n DB_ .env", "grep -o '=.*' .env", "less .env", "base64 .env", "xxd .env",
    "diff .env.example .env", `cat ${path.join(P, ".env")}`, "cat ./sub/../.env", "jq -R . .env", "while read l; do echo $l; done < .env",
    "sudo cat .env", "env FOO=1 cat .env", "timeout 5 cat .env", "bash -c 'cat .env'", "sh -c \"head .env\"", "eval 'cat .env'",
    "cat .env | head -1", "true && cat .env"], "deny");
});

test("Bash: cd, symlink, glob, ekspansi, salinan", () => {
  harap(["cd apps/api && cat ../../.env", "cd apps; cat ../.env", "cd .. && cat ./tech-lead-uji/.env"], "deny");
  if (ADA_SYMLINK) harap(["cat config.txt"], "deny");
  harap(["cat $(echo .env)", "F=.env; cat $F", "cat .e*", "cat .env*", "cat `echo .env`"], "deny");
  harap(["ln -s .env x && cat x", "cp .env /tmp/a && cat /tmp/a", "export $(cat .env | xargs)", "ls -a | grep env | xargs cat"], "deny");
});

test("Bash: source, kode sebaris, pemuat yang membuang lingkungan → deny", () => {
  harap(["source .env && echo $DB_DSN", ". ./.env; printenv", "set -a; . .env; set +a; env",
    "node -e \"require('dotenv').config();console.log(process.env)\"", "node -p \"require('fs').readFileSync('.env','utf8')\"",
    "python3 -c \"print(open('.env').read())\"", "ruby -e \"puts File.read('.env')\"", "perl -ne print .env",
    "dotenv -e .env -- printenv", "node --env-file=.env -p process.env", "npx dotenv -e .env -- env",
    "docker compose --env-file .env config"], "deny");
});

test("Bash: git & pencarian", () => {
  harap(["git diff --no-index .env.example .env", "git show stash@{0}:.env", "git log -p .env"], "deny");
  harap(["git check-ignore -q .env", "git status .env", "git ls-files .env", "git grep DB_PASS", "rg DB_PASS"], "—");
  harap(["grep -rn DB_PASS ."], "—");                             // repo git, .env di-ignore: grep bawaan melewatinya
  harap(["grep -rn DB_PASS ."], "deny", NONGIT);                  // folder non-git: terbaca
  harap(["command grep -r DB .", "/usr/bin/grep -r DB .", "rg --no-ignore DB", "rg -uu DB", "rg DB .env",
    "find . -name .env -exec cat {} \\;"], "deny");
});

test("Bash: tanpa isi / kapabilitas tetap → tanpa keputusan baru", () => {
  harap(["ls -la .env", "test -s .env", "[ -f .env ]", "stat .env", "wc -l .env", "chmod 600 .env", "touch .env", "rm .env.local",
    "cp .env ../main/.env", "cp -n .env /x/main/.env", "mv .env .env.bak", "echo DB_DSN= >> .env", "cat .env.example",
    "grep -c '^DB_DSN=' .env", "grep -cE '^(DB_DSN|DATABASE_URL)=[^[:space:]\"#]' .env", "grep -q DB_DSN .env", "grep -l DB .env",
    "npm test", "go test ./...", "node scripts/env-local.mjs", "node scripts/db-local.mjs --admin-password-empty", "npm run dev",
    "dotenvx run -- npm test", "node --env-file=.env server.js", "dotenv -e .env -- npm test", "docker compose --env-file .env up -d",
    "env", "printenv", "source .venv/bin/activate", "ls .venv-env/.env", "cat README.md", "grep -rn TODO src"], "—");
});

test("Bash: perkakas env-kunci asli → allow; tiruan → deny", () => {
  const sh = path.join(ROOT, "bin", "env-kunci.sh");
  for (const c of [`${sh} .env`, `${sh} --salah-satu DB_DSN,DATABASE_URL .env`, `node ${path.join(ROOT, "bin", "env-kunci.mjs")} --wajib DB_DSN .env`]) {
    const p = putuskan(bash(c), K);
    assert.equal(p.keputusan, "allow", `${c}: ${p.alasan}`);
  }
  fs.mkdirSync(path.join(tmp, "palsu"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "palsu", "env-kunci.sh"), "#!/bin/sh\ncat \"$1\"\n", { mode: 0o755 });
  assert.equal(kep(bash(`${path.join(tmp, "palsu", "env-kunci.sh")} .env`)), "deny");
});

test("gabungan dengan perintah yang biasanya allow → tetap deny; sesi pribadi tanpa keputusan", () => {
  assert.equal(kep(bash("gh pr list && cat .env")), "deny");
  assert.equal(kep(bash("cat .env", LUAR)), "—");
  assert.equal(kep(bash("cat .env", NONGIT)), "deny");
});

test("alasan menunjuk perkakas & audit tanpa nilai", () => {
  const p = putuskan(bash(`grep DB_DSN=${NILAI} .env`), K);
  assert.equal(p.keputusan, "deny");
  assert.match(p.alasan, /env-kunci\.sh/);
  catatTolakEnv(bash(`grep DB_DSN=${NILAI} .env`), p);
  const r = bacaAudit().at(-1);
  assert.equal(r.jenis, "baca-rahasia-ditolak");
  assert.equal(r.jenjang, 3);
  assert.ok(!JSON.stringify(r).includes(NILAI), "nilai tidak masuk audit");
  assert.ok(r.rantai, "audit berantai");
  assert.equal(samarkan("KUNCI_A=abc123 KUNCI_B='x y'"), "KUNCI_A=*** KUNCI_B=***");
});

test("hook end-to-end: deny di stdout + satu baris audit", () => {
  const masuk = { ...bash("cat .env"), session_id: "e2e" };
  const r = spawnSync(process.execPath, [path.join(SINI, "kebijakan.mjs"), "hook"], { input: JSON.stringify(masuk), encoding: "utf8", env: process.env });
  assert.equal(r.status, 0);
  const o = JSON.parse(r.stdout);
  assert.equal(o.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(bacaAudit().some((x) => x.sesi === "e2e" && x.jenis === "baca-rahasia-ditolak"));
});

test("pemasangan: matcher mencakup Read/Grep/Glob; aturan deny .env idempoten & tidak menghapus aturan lain", () => {
  assert.ok(["Read", "Grep", "Glob", "Bash"].every((a) => new RegExp(MATCHER).test(a)));
  const awal = { permissions: { deny: ["Read(**/.env)", "Bash(git reset --hard *)"], ask: ["Bash(git push *)"] },
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "/lain/hook.sh" }] }] } };
  const s1 = settingsTerpasang(awal);
  const s2 = settingsTerpasang(s1);
  assert.deepEqual(s2, s1, "idempoten");
  for (const a of ATURAN_IZIN_ENV) assert.ok(s1.permissions.deny.includes(a), a);
  assert.ok(s1.permissions.deny.includes("Bash(git reset --hard *)") && s1.permissions.deny.includes("Read(**/.env)"));
  assert.deepEqual(s1.permissions.ask, ["Bash(git push *)"]);
  assert.ok(s1.hooks.PreToolUse.some((e) => e.hooks[0].command === "/lain/hook.sh"), "hook sistem lain tidak disentuh");
  assert.equal(s1.hooks.PreToolUse.length, 2);
  assert.deepEqual(kekuranganIzin(s1), []);
  assert.ok(!ATURAN_IZIN_ENV.some((a) => /example|contoh/.test(a)));
});

test("pasang lewat CLI: idempoten, cadangan hanya saat berubah; installer RudisOne yang dijalankan agent → ask", () => {
  const S = process.env.RUDISONE_SETTINGS_USER;
  fs.mkdirSync(path.dirname(S), { recursive: true });
  fs.writeFileSync(S, JSON.stringify({ permissions: { deny: ["Bash(git clean -f*)"] } }));
  const cli = () => spawnSync(process.execPath, [path.join(SINI, "kebijakan.mjs"), "pasang", "--ya"], { encoding: "utf8", env: process.env });
  const cadangan = () => fs.readdirSync(path.dirname(S)).filter((f) => f.includes("cadangan-rudisone")).length;
  assert.equal(cli().status, 0);
  const isi1 = fs.readFileSync(S, "utf8"), c1 = cadangan();
  const r2 = cli();
  assert.equal(r2.status, 0);
  assert.match(r2.stdout, /Sudah terpasang/);
  assert.equal(fs.readFileSync(S, "utf8"), isi1);
  assert.equal(cadangan(), c1, "tanpa cadangan baru bila tidak berubah");
  fs.writeFileSync(path.join(ROOT, "install.sh"), "#!/bin/sh\n");
  for (const c of ["./install.sh", "node install.mjs --tanpa-perkakas", `${ROOT}/install.sh`]) assert.equal(kep(bash(c, ROOT)), "ask", c);
  assert.equal(kep(bash("./install.sh", P)), "—", "install.sh proyek lain bukan installer RudisOne");
  fs.rmSync(S);
});

test("jalur Tech Lead-subagent: SE lapis-2 (induk = sesi COO) tidak diblokir kerja lokal; gerbang-tl allow untuk COO", () => {
  // transkrip sesi COO + transkrip subagent di <sid>/subagents/ — kebijakan membaca jabatan induk dari transkrip utama
  const dirT = path.join(tmp, "proyek-transkrip");
  fs.mkdirSync(path.join(dirT, "sid", "subagents"), { recursive: true });
  fs.writeFileSync(path.join(dirT, "sid.jsonl"), `${JSON.stringify({ type: "user", cwd: ROOT, message: { role: "user", content: "halo" } })}\n`);
  const wt = path.join(P, ".claude", "worktrees", "r1-se1-uji");
  fs.mkdirSync(wt, { recursive: true });
  const se = (command) => ({ ...bash(command, wt), agent_type: "rudis-software-engineer", transcript_path: path.join(dirT, "sid", "subagents", "agent-x.jsonl") });
  for (const c of ["git -C . add -A && git commit -m 'feat: x'", "npm test", "node --test", "git merge --no-ff refs/heads/rudis/T-1-se1"])
    assert.equal(putuskan(se(c), K).keputusan ?? "—", "—", c);
  assert.equal(putuskan(se("cat .env"), K).keputusan, "deny", "penjaga .env juga berlaku untuk subagent");
  fs.writeFileSync(path.join(ROOT, "bin", "gerbang-tl.sh"), "#!/bin/sh\n", { mode: 0o755 });
  execFileSync("git", ["-C", ROOT, "add", "bin/gerbang-tl.sh"]);
  execFileSync("git", ["-C", ROOT, "-c", "user.email=u@contoh.test", "-c", "user.name=u", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "gerbang"]);
  assert.equal(kep(bash(`${path.join(ROOT, "bin", "gerbang-tl.sh")} T-20261031-9`, ROOT)), "allow");
});

test("A6: git yang menimpa/menghapus kerja di sesi RudisOne → ask; git baca & kerja biasa tanpa keputusan", () => {
  harap(["git stash", "git stash push -u -m x", "git stash pop", "git stash drop stash@{0}", "git reset --hard HEAD~1", "git reset --soft HEAD && git reset --hard",
    "git checkout -- a.txt", "git checkout main -- a.txt", "git checkout .", "git clean -fd", "git clean -xf", "git restore a.txt",
    "git worktree remove ../wt", "git branch -D rudis/T-1", "git -C /x/repo reset --hard"], "ask");
  harap(["git stash list", "git status", "git log --oneline -3", "git diff", "git restore --staged a.txt", "git checkout -b rudis/T-1",
    "git switch rudis/T-1", "git commit -m x", "git merge --no-ff refs/heads/rudis/T-1-se1", "git worktree add -b x ../wt", "git branch -d x",
    "git reset --soft HEAD~1", "git clean -n"], "—");
  harap(["git reset --hard"], "—", LUAR);   // sesi pribadi: dijaga settings pengguna, bukan hook
});

test("A1: brief ke subagent rudis-* tanpa ID tugas di baris pertama → deny; ber-ID / subagent lain → tanpa keputusan", () => {
  const ag = (subagent_type, prompt, cwd = P) => kep({ session_id: `a${++n}`, cwd, tool_name: "Agent", tool_input: { subagent_type, prompt, description: "x" }, hook_event_name: "PreToolUse" });
  assert.equal(ag("rudis-software-engineer", "Kerjakan fitur X"), "deny");
  assert.equal(ag("rudis-research-analyst", "Riset harga\nT-20261031-2 di baris kedua"), "deny");
  assert.equal(ag("rudis-software-engineer", "[Tugas dari Tech Lead] T-20261031-2.3 · env-kunci\nisi"), "—");
  assert.equal(ag("rudis-tech-lead", "\n\n[Tugas dari COO] T-20261031-12 · x"), "—");
  assert.equal(ag("Explore", "cari berkas"), "—");
  assert.equal(ag("general-purpose", "apa saja"), "—");
  assert.equal(ag("rudis-software-engineer", "tanpa id", LUAR), "—", "sesi pribadi tidak diatur");
  const p = putuskan({ session_id: "a0", cwd: P, tool_name: "Agent", tool_input: { subagent_type: "rudis-business-systems-analyst", prompt: "analisis" }, hook_event_name: "PreToolUse" }, K);
  assert.match(p.alasan, /\[Tugas dari <Jabatan>\] T-YYYYMMDD-n/);
});

test("pemasangan memulihkan instalasi parsial (hanya SessionStart + PostToolUseFailure lama tersisa) — dikenali dari path absolut, tanpa duplikat", () => {
  const milik = `"${process.execPath}" "${path.join(SINI, "kebijakan.mjs")}" hook`;
  const parsial = {
    permissions: { deny: ["Read(**/.env)"] },
    hooks: {
      SessionStart: [{ matcher: "compact|resume", hooks: [{ type: "command", command: `"${process.execPath}" "/x/RudisOne/bin/inti.mjs" hook` }] }],
      PostToolUseFailure: [{ matcher: "^(Bash|Write|Edit|MultiEdit|NotebookEdit|mcp__.*)$", hooks: [{ type: "command", command: milik, timeout: 30 }] }],
    },
  };
  const s1 = settingsTerpasang(parsial);
  for (const ev of ["PreToolUse", "PostToolUse", "PostToolUseFailure"]) {
    assert.equal(s1.hooks[ev].length, 1, ev);
    assert.equal(s1.hooks[ev][0].matcher, MATCHER, ev);
  }
  assert.deepEqual(s1.hooks.SessionStart, parsial.hooks.SessionStart, "hook lain (inti) tidak disentuh kebijakan");
  assert.deepEqual(settingsTerpasang(s1), s1, "idempoten");
  assert.deepEqual(kekuranganIzin(s1), []);
});
