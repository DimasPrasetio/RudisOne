#!/usr/bin/env node
// Gerbang mesin sebelum Tech Lead-subagent melapor (T-20261031-2.3). READ-ONLY: hanya membaca handoff/<ID>/ dan
// menjalankan git baca (rev-parse, rev-list, branch, worktree list, status --porcelain, diff --name-only) dengan
// GIT_OPTIONAL_LOCKS=0 agar `status` pun tidak menulis indeks. Tidak menulis berkas apa pun.
// Butir: status.md tertulis · branch rudis/<ID> ada dengan ≥ 1 commit di atas base · worktree-nya bersih · cabang
// engineer rudis/<ID>-se* tergabung · tinjauan silang LULUS untuk sha HEAD terakhir (+ kecocokan spesifikasi bila ada
// spesifikasi) · opsional: transkrip membuktikan LULUS datang dari subagent peninjau, bukan ditulis Tech Lead sendiri.
//   bin/gerbang-tl.sh <ID> [--repo <path>] [--base <ref>] [--handoff <folder>] [--transkrip <jsonl>] [--json]
//   node bin/gerbang-tl.mjs --hook     (stdin: JSON hook SubagentStop dari frontmatter rudis-tech-lead)
// Exit: 0 SIAP LAPOR · 2 kurang (butir gagal + cara memperbaikinya) · 1 galat (ID tak sah, repo bukan git, argumen salah).
// Mode --hook selalu exit 0 dan gagal terbuka: hanya laporan akhir yang gagal gerbang yang di-block (COO tetap menjalankan
// gerbang sendiri). Idempoten: SubagentStop bisa terpicu ±2×/menit selagi subagent berjalan (bug Claude Code < 2.1.311).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
export const POLA_ID = /^T-\d{8}-\d+(\.\d+)*$/;
const POLA_ID_LEPAS = /T-\d{8}-\d+(?:\.\d+)*/;
export const PENINJAU = new Set(["rudis-software-engineer", "rudis-business-systems-analyst"]);
const PEMAKAIAN = "Pemakaian: bin/gerbang-tl.sh <ID> [--repo <path>] [--base <ref>] [--handoff <folder>] [--transkrip <jsonl>] [--json]\n"
  + "          node bin/gerbang-tl.mjs --hook   (stdin JSON SubagentStop)";

export class Galat extends Error {}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bersihNilai = (s) => s.trim().replace(/^\*+\s*/, "").replace(/^`(.*)`$/, "$1").trim();

/** ROOT RudisOne: env RUDISONE_ROOT atau induk folder bin/. */
export const akarRudisOne = (env = process.env) => env.RUDISONE_ROOT || path.dirname(path.dirname(INI));
/** Folder handoff/: --handoff, env RUDISONE_HANDOFF, atau <ROOT>/handoff. */
export const folderHandoff = (opsi = {}, env = process.env) => opsi.handoff || env.RUDISONE_HANDOFF || path.join(akarRudisOne(env), "handoff");

/** Ambil nilai `Kunci: nilai` di awal baris atau setelah pemisah `·` (gaya templat/status-tugas.md); toleran markdown
 *  (`- **Repo:** \`/x\``). Nilai berakhir di ujung baris atau `·` berikutnya. null bila tidak ada. */
export function nilaiBaris(teks, kunci) {
  const m = String(teks).match(new RegExp(`(?:^|·)[ \\t>*-]*\\**${esc(kunci)}\\**[ \\t]*:\\**[ \\t]*([^·\\n]+?)[ \\t]*(?=·|$)`, "im"));
  return m ? bersihNilai(m[1]) || null : null;
}

/** Periksa isi status.md. Mengembalikan { repo, base, kurang: [kata/baris yang hilang] }. */
export function periksaStatus(teks) {
  const kurang = [];
  const repo = nilaiBaris(teks, "Repo"), base = nilaiBaris(teks, "Base");
  if (!repo) kurang.push("baris `Repo: <path absolut>`");
  if (!base) kurang.push("baris `Base: <ref>`");
  for (const kata of ["selesai", "sisa", "langkah berikutnya"]) if (!new RegExp(esc(kata), "i").test(teks)) kurang.push(`kata "${kata}"`);
  return { repo, base, kurang };
}

