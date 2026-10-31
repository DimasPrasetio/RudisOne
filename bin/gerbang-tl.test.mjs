// Uji gerbang Tech Lead-subagent (T-20261031-2.3): node --test bin/
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { jalankanSh } from "./lib/uji-util.mjs";
import { gerbang, main, hook, buktiTranskrip, periksaStatus, hasilTerakhir, idLaporanAkhir, uraiArgumen, Galat } from "./gerbang-tl.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const MJS = path.join(SINI, "gerbang-tl.mjs");
const ID = "T-20261031-9";
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gerbang-tl-")));
const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let nomor = 0;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const STATUS = (repo, base = "main") => `# Status ${ID}\nRepo: ${repo}\nBase: ${base}\n\n## Selesai\n- gerbang\n\n## Sisa\n- tidak ada\n\n## Langkah berikutnya\n- lapor COO\n`;
const TINJAUAN = (sha, hasil = "LULUS", id = ID) => `# Tinjauan\n[Hasil tinjauan] ${id} · ${hasil}\nsha: ${sha.slice(0, 12)}\n`;

/** Fixture baru: repo (main) + worktree rudis/<ID> dengan 1 commit + handoff/<ID>/{status,tinjauan}.md. */
function fixture({ commit = true } = {}) {
  const akar = path.join(tmp, `f${++nomor}`);
  const repo = path.join(akar, "proyek"), wt = path.join(akar, "wt"), handoff = path.join(akar, "handoff");
  fs.mkdirSync(repo, { recursive: true });
  g(repo, "init", "-q", "-b", "main");
  for (const [k, v] of [["user.email", "uji@contoh.test"], ["user.name", "uji"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) g(repo, "config", k, v);
  fs.writeFileSync(path.join(repo, "a.txt"), "v1\n");
  fs.writeFileSync(path.join(repo, ".gitignore"), "*.log\n");
  g(repo, "add", "-A"); g(repo, "commit", "-q", "-m", "awal");
  g(repo, "worktree", "add", "-q", "-b", `rudis/${ID}`, wt);
  if (commit) { fs.writeFileSync(path.join(wt, "a.txt"), "v2\n"); g(wt, "commit", "-q", "-am", "kerja"); }
  const dir = path.join(handoff, ID);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "status.md"), STATUS(repo));
  const head = () => g(repo, "rev-parse", `rudis/${ID}`);
  const tinjau = (hasil = "LULUS") => fs.writeFileSync(path.join(dir, "tinjauan.md"), TINJAUAN(head(), hasil));
  tinjau();
  return { repo, wt, handoff, dir, head, tinjau };
}
const jalan = (f, ...arg) => { const out = [], err = []; const kode = main([ID, "--handoff", f.handoff, ...arg], { keluar: (s) => out.push(s), galat: (s) => err.push(s) }); return { kode, out: out.join("\n"), err: err.join("\n") }; };
const gagalNama = (h) => h.butir.filter((b) => !b.ok).map((b) => b.nama);

test("lulus penuh → exit 0 SIAP LAPOR", () => {
  const f = fixture();
  const r = jalan(f);
  assert.equal(r.kode, 0, r.out + r.err);
  assert.match(r.out, new RegExp(`^SIAP LAPOR · ${ID}`));
  assert.match(r.out, /worktree .* bersih/);
});

test("status.md hilang → exit 2; tanpa --repo butir repo tidak bisa diperiksa; dengan --repo/--base hanya status gagal", () => {
  const f = fixture();
  fs.rmSync(path.join(f.dir, "status.md"));
  const r = jalan(f);
  assert.equal(r.kode, 2);
  assert.match(r.out, /- status: .*status\.md tidak ada/);
  assert.match(r.out, /- branch: tidak bisa diperiksa: repo tidak diketahui/);
  const h = gerbang({ id: ID, handoff: f.handoff, repo: f.repo, base: "main" });
  assert.deepEqual(gagalNama(h), ["status"]);
});

