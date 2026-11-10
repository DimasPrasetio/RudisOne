// Izin tugas RudisOne — aksi integrasi yang sudah disepakati pengguna di percakapan COO berjalan tanpa prompt.
// COO menulis izin saat kesepakatan: `bin/register.sh izin <ID> --repo <path> --aksi gabung,push,bersihkan --kutip "<kata
// pengguna persis>"` (kolom `izin` di register-tugas.json). Hook kebijakan (bin/kebijakan.mjs) meloloskan aksi git yang
// tercakup HANYA bila semua syarat di bawah terpenuhi pada saat itu juga; selain itu keputusan biasa (ask) berlaku.
//   · dijalankan sesi COO utama (bukan subagent, bukan sesi lain) — agent tidak bisa memakai izin untuk dirinya sendiri
//   · tugas aktif, izin untuk repo yang sama (realpath checkout utama), belum kedaluwarsa (maks. 24 jam sejak dibuat)
//   · kutipan izin = pesan UTUH yang DIKETIK/DIPILIH pengguna di transkrip sesi itu dalam 24 jam terakhir (pesan manusia atau
//     jawaban AskUserQuestion — bukan hasil alat lain, bukan pesan lintas sesi)
//   · gabung: `git merge [--no-ff|--ff-only|--no-edit|-m …] rudis/<ID>` di checkout utama pada cabang izin, pohon kerja bersih,
//     dan tidak mengubah berkas pengaman (kebijakan, settings, hook, audit, installer) — gabung semacam itu dijalankan pengguna
//   · push: `git push origin <cabang>|HEAD|HEAD:<cabang>` (refspec wajib) tanpa force/delete/mirror, URL push origin sama dengan saat izin
//     ditulis, dan pemindai rahasia lulus atas semua commit yang akan dikirim (repo RudisOne: juga bin/bersih.mjs)
//   · bersihkan: `git worktree remove <path>` / `git branch -d|-D rudis/<ID>[-…]` — cabang tugas yang sudah tergabung ke
//     cabang izin dan bersih; tanpa --force pada worktree
// Bentuk lain (git -c, env GIT_*, opsi di luar daftar, refspec lain, variabel/glob) tidak pernah tercakup.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const AKSI_IZIN = ["gabung", "push", "bersihkan"];
export const IZIN_MAKS_JAM = 24;
const JAM = 3600e3;
const RE_ID = /^T-\d{8}-\d+(\.\d+)?$/;
const TUTUP = new Set(["selesai", "dibatalkan", "penyelarasan"]);

// ---------- pesan pengguna di transkrip ----------
export function teksPesanPengguna(baris) {
  if (baris?.type !== "user" || !baris.message || baris.isMeta) return "";
  const c = baris.message.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  return "";
}
/** Ketikan pengguna sendiri (bukan pesan lintas sesi, notifikasi, hand-back subagent, ekspansi skill, atau hasil alat). */
export function ketikanPengguna(baris) {
  if (baris?.type !== "user" || baris.isMeta) return false;
  const c = baris.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === "tool_result")) return false;
  const k = baris.origin?.kind;
  if (k && k !== "human") return false;
  const t = teksPesanPengguna(baris).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
  return !!t && !/<cross-session-message\b|<task-notification\b|The session "[^"]*" you started/.test(t);
}
const rapat = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Waktu (ISO) pesan pengguna terbaru di transkrip `file` yang memuat `kutip` — diketik (origin manusia) atau jawaban
 *  AskUserQuestion (hasil alat yang tool_use-nya bernama AskUserQuestion; jawaban alat lain tidak dihitung) — dan tidak
 *  lebih tua dari `sejakMs`. Dibaca mundur per potongan (maks. `maks` byte). Tidak ketemu → null. */
