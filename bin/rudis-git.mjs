#!/usr/bin/env node
// Pengaman git untuk command RUDIS. Command /rudis.redesign|revamp|upgrade|implement menawarkan
// checkpoint "commit atau stash" dan rollback `git reset --hard` / `git checkout <sha> -- <path>` — dilarang protokol
// (stash dipakai bersama semua worktree; reset/checkout -- membuang kerja). Penggantinya: checkpoint = commit di branch
// tugas, rollback = commit baru yang memulihkan path dari checkpoint. Tidak ada yang hilang dari riwayat.
// Hanya di worktree tertaut (bukan checkout utama milik pengguna) dan hanya di branch rudis/<ID>[-…].
//   checkpoint <ID> [pesan]          commit semua perubahan: "checkpoint(<ID>): <pesan>" (tanpa perubahan → cetak HEAD)
//   rollback <ID> <sha> -- <path…>   checkpoint keadaan sekarang, pulihkan path dari checkpoint <sha>, commit "rollback(<ID>): …"
//   daftar <ID>                      checkpoint di branch ini
// Exit: 0 berhasil · 1 ditolak/gagal (alasan di stderr) · 3 pemakaian salah.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const POLA_ID = /^T-\d{8}-\d+(\.\d+)?$/;
const RAHASIA = new RegExp([
  "(^|/)\\.env(\\.[^/]*)?$", "(^|/)[^/]*\\.env$", "(^|/)\\.envrc$",
  "(^|/)id_(rsa|dsa|ecdsa|ed25519)(_sk)?$", "\\.(pem|key|p12|pfx|jks|keystore|ppk|kdbx)$",
  "(^|/)\\.(netrc|npmrc|pypirc|pgpass|git-credentials|htpasswd)$", "(^|/)[^/]*credentials?[^/]*$",
  "(^|/)[^/]*secrets?[^/]*\\.(json|ya?ml|toml|ini|txt)$", "(^|/)service[-_]?account[^/]*\\.json$", "(^|/)[^/]*token[^/]*\\.(json|txt)$",
].join("|"), "i");
const BOLEH_RAHASIA = /\.(example|sample|template|dist)$|\.env\.[^/]*\.example$/i;

class Tolak extends Error {}
const git = (cwd, args, opsi = {}) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opsi }).trim();

/** Prasyarat bersama: worktree tertaut, branch rudis/<ID>…, ID sah. Mengembalikan { akar, branch, head }. */
export function periksa(cwd, id) {
  if (!POLA_ID.test(id ?? "")) throw new Tolak(`ID tugas tidak sah: ${id ?? "(kosong)"}`);
  let akar;
  try { akar = path.resolve(git(cwd, ["rev-parse", "--show-toplevel"])); } catch { throw new Tolak(`bukan repo git: ${cwd}`); }
  const gitDir = path.resolve(akar, git(akar, ["rev-parse", "--git-dir"]));
  const common = path.resolve(akar, git(akar, ["rev-parse", "--git-common-dir"]));
  if (gitDir === common) throw new Tolak("ini checkout utama (milik pengguna) — jalankan di worktree tugas");
  let branch;
  try { branch = git(akar, ["symbolic-ref", "--short", "HEAD"]); } catch { throw new Tolak("HEAD terlepas (detached) — pindah ke branch tugas dulu"); }
  const esc = id.replace(/\./g, "\\.");
  if (!new RegExp(`^rudis/${esc}(-[\\w.-]+)?$`).test(branch)) throw new Tolak(`branch ${branch} bukan branch tugas rudis/${id}[-…]`);
  return { akar, branch, head: git(akar, ["rev-parse", "HEAD"]) };
}

/** Path yang akan masuk commit (berubah + belum di-track, menghormati .gitignore). */
function berubah(akar) {
  const out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: akar, encoding: "utf8" });
  const ent = out.split("\0").filter(Boolean);
  const hasil = [];
  for (let i = 0; i < ent.length; i++) { const e = ent[i]; hasil.push(e.slice(3)); if (e[0] === "R" || e[0] === "C") i++; }
  return hasil;
}

export function checkpoint(cwd, id, pesan = "checkpoint") {
  const { akar } = periksa(cwd, id);
  const ubah = berubah(akar);
  if (!ubah.length) { const h = git(akar, ["rev-parse", "HEAD"]); return { sha: h, baru: false, pesan: `tidak ada perubahan — checkpoint = HEAD ${h.slice(0, 12)}` }; }
  const rahasia = ubah.filter((p) => RAHASIA.test(p) && !BOLEH_RAHASIA.test(p));
  if (rahasia.length) throw new Tolak(`berkas rahasia tidak ikut checkpoint: ${rahasia.join(", ")} — tambahkan ke .gitignore dulu`);
  git(akar, ["add", "-A"]);
  git(akar, ["commit", "-q", "-m", `checkpoint(${id}): ${String(pesan).replace(/\s+/g, " ").slice(0, 120)}`]);
  const h = git(akar, ["rev-parse", "HEAD"]);
  return { sha: h, baru: true, pesan: `checkpoint ${h.slice(0, 12)} (${ubah.length} berkas)` };
}