test("status tanpa \"sisa\" → exit 2 dengan cara memperbaiki", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.dir, "status.md"), STATUS(f.repo).replace("## Sisa\n- tidak ada\n\n", ""));
  const r = jalan(f);
  assert.equal(r.kode, 2);
  assert.match(r.out, /- status: status\.md belum memuat kata "sisa" — lengkapi /);
  assert.deepEqual(periksaStatus("Repo: `/x`\n- **Base:** main\nSELESAI, Sisa, Langkah Berikutnya").kurang, []);
  assert.equal(periksaStatus("- **Repo:** `/a b/c`").repo, "/a b/c");
  const sebaris = periksaStatus("- Pemilik: Tech Lead · Repo: /x/proyek · Base: main\r\n");
  assert.equal(sebaris.repo, "/x/proyek"); assert.equal(sebaris.base, "main");
  assert.equal(periksaStatus("Repository: /salah\nRepo:\n").repo, null);
});

test("branch tanpa commit di atas base → exit 2; branch tidak ada → exit 2", () => {
  const f = fixture({ commit: false });
  const r = jalan(f);
  assert.equal(r.kode, 2);
  assert.match(r.out, /- commit: tidak ada commit di atas main/);
  g(f.wt, "switch", "-q", "-c", "lain"); g(f.repo, "branch", "-q", "-D", `rudis/${ID}`);
  const h = gerbang({ id: ID, handoff: f.handoff });
  assert.deepEqual(gagalNama(h), ["branch", "commit", "worktree", "cabang-engineer", "tinjauan"]);
});

test("worktree kotor → exit 2; berkas yang di-ignore tidak dihitung; tidak di-checkout → dilewati", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.wt, "debug.log"), "abaikan\n");
  assert.equal(jalan(f).kode, 0);
  fs.writeFileSync(path.join(f.wt, "baru.txt"), "x\n");
  const r = jalan(f);
  assert.equal(r.kode, 2);
  assert.match(r.out, /- worktree: worktree .* kotor \(1 berkas: baru\.txt\)/);
  fs.rmSync(path.join(f.wt, "baru.txt"));
  g(f.wt, "switch", "-q", "--detach");
  const h = gerbang({ id: ID, handoff: f.handoff });
  assert.equal(h.siap, true);
  assert.match(h.butir.find((b) => b.nama === "worktree").pesan, /tidak di-checkout/);
});

test("branch -se1 belum tergabung → exit 2; setelah merge (dan tinjauan ulang) → 0", () => {
  const f = fixture();
  const se = path.join(path.dirname(f.wt), "wt-se1");
  g(f.repo, "worktree", "add", "-q", "-b", `rudis/${ID}-se1`, se, `rudis/${ID}`);
  fs.writeFileSync(path.join(se, "b.txt"), "se\n"); g(se, "add", "-A"); g(se, "commit", "-q", "-m", "bagian se");
  g(f.repo, "branch", "-q", `rudis/${ID}.1-se1`, "main");        // sub-tugas lain: bukan cabang engineer tugas ini
  const r = jalan(f);
  assert.equal(r.kode, 2);
  assert.match(r.out, new RegExp(`- cabang-engineer: belum tergabung ke rudis/${ID}: rudis/${ID}-se1 \\(1 commit\\)`));
  assert.doesNotMatch(r.out, /\.1-se1/);
  g(f.wt, "merge", "-q", "--no-ff", "--no-edit", `rudis/${ID}-se1`);
  assert.match(jalan(f).out, /- tinjauan: tinjauan basi/);         // merge mengubah HEAD
  f.tinjau();
  assert.equal(jalan(f).kode, 0);
});

test("tinjauan sha basi → exit 2", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.wt, "a.txt"), "v3\n"); g(f.wt, "commit", "-q", "-am", "commit setelah tinjauan");
  const r = jalan(f);
  assert.equal(r.kode, 2);
  assert.match(r.out, /- tinjauan: tinjauan basi: sha [0-9a-f]{12} ≠ HEAD/);
});