export function buktiKetikan(file, kutip, { sejakMs = 0, maks = 128 << 20, potongan = 1 << 20 } = {}) {
  const k = rapat(kutip);
  if (k.length < 2 || !file) return null;
  const jarum = JSON.stringify(k).slice(1, -1).split(" ")[0];   // potongan pertama kutipan dalam bentuk JSON (penyaring cepat)
  let fd;
  try { fd = fs.openSync(file, "r"); } catch { return null; }
  const calon = new Map();   // tool_use_id → waktu jawaban yang memuat kutipan, menunggu bukti nama alat
  try {
    let pos = fs.fstatSync(fd).size, ekor = Buffer.alloc(0), dibaca = 0;
    while (pos > 0 && dibaca < maks) {
      const n = Math.min(potongan, pos);
      pos -= n; dibaca += n;
      const b = Buffer.alloc(n);
      fs.readSync(fd, b, 0, n, pos);
      const blok = Buffer.concat([b, ekor]);
      let awal = 0;
      if (pos > 0) { const i = blok.indexOf(10); if (i < 0) { ekor = blok; continue; } ekor = blok.subarray(0, i); awal = i + 1; }
      const ls = blok.subarray(awal).toString("utf8").split("\n");
      for (let i = ls.length - 1; i >= 0; i--) {
        const l = ls[i];
        if (!l) continue;
        const sebutCalon = calon.size && [...calon.keys()].some((id) => l.includes(id));
        if (!sebutCalon && !l.includes(jarum)) continue;
        let x; try { x = JSON.parse(l); } catch { continue; }
        const waktu = Date.parse(x.timestamp ?? "");
        if (x.type === "assistant" && calon.size) {
          for (const blk of Array.isArray(x.message?.content) ? x.message.content : []) {
            if (blk?.type === "tool_use" && calon.has(blk.id)) {
              if (blk.name === "AskUserQuestion") return calon.get(blk.id);
              calon.delete(blk.id);
            }
          }
          continue;
        }
        if (x.type !== "user") continue;
        // lebih tua dari jendela: berhenti — kecuali masih mencari tool_use jawaban AskUserQuestion yang sudah ketemu
        if (!(waktu >= sejakMs)) { if (waktu < sejakMs && !calon.size) return null; continue; }
        // pesan/jawaban UTUH sama dengan kutipan (bukan sekadar memuatnya: "jangan gabung & kirim" ≠ "gabung & kirim")
        if (ketikanPengguna(x) && rapat(teksPesanPengguna(x).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")) === k) return new Date(waktu).toISOString();
        const jawaban = x.toolUseResult?.answers;
        const hasil = Array.isArray(x.message?.content) ? x.message.content.find((b) => b?.type === "tool_result") : null;
        if (hasil && jawaban && typeof jawaban === "object" && Array.isArray(x.toolUseResult?.questions)
          && Object.values(jawaban).some((v) => rapat(v) === k)) calon.set(hasil.tool_use_id, new Date(waktu).toISOString());
      }
    }
    return null;
  } catch { return null; } finally { fs.closeSync(fd); }
}

// ---------- git ----------
export function git(dir, args, opsi = {}) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", timeout: opsi.timeout ?? 10000, maxBuffer: opsi.maxBuffer ?? 16 << 20,
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" } });
  return { ok: !r.error && r.status === 0, out: String(r.stdout ?? ""), status: r.status };
}
const nyata = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };
const sama = (a, b) => { if (!a || !b) return false; const n = (p) => (process.platform === "darwin" || process.platform === "win32" ? p.toLowerCase() : p); return n(path.resolve(a)) === n(path.resolve(b)); };

