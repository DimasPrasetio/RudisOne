#!/usr/bin/env node
// Pembersih riwayat tugas RudisOne — algoritma murni (tanpa AI). Membuang tugas berstatus selesai/dibatalkan yang sudah
// lebih dari 24 jam supaya register dan handoff/ tidak menumpuk di device:
//   1. entri di register tugas + folder handoff/<ID>/ (dihapus seluruhnya; satu baris audit tersisa) — otomatis dengan --jalankan;
//   2. worktree & branch rudis/<ID>[-…] milik tugas itu — HANYA DIUSULKAN (perintahnya dicetak), tidak pernah dijalankan
//      skrip ini: git yang menghapus worktree/branch selalu ditanya hook kebijakan (protokol › Ruang kerja Engineering), dan
//      membungkusnya di skrip akan mengakali kebijakan itu. Pelaksana menjalankan perintah usulan lewat Bash sesinya
//      setelah pengguna setuju, sehingga prompt jenjang 3 tetap muncul.
// Yang tidak pernah disentuh: tugas aktif; tugas yang menjadi ketergantungan (juga tak langsung) tugas aktif; sub-tugas
// dari induk yang masih aktif; folder di luar handoff/<ID>/; checkout utama; branch selain rudis/*; repo proyek lain.
// Usulan git hanya untuk branch yang SUDAH ter-merge ke branch utama (ancestor) dan worktree-nya bersih (tanpa perubahan &
// berkas baru), terletak di <repo>/.claude/worktrees, bukan worktree sesi tim (r<n>-…), tidak terkunci, bukan cwd pemanggil.
//
//   bin/bersih-riwayat.sh                   dry-run: tampilkan rencana, tidak mengubah apa pun
//   bin/bersih-riwayat.sh --jalankan        hapus register+handoff yang memenuhi syarat, catat audit
//   bin/bersih-riwayat.sh --usulan-git      cetak perintah git yang perlu disetujui (satu per baris, tanpa ringkasan)
//   opsi: --rinci (daftar per tugas) · --base <branch> (bawaan main, lalu master) · --json
// Audit: handoff/bersih-riwayat.jsonl (satu baris per tugas: ID, judul, tanggal, cabang + sha merge).
// Metrik: sebelum handoff/<ID>/ dihapus, satu baris ringkas metrik tugas ditambahkan ke handoff/metrik.jsonl (bin/metrik.mjs
// › ringkasMetrik; sumber "bersih-riwayat"; galat penghitung → baris ber-`galat`, pembersihan jalan terus).
// Exit: 0 berhasil (juga bila tak ada yang dibersihkan) · 1 galat · 3 pemakaian salah.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { aktif, baca, perbarui } from "./register.mjs";
import { berkasMetrik, hitungMetrik, infoRegister, ringkasTugas, simpanRingkas } from "./metrik.mjs";
import { posix } from "./lib/platform.mjs";

const INI = fileURLToPath(import.meta.url);
export const ROOT_BAWAAN = path.resolve(path.dirname(INI), "..");
export const BATAS_MS = 24 * 3600e3;
const RE_ID = /^T-\d{8}-\d+(\.\d+)?$/;
const RE_CABANG = /^rudis\/(T-\d{8}-\d+(?:\.\d+)?)(?:-.+)?$/;
const RE_WORKTREE_SESI = /^r[1-9]\d*-(lead|bsa|se\d*)-/;   // worktree sesi tim: hidup lintas tugas
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };

const git = (cwd, args) => {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: GIT_ENV, maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const dua = (n) => String(n).padStart(2, "0");
const tglLokal = (d) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;

/** Waktu penutupan tugas: `diperbarui` bila konsisten dengan tanggal selesai, selain itu akhir hari selesai_pada. Tak valid → null. */
export function waktuTutup(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t.selesai_pada ?? ""));
  if (!m) return null;
  const akhirHari = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999);
  if (Number.isNaN(+akhirHari)) return null;
  const dip = new Date(t.diperbarui);
  if (!Number.isNaN(+dip) && tglLokal(dip) >= m[0]) return dip;
  return akhirHari;
}

/** ID yang dilindungi: tugas aktif, penutup transitif ketergantungannya, dan sub-tugas dari induk yang aktif. */
export function terlindung(tugas) {
  const per = new Map(tugas.map((t) => [t.id, t]));
  const lindung = new Set();
  const naik = (id) => {
    if (lindung.has(id)) return;
    lindung.add(id);
    for (const d of per.get(id)?.bergantung ?? []) naik(d);
  };
  for (const t of tugas) if (aktif(t)) naik(t.id);
  const aktifId = new Set(tugas.filter(aktif).map((t) => t.id));
  for (const t of tugas) if (t.id.includes(".") && aktifId.has(t.id.split(".")[0])) lindung.add(t.id);
  return lindung;
}