/** Pola `[Hasil tinjauan] <ID> · LULUS|PERLU REVISI` (pemisah ·, -, —, : ditoleransi; ID tidak boleh berlanjut ke sub-ID). */
const polaHasil = (id) => new RegExp(`\\[Hasil tinjauan\\]\\s*${esc(id)}(?![\\w.])\\s*[·—:-]?\\s*(LULUS|PERLU REVISI)`, "gi");

/** Hasil tinjauan terakhir untuk <ID> dalam teks: "LULUS" | "PERLU REVISI" | null. */
export function hasilTerakhir(teks, id) {
  let akhir = null;
  for (const m of String(teks).matchAll(polaHasil(id))) akhir = m[1].toUpperCase();
  return akhir;
}

/** Periksa isi tinjauan.md terhadap sha HEAD. Mengembalikan daftar masalah (kosong = lulus). */
export function periksaTinjauan(teks, id, head, perluSpek) {
  const masalah = [];
  const hasil = hasilTerakhir(teks, id);
  if (!hasil) masalah.push(`tidak ada baris "[Hasil tinjauan] ${id} · LULUS"`);
  else if (hasil !== "LULUS") masalah.push("hasil tinjauan terakhir PERLU REVISI — perbaiki temuan lalu minta tinjauan ulang");
  const shas = [...String(teks).matchAll(/^[\s>*-]*\**sha\**\s*:\**\s*`?([0-9a-f]{7,40})`?\s*$/gim)].map((m) => m[1].toLowerCase());
  const sha = shas.at(-1);
  if (!sha) masalah.push(`tidak ada baris "sha: <sha>" (≥ 7 heks) untuk HEAD ${head.slice(0, 12)}`);
  else if (!head.toLowerCase().startsWith(sha)) masalah.push(`tinjauan basi: sha ${sha.slice(0, 12)} ≠ HEAD rudis/${id} ${head.slice(0, 12)} — tinjau ulang commit terakhir`);
  if (perluSpek && !/^[\s>*-]*\**kecocokan-spesifikasi\**\s*:\**\s*`?LULUS\b/im.test(teks))
    masalah.push("ada spesifikasi tetapi tidak ada baris \"kecocokan-spesifikasi: LULUS\" — minta BSA memeriksa kecocokan spesifikasi");
  return masalah;
}

const teksIsi = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => (typeof b === "string" ? b : b?.type === "text" ? b.text ?? "" : "")).join("\n") : "";

/** Bukti dari transkrip jsonl subagent Tech Lead: hasil tinjauan terakhir untuk <ID> di tool_result panggilan Agent/Task
 *  bertipe peninjau. Mengembalikan { ok, pesan }. Baris rusak dilewati. */
export function buktiTranskrip(jsonl, id) {
  const peninjau = new Map();         // tool_use_id → subagent_type
  let akhir = null, dari = null, hanyaTL = false;
  for (const baris of String(jsonl).split(/\r?\n/)) {
    if (!baris.trim()) continue;
    let o; try { o = JSON.parse(baris); } catch { continue; }
    const isi = o?.message?.content;
    if (!Array.isArray(isi)) {
      if (o?.type === "assistant" && hasilTerakhir(teksIsi(isi), id)) hanyaTL = true;
      continue;
    }
    for (const b of isi) {
      if (b?.type === "tool_use" && (b.name === "Agent" || b.name === "Task") && PENINJAU.has(b.input?.subagent_type)) peninjau.set(b.id, b.input.subagent_type);
      else if (b?.type === "tool_result" && peninjau.has(b.tool_use_id)) {
        const h = hasilTerakhir(teksIsi(b.content), id);
        if (h) { akhir = h; dari = peninjau.get(b.tool_use_id); }
      } else if (o.type === "assistant" && (b?.type === "text" || b?.type === "tool_use") && hasilTerakhir(b.type === "text" ? b.text : JSON.stringify(b.input ?? {}), id)) hanyaTL = true;
    }
  }
  if (akhir === "LULUS") return { ok: true, pesan: `LULUS berasal dari tool_result ${dari}` };
  if (akhir) return { ok: false, pesan: `hasil peninjau terakhir di transkrip ${akhir} (${dari}) — perbaiki lalu minta tinjauan ulang` };
  return { ok: false, pesan: (hanyaTL ? "\"[Hasil tinjauan] … LULUS\" hanya ditulis Tech Lead sendiri" : "transkrip tidak memuat hasil tinjauan")
    + " — panggil subagent rudis-software-engineer (atau rudis-business-systems-analyst untuk spesifikasi) sebagai peninjau" };
}

/** Uraikan `git worktree list --porcelain` → [{ path, branch }]. */
export function uraiWorktree(teks) {
  const hasil = [];
  for (const blok of String(teks).split(/\n\s*\n/)) {
    const wt = blok.match(/^worktree (.+)$/m), br = blok.match(/^branch (.+)$/m);
    if (wt) hasil.push({ path: wt[1].trim(), branch: br ? br[1].trim() : null });
  }
  return hasil;
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  }).replace(/\s+$/, "");
}
const gitCoba = (cwd, args) => { try { return git(cwd, args); } catch { return null; } };

const perluasRumah = (p) => (p === "~" ? os.homedir() : p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);

/** Jalankan gerbang. Melempar Galat untuk kesalahan argumen/repo. Mengembalikan { id, siap, butir: [{nama, ok, pesan}] }. */
export function gerbang(opsi = {}) {
  const { id } = opsi;
  if (!POLA_ID.test(id ?? "")) throw new Galat(`ID tugas tidak sah: ${id ?? "(kosong)"} (bentuk T-YYYYMMDD-n[.k])`);
  const butir = [];
  const catat = (nama, ok, pesan) => butir.push({ nama, ok, pesan });
  const dirTugas = path.join(folderHandoff(opsi), id);

  // 1. status.md
  const fStatus = path.join(dirTugas, "status.md");
  let st = { repo: null, base: null, kurang: [] };
  if (!fs.existsSync(fStatus)) catat("status", false, `${fStatus} tidak ada — tulis status (Repo:, Base:, selesai, sisa, langkah berikutnya)`);
  else {
    st = periksaStatus(fs.readFileSync(fStatus, "utf8"));
    if (st.kurang.length) catat("status", false, `status.md belum memuat ${st.kurang.join(", ")} — lengkapi ${fStatus}`);
    else catat("status", true, "status.md lengkap");
  }

  let transkrip = null;
  if (opsi.transkrip) {
    try { transkrip = fs.readFileSync(opsi.transkrip, "utf8"); } catch (e) { throw new Galat(`transkrip tidak terbaca: ${opsi.transkrip} (${e.code ?? e.message})`); }
  }

  const repoMentah = opsi.repo || st.repo, base = opsi.base || st.base;
  const lewati = (nama, sebab) => catat(nama, false, `tidak bisa diperiksa: ${sebab}`);
  const NAMA_REPO = ["branch", "commit", "worktree", "cabang-engineer", "tinjauan"];
  if (!repoMentah || !base) {
    const sebab = `${!repoMentah ? "repo" : "base"} tidak diketahui — tulis \`${!repoMentah ? "Repo: <path absolut>" : "Base: <ref>"}\` di status.md atau beri ${!repoMentah ? "--repo" : "--base"}`;
    for (const n of NAMA_REPO) lewati(n, sebab);
  } else {
    const repo = path.resolve(perluasRumah(repoMentah));
    if (!fs.existsSync(repo)) throw new Galat(`repo tidak ada: ${repo}`);
    if (gitCoba(repo, ["rev-parse", "--git-dir"]) === null) throw new Galat(`bukan repo git: ${repo}`);
    if (gitCoba(repo, ["rev-parse", "--verify", "-q", `${base}^{commit}`]) === null) throw new Galat(`base bukan commit/ref yang dikenal di ${repo}: ${base}`);
    const ref = `refs/heads/rudis/${id}`;
    const head = gitCoba(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
    if (!head) {
      catat("branch", false, `branch rudis/${id} tidak ada di ${repo} — kerjakan tugas di branch rudis/${id}`);
      for (const n of NAMA_REPO.slice(1)) lewati(n, `branch rudis/${id} tidak ada`);
    } else {
      catat("branch", true, `rudis/${id} @ ${head.slice(0, 12)}`);
      // 2. ≥ 1 commit di atas base
      const n = Number(git(repo, ["rev-list", "--count", `${base}..${ref}`]));
      catat("commit", n >= 1, n >= 1 ? `${n} commit di atas ${base}` : `tidak ada commit di atas ${base} — commit pekerjaan di rudis/${id}`);
      // 3. worktree bersih
      const wt = uraiWorktree(git(repo, ["worktree", "list", "--porcelain"])).find((w) => w.branch === ref);
      if (!wt) catat("worktree", true, `rudis/${id} tidak di-checkout di worktree mana pun — dilewati`);
      else if (!fs.existsSync(wt.path)) catat("worktree", true, `worktree ${wt.path} terdaftar tetapi foldernya tidak ada — dilewati`);
      else {
        const kotor = git(wt.path, ["status", "--porcelain"]);
        catat("worktree", !kotor, !kotor ? `worktree ${wt.path} bersih`
          : `worktree ${wt.path} kotor (${kotor.split("\n").length} berkas: ${kotor.split("\n").slice(0, 5).map((l) => l.slice(3)).join(", ")}) — commit atau buang perubahan yang tidak dipakai`);
      }
      // 4. cabang engineer tergabung
      const se = git(repo, ["branch", "--list", "--format=%(refname:short)", `rudis/${id}-se*`]).split("\n").filter(Boolean);
      const belum = se.map((b) => [b, Number(git(repo, ["rev-list", "--count", `${ref}..refs/heads/${b}`]))]).filter(([, k]) => k > 0);
      catat("cabang-engineer", !belum.length, !se.length ? "tidak ada cabang rudis/<ID>-se*"
        : !belum.length ? `${se.length} cabang engineer tergabung`
          : `belum tergabung ke rudis/${id}: ${belum.map(([b, k]) => `${b} (${k} commit)`).join(", ")} — gabungkan (git merge) atau laporkan sebagai sebagian`);
      // 5. tinjauan silang (+ kecocokan spesifikasi)
      let perluSpek = fs.existsSync(dirTugas) && fs.readdirSync(dirTugas).some((f) => /^spesifikasi.*\.md$/i.test(f));
      if (!perluSpek) perluSpek = git(repo, ["diff", "--name-only", `${base}...${ref}`]).split("\n").some((f) => f.startsWith("specs/"));
      const fTinjau = path.join(dirTugas, "tinjauan.md");
      if (!fs.existsSync(fTinjau)) catat("tinjauan", false, `${fTinjau} tidak ada — minta tinjauan silang (rudis-software-engineer) lalu tulis hasilnya beserta "sha: ${head.slice(0, 12)}"`);
      else {
        const masalah = periksaTinjauan(fs.readFileSync(fTinjau, "utf8"), id, head, perluSpek);
        catat("tinjauan", !masalah.length, masalah.length ? masalah.join("; ") : `LULUS untuk ${head.slice(0, 12)}${perluSpek ? " + kecocokan spesifikasi" : ""}`);
      }
    }
  }
  // 6. bukti transkrip (opsional)
  if (transkrip !== null) { const b = buktiTranskrip(transkrip, id); catat("transkrip", b.ok, b.pesan); }
  return { id, siap: butir.every((b) => b.ok), butir };
}

/** Teks untuk manusia. */
export function format(hasil) {
  if (hasil.siap) return [`SIAP LAPOR · ${hasil.id}`, ...hasil.butir.map((b) => `  ok  ${b.nama}: ${b.pesan}`)].join("\n");
  const gagal = hasil.butir.filter((b) => !b.ok);
  return [`BELUM SIAP · ${hasil.id} — ${gagal.length} butir gagal:`, ...gagal.map((b) => `- ${b.nama}: ${b.pesan}`)].join("\n");
}

/** Tentukan apakah input SubagentStop adalah laporan akhir yang wajib digerbang. Mengembalikan ID atau null. */
export function idLaporanAkhir(input) {
  const pesan = String(input?.last_assistant_message ?? "");
  const pertama = pesan.replace(/^\s+/, "").split(/\r?\n/, 1)[0];
  if (!/^\[Laporan divisi Engineering/.test(pertama) && !/^\[Laporan ke COO\]/.test(pertama)) return null;
  const id = pertama.match(POLA_ID_LEPAS)?.[0];
  if (!id || !POLA_ID.test(id)) return null;
  if (/\[Terhambat\]/i.test(pesan) || /\bstatus\W{0,6}(sebagian|terhambat)\b/i.test(pesan) || /\b(sebagian|terhambat)\b/i.test(pertama)) return null;
  return id;
}

/** Mode hook: kembalikan teks keluaran (JSON block) atau "" — tidak pernah melempar. */
export function hook(stdin, opsi = {}) {
  try {
    const input = JSON.parse(stdin);
    if (!input || typeof input !== "object" || input.stop_hook_active === true) return "";
    const id = idLaporanAkhir(input);
    if (!id) return "";
    const t = input.agent_transcript_path;
    const hasil = gerbang({ ...opsi, id, transkrip: t && fs.existsSync(t) ? t : undefined });
    if (hasil.siap) return "";
    const gagal = hasil.butir.filter((b) => !b.ok).map((b) => `${b.nama}: ${b.pesan}`).join(" · ");
    return JSON.stringify({ decision: "block", reason: `Gerbang Tech Lead belum lulus (${id}): ${gagal}. Perbaiki lalu laporkan ulang, atau laporkan sebagai sebagian/[Terhambat].` });
  } catch { return ""; }
}

/** Urai argumen CLI. Melempar Galat untuk argumen salah. */
export function uraiArgumen(argv) {
  const o = { json: false };
  const NILAI = { "--repo": "repo", "--base": "base", "--handoff": "handoff", "--transkrip": "transkrip" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--hook") o.hook = true;
    else if (NILAI[a]) { const v = argv[++i]; if (v === undefined || v.startsWith("--")) throw new Galat(`${a} butuh nilai`); o[NILAI[a]] = v; }
    else if (a.startsWith("-")) throw new Galat(`opsi tidak dikenal: ${a}`);
    else if (o.id === undefined) o.id = a;
    else throw new Galat(`argumen berlebih: ${a}`);
  }
  return o;
}

export function main(argv, io = {}) {
  const keluar = io.keluar ?? ((s) => process.stdout.write(s + "\n"));
  const galat = io.galat ?? ((s) => process.stderr.write(s + "\n"));
  if (argv.includes("--hook")) {
    let stdin = "";
    try { stdin = io.stdin ?? fs.readFileSync(0, "utf8"); } catch { /* gagal terbuka */ }
    const out = hook(stdin, io.opsi);
    if (out) keluar(out);
    return 0;
  }
  let o;
  try {
    o = uraiArgumen(argv);
    if (!o.id) throw new Galat("ID tugas wajib");
    const hasil = gerbang(o);
    keluar(o.json ? JSON.stringify(hasil) : format(hasil));
    return hasil.siap ? 0 : 2;
  } catch (e) {
    const pesan = e instanceof Galat ? e.message : String(e.stderr || e.message).trim();
    if (o?.json) keluar(JSON.stringify({ id: o.id ?? null, siap: false, galat: pesan }));
    galat(`[gerbang-tl] galat: ${pesan}`);
    if (!(e instanceof Galat) || /wajib|opsi|argumen|butuh nilai/.test(pesan)) galat(PEMAKAIAN);
    return 1;
  }
}

// realpath: hook bisa memanggil lewat path ber-symlink (mis. /tmp → /private/tmp di macOS)
const utama = (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(INI); } catch { return false; } })();
if (process.argv[1] && utama) process.exitCode = main(process.argv.slice(2));
