// Uji pembersih riwayat (bin/bersih-riwayat.mjs): node --test bin/bersih-riwayat.test.mjs
// Semua di repo git & folder sementara — tidak menyentuh riwayat sungguhan.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { kandidat, terlindung, waktuTutup, rencanakan, eksekusi, ringkas } from "./bersih-riwayat.mjs";
import { samaPath } from "./lib/lokasi.mjs";

delete process.env.RUDISONE_METRIK_SIMPAN;   // uji in-process memakai <root>/handoff/metrik.jsonl
const SKRIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "bersih-riwayat.mjs");
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bersih-riwayat-")));
const SEKARANG = "2026-02-20T12:00:00.000Z";
const LAMA = "2026-02-10T10:00:00.000Z";     // > 24 jam sebelum SEKARANG
const BARU = "2026-02-20T02:00:00.000Z";     // 10 jam sebelum SEKARANG

const sh = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "u", GIT_AUTHOR_EMAIL: "u@x", GIT_COMMITTER_NAME: "u", GIT_COMMITTER_EMAIL: "u@x",
    GIT_AUTHOR_DATE: LAMA, GIT_COMMITTER_DATE: LAMA } });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const tugas = (id, extra = {}) => ({ id, judul: `Tugas ${id}`, folder: "/x", divisi: "Engineering", pemilik: "Tech Lead", prioritas: "normal", status: "selesai",
  fase: "—", kunci: [], bergantung: [], perkakas: "—", dibuat: LAMA, diperbarui: LAMA, selesai_pada: "2026-02-10", ...extra });

/** Repo RudisOne sementara: root + handoff + register. */
function bangun(tugasList) {
  const root = fs.mkdtempSync(path.join(tmp, "repo-"));
  sh(root, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(root, "a.txt"), "a\n");
  fs.writeFileSync(path.join(root, ".gitignore"), "handoff/*\n.claude/worktrees/\n");
  sh(root, "add", "."); sh(root, "commit", "-q", "-m", "awal");
  fs.mkdirSync(path.join(root, "handoff"), { recursive: true });
  for (const t of tugasList) { fs.mkdirSync(path.join(root, "handoff", t.id), { recursive: true }); fs.writeFileSync(path.join(root, "handoff", t.id, "laporan.md"), "x".repeat(1000)); }
  const json = path.join(root, "handoff", "register-tugas.json");
  fs.writeFileSync(json, JSON.stringify({ versi: 1, diperbarui: LAMA, tugas: tugasList }, null, 2));
  return { root, json };
}
/** Branch rudis/<nama> dengan satu commit; merged=true → digabung ke main (--no-ff). wt → worktree di .claude/worktrees/<wt>. */
function cabang(root, nama, { merged = false, wt = null } = {}) {
  const b = `rudis/${nama}`;
  if (wt) { fs.mkdirSync(path.join(root, ".claude", "worktrees"), { recursive: true }); sh(root, "worktree", "add", "-q", "-b", b, path.join(root, ".claude", "worktrees", wt)); }
  else sh(root, "branch", b, "main");
  const dir = wt ? path.join(root, ".claude", "worktrees", wt) : null;
  const ujung = dir ?? (() => { const p = fs.mkdtempSync(path.join(tmp, "sementara-")); fs.rmSync(p, { recursive: true }); sh(root, "worktree", "add", "-q", p, b); return p; })();
  fs.writeFileSync(path.join(ujung, `${nama.replace(/[^\w]/g, "_")}.txt`), nama);
  sh(ujung, "add", "."); sh(ujung, "commit", "-q", "-m", `kerja ${nama}`);
  if (!dir) sh(root, "worktree", "remove", "--force", ujung);
  if (merged) sh(root, "merge", "-q", "--no-ff", "-m", `merge ${nama}`, b);
  return { branch: b, dir };
}
// transkrip & metadata Desktop kosong: penghitung metrik bawaan tidak membaca ~/.claude device ini
const METRIK_KOSONG = { RUDISONE_METRIK_PROJECTS: fs.mkdtempSync(path.join(tmp, "projects-")), RUDISONE_METRIK_DESKTOP: fs.mkdtempSync(path.join(tmp, "desktop-")),
  RUDISONE_METRIK_SIMPAN: "", RUDISONE_AUDIT: "" };
