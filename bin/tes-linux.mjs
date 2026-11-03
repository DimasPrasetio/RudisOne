#!/usr/bin/env node
// Tes RudisOne di kontainer Linux (Docker) — untuk tes yang di OS pengembang dilewati karena khusus Linux/macOS
// (pemasangan uv/claude per OS, curl/wget, symlink peran, firmlink macOS …) dan untuk memeriksa suite penuh di Linux.
//
//   bin/tes-linux.sh [--semua] [--image <nama:tag>] [--tanpa-mulai] [--tanpa-unduh] [<berkas.test.mjs> …]
//
// Bawaan (tanpa berkas): bin/pasang-alat.test.mjs, bin/peran.test.mjs, bin/kebijakan.test.mjs — tes yang punya cabang khusus OS.
// --semua = seluruh suite (bin/*.test.mjs kantor/*.test.mjs uji/suite/*.test.mjs). Repo dipasang read-only; tes berjalan di
// salinan (/work) yang di-commit ulang di dalam kontainer — checkout asli tidak tersentuh.
//
// Prasyarat otomatis, berurutan (satu pemeriksaan "sudah ada?" per alat; yang belum ada diperlakukan sesuai jenisnya):
//   1. docker terpasang?  Tidak → TIDAK dipasang diam-diam (Docker Desktop butuh GUI/hak admin): satu perintah baku dicetak, exit 3.
//   2. daemon jalan?      Tidak → `docker desktop start` (tanpa hak admin; Docker Desktop ≥ 4.37) lalu ditunggu; gagal → perintah, exit 3.
//   3. image ada?         Tidak → `docker pull node:<mayor Node ini>-bookworm` (image resmi Docker Hub; --tanpa-unduh menolaknya).
// Exit: 0 lulus · 1 ada tes gagal · 3 prasyarat belum terpenuhi (tes TIDAK dijalankan) · 2 pemakaian salah.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jalankan, osLogis, tidur } from "./lib/platform.mjs";

const INI = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(INI), "..");
export const BERKAS_BAWAAN = ["bin/pasang-alat.test.mjs", "bin/peran.test.mjs", "bin/kebijakan.test.mjs"];
export const BERKAS_SEMUA = ["bin/*.test.mjs", "kantor/*.test.mjs", "uji/suite/*.test.mjs"];
export const imageBawaan = (mayor = process.versions.node.split(".")[0]) => `node:${mayor}-bookworm`;

/** Perintah baku (satu baris) memasang Docker di `os` — hanya dicetak untuk pengguna, tidak pernah dijalankan. */
export function perintahPasangDocker(os = osLogis()) {
  if (os === "win32") return "winget install -e --id Docker.DockerDesktop";
  if (os === "darwin") return "brew install --cask docker";
  return "lihat https://docs.docker.com/engine/install/ (butuh hak admin)";
}

/** Skrip di dalam kontainer: salin repo (tanpa .git/node_modules), commit, lalu jalankan node --test. */
export const SKRIP_KONTAINER = `set -u
mkdir -p /work && cd /src
tar cf - --exclude=./.git --exclude=./node_modules --exclude=./.claude/worktrees . | tar xf - -C /work
cd /work
git init -q -b main && git config user.email u@contoh.test && git config user.name u && git config commit.gpgsign false
git add -A >/dev/null 2>&1 && git commit -q -m salinan
echo "tes-linux: node $(node --version) | $(uname -sr) | git $(git --version | cut -d' ' -f3)"
exec node --test "$@"`;

/**
 * Pastikan Docker siap. `d` = { jalankan(cmd,args)→{status,stdout}, tidur(ms), os, mulai, unduh, image, lapor, tunggu_ms }.
 * → { siap: true } | { siap: false, sebab, perintah } (perintah = satu baris untuk diketik pengguna).
 */
export function pastikanDocker(d) {
  const { jalankan: j, lapor, image } = d;
  const ok = (r) => !r.error && r.status === 0;
  if (!ok(j("docker", ["--version"]))) {
    const perintah = perintahPasangDocker(d.os);
    lapor(`docker tidak ditemukan — tidak dipasang otomatis (butuh GUI/hak admin). Pasang sekali: ${perintah}`);
    return { siap: false, sebab: "docker belum terpasang", perintah };
  }
  if (!ok(j("docker", ["info", "--format", "{{.ServerVersion}}"]))) {
    if (!d.mulai) return { siap: false, sebab: "daemon Docker tidak jalan (--tanpa-mulai)", perintah: "docker desktop start" };
    lapor("daemon Docker belum jalan — menjalankan: docker desktop start (tanpa hak admin)");
    j("docker", ["desktop", "start"]);
    const batas = Date.now() + (d.tunggu_ms ?? 180_000);
    let jalan = false;
    while (Date.now() < batas) {
      if (ok(j("docker", ["info", "--format", "{{.ServerVersion}}"]))) { jalan = true; break; }
      d.tidur(5000);
    }
    if (!jalan) return { siap: false, sebab: "Docker Desktop tidak siap dalam waktu tunggu", perintah: "docker desktop start" };
  }
  if (!ok(j("docker", ["image", "inspect", image]))) {
    if (!d.unduh) return { siap: false, sebab: `image ${image} belum ada (--tanpa-unduh)`, perintah: `docker pull ${image}` };
    lapor(`image ${image} belum ada — mengunduh (image resmi Docker Hub)`);
    if (!ok(j("docker", ["pull", image]))) return { siap: false, sebab: `docker pull ${image} gagal`, perintah: `docker pull ${image}` };
  }
  return { siap: true };
}

export function uraiArgumen(argv) {
  const o = { semua: false, image: imageBawaan(), mulai: true, unduh: true, berkas: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--semua") o.semua = true;
    else if (a === "--image") o.image = argv[++i] ?? "";
    else if (a === "--tanpa-mulai") o.mulai = false;
    else if (a === "--tanpa-unduh") o.unduh = false;
    else if (a.startsWith("--")) throw new Error(`opsi tidak dikenal: ${a}`);
    else o.berkas.push(a);
  }
  if (!o.image) throw new Error("--image butuh nilai");
  for (const b of o.berkas) if (!/^[\w./*-]+$/.test(b) || b.startsWith("/") || b.includes("..")) throw new Error(`berkas uji tidak valid: ${b}`);
  return o;
}

export function main(argv, { root = ROOT } = {}) {
  let o;
  try { o = uraiArgumen(argv); } catch (e) { console.error(`${e.message}\nPemakaian: bin/tes-linux.sh [--semua] [--image <nama:tag>] [--tanpa-mulai] [--tanpa-unduh] [<berkas.test.mjs> …]`); return 2; }
  const lapor = (t) => console.log(`tes-linux: ${t}`);
  const p = pastikanDocker({ jalankan: (c, a) => jalankan(c, a, { encoding: "utf8", timeout: 600_000, stdio: ["ignore", "pipe", "pipe"] }), tidur, os: osLogis(),
    mulai: o.mulai, unduh: o.unduh, image: o.image, lapor });
  if (!p.siap) {
    console.log(`tes-linux: DILEWATI — ${p.sebab}. Satu perintah untuk diketik: ${p.perintah}`);
    return 3;
  }
  const berkas = o.berkas.length ? o.berkas : o.semua ? BERKAS_SEMUA : BERKAS_BAWAAN;
  const r = spawnSync("docker", ["run", "--rm", "-v", `${path.resolve(root)}:/src:ro`, o.image, "bash", "-c", SKRIP_KONTAINER, "bash", ...berkas],
    { stdio: "inherit", timeout: 1_800_000, windowsHide: true, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  return r.status === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
