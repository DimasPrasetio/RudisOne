// Pemasangan otomatis alat prasyarat oleh install.mjs: uv/uvx (RUDIS SDD) dan Claude Code CLI — hanya bila belum terdeteksi.
// Sumber resmi (diverifikasi 2026-10-31):
//   uv     macOS/Linux/WSL: curl -LsSf https://astral.sh/uv/install.sh | sh    (wget -qO- bila tanpa curl)
//          Windows: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
//          biner di ~/.local/bin (uv, uvx; Windows: uv.exe, uvx.exe)
//   claude macOS/Linux/WSL: curl -fsSL https://claude.ai/install.sh | bash
//          Windows PowerShell: irm https://claude.ai/install.ps1 | iex
//          biner di ~/.local/bin/claude (Windows: ~\.local\bin\claude.exe)
// Gagal/tanpa jaringan → peringatan + perintah manual, tidak pernah mematikan install. Tanpa sudo/Administrator.
// Env uji: RUDISONE_OS (os logis; "wsl" = jalur Linux), RUDISONE_PEMASANG_UV / RUDISONE_PEMASANG_CLAUDE = executable tiruan
// yang menggantikan perintah unduhan (dipanggil tanpa argumen), RUDISONE_PEMASANG_LOG = berkas log perintah yang SEHARUSNYA jalan.
import fs from "node:fs";
import path from "node:path";
import { jalankan, osLogis } from "./platform.mjs";

export const SUMBER = {
  uv: { sh: "https://astral.sh/uv/install.sh", ps: "https://astral.sh/uv/install.ps1" },
  claude: { sh: "https://claude.ai/install.sh", ps: "https://claude.ai/install.ps1" },
};

const windows = (os) => os === "win32";

/** Perintah pemasangan resmi untuk `alat` ("uv" | "claude") di `os`: { url, tampil, cmd, args }.
 *  `tampil` = baris yang dicetak/disalin pengguna (sama dengan dokumentasi resmi). uv memakai wget hanya bila curl tidak ada dan wget ada. */
export function perintahPasang(alat, os = osLogis(), { adaCurl = true, adaWget = false } = {}) {
  const s = SUMBER[alat];
  if (!s) throw new Error(`alat tidak dikenal: ${alat}`);
  if (windows(os)) {
    const isi = `irm ${s.ps} | iex`;
    return {
      url: s.ps,
      tampil: alat === "uv" ? `powershell -ExecutionPolicy ByPass -c "${isi}"` : isi,
      cmd: "powershell",
      args: ["-NoProfile", "-ExecutionPolicy", "ByPass", "-Command", isi],
    };
  }
  const unduh = alat === "uv" ? (!adaCurl && adaWget ? `wget -qO- ${s.sh} | sh` : `curl -LsSf ${s.sh} | sh`) : `curl -fsSL ${s.sh} | bash`;
  // pipefail: kegagalan unduh (curl) harus terlihat, bukan tertelan oleh sh/bash di ujung pipa
  return { url: s.sh, tampil: unduh, cmd: "bash", args: ["-c", `set -o pipefail; ${unduh}`] };
}

