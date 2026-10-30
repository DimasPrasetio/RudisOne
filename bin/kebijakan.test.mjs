// Uji kebijakan akses & batas kewenangan: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kebijakan-"));
const ROOT = path.join(tmp, "RudisOne");
const KONFIG = path.join(tmp, "server.json");
fs.writeFileSync(KONFIG, JSON.stringify({
  versi: 1, diisi: { tanggal: "2026-01-01", oleh: "COO", persetujuan: "uji" }, server_bawaan: "vps-uji",
  server: { "vps-uji": { ssh_host: "vps-uji", playbook: null } },
  aplikasi: { "app-uji": { server: "vps-uji", folder: "~/app-uji", repo: "contoh/app-uji", domain: ["app-uji.contoh.test"] } },
  dns: { mcp_server: "hostinger-api", domain: ["contoh.test"] },
}));
Object.assign(process.env, {
  RUDISONE_ROOT: ROOT,
  RUDISONE_KEBIJAKAN: path.join(SINI, "..", "kebijakan-akses.json"),
  RUDISONE_AUDIT: path.join(tmp, "audit"),
  RUDISONE_SETTINGS_USER: path.join(tmp, "claude", "settings.json"),
  RUDISONE_SERVER: KONFIG,
});
const { putuskan, catatSesudah, muatKebijakan, pisahSegmen, kata, samarkan, bacaAudit, statusPasang } = await import("./kebijakan.mjs");
const K = muatKebijakan();

const SA = path.join(ROOT, "ruang", "system-administrator");
const COO = ROOT;
const SHA = "0123456789abcdef0123456789abcdef01234567";
let n = 0;
const bash = (cwd, command, extra = {}) => ({ session_id: `s${++n}`, cwd, tool_name: "Bash", tool_input: { command }, hook_event_name: "PreToolUse", ...extra });
const mcp = (cwd, tool, input) => ({ session_id: `s${++n}`, cwd, tool_name: `mcp__hostinger-api__${tool}`, tool_input: input, hook_event_name: "PreToolUse" });
const kep = (i) => putuskan(i, K).keputusan;

function transkrip(nama, baris) {
  const f = path.join(tmp, `${nama}.jsonl`);
  fs.writeFileSync(f, baris.map((b) => JSON.stringify(b)).join("\n") + "\n");
  return f;
}

test("pengurai shell sadar tanda kutip", () => {
  assert.deepEqual(pisahSegmen("ssh vps-uji 'cd ~/app-uji && ./deploy.sh x' | tail -3").segmen, ["ssh vps-uji 'cd ~/app-uji && ./deploy.sh x'", "tail -3"]);
  assert.equal(pisahSegmen("echo $(whoami)").kompleks, true);
  assert.equal(pisahSegmen("echo '$(tidak)'").kompleks, false);
  assert.deepEqual(kata(`ssh -o BatchMode=yes vps-uji "docker ps"`), ["ssh", "-o", "BatchMode=yes", "vps-uji", "docker ps"]);
});

test("sesi pribadi tidak disentuh sama sekali", () => {
  const t = transkrip("pribadi", [{ type: "user", message: { content: "tolong cek server" } }]);
  const p = putuskan(bash("/Users/x/proyek", "ssh vps-uji 'docker restart app'", { transcript_path: t }), K);
  assert.equal(p.keputusan, null);
  assert.equal(p.sesi.rudisOne, false);
});

test("jabatan dikenali dari folder, worktree, pembuka peran, dan /rudisone", () => {
  assert.equal(putuskan(bash(SA, "uptime"), K).sesi.jabatan, "system-administrator");
  assert.equal(putuskan(bash(COO, "uptime"), K).sesi.jabatan, "coo");
  assert.equal(putuskan(bash("/x/toko/.claude/worktrees/r2-se1-toko", "uptime"), K).sesi.jabatan, "software-engineer");
  const tl = transkrip("tl", [{ type: "user", message: { content: "Kamu adalah Tech Lead di RudisOne. Baca dan patuhi …" } }]);
  assert.equal(putuskan(bash("/x/toko", "uptime", { transcript_path: tl }), K).sesi.jabatan, "tech-lead");
  const se2 = transkrip("se2", [{ type: "user", message: { content: [{ type: "text", text: "Kamu adalah **Software Engineer** #2 di RudisOne." }] } }]);
  assert.equal(putuskan(bash("/x/toko", "uptime", { transcript_path: se2 }), K).sesi.jabatan, "software-engineer");
  const coo = transkrip("coo", [{ type: "user", message: { content: "<command-name>/rudisone</command-name> perbaiki SJ" } },
    { type: "assistant", message: { content: [{ type: "tool_use", name: "SendMessage", input: { message: "Kamu adalah Tech Lead di RudisOne." } }] } }]);
  assert.equal(putuskan(bash("/x/toko", "uptime", { transcript_path: coo }), K).sesi.jabatan, "coo");   // brief keluar ≠ jabatan sendiri
});

