// Tabel kelas bentuk perintah untuk penjaga hook (bin/kebijakan.mjs): setiap aksi yang dijaga (git perusak, git push,
// baca .env) diuji dalam bentuk polos (kontrol), bentuk tersamar (pembungkus, kutip, substitusi, heredoc, cd/symlink,
// variabel, glob, blok/pipa ke sh, git -c/alias, --env-file) dan bentuk yang hanya menyebut/aman.
// Tinjauan menemukan bentuk baru → tambah barisnya di sini (jebakan terulang ≥ 2 kali → pemeriksaan otomatis).
// Celah/salah tangkap yang belum diperbaiki ditandai `todo` agar terlihat tanpa menggagalkan suite. node --test bin/
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "kebijakan-bentuk-")));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const ROOT = path.join(tmp, "RudisOne");
const REGISTER = path.join(tmp, "register-tugas.json");
const KONFIG = path.join(tmp, "server.json");
fs.mkdirSync(path.join(ROOT, "handoff"), { recursive: true });
fs.writeFileSync(KONFIG, JSON.stringify({ versi: 1, server: {}, aplikasi: {}, dns: {} }));
// konfigurasi git global/sistem per device tidak ikut menentukan hasil (izin tugas menilainya)
const GLOBAL = path.join(tmp, "gitconfig-global");
fs.writeFileSync(GLOBAL, "");
Object.assign(process.env, {
  RUDISONE_ROOT: ROOT, RUDISONE_REGISTER: REGISTER, RUDISONE_SERVER: KONFIG,
  RUDISONE_KEBIJAKAN: path.join(SINI, "..", "kebijakan-akses.json"),
  RUDISONE_AUDIT: path.join(tmp, "audit"), RUDISONE_SETTINGS_USER: path.join(tmp, "claude", "settings.json"),
  GIT_CONFIG_GLOBAL: GLOBAL, GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "u", GIT_AUTHOR_EMAIL: "u@contoh.test", GIT_COMMITTER_NAME: "u", GIT_COMMITTER_EMAIL: "u@contoh.test",
});
const { putuskan, muatKebijakan } = await import("./kebijakan.mjs");
const K = muatKebijakan();
const g = (dir, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", "-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tulis = (f, isi) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, isi); };
const NILAI = "rahasia-SANGAT-panjang-123";

// ---------- fixture: repo proyek (origin bare, .env di-ignore), worktree Tech Lead, folder bertautan, sesi pribadi ----------
const BARE = path.join(tmp, "origin.git"), REPO = path.join(tmp, "proyek");
execFileSync("git", ["init", "-q", "--bare", "-b", "main", BARE]);
execFileSync("git", ["init", "-q", "-b", "main", REPO]);
tulis(path.join(REPO, ".gitignore"), ".env\n.env.*\n!.env.example\n");
tulis(path.join(REPO, "a.txt"), "a\n"); tulis(path.join(REPO, "README.md"), "x\n"); tulis(path.join(REPO, "sub", "b.txt"), "b\n");
g(REPO, "add", "-A"); g(REPO, "commit", "-qm", "awal");
g(REPO, "remote", "add", "origin", BARE); g(REPO, "push", "-q", "-u", "origin", "main");
tulis(path.join(REPO, "c.txt"), "c\n"); g(REPO, "add", "-A"); g(REPO, "commit", "-qm", "kerja");   // main maju 1 dari origin
const ID = "T-20260101-1";
const WT = path.join(REPO, ".claude", "worktrees", "r1-lead-proyek");
g(REPO, "worktree", "add", "-q", "-b", `rudis/${ID}`, WT);
for (const d of [REPO, WT]) {
  for (const f of [".env", ".env.local"]) tulis(path.join(d, f), `DB_DSN=${NILAI}\n`);
  tulis(path.join(d, ".env.example"), "DB_DSN=\n");
}
const X = path.join(tmp, "luar");          // folder tanpa .env; tautan/.. = REPO secara fisik, = X secara teks
const PRIBADI = path.join(tmp, "pribadi");
fs.mkdirSync(X, { recursive: true }); fs.mkdirSync(PRIBADI, { recursive: true });
let ADA_SYMLINK = true;
try {
  fs.symlinkSync(path.join(REPO, "sub"), path.join(X, "tautan"), "junction");
  fs.symlinkSync(path.join(REPO, ".env"), path.join(X, "config.txt"));
} catch (e) { if (["EPERM", "EACCES"].includes(e.code)) ADA_SYMLINK = false; else throw e; }