/** { akar: checkout utama (realpath), toplevel: folder kerja `dir` (realpath) } atau null bila bukan repo git. */
export function infoRepo(dir) {
  const d = nyata(dir);
  if (!d) return null;
  const r = git(d, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"]);
  if (!r.ok) return null;
  const [top, common] = r.out.trim().split("\n");
  if (!top || !common || path.basename(common) !== ".git") return null;
  return { akar: nyata(path.dirname(common)), toplevel: nyata(top) };
}
const cabangSekarang = (dir) => { const r = git(dir, ["symbolic-ref", "--quiet", "--short", "HEAD"]); return r.ok ? r.out.trim() : null; };
const tergabung = (akar, ref, cabang) => git(akar, ["merge-base", "--is-ancestor", ref, `refs/heads/${cabang}`]).ok;
const adaRef = (akar, ref) => git(akar, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).ok;
/** Daftar worktree repo: [{ path, branch }] (entri pertama = checkout utama). */
export function daftarWorktree(dir) {
  const r = git(dir, ["worktree", "list", "--porcelain"]);
  if (!r.ok) return null;
  return r.out.split("\n\n").map((b) => ({ path: b.match(/^worktree (.+)$/m)?.[1] ?? null, branch: b.match(/^branch (.+)$/m)?.[1] ?? null })).filter((w) => w.path);
}
/** URL push origin efektif (insteadOf/pushInsteadOf diterapkan git). */
export const urlPushOrigin = (dir) => { const r = git(dir, ["remote", "get-url", "--push", "origin"]); return r.ok ? r.out.trim() : null; };
/** Cabang bawaan repo: origin/HEAD, selain itu cabang checkout utama. */
export function cabangBawaan(akar) {
  const r = git(akar, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (r.ok && r.out.trim().startsWith("origin/")) return r.out.trim().slice(7);
  return cabangSekarang(akar);
}

// ---------- pengurai perintah git (kata sudah tanpa kutip) ----------
const RE_CABANG_TUGAS = /^(?:refs\/heads\/)?rudis\/(T-\d{8}-\d+(?:\.\d+)?)(-[A-Za-z0-9._-]+)?$/;
/** Kata-kata sesudah `git` → calon aksi izin { jenis, … } atau null. Opsi global hanya `-C <path>` (git -c/--git-dir/
 *  --exec-path dll. bisa menjalankan program lain → tidak pernah tercakup). `basis` = folder kerja perintah. */
export function calonGit(args, basis) {
  if (!basis) return null;
  let i = 0, dir = basis;
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-C" && args[i + 1] !== undefined) { dir = path.resolve(dir, args[i + 1]); i += 2; continue; }
    return null;
  }
  const sub = args[i], r = args.slice(i + 1);
  const pos = [], opsi = [];
  let habis = false;
  for (let j = 0; j < r.length; j++) {
    const x = r[j];
    if (!habis && x === "--") { habis = true; continue; }
    if (!habis && x.startsWith("-") && x !== "-") {
      if (sub === "merge" && (x === "-m" || x === "--message")) { if (r[j + 1] === undefined) return null; opsi.push(x); j++; continue; }
      opsi.push(x); continue;
    }
    pos.push(x);
  }
  if (sub === "merge") {
    if (!opsi.every((o) => /^(--no-ff|--ff|--ff-only|--no-edit|-q|--quiet|--log|--no-log|--stat|--no-stat|-n|-m|--message|-m.+|--message=.*)$/.test(o))) return null;
    const m = pos.length === 1 ? pos[0].match(RE_CABANG_TUGAS) : null;
    if (!m || m[2]) return null;   // hanya cabang tugas itu sendiri, bukan cabang anggota (rudis/<ID>-se1)
    return { jenis: "gabung", dir, id: m[1], ref: `refs/heads/rudis/${m[1]}` };
  }
  if (sub === "push") {
    if (!opsi.every((o) => /^(-u|--set-upstream|-q|--quiet|-v|--verbose|--porcelain|--progress|--no-progress)$/.test(o))) return null;
    if (pos[0] !== "origin" || pos.length !== 2) return null;
    return { jenis: "push", dir, refspec: pos[1] };
  }
  if (sub === "worktree") {
    if (pos[0] !== "remove" || pos.length !== 2 || opsi.length) return null;   // --force / -f tidak pernah tercakup
    return { jenis: "bersihkan", sub: "worktree", dir, path: path.resolve(dir, pos[1]) };
  }
  if (sub === "branch") {
    if (!opsi.length || !opsi.every((o) => /^(-d|-D|--delete|--force|-f|-q|--quiet)$/.test(o)) || !opsi.some((o) => /^(-d|-D|--delete)$/.test(o))) return null;
    if (!pos.length) return null;
    const ids = pos.map((p) => p.match(RE_CABANG_TUGAS));
    if (ids.some((m) => !m)) return null;
    return { jenis: "bersihkan", sub: "branch", dir, cabang: pos.map((p) => p.replace(/^refs\/heads\//, "")), ids: ids.map((m) => m[1]) };
  }
  return null;
}

// ---------- pemindai rahasia (commit yang akan dikirim) ----------
const POLA_RAHASIA = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/], ["kunci AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["token GitHub", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/], ["token GitLab", /\bglpat-[A-Za-z0-9_-]{20,}/],
  ["token Slack", /\bxox[abeoprs]-[A-Za-z0-9-]{10,}/], ["kunci Google API", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["kunci API (sk-)", /\bsk-(ant-|proj-)?[A-Za-z0-9_-]{32,}/], ["kunci Stripe live", /\b[rs]k_live_[0-9A-Za-z]{20,}/],
];
const BERKAS_RAHASIA = /(^|\/)(\.env(\.(?!(example|contoh|sample|template|dist|defaults?)$)[\w.-]+)?|\.envrc|id_(rsa|dsa|ecdsa|ed25519)|[^/]*\.(pem|key|p12|pfx|keystore|jks)|\.netrc|\.npmrc|\.pypirc|\.git-credentials|credentials\.json)$/i;
/** Temuan rahasia di commit `rentang` (mis. origin/main..main) — nama pola & berkas saja, nilai tidak pernah dikembalikan.
 *  Gagal membaca (rentang terlalu besar, git galat) → [{ galat }] (pemanggil menganggapnya tidak lulus). */
export function pindaiRahasia(dir, rentang) {
  const nama = git(dir, ["log", "--no-renames", "--diff-filter=AM", "--name-only", "--format=", rentang], { maxBuffer: 64 << 20 });
  const isi = git(dir, ["log", "-p", "--no-color", "--no-ext-diff", "--no-textconv", "--format=commit %H", rentang], { maxBuffer: 256 << 20, timeout: 20000 });
  if (!nama.ok || !isi.ok) return [{ galat: `isi commit ${rentang} tidak terbaca` }];
  const temuan = [];
  for (const f of new Set(nama.out.split("\n").filter(Boolean))) if (BERKAS_RAHASIA.test(f)) temuan.push({ berkas: f, pola: "berkas rahasia" });
  let berkas = "";
  for (const l of isi.out.split("\n")) {
    if (l.startsWith("+++ ")) { berkas = l.slice(4).replace(/^b\//, ""); continue; }
    if (!l.startsWith("+")) continue;
    for (const [n, p] of POLA_RAHASIA) if (p.test(l)) temuan.push({ berkas, pola: n });
  }
  return temuan;
}

// ---------- register ----------
/** Galat skema satu entri izin (kosong = valid). */
export function validasiIzin(iz) {
  const g = [];
  if (!iz || typeof iz !== "object" || Array.isArray(iz)) return ["izin harus objek"];
  for (const k of Object.keys(iz)) if (!["repo", "cabang", "origin", "aksi", "kutip", "dibuat", "sampai"].includes(k)) g.push(`kolom izin tidak dikenal: ${k}`);
  if (typeof iz.repo !== "string" || !path.isAbsolute(iz.repo)) g.push("izin.repo harus path absolut");
  if (typeof iz.cabang !== "string" || !/^[\w./-]+$/.test(iz.cabang)) g.push("izin.cabang harus nama cabang");
  if (iz.origin !== null && typeof iz.origin !== "string") g.push("izin.origin harus URL atau null");
  if (!Array.isArray(iz.aksi) || !iz.aksi.length || iz.aksi.some((a) => !AKSI_IZIN.includes(a))) g.push(`izin.aksi harus larik dari ${AKSI_IZIN.join("|")}`);
  if (typeof iz.kutip !== "string" || rapat(iz.kutip).length < 2 || /[\n|]/.test(iz.kutip)) g.push("izin.kutip harus kata pengguna persis, satu baris");
  const d = Date.parse(iz.dibuat ?? ""), s = Date.parse(iz.sampai ?? "");
  if (Number.isNaN(d) || Number.isNaN(s)) g.push("izin.dibuat/sampai harus waktu ISO");
  else if (s <= d || s - d > IZIN_MAKS_JAM * JAM + 60e3) g.push(`izin.sampai harus sesudah dibuat dan paling lama ${IZIN_MAKS_JAM} jam`);
  return g;
}
const idCakup = (idIzin, id) => id === idIzin || id.startsWith(`${idIzin}.`);

/** Izin yang masih berlaku dari register untuk `akar` & `jenis` (dan ID bila diberikan): [{ id, iz }]. */
export function izinBerlaku(reg, akar, jenis, kini, id = null) {
  const out = [];
  for (const t of reg?.tugas ?? []) {
    if (!RE_ID.test(String(t.id)) || TUTUP.has(t.status) || !Array.isArray(t.izin)) continue;
    if (id && !idCakup(t.id, id)) continue;
    for (const iz of t.izin) {
      if (validasiIzin(iz).length || !iz.aksi.includes(jenis) || !sama(nyata(iz.repo), akar)) continue;
      if (!(Date.parse(iz.dibuat) <= kini && kini < Date.parse(iz.sampai))) continue;
      out.push({ id: t.id, iz });
    }
  }
  return out;
}

/** Periksa satu calon aksi git terhadap izin di register. `o`: { reg, transkrip, kini, root, pengaman(rel, abs) → sebab|null }.
 *  → { ok: true, id, aksi } | { ok: false, alasan }. */
export function periksaIzin(c, o) {
  const kini = o.kini ?? Date.now();
  const info = infoRepo(c.dir);
  if (!info) return { ok: false, alasan: "folder bukan repo git" };
  const jenisId = c.jenis === "gabung" ? c.id : null;
  const kandidat = izinBerlaku(o.reg, info.akar, c.jenis, kini, jenisId);
  if (!kandidat.length) return { ok: false, alasan: `tidak ada izin tugas "${c.jenis}" yang berlaku untuk repo ini` };
  const syaratGit = (iz) => {
    if (c.jenis === "gabung") {
      if (!sama(info.toplevel, info.akar)) return "gabung hanya di checkout utama";
      if (cabangSekarang(info.akar) !== iz.cabang) return `checkout utama tidak di cabang ${iz.cabang}`;
      if (!adaRef(info.akar, c.ref)) return `${c.ref} tidak ada`;
      const st = git(info.akar, ["status", "--porcelain", "--untracked-files=no"]);
      if (!st.ok || st.out.trim()) return "checkout utama punya perubahan yang belum di-commit";
      const d = git(info.akar, ["diff", "--name-only", "--no-renames", `refs/heads/${iz.cabang}...${c.ref}`]);
      if (!d.ok) return "daftar berkas yang digabung tidak terbaca";
      for (const rel of d.out.split("\n").filter(Boolean)) {
        const s = o.pengaman(rel, path.join(info.akar, rel), info.akar);
        if (s) return `gabung mengubah berkas pengaman (${rel}) — dijalankan pengguna sendiri`;
      }
      return null;
    }
    if (c.jenis === "push") {
      if (!sama(info.toplevel, info.akar)) return "push hanya dari checkout utama";
      const cb = iz.cabang;
      if (cabangSekarang(info.akar) !== cb) return `checkout utama tidak di cabang ${cb}`;
      // refspec wajib eksplisit: tanpa refspec git memakai remote.origin.push / push.default dari config (bisa +refs/heads/*)
      const okRef = [cb, "HEAD", `HEAD:${cb}`, `${cb}:${cb}`, `refs/heads/${cb}`, `refs/heads/${cb}:refs/heads/${cb}`, `HEAD:refs/heads/${cb}`];
      if (!okRef.includes(c.refspec)) return `refspec ${c.refspec} di luar izin (hanya ${cb})`;
      const url = urlPushOrigin(info.akar);
      if (!url || url !== iz.origin) return "URL push origin berbeda dari saat izin ditulis";
      if (!adaRef(info.akar, `refs/remotes/origin/${cb}`)) return `refs/remotes/origin/${cb} tidak ada — dasar pemindaian tidak diketahui`;
      if (!tergabung(info.akar, `refs/remotes/origin/${cb}`, cb)) return "push bukan maju-cepat dari origin (butuh force)";
      const t = pindaiRahasia(info.akar, `refs/remotes/origin/${cb}..refs/heads/${cb}`);
      if (t.length) return `pemindai rahasia: ${t.slice(0, 3).map((x) => x.galat ?? `${x.pola} di ${x.berkas}`).join("; ")}`;
      if (o.root && sama(info.akar, nyata(o.root)) && o.bersih && !o.bersih(info.akar)) return "bin/bersih.mjs menemukan sisa pemakaian di berkas produk RudisOne";
      return null;
    }
    // bersihkan
    const wts = daftarWorktree(info.akar);
    if (!wts) return "daftar worktree tidak terbaca";
    if (c.sub === "worktree") {
      const w = wts.slice(1).find((x) => sama(nyata(x.path) ?? x.path, nyata(c.path) ?? c.path));
      if (!w) return "path bukan worktree tambahan repo ini";
      const m = String(w.branch ?? "").match(/^refs\/heads\/(rudis\/(T-\d{8}-\d+(?:\.\d+)?)(?:-[A-Za-z0-9._-]+)?)$/);
      if (!m) return "worktree tidak berada di cabang tugas rudis/<ID>";
      c.ids = [m[2]];
      if (!tergabung(info.akar, `refs/heads/${m[1]}`, iz.cabang)) return `${m[1]} belum tergabung ke ${iz.cabang}`;
      const st = git(w.path, ["status", "--porcelain", "--untracked-files=all"]);
      if (!st.ok || st.out.trim()) return "worktree punya perubahan atau berkas baru";
      return null;
    }
    const dipakai = new Set(wts.map((w) => w.branch).filter(Boolean));
    for (const b of c.cabang) {
      if (!adaRef(info.akar, `refs/heads/${b}`)) return `cabang ${b} tidak ada`;
      if (dipakai.has(`refs/heads/${b}`)) return `cabang ${b} masih dipakai worktree`;
      if (!tergabung(info.akar, `refs/heads/${b}`, iz.cabang)) return `${b} belum tergabung ke ${iz.cabang}`;
    }
    return null;
  };
  let alasan = "izin tidak cocok";
  for (const { id, iz } of kandidat) {
    const sebab = syaratGit(iz);
    if (sebab) { alasan = sebab; continue; }
    if (c.jenis === "bersihkan" && !(c.ids ?? []).every((x) => idCakup(id, x))) { alasan = "cabang milik tugas lain"; continue; }
    if (!buktiKetikan(o.transkrip, iz.kutip, { sejakMs: kini - IZIN_MAKS_JAM * JAM })) { alasan = `kesepakatan "${iz.kutip}" tidak ditemukan sebagai ketikan pengguna di percakapan ini dalam ${IZIN_MAKS_JAM} jam`; continue; }
    return { ok: true, id, aksi: c.jenis };
  }
  return { ok: false, alasan };
}