test("jenjang 1: baca server oleh System Administrator diizinkan", () => {
  assert.equal(kep(bash(SA, "ssh vps-uji 'docker ps --format \"{{.Names}}\" && df -h' 2>&1 | tail -20")), "allow");
  assert.equal(kep(bash(SA, `${ROOT}/bin/server-cek.sh`)), "allow");
  assert.equal(kep(bash(SA, "ssh vps-uji \"mysql -u ro app_uji_db -e 'SELECT COUNT(*) FROM users'\"")), "allow");
});

test("perkakas_perintah: subperintah perkakas yang didelegasikan pemilik", () => {
  const TW = path.join(ROOT, "ruang", "technical-writer");
  // Tanpa aturan di kebijakan: alur izin biasa (selalu ditanya Claude Code).
  assert.equal(kep(bash(TW, `${ROOT}/bin/perkakas.sh pastikan docx-neuron`)), K.perkakas_perintah?.perkakas?.pastikan ? "allow" : null);
  // Dengan aturan (contoh yang bisa disetujui pemilik): semua jabatan boleh pastikan/skill tanpa bertanya.
  const K2 = { ...K, perkakas_perintah: { perkakas: { pastikan: "skill-luar", skill: "skill-luar" } },
    kemampuan: { ...K.kemampuan, "skill-luar": { nama: "Skill luar", akses: Object.keys(K.jabatan) } } };
  const kep2 = (i) => putuskan(i, K2).keputusan;
  assert.equal(kep2(bash(TW, `${ROOT}/bin/perkakas.sh pastikan docx-neuron`)), "allow");
  assert.equal(kep2(bash(SA, "bin/perkakas.sh skill")), "allow");
  assert.equal(kep2(bash(TW, `${ROOT}/bin/perkakas.sh siapkan`)), null);   // subperintah lain tidak ikut didelegasikan
  assert.equal(kep2(bash("/x/lain/bin", "/x/lain/bin/perkakas.sh pastikan docx")), null);   // perkakas sistem lain tidak dikenali
});

test("kebijakan asli: skill luar boleh dicek & dipasang setiap jabatan (disetujui pemilik 2026-10-27)", () => {
  assert.deepEqual([...K.kemampuan["skill-luar"].akses].sort(), Object.keys(K.jabatan).sort());
  for (const j of Object.keys(K.jabatan).filter((x) => !["tech-lead", "business-systems-analyst", "software-engineer"].includes(x))) {
    assert.equal(kep(bash(j === "coo" ? COO : path.join(ROOT, "ruang", j), `${ROOT}/bin/perkakas.sh pastikan docx`)), "allow", j);
  }
  assert.equal(kep(bash("/x/toko/.claude/worktrees/r1-se1-toko", `${ROOT}/bin/perkakas.sh pastikan frontend-design`)), "allow");
  assert.equal(kep(bash(path.join(ROOT, "ruang", "technical-writer"), `${ROOT}/bin/perkakas.sh siapkan`)), null);
});

test("jenjang 3: ubah server, sudo, rahasia, perintah tak dikenal selalu ditanya", () => {
  for (const c of ["ssh vps-uji 'docker restart app-uji-app'", "ssh vps-uji 'sudo systemctl reload nginx'",
    "ssh vps-uji 'cat ~/app-uji/.env'", "ssh vps-uji 'echo x > /tmp/a'", "ssh vps-uji", "scp a.sql vps-uji:~/",
    "ssh vps-uji \"mysql app_uji_db -e 'DELETE FROM users'\"", "ssh vps-uji 'ls $(pwd)'"]) {
    assert.equal(kep(bash(SA, c)), "ask", c);
  }
});