// register: tugas berizin (gabung/push) di REPO — juga menjadikan worktree r1-lead-* di REPO terbaca sebagai Tech Lead
const JAM = 3600e3, kini = Date.now();
fs.writeFileSync(REGISTER, JSON.stringify({ versi: 1, diperbarui: new Date().toISOString(), tugas: [{
  id: ID, judul: "x", folder: REPO, divisi: "Engineering", pemilik: "Tech Lead", prioritas: "normal", status: "berjalan",
  kunci: [], bergantung: [], fase: "—", perkakas: "—", dibuat: new Date(kini).toISOString(), diperbarui: new Date(kini).toISOString(),
  izin: [{ repo: REPO, cabang: "main", origin: BARE, aksi: ["gabung", "push", "bersihkan"], kutip: "Ya, gabung & kirim",
    dibuat: new Date(kini - 5 * 60e3).toISOString(), sampai: new Date(kini + 23 * JAM).toISOString() }] }] }));
// transkrip sesi COO utama (folder awal = ROOT) dengan pertanyaan COO + jawaban yang diketik pengguna
const baris = (o, mnt) => JSON.stringify({ timestamp: new Date(kini - mnt * 60e3).toISOString(), ...o });
const TR = path.join(tmp, "proj", "coo.jsonl");
tulis(TR, [
  baris({ type: "user", cwd: ROOT, origin: { kind: "human" }, message: { role: "user", content: "status tugas" } }, 12),
  baris({ type: "assistant", message: { content: [{ type: "text", text: "Gabung ke versi utama, kirim ke GitHub, lalu bersihkan salinan kerja?" }] } }, 11),
  baris({ type: "user", cwd: ROOT, origin: { kind: "human" }, message: { role: "user", content: "Ya, gabung & kirim" } }, 10),
].join("\n") + "\n");

// sesi: coo = sesi COO utama di repo proyek (push polos tercakup izin → allow); x = sesi COO di folder bertautan;
// tl = sesi Tech Lead di worktree; pribadi = sesi di luar RudisOne (hanya pengaman git pribadi)
const SESI = {
  coo: { cwd: REPO, transcript_path: TR }, x: { cwd: X, transcript_path: TR },
  tl: { cwd: WT }, pribadi: { cwd: PRIBADI },
};
let n = 0;
const putus = (perintah, sesi = "coo") =>
  putuskan({ session_id: `b${++n}`, tool_name: "Bash", tool_input: { command: perintah }, hook_event_name: "PreToolUse", ...SESI[sesi] }, K);

// ---------- tabel ----------
// harap: "allow" | "bukan-allow" | "ask" | "deny" | "—" (tanpa keputusan hook = alur izin biasa, sama dengan perintah polos aman).
// Bentuk berbahaya diharapkan keputusan yang SAMA dengan kontrol polosnya (ask untuk git, deny untuk .env): `—` berarti
// lolos dari hook. Baris `kontrol` = perintah polos yang menjadi pembanding kelasnya.
// Opsi: sesi (bawaan coo), kontrol, posix (lewati di Windows), symlink (lewati bila tautan tak bisa dibuat), todo.
const TABEL = [];
const kelas = (nama, ...daftar) => { for (const [perintah, harap, o = {}] of daftar) TABEL.push({ kelas: nama, perintah, harap, ...o }); };
// celah yang diketahui: bentuk berbahaya mendapat `—` (lolos dari hook ke alur izin biasa) padahal kontrol polosnya ask/deny
const celah = (uraian) => ({ todo: `celah: ${uraian} — dapat "—", polos ditanya/ditolak` });
const KONTROL = [
  ["git reset --hard", "ask", { kontrol: true }], ["git push origin main", "allow", { kontrol: true }],
  ["git status", "—", { kontrol: true }], ["cat .env", "deny", { kontrol: true }], ["cat .env.example", "—", { kontrol: true }],
];

