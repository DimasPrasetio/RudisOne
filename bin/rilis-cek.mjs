// Kesiapan rilis sebuah commit — READ-ONLY (GitHub via gh).
// Menampilkan semua workflow untuk commit itu dan tag image GHCR yang diterbitkan workflow rilis.
// Pemakaian: bin/rilis-cek.sh <owner/repo> <sha>      contoh: bin/rilis-cek.sh owner/app-saya 6385363
// Exit: 0 = semua workflow sukses & image terbit, 1 = ada yang gagal / image tak ditemukan,
//       2 = belum ada workflow atau masih berjalan, 3 = argumen/gh bermasalah.
import { jalankan } from "./lib/platform.mjs";

const [REPO = "", SHA = ""] = process.argv.slice(2);
if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(REPO) || !/^[0-9a-f]{7,40}$/.test(SHA)) {
  console.error("Pemakaian: bin/rilis-cek.sh <owner/repo> <sha>");
  process.exit(3);
}
const gh = (args, timeout = 60_000) => jalankan("gh", args, { encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 });

const versi = gh(["--version"], 15_000);
if (versi.error || versi.status !== 0) { console.error("gh (GitHub CLI) tidak ditemukan"); process.exit(3); }

const commit = gh(["api", `repos/${REPO}/commits/${SHA}`, "--jq", ".sha"]);
const FULL = commit.status === 0 ? commit.stdout.trim() : "";
if (!FULL) { console.error(`Commit ${SHA} tidak ditemukan di ${REPO}`); process.exit(3); }
console.log(`== ${REPO} @ ${FULL.slice(0, 7)} (${FULL})`);

const daftar = gh(["run", "list", "--repo", REPO, "--commit", FULL, "--limit", "20", "--json", "databaseId,workflowName,status,conclusion"]);
let runs = [];
try { runs = JSON.parse(daftar.stdout); } catch { /* keluaran bukan JSON → dianggap belum ada */ }
if (!runs.length) { console.log("Belum ada workflow untuk commit ini (belum di-push?)."); process.exit(2); }

let rc = 0;
console.log(`  ${"WORKFLOW".padEnd(22)} ${"STATUS".padEnd(12)} HASIL`);
for (const r of runs) {
  console.log(`  ${String(r.workflowName).padEnd(22)} ${String(r.status).padEnd(12)} ${r.conclusion || "-"}`);
  if (r.status !== "completed") { if (rc === 0) rc = 2; }
  else if (r.conclusion !== "success") rc = 1;
}

// Tag image dari log workflow rilis (nama mengandung release/image/publish); run terakhir yang memenuhi syarat menentukan.
let img = "";
const pola = new RegExp(`ghcr\\.io/[a-z0-9._/-]+:${FULL}`, "g");
for (const r of runs) {
  if (!/release|image|publish/.test(r.workflowName) || r.status !== "completed" || r.conclusion !== "success") continue;
  const log = gh(["run", "view", String(r.databaseId), "--repo", REPO, "--log"], 120_000);
  img = [...new Set(String(log.stdout ?? "").match(pola) ?? [])].sort()[0] ?? "";
}

console.log();
if (img) console.log(`Image: ${img}`);
else if (rc === 0) { console.log("Image: tidak ditemukan di log workflow rilis"); rc = 1; }
else console.log("Image: belum terbit");

console.log(rc === 0 ? "Hasil: SIAP DEPLOY" : rc === 2 ? "Hasil: MASIH BERJALAN — cek lagi nanti" : "Hasil: BELUM SIAP");
process.exit(rc);