test("akses per jabatan: COO tidak membaca server/DNS tanpa izin", () => {
  assert.equal(kep(bash(COO, "ssh vps-uji uptime")), "ask");
  assert.equal(kep(mcp(COO, "execute", { operation: "dns_records_list", params: { domain: "contoh.test" } })), "ask");
  assert.equal(kep(bash(COO, `${ROOT}/bin/rilis-cek.sh contoh/app-uji ${SHA}`)), "allow");
});

test("jenjang 2 deploy: hanya setelah rilis-cek SIAP DEPLOY tercatat", () => {
  const deploy = `ssh vps-uji 'cd ~/app-uji && ./deploy.sh ${SHA}'`;
  assert.equal(kep(bash(SA, deploy)), "ask");                                   // belum ada rilis-cek
  catatSesudah({ ...bash(COO, `bin/rilis-cek.sh contoh/app-uji ${SHA.slice(0, 7)}`), hook_event_name: "PostToolUse",
    tool_response: { stdout: "ci: success\nSIAP DEPLOY" } }, K);
  assert.equal(kep(bash(SA, deploy)), "allow");
  assert.equal(kep(bash(COO, deploy)), "ask");                                  // bukan wewenang COO
  assert.equal(kep(bash(SA, `ssh vps-uji 'cd ~/app-lain && ./deploy.sh ${SHA}'`)), "ask");   // app belum terdaftar
  assert.equal(kep(bash(SA, `ssh vps-uji 'cd ~/app-uji && ./deploy.sh ${"f".repeat(40)}'`)), "ask"); // sha lain
});

test("jenjang 2 DNS: tambah subdomain boleh, apex/overwrite/hapus ditanya", () => {
  const z = (name, type = "A", extra = {}) => ({ operation: "dns_records_update", params: { domain: "contoh.test", zone: [{ name, type, records: [{ content: "192.0.2.10" }] }], ...extra } });
  assert.equal(kep(mcp(SA, "execute", z("api"))), "allow");
  assert.equal(kep(mcp(SA, "execute", z("@"))), "ask");
  assert.equal(kep(mcp(SA, "execute", z("www"))), "ask");
  assert.equal(kep(mcp(SA, "execute", z("*.x"))), "ask");
  assert.equal(kep(mcp(SA, "execute", z("mail", "MX"))), "ask");
  assert.equal(kep(mcp(SA, "execute", z("api", "A", { overwrite: true }))), "ask");
  assert.equal(kep(mcp(SA, "execute", { operation: "dns_records_delete", params: { domain: "contoh.test" } })), "ask");
  assert.equal(kep(mcp(SA, "execute", { operation: "dns_records_list", params: { domain: "contoh.test" } })), "allow");
  assert.equal(kep(mcp(SA, "search", { query: "dns" })), "allow");
  assert.equal(kep(mcp(SA, "multi-execute", { steps: [{ operation: "dns_records_list" }, { operation: "dns_records_reset" }] })), "ask");
});

test("jenjang 2 repo: COO membuat repo privat; publik, --push, push, dan jabatan lain ditanya", () => {
  assert.equal(kep(bash(COO, "gh repo create contoh/repo-baru --private")), "allow");
  assert.equal(kep(bash(COO, "gh repo create contoh/repo-baru --private --source . --push")), "ask");
  assert.equal(kep(bash(COO, "gh repo create contoh/repo-baru --public")), "ask");
  const tl = "/x/toko/.claude/worktrees/r1-lead-toko";
  assert.equal(kep(bash(tl, "gh repo create contoh/x --private")), "ask");
  assert.equal(kep(bash(tl, "git -C /x/toko push origin main")), "ask");
  assert.equal(kep(bash(tl, "git commit -m 'perbaiki tombol push'")), null);   // lokal, bukan urusan kebijakan
  assert.equal(kep(bash(tl, "gh pr view 12 && gh run list")), "allow");
  assert.equal(kep(bash(tl, "gh api repos/a/b/pulls -X POST -f title=x")), "ask");
  assert.equal(kep(bash(tl, "glab mr list")), "allow");
});

test("perintah campuran: bagian tak dikenal → alur biasa, kecuali ada yang berisiko", () => {
  assert.equal(kep(bash(SA, "ssh vps-uji uptime && python3 olah.py")), null);
  assert.equal(kep(bash(SA, "python3 olah.py && ssh vps-uji 'docker restart x'")), "ask");
});