export function daftar(cwd, id) {
  const { akar } = periksa(cwd, id);
  const out = git(akar, ["log", "--format=%H%x09%ad%x09%s", "--date=iso", "--fixed-strings", `--grep=checkpoint(${id})`]);
  return out ? out.split("\n").map((l) => { const [sha, waktu, subjek] = l.split("\t"); return { sha, waktu, subjek }; }) : [];
}

export function rollback(cwd, id, sha, paths) {
  const { akar } = periksa(cwd, id);
  if (!paths?.length) throw new Tolak("sebut path yang dipulihkan setelah `--` (rollback seluruh repo tidak didukung)");
  let full;
  try { full = git(akar, ["rev-parse", "--verify", `${sha}^{commit}`]); } catch { throw new Tolak(`bukan commit: ${sha}`); }
  try { git(akar, ["merge-base", "--is-ancestor", full, "HEAD"]); } catch { throw new Tolak(`${sha} bukan leluhur HEAD di branch ini`); }
  const subjek = git(akar, ["log", "-1", "--format=%s", full]);
  if (!subjek.startsWith(`checkpoint(${id})`)) throw new Tolak(`${sha} bukan checkpoint tugas ${id} ("${subjek}") — buat checkpoint dulu dengan perkakas ini`);
  for (const p of paths) {
    const abs = path.resolve(akar, p);
    if (abs !== akar && !abs.startsWith(akar + path.sep)) throw new Tolak(`path di luar repo: ${p}`);
    if (/^:|[*?[]/.test(p)) throw new Tolak(`pathspec khusus/glob tidak didukung: ${p}`);
  }
  // Berkas yang di-.gitignore tidak masuk checkpoint, tetapi `git restore --worktree` tetap menimpanya bila ada di
  // checkpoint → isinya hilang dari mana pun. Tolak; pengguna/TL memindahkan atau meng-commit-nya dulu.
  const abai = execFileSync("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", ...paths], { cwd: akar, encoding: "utf8" })
    .split("\0").filter(Boolean);
  if (abai.length) {
    const diCp = new Set(execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", full, "--", ...paths], { cwd: akar, encoding: "utf8" }).split("\0").filter(Boolean));
    const tertimpa = abai.filter((f) => diCp.has(f));
    if (tertimpa.length) throw new Tolak(`berkas yang diabaikan git akan tertimpa dan tidak tersimpan di checkpoint mana pun: ${tertimpa.join(", ")} — pindahkan dulu`);
  }
  const sebelum = checkpoint(akar, id, `sebelum rollback ke ${full.slice(0, 7)}`);
  try { git(akar, ["restore", `--source=${full}`, "--staged", "--worktree", "--", ...paths]); }
  catch (e) { throw new Tolak(`git restore gagal: ${String(e.stderr || e.message).trim()}`); }
  if (!berubah(akar).length) return { sha: git(akar, ["rev-parse", "HEAD"]), sebelum: sebelum.sha, pesan: "path sudah sama dengan checkpoint — tidak ada yang diubah" };
  git(akar, ["commit", "-q", "-m", `rollback(${id}): ${paths.join(" ").slice(0, 100)} ke ${full.slice(0, 7)}`]);
  const h = git(akar, ["rev-parse", "HEAD"]);
  return { sha: h, sebelum: sebelum.sha, pesan: `rollback ${h.slice(0, 12)}; keadaan sebelumnya tersimpan di ${sebelum.sha.slice(0, 12)}` };
}

export function main(argv, cwd = process.cwd()) {
  const [cmd, id, ...sisa] = argv;
  try {
    if (cmd === "checkpoint") { console.log(checkpoint(cwd, id, sisa.join(" ") || "checkpoint").pesan); return 0; }
    if (cmd === "daftar") { for (const c of daftar(cwd, id)) console.log(`${c.sha.slice(0, 12)}  ${c.waktu}  ${c.subjek}`); return 0; }
    if (cmd === "rollback") {
      const i = sisa.indexOf("--");
      if (i !== 1) { console.error("Pemakaian: rollback <ID> <sha> -- <path…>"); return 3; }
      console.log(rollback(cwd, id, sisa[0], sisa.slice(2)).pesan); return 0;
    }
  } catch (e) {
    if (e instanceof Tolak) { console.error(`[rudis-git] ditolak: ${e.message}`); return 1; }
    console.error(`[rudis-git] gagal: ${String(e.stderr || e.message).trim()}`); return 1;
  }
  console.error("Pemakaian: bin/rudis-git.sh checkpoint <ID> [pesan] | rollback <ID> <sha> -- <path…> | daftar <ID>");
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