/** Tugas yang boleh dibuang dari register + handoff. → [{ tugas, tutup }] */
export function kandidat(tugas, kini) {
  const lindung = terlindung(tugas);
  const hasil = [];
  for (const t of tugas) {
    if (aktif(t) || lindung.has(t.id) || !RE_ID.test(t.id)) continue;
    const w = waktuTutup(t);
    if (w && kini - w > BATAS_MS) hasil.push({ tugas: t, tutup: w });
  }
  return hasil;
}

/** Ukuran folder (byte, tanpa mengikuti symlink) dan jumlah berkas. */
function ukuran(dir) {
  let byte = 0, berkas = 0;
  const jalan = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) jalan(p);
      else { try { byte += fs.lstatSync(p).size; berkas++; } catch { /* hilang di tengah jalan */ } }
    }
  };
  try { jalan(dir); } catch { /* tak terbaca */ }
  return { byte, berkas };
}

/** Folder handoff/<ID>: ada & aman dihapus (anak langsung handoff/, bukan symlink)? → { ada, aman, alasan } */
function periksaHandoff(root, id) {
  const induk = path.join(root, "handoff");
  const p = path.join(induk, id);
  let st;
  try { st = fs.lstatSync(p); } catch { return { ada: false, aman: true, path: p }; }
  if (!st.isDirectory()) return { ada: true, aman: false, alasan: st.isSymbolicLink() ? "symlink" : "bukan folder", path: p };
  if (path.dirname(fs.realpathSync(p)) !== fs.realpathSync(induk)) return { ada: true, aman: false, alasan: "di luar handoff/", path: p };
  return { ada: true, aman: true, path: p, ...ukuran(p) };
}