test("audit: deploy & DNS tercatat dengan ID tugas, rahasia disamarkan", () => {
  const t = transkrip("audit", [{ type: "user", message: { content: "[Tugas dari Head of IT Operations] T-20261026-4 · deploy" } }]);
  catatSesudah({ ...bash(SA, `ssh vps-uji 'cd ~/app-uji && ./deploy.sh ${SHA}'`, { transcript_path: t }), hook_event_name: "PostToolUse", tool_response: { stdout: "ok" } }, K);
  const r = bacaAudit().at(-1);
  assert.equal(r.jenis, "deploy");
  assert.equal(r.tugas, "T-20261026-4");
  const coo = transkrip("audit-coo", [{ type: "user", message: { content: "push ke origin" } },
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { content: "contoh T-20990101-9 di berkas tes" } }] } }]);
  catatSesudah({ ...bash(COO, "git push origin main", { transcript_path: coo }), hook_event_name: "PostToolUse", tool_response: { stdout: "" } }, K);
  assert.equal(bacaAudit().at(-1).tugas, null);                                // ID di teks agent/berkas tidak dipakai
  assert.equal(r.jabatan, "system-administrator");
  assert.equal(samarkan("mysql -u root -pRahasia123 -e 'x' TOKEN=abc password: qwe"), "mysql -u root -p*** -e 'x' TOKEN=*** password: ***");
  const jumlah = bacaAudit().length;
  catatSesudah({ ...bash(SA, "ssh vps-uji uptime"), hook_event_name: "PostToolUse", tool_response: { stdout: "up" } }, K);
  assert.equal(bacaAudit().length, jumlah);                                      // baca tidak diaudit
});

test("hook CLI: keluaran JSON PreToolUse dan gagal terbuka", () => {
  const jalankan = (stdin) => execFileSync(process.execPath, [path.join(SINI, "kebijakan.mjs"), "hook"], { input: stdin, env: process.env }).toString();
  const out = JSON.parse(jalankan(JSON.stringify(bash(SA, "ssh vps-uji 'docker restart x'"))));
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /System Administrator/);
  assert.equal(jalankan("bukan json"), "");
});

test("tanpa konfigurasi server: host ssh & MCP DNS tidak dikenali → alur biasa", () => {
  const K0 = muatKebijakan(undefined, path.join(tmp, "tidak-ada.json"));
  assert.deepEqual(K0.aplikasi, {});
  assert.equal(putuskan(bash(SA, "ssh vps-uji uptime"), K0).keputusan, null);
  assert.equal(putuskan(bash(SA, "ssh vps-uji 'docker restart x'"), K0).keputusan, null);
  assert.equal(putuskan(mcp(SA, "execute", { operation: "dns_records_list", params: { domain: "contoh.test" } }), K0).keputusan, null);
  assert.equal(putuskan(bash(COO, "gh pr view 1"), K0).keputusan, "allow");   // aturan generik tetap berlaku
});

test("pasang & lepas: hook sistem lain bernama bin/kebijakan.mjs tidak dianggap milik kita dan tidak tersentuh", () => {
  const S = process.env.RUDISONE_SETTINGS_USER;
  const asing = { matcher: "^(Bash|mcp__.*)$", hooks: [{ type: "command", command: '"/usr/bin/node" "/x/TimAgent/bin/kebijakan.mjs" hook' }] };
  fs.mkdirSync(path.dirname(S), { recursive: true });
  fs.writeFileSync(S, JSON.stringify({ hooks: { PreToolUse: [asing], PostToolUse: [asing] } }));
  assert.equal(statusPasang(), false);
  const cli = (...a) => execFileSync(process.execPath, [path.join(SINI, "kebijakan.mjs"), ...a], { env: process.env }).toString();
  assert.match(cli("lepas", "--ya"), /Tidak terpasang/);
  cli("pasang", "--ya");
  assert.equal(statusPasang(), true);
  cli("lepas", "--ya");
  assert.deepEqual(JSON.parse(fs.readFileSync(S, "utf8")).hooks, { PreToolUse: [asing], PostToolUse: [asing] });
  fs.rmSync(S);
});