kelas("pembungkus", ...KONTROL,
  ["bash -c 'git reset --hard'", "ask"], ["sh -c \"git stash\"", "ask"], ["bash -lc 'git push origin main'", "ask"],
  ["env git reset --hard", "ask"], ["env -i git push origin main", "ask"], ["env FOO=1 git clean -fd", "ask"],
  ["xargs git reset --hard < /dev/null", "ask"], ["echo main | xargs git push origin", "ask"],
  ["nohup git push origin main", "ask"], ["timeout 5 git push origin main", "ask"], ["timeout 5 git stash", "ask"],
  ["command git reset --hard", "ask"], ["exec git reset --hard", "ask"], ["eval 'git reset --hard'", "ask"], ["eval \"git push origin main\"", "ask"],
  ["time git push origin main", "ask"], ["time git checkout -- a.txt", "ask"], ["sudo git clean -fd", "ask"],
  ["bash -c 'cat .env'", "deny"], ["nohup cat .env", "deny"], ["time cat .env", "deny"], ["exec cat .env", "deny"],
  ["command cat .env", "deny"], ["xargs cat < /dev/null .env", "deny"],
  ["bash -c 'git reset --hard'", "ask", { sesi: "tl" }], ["bash -c 'git push origin main'", "ask", { sesi: "pribadi" }],
  ["env git stash", "ask", { sesi: "pribadi" }], ["timeout 5 git push origin main", "ask", { sesi: "pribadi" }],
  ["git status", "—", { sesi: "pribadi", kontrol: true }], ["git push origin main", "ask", { sesi: "pribadi", kontrol: true }],
  ["bash -c 'git status'", "—"], ["sh -c 'git log --oneline -3'", "—"], ["env git status", "—"], ["timeout 5 git diff", "—"],
  ["nohup npm test", "—"], ["time git status", "—"], ["command -v git", "—"], ["eval \"git status\"", "—"], ["exec git status", "—"],
  ["bash -c 'cat .env.example'", "—"], ["time npm test", "—"], ["bash -c 'git status'", "—", { sesi: "pribadi" }]);

kelas("kutip-escape", ...KONTROL,
  ["git \"reset\" --hard", "ask"], ["g\\it reset --hard", "ask"], ["'git' push origin main", "ask"], ["\"git\" stash", "ask"],
  ["git 'reset' \"--hard\"", "ask"], ["g\"i\"t reset --hard", "ask"], ["git re''set --hard", "ask"], ["git reset --h\"\"ard", "ask"],
  ["\\git push origin main", "ask"], ["git \"push\" origin main", "ask"], ["git $'reset' --hard", "ask", celah("kutip ANSI-C $'…'")], ["git cl\\ean -fd", "ask"],
  ["cat \".env\"", "deny"], ["cat '.env'", "deny"], ["cat .e\"n\"v", "deny"], ["cat \\.env", "deny"], ["c\\at .env", "deny"], ["'cat' .env", "deny"],
  ["'git' push origin main", "ask", { sesi: "pribadi" }], ["g\\it stash", "ask", { sesi: "pribadi" }],
  ["echo 'git reset --hard'", "—"], ["git commit -m \"git reset --hard ditolak\"", "—"], ["git log --grep=\"git push\"", "—"],
  ["echo \"cat .env\"", "—"], ["\"git\" status", "—"], ["g\\it status", "—"], ["cat \".env.example\"", "—"],
  ["echo 'git push origin main'", "—", { sesi: "pribadi" }]);