/** Cabang utama: --base, selain itu main, lalu master. */
function cabangUtama(root, base) {
  for (const c of base ? [base] : ["main", "master"]) if (git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${c}`]).ok) return c;
  return null;
}

/** Peta worktree dari `git worktree list --porcelain`. */
function daftarWorktree(root) {
  const r = git(root, ["worktree", "list", "--porcelain"]);
  if (!r.ok) return [];
  return r.out.split(/\n\n+/).map((blok) => {
    const w = { path: "", branch: null, terkunci: false, prunable: false };
    for (const l of blok.split("\n")) {
      if (l.startsWith("worktree ")) w.path = l.slice(9);
      else if (l.startsWith("branch ")) w.branch = l.slice(7).replace(/^refs\/heads\//, "");
      else if (l.startsWith("locked")) w.terkunci = true;
      else if (l.startsWith("prunable")) w.prunable = true;
    }
    return w;
  }).filter((w) => w.path);
}

const dalam = (anak, induk) => { const r = path.relative(induk, anak); return !!r && !r.startsWith("..") && !path.isAbsolute(r); };
// realpathSync.native: di Windows juga memperluas nama pendek 8.3 (C:\Users\NAMAPE~1 → nama panjang) seperti yang dicetak
// `git worktree list`; realpathSync JS biasa membiarkannya sehingga dua bentuk path folder yang sama dianggap berbeda.
const nyata = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };

/** Sha merge: commit merge pertama (jalur first-parent) yang memasukkan `tip` ke `base`; fast-forward → tip itu sendiri. */
function shaMerge(root, tip, base) {
  const r = git(root, ["rev-list", "--merges", "--ancestry-path", "--first-parent", "--reverse", `${tip}..refs/heads/${base}`]);
  const pertama = r.ok ? r.out.split("\n").find(Boolean) : null;
  return (pertama ?? tip).slice(0, 12);
}

/**
 * Rencana pembersihan git (read-only): untuk tiap branch rudis/<ID>[-…] yang pemiliknya layak dibuang → usulan atau ditahan.
 * `layak(id)` → { judul } bila tugas pemilik boleh dibersihkan (tutup > 24 jam & tidak terlindung), atau null.
 */
export function rencanaGit(root, { base, kini, cwd = process.cwd(), layak }) {
  const hasil = { base: null, usulan: [], ditahan: [], galat: null };
  if (!git(root, ["rev-parse", "--git-dir"]).ok) { hasil.galat = "bukan repo git"; return hasil; }
  hasil.base = cabangUtama(root, base);
  if (!hasil.base) { hasil.galat = `cabang utama tidak ditemukan (${base ?? "main/master"})`; return hasil; }
  const akar = nyata(root);
  const rootWt = nyata(path.join(root, ".claude", "worktrees"));
  const wts = daftarWorktree(root);
  const wtDariCabang = new Map(wts.filter((w) => w.branch).map((w) => [w.branch, w]));
  const cwdNyata = nyata(cwd);
  const refs = git(root, ["for-each-ref", "--format=%(refname:short)%09%(objectname)%09%(committerdate:unix)", "refs/heads/rudis/"]);
  if (!refs.ok) { hasil.galat = refs.err || "for-each-ref gagal"; return hasil; }
  for (const baris of refs.out.split("\n").filter(Boolean)) {
    const [nama, sha, ct] = baris.split("\t");
    const m = RE_CABANG.exec(nama);
    if (!m) continue;
    const info = layak(m[1], new Date(+ct * 1000));
    if (!info) continue;                                                 // tugas aktif/terlindung/belum 24 jam/tak dikenal → diam
    const ent = { cabang: nama, id: m[1], judul: info.judul ?? "", tip: sha.slice(0, 12) };
    const tahan = (alasan) => hasil.ditahan.push({ ...ent, alasan });
    if (!git(root, ["merge-base", "--is-ancestor", `refs/heads/${nama}`, `refs/heads/${hasil.base}`]).ok) { tahan(`belum ter-merge ke ${hasil.base}`); continue; }
    ent.merge = shaMerge(root, sha, hasil.base);
    const wt = wtDariCabang.get(nama);
    if (wt) {
      const p = nyata(wt.path);
      if (p === akar) { tahan("branch dipakai checkout utama"); continue; }
      if (wt.terkunci) { tahan("worktree terkunci"); continue; }
      if (wt.prunable || !fs.existsSync(wt.path)) { tahan("worktree hilang dari disk (git worktree prune dulu)"); continue; }
      if (!dalam(p, rootWt)) { tahan("worktree di luar .claude/worktrees repo ini"); continue; }
      if (RE_WORKTREE_SESI.test(path.basename(p))) { tahan("worktree sesi tim (hidup lintas tugas)"); continue; }
      if (cwdNyata === p || dalam(cwdNyata, p)) { tahan("worktree sedang dipakai pemanggil"); continue; }
      const st = git(wt.path, ["status", "--porcelain"]);
      if (!st.ok) { tahan("status worktree tak terbaca"); continue; }
      if (st.out) { tahan("worktree kotor"); continue; }
      ent.worktree = wt.path;
    }
    hasil.usulan.push(ent);
  }
  return hasil;
}

/** Perintah usulan untuk satu entri (dijalankan pelaksana lewat Bash agar hook kebijakan bertanya). */
export function perintahUsulan(root, e) {
  const q = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
  const out = [];
  // garis miring ke depan: git mencetak path worktree begitu, dan bentuk ini aman ditempel ke Git Bash/PowerShell di Windows
  const r = posix(root);
  if (e.worktree) out.push(`git -C ${q(r)} worktree remove ${q(posix(e.worktree))}`);
  out.push(`git -C ${q(r)} branch -d ${q(e.cabang)}`);
  return out;
}

/** Susun rencana lengkap (read-only). */
export function rencanakan({ root = ROOT_BAWAAN, kini = new Date(), base, cwd = process.cwd(), json = path.join(root, "handoff", "register-tugas.json") } = {}) {
  const reg = baca(json);
  const rencana = { root, kini, tugas: [], tahan: { terlindung: 0, belum24: 0 }, git: null, yatimHandoff: [], galat: [] };
  const tugas = reg?.tugas ?? [];
  const kand = kandidat(tugas, kini);
  const lindung = terlindung(tugas);
  const dipilih = new Map(kand.map((k) => [k.tugas.id, k]));
  for (const t of tugas) {
    if (aktif(t)) continue;
    if (lindung.has(t.id)) rencana.tahan.terlindung++;
    else if (!dipilih.has(t.id)) rencana.tahan.belum24++;
  }
  for (const { tugas: t, tutup } of kand) rencana.tugas.push({ id: t.id, judul: t.judul, status: t.status, selesai_pada: t.selesai_pada, tutup,
    handoff: periksaHandoff(root, t.id), info: infoRegister(t) });
  const judulAudit = judulDariAudit(root);
  const per = new Map(tugas.map((t) => [t.id, t]));
  const layak = (id, tipTgl) => {
    const t = per.get(id);
    if (t) return dipilih.has(id) ? { judul: t.judul } : null;
    // pemilik sudah tak ada di register (dibersihkan lebih dulu): layak bila commit terakhir branch > 24 jam
    return kini - tipTgl > BATAS_MS ? { judul: judulAudit.get(id) ?? "" } : null;
  };
  rencana.git = rencanaGit(root, { base, kini, cwd, layak });
  if (rencana.git.galat) rencana.galat.push(`git: ${rencana.git.galat}`);
  const terdaftar = new Set(tugas.map((t) => t.id));
  try {
    for (const e of fs.readdirSync(path.join(root, "handoff"), { withFileTypes: true }))
      if (e.isDirectory() && RE_ID.test(e.name) && !terdaftar.has(e.name)) rencana.yatimHandoff.push(e.name);
  } catch { /* handoff/ belum ada */ }
  return rencana;
}

const BERKAS_AUDIT = (root) => path.join(root, "handoff", "bersih-riwayat.jsonl");
function judulDariAudit(root) {
  const m = new Map();
  try {
    for (const l of fs.readFileSync(BERKAS_AUDIT(root), "utf8").split("\n")) {
      if (!l.trim()) continue;
      try { const o = JSON.parse(l); if (o.id && o.judul) m.set(o.id, o.judul); } catch { /* baris rusak dilewati */ }
    }
  } catch { /* belum ada */ }
  return m;
}

/** Penghitung metrik bawaan (dengan biaya); audit izin dibaca dari root yang dibersihkan. */
const hitungBawaan = (root) => (id) => hitungMetrik(id, { biaya: true, dirAudit: process.env.RUDISONE_AUDIT || path.join(root, "handoff", "audit") });

/**
 * Eksekusi: simpan ringkasan metrik, hapus folder handoff, catat audit, lalu buang entri register (sekali tulis, divalidasi
 * ulang di dalam kunci). Metrik ditulis SEBELUM folder dihapus; galat penghitung tidak menghentikan pembersihan (baris
 * tetap ditulis dengan `galat`), tetapi galat MENULIS baris metrik menggagalkan tugas itu (folder dibiarkan).
 * `hitungMetrik(id)` dan `berkasMetrik` bisa disuntik untuk uji.
 */
export function eksekusi(rencana, { json = path.join(rencana.root, "handoff", "register-tugas.json"), md,
  hitungMetrik: hitung = hitungBawaan(rencana.root), berkasMetrik: berkasM = berkasMetrik(rencana.root) } = {}) {
  const { root, kini } = rencana;
  const gitPer = new Map();
  for (const e of [...(rencana.git?.usulan ?? []), ...(rencana.git?.ditahan ?? [])]) {
    if (!gitPer.has(e.id)) gitPer.set(e.id, []);
    gitPer.get(e.id).push({ nama: e.cabang, merge: e.merge ?? null, status: e.alasan ? `ditahan: ${e.alasan}` : "diusulkan" });
  }
  const selesai = [], gagal = [];
  let metrik = 0;
  for (const r of rencana.tugas) {
    const h = r.handoff;
    if (h.ada && !h.aman) { gagal.push({ id: r.id, alasan: `folder handoff tidak aman dihapus (${h.alasan})` }); continue; }
    try {
      simpanRingkas(ringkasTugas(r.id, { ...r.info, sumber: "bersih-riwayat", dicatat: kini }, { hitung }), { berkas: berkasM });
      metrik++;
      if (h.ada) fs.rmSync(h.path, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(BERKAS_AUDIT(root)), { recursive: true });
      fs.appendFileSync(BERKAS_AUDIT(root), `${JSON.stringify({ tanggal: kini.toISOString(), id: r.id, judul: r.judul, status: r.status,
        selesai_pada: r.selesai_pada, handoff_byte: h.byte ?? 0, handoff_berkas: h.berkas ?? 0, cabang: gitPer.get(r.id) ?? [] })}\n`);
      selesai.push(r.id);
    } catch (e) { gagal.push({ id: r.id, alasan: e.message }); }
  }
  if (selesai.length) {
    perbarui((reg) => {
      const boleh = new Set(kandidat(reg.tugas, kini).map((k) => k.tugas.id));     // validasi ulang: tugas bisa berubah sejak rencana
      reg.tugas = reg.tugas.filter((t) => !(selesai.includes(t.id) && boleh.has(t.id)));
    }, { json, ...(md ? { md } : { md: path.join(path.dirname(json), "register-tugas.md") }), bolehBaru: false });
  }
  return { selesai, gagal, metrik };
}

const MB = (b) => (b / 1048576).toFixed(1);
export function ringkas(rencana, hasil, { jalankan }) {
  const n = rencana.tugas.length;
  const byte = rencana.tugas.reduce((a, r) => a + (r.handoff.byte ?? 0), 0);
  const g = rencana.git;
  const bagian = [];
  if (!n) bagian.push("tidak ada tugas selesai/dibatalkan > 24 jam untuk dibuang");
  else bagian.push(`${jalankan ? `dibuang ${hasil.selesai.length}/${n}` : `akan dibuang ${n}`} tugas (register + handoff, ${MB(byte)} MB)`);
  if (hasil?.metrik) bagian.push(`metrik disimpan ${hasil.metrik}`);
  if (g?.usulan.length) bagian.push(`usulan git menunggu persetujuan: ${g.usulan.filter((e) => e.worktree).length} worktree + ${g.usulan.length} branch ter-merge (bin/bersih-riwayat.sh --usulan-git)`);
  if (g?.ditahan.length) bagian.push(`${g.ditahan.length} branch ditahan (belum ter-merge/kotor/dipakai)`);
  if (rencana.yatimHandoff.length) bagian.push(`${rencana.yatimHandoff.length} folder handoff tanpa entri register (tidak disentuh)`);
  if (hasil?.gagal.length) bagian.push(`GAGAL ${hasil.gagal.length}: ${hasil.gagal.map((x) => `${x.id} (${x.alasan})`).join("; ")}`);
  if (rencana.galat.length) bagian.push(`peringatan: ${rencana.galat.join("; ")}`);
  return `bersih-riwayat${jalankan ? "" : " (dry-run)"}: ${bagian.join(" · ")}`;
}

export function main(argv, env = process.env) {
  const opsi = { jalankan: false, usulanGit: false, rinci: false, json: false, base: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--jalankan") opsi.jalankan = true;
    else if (a === "--usulan-git") opsi.usulanGit = true;
    else if (a === "--rinci") opsi.rinci = true;
    else if (a === "--json") opsi.json = true;
    else if (a === "--base" && argv[i + 1]) opsi.base = argv[++i];
    else { console.error(fs.readFileSync(INI, "utf8").split("\n").filter((l) => /^\/\/ {3}(bin\/|opsi:)/.test(l)).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return 3; }
  }
  if (opsi.jalankan && opsi.usulanGit) { console.error("bersih-riwayat: --jalankan dan --usulan-git tidak digabung"); return 3; }
  const root = env.RUDISONE_ROOT ? path.resolve(env.RUDISONE_ROOT) : ROOT_BAWAAN;
  const json = env.RUDISONE_REGISTER_JSON || path.join(root, "handoff", "register-tugas.json");
  const md = env.RUDISONE_REGISTER_MD || path.join(path.dirname(json), "register-tugas.md");
  try {
    const kini = env.RUDISONE_SEKARANG ? new Date(env.RUDISONE_SEKARANG) : new Date();   // RUDISONE_SEKARANG: hanya untuk uji
    if (Number.isNaN(+kini)) throw new Error("RUDISONE_SEKARANG bukan tanggal ISO");
    const rencana = rencanakan({ root, base: opsi.base, json, kini });
    const g = rencana.git;
    if (opsi.usulanGit) {
      for (const e of g?.usulan ?? []) for (const c of perintahUsulan(root, e)) console.log(c);
      return 0;
    }
    const hasil = opsi.jalankan ? eksekusi(rencana, { json, md }) : { selesai: [], gagal: [] };
    if (opsi.json) {
      console.log(JSON.stringify({ jalankan: opsi.jalankan, tugas: rencana.tugas.map((r) => ({ id: r.id, judul: r.judul, status: r.status, selesai_pada: r.selesai_pada, byte: r.handoff.byte ?? 0 })),
        dibuang: hasil.selesai, gagal: hasil.gagal, metrik_disimpan: hasil.metrik ?? 0, git: g && { base: g.base, usulan: g.usulan, ditahan: g.ditahan }, yatimHandoff: rencana.yatimHandoff, tahan: rencana.tahan }, null, 2));
    } else {
      console.log(ringkas(rencana, hasil, opsi));
      if (opsi.rinci) {
        for (const r of rencana.tugas) console.log(`  - ${r.id} · ${r.judul} · ${r.status} ${r.selesai_pada} · ${MB(r.handoff.byte ?? 0)} MB`);
        for (const e of g?.usulan ?? []) console.log(`  usulan: ${e.cabang} (merge ${e.merge})${e.worktree ? ` + worktree ${e.worktree}` : ""}`);
        for (const e of g?.ditahan ?? []) console.log(`  ditahan: ${e.cabang} — ${e.alasan}`);
        for (const y of rencana.yatimHandoff) console.log(`  tanpa register: handoff/${y}`);
      }
    }
    return hasil.gagal.length ? 1 : 0;
  } catch (e) {
    console.error(`bersih-riwayat: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