test("tinjauan PERLU REVISI → exit 2; hasil terakhir yang dihitung; sub-ID tidak dihitung", () => {
  const f = fixture();
  f.tinjau("PERLU REVISI");
  assert.match(jalan(f).out, /- tinjauan: hasil tinjauan terakhir PERLU REVISI/);
  fs.appendFileSync(path.join(f.dir, "tinjauan.md"), `\n## Putaran 2\n[Hasil tinjauan] ${ID} · LULUS\nsha: ${f.head().slice(0, 7)}\n`);
  assert.equal(jalan(f).kode, 0);
  fs.appendFileSync(path.join(f.dir, "tinjauan.md"), `\n[Hasil tinjauan] ${ID} · PERLU REVISI\n`);
  assert.equal(jalan(f).kode, 2);
  assert.equal(hasilTerakhir(`[Hasil tinjauan] ${ID}.1 · LULUS`, ID), null);
  assert.equal(hasilTerakhir(`[Hasil tinjauan] ${ID} - lulus`, ID), "LULUS");
});

test("spesifikasi tanpa kecocokan → exit 2 (berkas spesifikasi*.md atau diff menyentuh specs/)", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.dir, "spesifikasi.md"), "# Spek\n");
  assert.match(jalan(f).out, /- tinjauan: ada spesifikasi tetapi tidak ada baris "kecocokan-spesifikasi: LULUS"/);
  fs.appendFileSync(path.join(f.dir, "tinjauan.md"), "kecocokan-spesifikasi: LULUS\n");
  assert.equal(jalan(f).kode, 0);

  const f2 = fixture();
  fs.mkdirSync(path.join(f2.wt, "specs", "001-x"), { recursive: true });
  fs.writeFileSync(path.join(f2.wt, "specs", "001-x", "spec.md"), "x\n"); g(f2.wt, "add", "-A"); g(f2.wt, "commit", "-q", "-m", "spek");
  f2.tinjau();
  assert.equal(jalan(f2).kode, 2);
  fs.appendFileSync(path.join(f2.dir, "tinjauan.md"), "- **kecocokan-spesifikasi:** LULUS\n");
  assert.equal(jalan(f2).kode, 0);
});

const baris = (...o) => o.map((x) => JSON.stringify(x)).join("\n") + "\n";
const pakaiAlat = (id, tipe, name = "Agent") => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: { subagent_type: tipe, prompt: "tinjau" } }] } });
const hasilAlat = (id, content) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } });

test("--transkrip: membuktikan bila LULUS dari tool_result peninjau; menolak bila hanya ditulis Tech Lead", () => {
  const f = fixture();
  const bukti = path.join(f.dir, "..", "bukti.jsonl"), palsu = path.join(f.dir, "..", "palsu.jsonl");
  fs.writeFileSync(bukti, baris(
    pakaiAlat("t1", "rudis-software-engineer"),
    hasilAlat("t1", [{ type: "text", text: `[Hasil tinjauan] ${ID} · PERLU REVISI\n- a.txt:1` }]),
    pakaiAlat("t2", "rudis-software-engineer", "Task"),
    hasilAlat("t2", `[Hasil tinjauan] ${ID} · LULUS`),
    "{rusak",
  ).replace('"{rusak"', "{rusak"));
  fs.writeFileSync(palsu, baris(
    pakaiAlat("t1", "Explore"),
    hasilAlat("t1", `[Hasil tinjauan] ${ID} · LULUS`),                      // bukan subagent peninjau
    { type: "assistant", message: { content: [{ type: "text", text: `[Hasil tinjauan] ${ID} · LULUS` }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "lain", content: `[Hasil tinjauan] ${ID} · LULUS` }] } },
  ));
  const ok = jalan(f, "--transkrip", bukti);
  assert.equal(ok.kode, 0, ok.out);
  assert.match(ok.out, /ok {2}transkrip: LULUS berasal dari tool_result rudis-software-engineer/);
  const tidak = jalan(f, "--transkrip", palsu);
  assert.equal(tidak.kode, 2);
  assert.match(tidak.out, /- transkrip: "\[Hasil tinjauan\] … LULUS" hanya ditulis Tech Lead sendiri/);
  assert.equal(buktiTranskrip(baris(pakaiAlat("x", "rudis-business-systems-analyst"), hasilAlat("x", `[Hasil tinjauan] ${ID} · PERLU REVISI`)), ID).ok, false);
  assert.equal(jalan(f, "--transkrip", path.join(f.dir, "tidak-ada.jsonl")).kode, 1);
});