kelas("substitusi", ...KONTROL,
  ["echo $(git reset --hard)", "ask"], ["echo `git stash`", "ask"], ["x=$(git push origin main)", "ask"], ["echo \"$(git clean -fd)\"", "ask"],
  ["$(echo git) reset --hard", "ask", celah("nama perintah dari $( )")], ["git $(echo reset) --hard", "ask", celah("subperintah git dari $( )")],
  ["git push origin $(echo main)", "ask"], ["`echo git` stash", "ask", celah("nama perintah dari backtick")],
  ["cat $(echo .env)", "deny"], ["cat `echo .env`", "deny"], ["echo \"$(cat .env)\"", "deny"], ["diff <(cat .env) .env.example", "deny"],
  ["echo $(<.env)", "deny"],
  ["echo $(git stash)", "ask", { sesi: "pribadi" }],
  ["echo $(git status --short)", "—"], ["x=$(git rev-parse HEAD)", "—"], ["echo \"$(date)\"", "—"], ["x=$(git stash list)", "—"],
  ["echo $(cat .env.example)", "—"], ["echo '$(git reset --hard)'", "—"], ["echo '`cat .env`'", "—"]);

kelas("heredoc", ...KONTROL,
  ["bash <<EOF\ngit reset --hard\nEOF", "ask"], ["sh <<'EOF'\ngit push origin main\nEOF", "ask"], ["bash -s <<EOF\ngit stash\nEOF", "ask"],
  ["cat <<EOF | bash\ngit reset --hard\nEOF", "ask"], ["bash <<< 'git reset --hard'", "ask", celah("here-string <<< ke shell")],
  ["sh <<< \"git clean -fd\"", "ask", celah("here-string <<< ke shell")],
  ["bash <<EOF\ncat .env\nEOF", "deny"], ["node - <<'EOF'\nconsole.log(require('fs').readFileSync('.env','utf8'))\nEOF", "deny"],
  ["python3 - <<'PY'\nprint(open('.env').read())\nPY", "deny"],
  ["bash <<EOF\ngit push origin main\nEOF", "ask", { sesi: "pribadi" }],
  ["cat <<EOF > catatan.md\ngit reset --hard\nEOF", "—"], ["cat <<'EOF'\ngit push origin main\nEOF", "—"],
  ["cat > x.md <<'EOF'\ncat .env\nEOF", "—"], ["tee x.md <<EOF\ngit stash\nEOF", "—"],
  ["git commit -F - <<'EOF'\nfix: git reset --hard ditolak\nEOF", "—"], ["cat <<EOF > x.md\ngit push\nEOF", "—", { sesi: "pribadi" }]);

kelas("cd-symlink", ...KONTROL,
  ["cd sub && cat ../.env", "deny"], ["cd sub; cat ../.env", "deny"], ["cd .. && cat proyek/.env", "deny"], ["cd sub && cd .. && cat .env", "deny"],
  ["cd ~ && cd - && cat .env", "deny"], ["cd sub && git reset --hard", "ask"], ["cd .. && git -C proyek stash", "ask"],
  ["cat .env", "deny", { sesi: "tl", kontrol: true }], ["cd .. && cat r1-lead-proyek/.env", "deny", { sesi: "tl" }],
  ["cat tautan/../.env", "deny", { sesi: "x", symlink: true }], ["cd tautan/.. && cat .env", "deny", { sesi: "x", symlink: true }],
  ["cd tautan && cat ../.env", "deny", { sesi: "x", symlink: true }], ["cat config.txt", "deny", { sesi: "x", symlink: true }],
  ["cat config.txt", "—", { sesi: "coo", kontrol: true }],   // nama yang sama tanpa tautan (tidak ada di REPO): bukan env
  ["cat .env", "deny", { sesi: "x", kontrol: true }],      // nama env dinilai walau berkasnya tidak ada di folder sesi
  ["cd sub && cat ../.env.example", "—"], ["cd sub && cat b.txt", "—"], ["cd sub && git status", "—"],
  ["cat tautan/../.env.example", "—", { sesi: "x", symlink: true }], ["cd tautan && cat b.txt", "—", { sesi: "x", symlink: true }]);