test("pasang & lepas: idempoten, cadangan dibuat, settings lain utuh", () => {
  const S = process.env.RUDISONE_SETTINGS_USER;
  fs.mkdirSync(path.dirname(S), { recursive: true });
  fs.writeFileSync(S, JSON.stringify({ theme: "dark", hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "lain.sh" }] }] } }));
  const cli = (...a) => execFileSync(process.execPath, [path.join(SINI, "kebijakan.mjs"), ...a], { env: process.env }).toString();
  cli("pasang", "--ya"); cli("pasang", "--ya");
  const s = JSON.parse(fs.readFileSync(S, "utf8"));
  assert.equal(s.theme, "dark");
  assert.equal(s.hooks.PreToolUse.length, 2);
  assert.equal(s.hooks.PostToolUse.length, 1);
  assert.equal(statusPasang(), true);
  assert.ok(fs.readdirSync(path.dirname(S)).some((f) => f.includes("cadangan-rudisone")));
  assert.match(cli("cek"), /terpasang/);
  const rusak = JSON.parse(fs.readFileSync(S, "utf8"));
  rusak.hooks.PostToolUse[0].hooks[0].command = `"/tidak/ada/node" "${path.join(SINI, "kebijakan.mjs")}" hook`;
  fs.writeFileSync(S, JSON.stringify(rusak));
  assert.throws(() => cli("cek"), (e) => /tidak ditemukan/.test(String(e.stdout)));
  cli("lepas", "--ya"); cli("pasang", "--ya");
  cli("lepas", "--ya");
  const s2 = JSON.parse(fs.readFileSync(S, "utf8"));
  assert.deepEqual(s2.hooks, { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "lain.sh" }] }] });
  assert.equal(statusPasang(), false);
});

test("subagent peran rudis-<id>: tercatat dengan jabatannya, akses hanya menyempit", async () => {
  const { kenaliSesi } = await import("./kebijakan.mjs");
  const SA_RUANG = path.join(ROOT, "ruang", "system-administrator");
  const sub = (cwd, cmd, tipe) => bash(cwd, cmd, { agent_type: tipe, agent_id: "a1" });
  // jabatan tercatat = peran subagent, induk = jabatan sesi pemanggil
  const s = kenaliSesi(sub(COO, "ls", "rudis-research-analyst"), K);
  assert.deepEqual([s.jabatan, s.induk, s.subagent], ["research-analyst", "coo", true]);
  // eskalasi ditolak: COO memanggil subagent SysAdmin untuk ssh → tetap ditanya (COO tidak punya akses server)
  const e = putuskan(sub(COO, "ssh vps-uji uptime", "rudis-system-administrator"), K);
  assert.equal(e.keputusan, "ask");
  assert.match(e.alasan, /di luar akses COO/);
  // sesi pribadi (bukan RudisOne) memanggil subagent SysAdmin → tidak pernah diloloskan
  const p = putuskan(sub(path.join(tmp, "pribadi"), "ssh vps-uji \"mysql app -e 'select 1'\"", "rudis-system-administrator"), K);
  assert.equal(p.keputusan, "ask");
  assert.match(p.alasan, /bukan sesi RudisOne/);
  // menyempit: sesi SysAdmin memanggil subagent Research Analyst untuk ssh → ditanya (RA tidak punya akses server)
  assert.equal(putuskan(sub(SA_RUANG, "ssh vps-uji uptime", "rudis-research-analyst"), K).keputusan, "ask");
  // sesi SysAdmin + subagent SysAdmin: jenjang 1 boleh, jenjang 2 selalu ditanya
  assert.equal(putuskan(sub(SA_RUANG, "ssh vps-uji uptime", "rudis-system-administrator"), K).keputusan, "allow");
  // tipe subagent lain (bukan rudis-) memakai jabatan sesi
  assert.equal(kenaliSesi(bash(COO, "ls", { agent_type: "Explore" }), K).jabatan, "coo");
});


test("worktree tim di dalam repo RudisOne sendiri terbaca sebagai jabatan tim, bukan COO", async () => {
  const { kenaliSesi } = await import("./kebijakan.mjs");
  const wt = path.join(ROOT, ".claude", "worktrees", "r2-lead-rudisone-abc123");
  assert.equal(kenaliSesi(bash(wt, "ls"), K).jabatan, "tech-lead");
  assert.equal(kenaliSesi(bash(path.join(ROOT, ".claude", "worktrees", "r2-se1-rudisone-x"), "ls"), K).jabatan, "software-engineer");
  assert.equal(kenaliSesi(bash(COO, "ls"), K).jabatan, "coo");
});