test("galat → exit 1: ID tak sah, repo bukan git, base tak dikenal, argumen salah", () => {
  const f = fixture();
  const kode = (argv) => main(argv, { keluar: () => {}, galat: () => {} });
  assert.equal(kode(["T-2026-1", "--handoff", f.handoff]), 1);
  assert.equal(kode(["bukan-id"]), 1);
  assert.equal(kode([]), 1);
  assert.equal(kode([ID, "--handoff", f.handoff, "--repo", path.dirname(f.repo)]), 1);
  assert.equal(kode([ID, "--handoff", f.handoff, "--base", "tidak-ada"]), 1);
  assert.equal(kode([ID, "--entah"]), 1);
  assert.equal(kode([ID, "--repo"]), 1);
  assert.throws(() => uraiArgumen([ID, "lagi"]), Galat);
  assert.equal(kode(["T-20261031-9.2.1", "--handoff", f.handoff, "--repo", f.repo, "--base", "main"]), 2);  // sub-sub-ID sah
});

test("--json: { id, siap, butir: [{nama, ok, pesan}] }", () => {
  const f = fixture();
  const ok = JSON.parse(jalan(f, "--json").out);
  assert.equal(ok.id, ID); assert.equal(ok.siap, true);
  assert.deepEqual(ok.butir.map((b) => b.nama), ["status", "branch", "commit", "worktree", "cabang-engineer", "tinjauan"]);
  assert.ok(ok.butir.every((b) => b.ok === true && typeof b.pesan === "string"));
  f.tinjau("PERLU REVISI");
  const r = jalan(f, "--json");
  assert.equal(r.kode, 2);
  const j = JSON.parse(r.out);
  assert.equal(j.siap, false);
  assert.deepEqual(gagalNama(j), ["tinjauan"]);
});

test("pembungkus shell memanggil modul (exit code ikut)", () => {
  const f = fixture();
  const r = jalankanSh(path.join(SINI, "gerbang-tl.sh"), [ID, "--handoff", f.handoff], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /SIAP LAPOR/);
  f.tinjau("PERLU REVISI");
  const r2 = jalankanSh(path.join(SINI, "gerbang-tl.sh"), [ID], { encoding: "utf8", env: { ...process.env, RUDISONE_HANDOFF: f.handoff } });
  assert.equal(r2.status, 2, r2.stderr);
  assert.equal(jalankanSh(path.join(SINI, "gerbang-tl.sh"), ["x"], { encoding: "utf8" }).status, 1);
});

// --- mode --hook ---
const kailProses = (f, input) => spawnSync(process.execPath, [MJS, "--hook"], {
  input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8",
  env: { ...process.env, RUDISONE_HANDOFF: f.handoff },
});
const masukan = (pesan, lain = {}) => ({ hook_event_name: "SubagentStop", agent_type: "rudis-tech-lead", stop_hook_active: false, cwd: "/", last_assistant_message: pesan, ...lain });
const LAPORAN = `[Laporan ke COO] ${ID} · gerbang\n\nstatus: selesai\n1. terpenuhi`;

test("hook: pesan tengah jalan / bukan laporan / tanpa ID → tanpa keluaran", () => {
  const f = fixture();
  f.tinjau("PERLU REVISI");                                            // gerbang pasti gagal bila dijalankan
  for (const pesan of ["Sekarang menulis tes.", `Lanjut ${ID}: menjalankan tes`, "[Laporan ke COO] tanpa id", `  \n[Info dari Tech Lead] ${ID} · x`, ""]) {
    const r = kailProses(f, masukan(pesan));
    assert.equal(r.status, 0); assert.equal(r.stdout, "", pesan);
  }
  assert.equal(idLaporanAkhir(masukan(`\n[Laporan divisi Engineering] ${ID} · x`)), ID);
});