kelas("variabel", ...KONTROL,
  ["X=reset; git $X --hard", "ask", celah("subperintah git dari variabel")], ["X=--hard; git reset $X", "ask", celah("opsi perusak dari variabel")],
  ["G=git; $G reset --hard", "ask", celah("nama perintah dari variabel")], ["${G:-git} push origin main", "ask", celah("nama perintah dari ${…:-…}")],
  ["A=push; git $A origin main", "ask", celah("subperintah push dari variabel")], ["R=.; git -C $R reset --hard", "ask"],
  ["git ${X:-stash}", "ask", celah("subperintah git dari ${…:-…}")], ["export S=stash; git $S", "ask", celah("subperintah git dari export")],
  ["F=.env; cat $F", "deny"], ["cat ${F:-.env}", "deny"], ["export F=.env; cat \"$F\"", "deny"], ["F=\".env\"; source \"$F\"", "deny"],
  ["A=push; git $A origin main", "ask", { sesi: "pribadi", ...celah("subperintah push dari variabel (sesi pribadi)") }],
  ["X=status; git $X", "—"], ["F=.env.example; cat $F", "—"], ["export ENV_FILE=.env", "—"], ["X=--oneline; git log $X", "—"],
  ["echo \"$HOME\"", "—"]);

kelas("glob", ...KONTROL,
  ["gi? reset --hard", "ask", celah("glob pada nama perintah git")], ["/usr/bin/gi[t] reset --hard", "ask", { posix: true, ...celah("glob pada path git") }],
  ["/usr/bin/g?t stash", "ask", { posix: true, ...celah("glob pada path git") }], ["gi[t] push origin main", "ask", celah("glob pada nama perintah git")],
  ["g*t clean -fd", "ask", celah("glob pada nama perintah git")], ["git{,} reset --hard", "ask", celah("kurawal pada nama perintah git")],
  ["cat .e*", "deny"], ["cat .en?", "deny"], ["cat .env*", "deny"], ["/bin/ca? .env", "deny", { posix: true }], ["cat .env.l*", "deny"],
  ["gi? push origin main", "ask", { sesi: "pribadi", ...celah("glob pada nama perintah git (sesi pribadi)") }],
  ["ls *.md", "—"], ["gi? status", "—"], ["cat .env.exa*", "—"], ["git log -- 'sub/*'", "—"], ["ls sub/*.txt", "—"]);

kelas("blok-loop-pipa", ...KONTROL,
  ["case x in x) git reset --hard;; esac", "ask"], ["for i in 1; do git stash; done", "ask"], ["while git push origin main; do break; done", "ask"],
  ["(git reset --hard)", "ask"], ["{ git reset --hard; }", "ask"], ["if true; then git clean -fd; fi", "ask"], ["f() { git reset --hard; }; f", "ask"],
  ["echo \"git push origin main\" | sh", "ask", celah("teks dipipa ke sh")], ["echo 'git reset --hard' | bash", "ask", celah("teks dipipa ke bash")],
  ["echo git reset --hard | bash -s", "ask", celah("teks dipipa ke bash -s")], ["printf 'git stash\\n' | sh -s", "ask", celah("teks dipipa ke sh -s")],
  ["(cd sub && git push origin main)", "ask"], ["! git reset --hard", "ask"],
  ["printf 'cat .env' | sh", "deny", celah("baca .env dipipa ke sh")], ["(cat .env)", "deny"], ["for f in .env; do cat $f; done", "deny"],
  ["case x in x) cat .env;; esac", "deny"],
  ["echo 'git push origin main' | sh", "ask", { sesi: "pribadi", ...celah("teks dipipa ke sh (sesi pribadi)") }],
  ["for i in 1; do git stash; done", "ask", { sesi: "pribadi" }],
  ["case x in a) echo \"git reset --hard\";; esac", "—"], ["for f in *.md; do wc -l $f; done", "—"], ["(git status)", "—"],
  ["echo \"git push\" | cat", "—"], ["echo 'git push origin main' | grep push", "—"], ["echo \"1) git stash pop\"", "—"],
  ["for f in .env.example; do cat $f; done", "—"], ["{ git status; }", "—"]);