const jalankan = (root, json, args = [], env = {}) => spawnSync(process.execPath, [SKRIP, ...args], { cwd: tmp, encoding: "utf8",
  env: { ...process.env, ...METRIK_KOSONG, RUDISONE_ROOT: root, RUDISONE_REGISTER_JSON: json, RUDISONE_REGISTER_MD: json.replace(/json$/, "md"), RUDISONE_SEKARANG: SEKARANG, ...env } });
const bacaMetrik = (root) => { try { return fs.readFileSync(path.join(root, "handoff", "metrik.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return null; } };
const regId = (json) => JSON.parse(fs.readFileSync(json, "utf8")).tugas.map((t) => t.id);
const cabangAda = (root, b) => spawnSync("git", ["-C", root, "rev-parse", "--verify", "--quiet", `refs/heads/${b}`]).status === 0;

test("waktuTutup & kandidat: > 24 jam saja; aktif, ketergantungan aktif, dan sub-tugas induk aktif dilindungi", () => {
  const kini = new Date(SEKARANG);
  assert.equal(waktuTutup(tugas("T-20260101-1", { selesai_pada: "bukan tanggal" })), null);
  // hanya tanggal (tanpa jam yang konsisten): dihitung akhir hari itu
  assert.equal(waktuTutup(tugas("T-20260101-1", { selesai_pada: "2026-02-19", diperbarui: "2026-02-01T00:00:00Z" })).getDate(), 19);
  const reg = [
    tugas("T-20260101-1"),                                                          // lama → boleh
    tugas("T-20260101-2", { selesai_pada: "2026-02-20", diperbarui: BARU }),        // 10 jam → tidak
    tugas("T-20260101-3", { status: "dibatalkan" }),                                // dibatalkan lama → boleh
    tugas("T-20260101-4"),                                                          // dependensi tugas aktif → tidak
    tugas("T-20260101-5", { status: "berjalan", selesai_pada: undefined, bergantung: ["T-20260101-6"] }),   // aktif
    tugas("T-20260101-6", { bergantung: ["T-20260101-4"] }),                        // dependensi aktif, dan 4 transitif → tidak
    tugas("T-20260101-7.1"), tugas("T-20260101-7", { status: "berjalan", selesai_pada: undefined }),       // sub-tugas induk aktif → tidak
    tugas("T-20260101-8", { selesai_pada: undefined, status: "baru" }),
  ];
  for (const t of reg) if (t.selesai_pada === undefined) delete t.selesai_pada;
  assert.deepEqual([...terlindung(reg)].sort(), ["T-20260101-4", "T-20260101-5", "T-20260101-6", "T-20260101-7", "T-20260101-7.1", "T-20260101-8"]);
  assert.deepEqual(kandidat(reg, kini).map((k) => k.tugas.id), ["T-20260101-1", "T-20260101-3"]);
});

test("dry-run (bawaan) tidak mengubah apa pun; ringkasan satu baris", () => {
  const { root, json } = bangun([tugas("T-20260101-1"), tugas("T-20260101-2", { status: "berjalan" })]);
  delete JSON.parse(fs.readFileSync(json, "utf8")).tugas[1].selesai_pada;
  const reg = JSON.parse(fs.readFileSync(json, "utf8")); delete reg.tugas[1].selesai_pada; fs.writeFileSync(json, JSON.stringify(reg));
  const sebelum = fs.readFileSync(json, "utf8");
  const r = jalankan(root, json);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^bersih-riwayat \(dry-run\): akan dibuang 1 tugas/);
  assert.equal(r.stdout.trim().split("\n").length, 1);
  assert.equal(fs.readFileSync(json, "utf8"), sebelum);
  assert.ok(fs.existsSync(path.join(root, "handoff", "T-20260101-1")));
  assert.ok(!fs.existsSync(path.join(root, "handoff", "bersih-riwayat.jsonl")));
  assert.equal(bacaMetrik(root), null, "dry-run tidak menulis metrik.jsonl");
  assert.doesNotMatch(r.stdout, /metrik disimpan/);
});

test("--jalankan: buang register + handoff yang layak, audit satu baris per tugas, aktif/baru utuh; idempoten", () => {
  const { root, json } = bangun([tugas("T-20260101-1"), tugas("T-20260101-2", { selesai_pada: "2026-02-20", diperbarui: BARU }),
    tugas("T-20260101-3", { status: "dibatalkan" }), tugas("T-20260101-4", { status: "berjalan" })]);
  const reg = JSON.parse(fs.readFileSync(json, "utf8")); delete reg.tugas[3].selesai_pada; fs.writeFileSync(json, JSON.stringify(reg));
  const luar = path.join(tmp, "luar-repo.txt"); fs.writeFileSync(luar, "jangan sentuh");
  fs.writeFileSync(path.join(root, "handoff", "audit.jsonl"), "rantai\n");
  fs.mkdirSync(path.join(root, "handoff", "pemetaan"));
  const r = jalankan(root, json, ["--jalankan"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^bersih-riwayat: dibuang 2\/2 tugas/);
  assert.deepEqual(regId(json), ["T-20260101-2", "T-20260101-4"]);
  assert.ok(!fs.existsSync(path.join(root, "handoff", "T-20260101-1")) && !fs.existsSync(path.join(root, "handoff", "T-20260101-3")));
  assert.ok(fs.existsSync(path.join(root, "handoff", "T-20260101-2")) && fs.existsSync(path.join(root, "handoff", "T-20260101-4")));
  assert.ok(fs.existsSync(path.join(root, "handoff", "audit.jsonl")) && fs.existsSync(path.join(root, "handoff", "pemetaan")));
  assert.equal(fs.readFileSync(luar, "utf8"), "jangan sentuh");
  assert.ok(fs.existsSync(path.join(root, "a.txt")));
  const audit = fs.readFileSync(path.join(root, "handoff", "bersih-riwayat.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(audit.map((a) => a.id), ["T-20260101-1", "T-20260101-3"]);
  assert.equal(audit[0].judul, "Tugas T-20260101-1");
  assert.equal(audit[0].handoff_byte, 1000);
  assert.ok(audit[0].tanggal && audit[0].selesai_pada === "2026-02-10");
  assert.ok(fs.readFileSync(json.replace(/json$/, "md"), "utf8").includes("T-20260101-2"), "register MD dibangkitkan ulang");
  // metrik: satu baris ringkas per tugas yang dibuang (penghitung bawaan, transkrip kosong → angka 0), info dari register
  assert.match(r.stdout, /metrik disimpan 2/);
  const m = bacaMetrik(root);
  assert.deepEqual(m.map((x) => x.id), ["T-20260101-1", "T-20260101-3"]);
  assert.deepEqual([m[1].sumber, m[1].judul, m[1].status, m[1].divisi, m[1].selesai_pada, m[1].dicatat, m[1].galat, m[1].sesi_terlibat, m[1].giliran],
    ["bersih-riwayat", "Tugas T-20260101-3", "dibatalkan", "Engineering", "2026-02-10", SEKARANG, null, 0, 0]);
  assert.equal(m[0].v, 1);
  // idempoten
  const r2 = jalankan(root, json, ["--jalankan"]);
  assert.equal(r2.status, 0);
  assert.match(r2.stdout, /tidak ada tugas selesai\/dibatalkan > 24 jam/);
  assert.equal(fs.readFileSync(path.join(root, "handoff", "bersih-riwayat.jsonl"), "utf8").trim().split("\n").length, 2);
  assert.equal(bacaMetrik(root).length, 2);
});

test("eksekusi: metrik ditulis SEBELUM folder dibuang; galat penghitung → baris ber-galat & tetap dibuang; sub-tugas → baris induk", () => {
  const { root, json } = bangun([tugas("T-20260101-1"), tugas("T-20260101-2"), tugas("T-20260101-3.1")]);
  const rc = rencanakan({ root, json, kini: new Date(SEKARANG), cwd: tmp });
  const terlihat = {};
  const palsu = (id) => {
    terlihat[id] = fs.existsSync(path.join(root, "handoff", id, "laporan.md"));
    if (id === "T-20260101-2") throw new Error("transkrip tak terbaca");
    return { id, atribusi: "dasar", total: { sesi_terlibat: 1, subagent: 0, giliran: 4, panggilan_api: 9, token: { total: 1234, output: 56 }, biaya_usd_perkiraan: 0.5,
      rentang_ms: 1000, waktu_aktif_ms: 800, waktu_aktif_subagent_ms: 0, pesan: { keluar: 2 }, revisi: { total_m2: 0 }, start_session: { panggilan: 0, gagal: 0 },
      intervensi: { ask_user_question: { panggilan: 1, pertanyaan: 2 }, prompt_pengguna_coo: 1 }, beban_keputusan: { pertanyaan: 2, prompt_pengguna: 1, prompt_izin: 0, total: 3 } } };
  };
  const hasil = eksekusi(rc, { json, md: json.replace(/json$/, "md"), hitungMetrik: palsu });
  assert.deepEqual(terlihat, { "T-20260101-1": true, "T-20260101-2": true }, "penghitung dipanggil saat folder masih ada; sub-tugas tidak dihitung");
  assert.deepEqual(hasil.selesai, ["T-20260101-1", "T-20260101-2", "T-20260101-3.1"]);
  assert.equal(hasil.metrik, 3);
  for (const id of hasil.selesai) assert.ok(!fs.existsSync(path.join(root, "handoff", id)), id);
  assert.deepEqual(regId(json), []);
  const m = Object.fromEntries(bacaMetrik(root).map((x) => [x.id, x]));
  assert.deepEqual([m["T-20260101-1"].giliran, m["T-20260101-1"].token_total, m["T-20260101-1"].beban_keputusan.total, m["T-20260101-1"].galat], [4, 1234, 3, null]);
  assert.deepEqual([m["T-20260101-2"].galat, m["T-20260101-2"].giliran, m["T-20260101-2"].judul], ["transkrip tak terbaca", null, "Tugas T-20260101-2"]);
  assert.deepEqual([m["T-20260101-3.1"].induk, m["T-20260101-3.1"].giliran], ["T-20260101-3", null]);
  assert.match(ringkas(rc, hasil, { jalankan: true }), /metrik disimpan 3/);
});

test("eksekusi: metrik gagal DITULIS → tugas gagal, folder & entri register dibiarkan", () => {
  const { root, json } = bangun([tugas("T-20260101-1")]);
  const rc = rencanakan({ root, json, kini: new Date(SEKARANG), cwd: tmp });
  const bukanBerkas = fs.mkdtempSync(path.join(tmp, "dir-metrik-"));            // append ke folder → EISDIR
  const hasil = eksekusi(rc, { json, md: json.replace(/json$/, "md"), hitungMetrik: () => null, berkasMetrik: bukanBerkas });
  assert.deepEqual(hasil.selesai, []);
  assert.equal(hasil.gagal[0].id, "T-20260101-1");
  assert.equal(hasil.metrik, 0);
  assert.ok(fs.existsSync(path.join(root, "handoff", "T-20260101-1", "laporan.md")));
  assert.deepEqual(regId(json), ["T-20260101-1"]);
});

test("git: hanya branch ter-merge + worktree bersih diusulkan; semua lainnya ditahan; tidak ada yang dihapus oleh skrip", () => {
  const ids = ["T-20260101-1", "T-20260101-2", "T-20260101-3", "T-20260101-4", "T-20260101-5", "T-20260101-6", "T-20260101-10"];
  const { root, json } = bangun([...ids.slice(0, 6).map((id) => tugas(id)), tugas("T-20260101-10", { status: "berjalan" })]);
  const reg = JSON.parse(fs.readFileSync(json, "utf8")); delete reg.tugas[6].selesai_pada; fs.writeFileSync(json, JSON.stringify(reg));
  const a = cabang(root, "T-20260101-1", { merged: true, wt: "agent-aaa" });                 // → usulan (worktree + branch)
  cabang(root, "T-20260101-1-p1", { merged: true });                                         // → usulan (hanya branch)
  cabang(root, "T-20260101-2");                                                              // belum ter-merge → ditahan
  const kotor = cabang(root, "T-20260101-3", { merged: true, wt: "agent-kotor" });           // worktree kotor → ditahan
  fs.writeFileSync(path.join(kotor.dir, "baru.txt"), "belum di-commit");
  cabang(root, "T-20260101-4", { merged: true, wt: "r1-lead-rudisone" });                    // worktree sesi tim → ditahan
  cabang(root, "T-20260101-10", { merged: true });                                           // pemilik aktif; NB: bukan awalan T-20260101-1 → tidak ikut
  cabang(root, "T-20260101-99", { merged: true });                                           // yatim (tak ada di register), commit lama → usulan
  sh(root, "branch", "fitur/lain", "main");                                                  // bukan rudis/* → tak disentuh
  const terkunci = cabang(root, "T-20260101-5", { merged: true, wt: "agent-kunci" });
  sh(root, "worktree", "lock", terkunci.dir);

  const sebelum = { wt: sh(root, "worktree", "list"), br: sh(root, "branch", "--list") };
  const rc = rencanakan({ root, json, kini: new Date(SEKARANG), cwd: tmp });
  const usulan = rc.git.usulan.map((e) => e.cabang).sort();
  assert.deepEqual(usulan, ["rudis/T-20260101-1", "rudis/T-20260101-1-p1", "rudis/T-20260101-99"]);
  const ditahan = Object.fromEntries(rc.git.ditahan.map((e) => [e.cabang, e.alasan]));
  assert.match(ditahan["rudis/T-20260101-2"], /belum ter-merge/);
  assert.match(ditahan["rudis/T-20260101-3"], /kotor/);
  assert.match(ditahan["rudis/T-20260101-4"], /sesi tim/);
  assert.match(ditahan["rudis/T-20260101-5"], /terkunci/);
  assert.ok(!("rudis/T-20260101-10" in ditahan) && !usulan.includes("rudis/T-20260101-10"), "pemilik aktif tidak muncul");
  assert.ok(!JSON.stringify(rc.git).includes("fitur/lain"));
  const e1 = rc.git.usulan.find((e) => e.cabang === "rudis/T-20260101-1");
  assert.ok(samaPath(e1.worktree, a.dir), "path worktree sama (git mencetak garis miring ke depan & nama panjang; uji memakai bentuk native)");
  assert.match(e1.merge, /^[0-9a-f]{12}$/);
  assert.notEqual(e1.merge, e1.tip, "sha merge = commit merge, bukan ujung branch");

  const r = jalankan(root, json, ["--jalankan"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /usulan git menunggu persetujuan: 1 worktree \+ 3 branch/);
  assert.match(r.stdout, /4 branch ditahan/);
  assert.deepEqual({ wt: sh(root, "worktree", "list"), br: sh(root, "branch", "--list") }, sebelum, "skrip tidak menghapus worktree/branch");
  const audit = fs.readFileSync(path.join(root, "handoff", "bersih-riwayat.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const a1 = audit.find((x) => x.id === "T-20260101-1");
  assert.ok(a1.cabang.some((c) => c.nama === "rudis/T-20260101-1" && /^[0-9a-f]{12}$/.test(c.merge)));

  const u = jalankan(root, json, ["--usulan-git"]);
  const baris = u.stdout.trim().split("\n");
  // baris usulan ditempel ke shell: path berspasi/berkarakter khusus dikutip tunggal, garis miring ke depan di semua OS
  const TOKEN = String.raw`(?:[^\s']+|'[^']*')`;
  const token = (l) => [...l.matchAll(new RegExp(TOKEN, "g"))].map((m) => m[0].replace(/^'|'$/g, ""));
  // path dibandingkan sebagai lokasi (bukan teks): git mencetak nama panjang, uji memegang bentuk native/pendek
  const hapusWt = baris.map(token).find((t) => t[3] === "worktree" && t[4] === "remove");
  assert.ok(hapusWt && samaPath(hapusWt[2], root) && samaPath(hapusWt[5], a.dir) && !hapusWt[2].includes("\\") && !hapusWt[5].includes("\\"), baris.join("\n"));
  assert.ok(baris.some((l) => token(l).slice(3).join(" ") === "branch -d rudis/T-20260101-1" && samaPath(token(l)[2], root)));
  assert.ok(baris.every((l) => new RegExp(`^git -C ${TOKEN} (worktree remove ${TOKEN}|branch -d rudis\\/T-\\d{8}-\\d+\\S*)$`).test(l)), baris.join("\n"));
  assert.ok(!u.stdout.includes("fitur/lain") && !u.stdout.includes("--force") && !u.stdout.includes("-D "));
  // menjalankan usulan (sebagai pelaksana) memang menghapusnya dengan pengaman git sendiri
  for (const l of baris) { const r2 = spawnSync("git", token(l).slice(1), { encoding: "utf8" }); assert.equal(r2.status, 0, `${l}: ${r2.stderr}`); }
  assert.ok(!cabangAda(root, "rudis/T-20260101-1") && cabangAda(root, "rudis/T-20260101-2") && cabangAda(root, "fitur/lain"));
  // setelah dibersihkan: pemilik sudah tak di register tetapi judul masih ada di audit; tidak ada usulan baru
  assert.equal(jalankan(root, json, ["--usulan-git"]).stdout.trim(), "");
});

test("git: worktree pemanggil (cwd) tidak diusulkan; branch yatim baru (< 24 jam) tidak diusulkan", () => {
  const { root, json } = bangun([tugas("T-20260101-1")]);
  const a = cabang(root, "T-20260101-1", { merged: true, wt: "agent-pakai" });
  const rc = rencanakan({ root, json, kini: new Date(SEKARANG), cwd: path.join(a.dir) });
  assert.deepEqual(rc.git.usulan, []);
  assert.match(rc.git.ditahan[0].alasan, /sedang dipakai/);
  // yatim dengan commit baru
  const r2 = rencanakan({ root, json, kini: new Date(new Date(LAMA).getTime() + 3600e3), cwd: tmp });
  assert.deepEqual(r2.git.usulan, []);
});

test("keamanan folder handoff: symlink tidak diikuti dan tidak dihapus; entri register tetap + dilaporkan GAGAL", () => {
  const { root, json } = bangun([tugas("T-20260101-1"), tugas("T-20260101-2")]);
  const luar = fs.mkdtempSync(path.join(tmp, "luar-")); fs.writeFileSync(path.join(luar, "penting.txt"), "p");
  fs.rmSync(path.join(root, "handoff", "T-20260101-1"), { recursive: true });
  // Windows tanpa izin symlink: junction (tanpa hak admin) juga reparse point yang dilaporkan lstat sebagai symlink
  fs.symlinkSync(luar, path.join(root, "handoff", "T-20260101-1"), process.platform === "win32" ? "junction" : "dir");
  const r = jalankan(root, json, ["--jalankan"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /GAGAL 1: T-20260101-1 \(folder handoff tidak aman dihapus \(symlink\)\)/);
  assert.ok(fs.existsSync(path.join(luar, "penting.txt")));
  assert.deepEqual(regId(json), ["T-20260101-1"]);
  assert.ok(!fs.existsSync(path.join(root, "handoff", "T-20260101-2")));
  assert.deepEqual(bacaMetrik(root).map((x) => x.id), ["T-20260101-2"], "folder tidak aman → tanpa baris metrik");
});

test("folder handoff tanpa entri register tidak disentuh; pemakaian salah → exit 3; --jalankan + --usulan-git ditolak", () => {
  const { root, json } = bangun([tugas("T-20260101-1")]);
  fs.mkdirSync(path.join(root, "handoff", "T-20251201-1"));
  const r = jalankan(root, json, ["--jalankan"]);
  assert.match(r.stdout, /1 folder handoff tanpa entri register/);
  assert.ok(fs.existsSync(path.join(root, "handoff", "T-20251201-1")));
  assert.equal(jalankan(root, json, ["--ngawur"]).status, 3);
  assert.equal(jalankan(root, json, ["--jalankan", "--usulan-git"]).status, 3);
});

test("bukan repo git / register belum ada: tetap aman (peringatan, tidak melempar)", () => {
  const root = fs.mkdtempSync(path.join(tmp, "polos-"));
  fs.mkdirSync(path.join(root, "handoff"));
  const r = jalankan(root, path.join(root, "handoff", "register-tugas.json"), ["--jalankan"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /tidak ada tugas/);
  assert.match(r.stdout, /peringatan: git:/);
});