test("hook: laporan yang gagal gerbang → block; stop_hook_active true → tanpa keluaran", () => {
  const f = fixture();
  f.tinjau("PERLU REVISI");
  const r = kailProses(f, masukan(LAPORAN));
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.decision, "block");
  assert.match(j.reason, new RegExp(`^Gerbang Tech Lead belum lulus \\(${ID}\\): tinjauan: hasil tinjauan terakhir PERLU REVISI.*Perbaiki lalu laporkan ulang, atau laporkan sebagai sebagian/\\[Terhambat\\]\\.$`));
  assert.equal(kailProses(f, masukan(LAPORAN, { stop_hook_active: true })).stdout, "");
  const div = kailProses(f, masukan(`[Laporan divisi Engineering] ${ID} · gerbang`));
  assert.equal(JSON.parse(div.stdout).decision, "block");
});

test("hook: laporan [Terhambat] / status sebagian → tanpa keluaran", () => {
  const f = fixture();
  f.tinjau("PERLU REVISI");
  for (const pesan of [
    `[Laporan ke COO] ${ID} · gerbang\nstatus: sebagian\n`,
    `[Laporan ke COO] ${ID} · gerbang (sebagian)`,
    `[Laporan divisi Engineering] ${ID} · gerbang\n**Status:** terhambat — butuh akses`,
    `[Laporan ke COO] ${ID} · gerbang\n[Terhambat] gerbang — butuh keputusan`,
    `[Terhambat] gerbang ${ID} — butuh keputusan`,
  ]) assert.equal(kailProses(f, masukan(pesan)).stdout, "", pesan);
});

test("hook: laporan yang lulus → tanpa keluaran; transkrip tanpa bukti → block", () => {
  const f = fixture();
  assert.equal(kailProses(f, masukan(LAPORAN)).stdout, "");
  const t = path.join(f.dir, "..", "transkrip.jsonl");
  fs.writeFileSync(t, baris({ type: "assistant", message: { content: [{ type: "text", text: `[Hasil tinjauan] ${ID} · LULUS` }] } }));
  const r = kailProses(f, masukan(LAPORAN, { agent_transcript_path: t }));
  assert.match(JSON.parse(r.stdout).reason, /transkrip: .*hanya ditulis Tech Lead sendiri/);
  fs.writeFileSync(t, baris(pakaiAlat("a", "rudis-software-engineer"), hasilAlat("a", `[Hasil tinjauan] ${ID} · LULUS`)));
  assert.equal(kailProses(f, masukan(LAPORAN, { agent_transcript_path: t })).stdout, "");
  assert.equal(kailProses(f, masukan(LAPORAN, { agent_transcript_path: path.join(tmp, "tidak-ada.jsonl") })).stdout, "");
});

test("hook: JSON rusak / galat → tanpa keluaran & exit 0", () => {
  const f = fixture();
  for (const input of ["{rusak", "", "null", "[]", "42"]) {
    const r = kailProses(f, input);
    assert.equal(r.status, 0); assert.equal(r.stdout, "", input); assert.equal(r.stderr, "");
  }
  fs.writeFileSync(path.join(f.dir, "status.md"), STATUS(path.join(tmp, "bukan-repo")));
  const r = kailProses(f, masukan(LAPORAN));                          // galat gerbang (repo tidak ada) → gagal terbuka
  assert.equal(r.status, 0); assert.equal(r.stdout, "");
  assert.equal(hook("{rusak"), "");
});

test("hook idempoten: 3× input sama → keluaran sama, tidak menulis berkas apa pun", () => {
  const f = fixture();
  f.tinjau("PERLU REVISI");
  fs.writeFileSync(path.join(f.wt, "kotor.txt"), "x\n");               // memicu `git status` di worktree
  const akar = path.dirname(f.repo);
  const potret = () => {
    const hasil = [];
    const jelajah = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); const s = fs.statSync(p); hasil.push(`${p} ${s.size} ${s.mtimeMs}`); if (e.isDirectory()) jelajah(p); } };
    jelajah(akar);
    return hasil.sort().join("\n");
  };
  const sebelum = potret();
  const keluaran = [1, 2, 3].map(() => { const r = kailProses(f, masukan(LAPORAN)); assert.equal(r.status, 0); return r.stdout; });
  assert.equal(new Set(keluaran).size, 1);
  assert.equal(JSON.parse(keluaran[0]).decision, "block");
  assert.match(keluaran[0], /worktree: .*kotor/);
  assert.equal(potret(), sebelum);
});