/** Jalankan `<cmd> --version`; baris pertama keluaran atau null. */
export function versiDari(cmd, args = ["--version"]) {
  const r = jalankan(cmd, args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"] });
  return !r.error && r.status === 0 ? String(r.stdout).trim().split(/\r?\n/)[0] || "(tanpa keluaran)" : null;
}

/** Cari `bin` ("uv" | "uvx" | "claude"): di PATH, lalu di ~/.local/bin (lokasi pemasang resmi; PATH shell belum terbarui
 *  sampai terminal dibuka ulang). { versi, lokasi: "path" | path-lengkap } atau null. */
export function cariAlat(bin, { os = osLogis(), home, override } = {}) {
  const v = versiDari(override || bin);
  if (v) return { versi: v, lokasi: "path", cmd: override || bin };
  const dir = path.join(home, ".local", "bin");
  for (const n of windows(os) ? [`${bin}.exe`, `${bin}.cmd`] : [bin]) {
    const kandidat = path.join(dir, n);
    const v2 = fs.existsSync(kandidat) ? versiDari(kandidat) : null;
    if (v2) return { versi: v2, lokasi: kandidat, cmd: kandidat };
  }
  return null;
}

/** Bandingkan versi "a.b.c": -1/0/1. */
export function banding(a, b) {
  const p = (x) => String(x).match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}

/**
 * Pastikan uv/uvx dan claude ada. Idempoten: yang sudah terdeteksi tidak dipasang ulang.
 * @param {{home:string, os?:string, tanpaUnduh?:boolean, env?:object, versiMinClaude?:string,
 *          lapor:{ok:(t:string)=>void, gagal:(t:string)=>void, info:(t:string)=>void}}} o
 * @returns {{dipasang:string[], gagal:string[]}}
 */
export function pastikanAlat(o) {
  const { home, tanpaUnduh = false, env = process.env, lapor, versiMinClaude } = o;
  const os = (o.os ?? osLogis()) === "wsl" ? "linux" : (o.os ?? osLogis());
  const hasil = { dipasang: [], gagal: [] };
  const bukaUlang = [];
  const log = (t) => { if (env.RUDISONE_PEMASANG_LOG) { try { fs.appendFileSync(env.RUDISONE_PEMASANG_LOG, `${t}\n`); } catch { /* log uji opsional */ } } };

  const pasang = (alat, label) => {
    const adaCurl = !!versiDari("curl"), adaWget = !!versiDari("wget");
    const p = perintahPasang(alat, os, { adaCurl, adaWget });
    const tiruan = env[alat === "uv" ? "RUDISONE_PEMASANG_UV" : "RUDISONE_PEMASANG_CLAUDE"];
    if (tanpaUnduh) { lapor.gagal(`${label} tidak ditemukan — pemasangan dilewati (--tanpa-unduh). Manual: ${p.tampil}`); hasil.gagal.push(alat); return false; }
    if (!windows(os) && !tiruan && !adaCurl && !(alat === "uv" && adaWget)) {
      lapor.gagal(`${label} tidak ditemukan dan curl tidak ada — pasang curl lalu: ${p.tampil}`); hasil.gagal.push(alat); return false;
    }
    lapor.info(`${label} tidak ditemukan — memasang otomatis dari ${p.url}`);
    lapor.info(`perintah resmi: ${p.tampil}`);
    log(`${alat}\t${os}\t${p.cmd} ${p.args.join(" ")}`);
    const r = tiruan
      ? jalankan(tiruan, [], { stdio: "inherit", timeout: 600_000 })
      : jalankan(p.cmd, p.args, { stdio: "inherit", timeout: 600_000 });
    if (r.error || r.status !== 0) {
      const sebab = r.error ? r.error.message : `kode keluar ${r.status}`;
      lapor.gagal(`pemasangan ${label} gagal (${sebab}) — jalankan manual: ${p.tampil}`);
      hasil.gagal.push(alat);
      return false;
    }
    hasil.dipasang.push(alat);
    return true;
  };

  const periksa = (alat, bins, label, manual) => {
    let ada = cariAlat(bins[0], { os, home, override: alat === "claude" ? env.RUDISONE_CLAUDE_BIN : undefined });
    if (ada) lapor.ok(`${label}: ${ada.versi}${ada.lokasi === "path" ? "" : ` (${ada.lokasi})`} — sudah ada, tidak dipasang ulang`);
    else if (!pasang(alat, label)) return;
    else ada = null;
    // konfirmasi sesudah pemasangan (juga untuk yang sudah ada: tiap biner dilaporkan versinya)
    for (const b of bins) {
      const a = cariAlat(b, { os, home, override: b === "claude" ? env.RUDISONE_CLAUDE_BIN : undefined });
      if (!a) { lapor.gagal(ada === null ? `${b} --version gagal sesudah pemasangan — ${manual}` : `${b} tidak ditemukan padahal ${bins[0]} ada (instalasi tidak lengkap) — ${manual}`); hasil.gagal.push(b); continue; }
      if (a.lokasi !== "path") { bukaUlang.push(a.lokasi); }
      if (b !== bins[0] || !ada) lapor.ok(`${b} --version → ${a.versi}${a.lokasi === "path" ? "" : ` (${a.lokasi}; belum di PATH)`}`);
      if (b === "claude" && versiMinClaude && banding(a.versi, versiMinClaude) < 0) {
        lapor.info(`claude ${a.versi} < ${versiMinClaude} (syarat backend sesi cli) — perbarui sendiri: claude update (installer tidak memperbarui yang sudah ada)`);
      }
    }
  };

  periksa("uv", ["uv", "uvx"], "uv/uvx", `manual: ${perintahPasang("uv", os).tampil}`);
  periksa("claude", ["claude"], "Claude Code CLI", `manual: ${perintahPasang("claude", os).tampil}`);

  if (bukaUlang.length) {
    const dir = path.dirname(bukaUlang[0]);
    // langkah install berikutnya (mis. perkakas SDLC yang memanggil `uvx`) harus ikut menemukannya di proses ini
    if (!(process.env.PATH ?? "").split(path.delimiter).includes(dir)) process.env.PATH = `${dir}${path.delimiter}${process.env.PATH ?? ""}`;
    lapor.info(`${dir} belum ada di PATH shell ini — buka ulang terminal; bila tetap tidak ditemukan, tambahkan ke PATH${windows(os) ? "" : ` (mis. export PATH="${dir}:$PATH" di profil shell)`}`);
  }
  return hasil;
}