kelas("git-config-alias", ...KONTROL,
  ["git -c alias.x='!git reset --hard' x", "ask", celah("alias shell lewat -c")], ["git -c alias.x=reset x --hard", "ask", celah("alias git lewat -c")],
  ["git -c alias.p=push p origin main", "ask", celah("alias push lewat -c")], ["git -c core.sshCommand=x push origin main", "ask"],
  ["git -c core.fsmonitor='git reset --hard' status", "ask", celah("program core.fsmonitor lewat -c")],
  ["git -c core.pager='sh -c \"git reset --hard\"' log", "ask", celah("program core.pager lewat -c")],
  ["git --exec-path=/tmp/x push origin main", "ask"],
  ["git config alias.x '!git reset --hard' && git x", "ask", celah("alias ditulis ke config lalu dipanggil")],
  ["git config --global alias.st stash && git st", "ask", celah("alias global ditulis lalu dipanggil")],
  ["git -c alias.x='!cat .env' x", "deny", celah("baca .env lewat alias shell -c")],
  ["git -c alias.p=push p origin main", "ask", { sesi: "pribadi", ...celah("alias push lewat -c (sesi pribadi)") }],
  ["git -c color.ui=never status", "—"], ["git -c core.fsmonitor=false status", "—"], ["git config --get user.name", "—"],
  ["git --exec-path", "—"], ["git -c alias.lg='log --oneline' lg", "—"], ["git config alias.lg 'log --oneline'", "—"]);

kelas("env-file", ...KONTROL,
  ["node --env-file=.env -p process.env", "deny"], ["node --env-file .env -e 'console.log(process.env.DB_DSN)'", "deny"],
  ["source .env && env", "deny"], [". ./.env; printenv", "deny"], ["set -a; . .env; set +a; env", "deny"],
  ["docker compose --env-file .env config", "deny"], ["dotenv -e .env -- printenv", "deny"], ["head -1 .env.local", "deny"],
  ["bun --env-file=.env -e 'console.log(process.env)'", "deny"], ["env $(cat .env | xargs) printenv", "deny"],
  ["cat .env", "deny", { sesi: "tl" }], ["node --env-file=.env -p process.env", "deny", { sesi: "tl" }],
  ["cat .env", "—", { sesi: "pribadi", kontrol: true }],
  ["node --env-file=.env server.js", "—"], ["source .env.example", "—"], ["npm test", "—"], ["ls -la .env", "—"],
  ["grep -c DB_DSN .env", "—"], ["cp .env.example .env", "—"], ["test -f .env && echo ada", "—"], ["git check-ignore -q .env", "—"],
  ["node --env-file=.env.example -e 'console.log(1)'", "—"]);

// ---------- penjalan: satu test() per kelas, satu subtes per baris ----------
// Hal rawan "lulus karena alasan lain": ask/deny harus datang dari aksi sasaran (alasan menyebut git / isi .env), bukan dari jabatan/folder.
const SEBAB = { ask: /git/i, deny: /membaca isi/ };
for (const nama of [...new Set(TABEL.map((b) => b.kelas))]) {
  test(`kelas bentuk: ${nama}`, async (t) => {
    for (const b of TABEL.filter((x) => x.kelas === nama)) {
      const sesi = b.sesi ?? "coo";
      const label = `${b.kontrol ? "[kontrol] " : ""}${JSON.stringify(b.perintah)} @${sesi} → ${b.harap}`;
      const skip = (b.posix && process.platform === "win32" && "khas POSIX") || (b.symlink && !ADA_SYMLINK && "symlink tidak tersedia");
      await t.test(label, { skip, todo: b.todo }, () => {
        const p = putus(b.perintah, sesi);
        const dapat = p.keputusan ?? "—";
        const pesan = `${b.perintah} @${sesi}: dapat ${dapat} (${p.alasan ?? "-"}), harap ${b.harap}`;
        if (b.harap === "bukan-allow") assert.notEqual(dapat, "allow", pesan);
        else assert.equal(dapat, b.harap, pesan);
        if (SEBAB[dapat] && b.harap === dapat) assert.match(String(p.alasan), SEBAB[dapat], `${pesan} — ditolak/ditanya karena sebab lain`);
      });
    }
  });
}
