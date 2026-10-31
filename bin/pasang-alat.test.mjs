// Uji pemasangan otomatis uv/uvx & Claude Code CLI oleh install.mjs — TANPA unduhan sungguhan: pemasang tiruan
// (RUDISONE_PEMASANG_UV/_CLAUDE) menggantikan perintah curl/irm; perintah resmi yang seharusnya jalan dicatat (RUDISONE_PEMASANG_LOG).
// OS lain disimulasikan lewat parameter os / RUDISONE_OS; jalur PowerShell diuji sebagai string perintah (tidak ada
// PowerShell di macOS/Linux). Jalan di macOS, Linux, Windows: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { banding, cariAlat, pastikanAlat, perintahPasang } from "./lib/pasang-alat.mjs";
import { palsu } from "./lib/uji-util.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SINI, "..");
const WIN = process.platform === "win32";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pasang-alat-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const baru = (nm) => { const d = path.join(tmp, `${nm}-${++n}`); fs.mkdirSync(d, { recursive: true }); return d; };

/** Biner palsu `bin` yang mencetak `versi` di folder `dir` (nama menurut OS logis; di Windows asli selalu .cmd). */
function biner(dir, bin, versi, osLogis = process.platform) {
  fs.mkdirSync(dir, { recursive: true });
  if (WIN) { fs.writeFileSync(path.join(dir, `${bin}.cmd`), `@echo off\r\necho ${versi}\r\n`); return; }
  const f = path.join(dir, osLogis === "win32" ? `${bin}.exe` : bin);
  fs.writeFileSync(f, `#!/bin/sh\necho "${versi}"\n`, { mode: 0o755 });
}
/** Pemasang tiruan: menaruh biner di <home>/.local/bin (seperti pemasang resmi) dan meninggalkan jejak; keluar `kode`. */
function pemasangTiruan(dir, nm, { home, bins, versi, osLogis, kode = 0 }) {
  const jejak = path.join(dir, `${nm}.jejak`);
  const kodeJs = `import fs from "node:fs";\nfs.appendFileSync(${JSON.stringify(jejak)}, "jalan\\n");\n`
    + (kode === 0 ? `fs.mkdirSync(${JSON.stringify(path.join(home, ".local", "bin"))}, { recursive: true });\n` : "")
    + `process.exit(${kode});\n`;
  const exe = palsu(dir, nm, kodeJs);
  return { exe, jejak, pasangBiner: () => { for (const b of bins) biner(path.join(home, ".local", "bin"), b, versi(b), osLogis); } };
}
/** Pemasang tiruan yang benar-benar menaruh biner: biner dibuat lebih dulu oleh pasangBiner di dalam skrip pemasang. */
function pemasangDenganBiner(dir, nm, { home, bins, versi, osLogis }) {
  const sisip = {};
  for (const b of bins) {
    const ext = WIN ? ".cmd" : osLogis === "win32" ? ".exe" : "";
    const isi = WIN ? `@echo off\r\necho ${versi(b)}\r\n` : `#!/bin/sh\necho "${versi(b)}"\n`;
    sisip[`${b}${ext}`] = isi;
  }
  const jejak = path.join(dir, `${nm}.jejak`);
  const kodeJs = `import fs from "node:fs";\nimport path from "node:path";\nconst d = ${JSON.stringify(path.join(home, ".local", "bin"))};\n`
    + `fs.mkdirSync(d, { recursive: true });\nfs.appendFileSync(${JSON.stringify(jejak)}, "jalan\\n");\n`
    + `for (const [f, isi] of Object.entries(${JSON.stringify(sisip)})) fs.writeFileSync(path.join(d, f), isi, { mode: 0o755 });\n`;
  return { exe: palsu(dir, nm, kodeJs), jejak };
}
const ada = (f) => fs.existsSync(f);
const catat = () => { const m = { ok: [], gagal: [], info: [] }; return { m, lapor: { ok: (t) => m.ok.push(t), gagal: (t) => m.gagal.push(t), info: (t) => m.info.push(t) } }; };
/** env tanpa uv/claude di PATH (PATH hanya berisi dir kosong) */
const envKosong = (extra = {}) => ({ ...process.env, PATH: baru("path-kosong"), ...extra });

test("perintahPasang: perintah resmi per OS (bash di macOS/Linux/WSL, PowerShell di Windows)", () => {
  for (const o of ["darwin", "linux"]) {
    const uv = perintahPasang("uv", o), cl = perintahPasang("claude", o);
    assert.equal(uv.tampil, "curl -LsSf https://astral.sh/uv/install.sh | sh");
    assert.equal(cl.tampil, "curl -fsSL https://claude.ai/install.sh | bash");
    assert.equal(uv.cmd, "bash"); assert.match(uv.args[1], /pipefail; curl -LsSf https:\/\/astral\.sh\/uv\/install\.sh \| sh$/);
    assert.match(cl.args[1], /pipefail; curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash$/);
  }
  assert.equal(perintahPasang("uv", "linux", { adaCurl: false, adaWget: true }).tampil, "wget -qO- https://astral.sh/uv/install.sh | sh");
  const uvw = perintahPasang("uv", "win32"), clw = perintahPasang("claude", "win32");
  assert.equal(uvw.tampil, 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"');
  assert.equal(clw.tampil, "irm https://claude.ai/install.ps1 | iex");
  for (const p of [uvw, clw]) { assert.equal(p.cmd, "powershell"); assert.deepEqual(p.args.slice(0, 4), ["-NoProfile", "-ExecutionPolicy", "ByPass", "-Command"]); }
  assert.equal(clw.args[4], "irm https://claude.ai/install.ps1 | iex");
  assert.equal(perintahPasang("uv", "linux", { adaCurl: false, adaWget: false }).tampil, "curl -LsSf https://astral.sh/uv/install.sh | sh");
  assert.throws(() => perintahPasang("brew", "linux"));
});

test("banding versi", () => {
  assert.equal(banding("2.1.281 (Claude Code)", "2.1.300"), -1);
  assert.equal(banding("2.1.300", "2.1.300"), 0);
  assert.equal(banding("2.2.0 (Claude Code)", "2.1.300"), 1);
});

for (const o of ["darwin", "linux", "wsl", "win32"]) {
  // OS asing bagi mesin ini hanya bisa disimulasikan di POSIX (biner palsu .exe tidak jalan di Windows asli)
  test(`pastikanAlat (${o}): uv/uvx & claude belum ada → dipasang otomatis dari URL resmi, versi dikonfirmasi`, { skip: WIN && o !== "win32" }, () => {
    const home = baru("home"), dir = baru("alat");
    const logis = o === "wsl" ? "linux" : o;
    const versi = (b) => ({ uv: "uv 9.9.9 (palsu)", uvx: "uvx 9.9.9 (palsu)", claude: "9.9.9 (Claude Code)" })[b];
    const uv = pemasangDenganBiner(dir, "pasang-uv", { home, bins: ["uv", "uvx"], versi, osLogis: logis });
    const cl = pemasangDenganBiner(dir, "pasang-claude", { home, bins: ["claude"], versi, osLogis: logis });
    const log = path.join(dir, "perintah.log");
    const { m, lapor } = catat();
    const env = envKosong({ RUDISONE_PEMASANG_UV: uv.exe, RUDISONE_PEMASANG_CLAUDE: cl.exe, RUDISONE_PEMASANG_LOG: log, RUDISONE_CLAUDE_BIN: "" });
    const asli = process.env.PATH; process.env.PATH = env.PATH;
    let h;
    try { h = pastikanAlat({ home, os: o, env, lapor, versiMinClaude: "2.1.300" }); } finally { process.env.PATH = asli; }
    assert.deepEqual(h.dipasang, ["uv", "claude"]); assert.deepEqual(h.gagal, []);
    assert.equal(fs.readFileSync(uv.jejak, "utf8"), "jalan\n"); assert.equal(fs.readFileSync(cl.jejak, "utf8"), "jalan\n");
    // URL dicetak SEBELUM mengunduh, dan perintah resmi yang sesuai OS dicatat
    const sumberUv = logis === "win32" ? "https://astral.sh/uv/install.ps1" : "https://astral.sh/uv/install.sh";
    const sumberCl = logis === "win32" ? "https://claude.ai/install.ps1" : "https://claude.ai/install.sh";
    assert.ok(m.info.some((t) => t.includes(`memasang otomatis dari ${sumberUv}`)), m.info.join("\n"));
    assert.ok(m.info.some((t) => t.includes(`memasang otomatis dari ${sumberCl}`)), m.info.join("\n"));
    const lg = fs.readFileSync(log, "utf8").trim().split("\n");
    assert.equal(lg.length, 2);
    assert.match(lg[0], logis === "win32" ? /^uv\twin32\tpowershell .*irm https:\/\/astral\.sh\/uv\/install\.ps1 \| iex/ : /^uv\t\w+\tbash .*curl -LsSf https:\/\/astral\.sh\/uv\/install\.sh \| sh/);
    assert.match(lg[1], logis === "win32" ? /^claude\twin32\tpowershell .*irm https:\/\/claude\.ai\/install\.ps1 \| iex/ : /^claude\t\w+\tbash .*curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash/);
    // konfirmasi versi (uv, uvx, claude) dilaporkan; belum di PATH → diberi tahu
    const ok = m.ok.join("\n");
    assert.match(ok, /uv --version → uv 9\.9\.9/); assert.match(ok, /uvx --version → uvx 9\.9\.9/); assert.match(ok, /claude --version → 9\.9\.9 \(Claude Code\)/);
    assert.ok(m.info.some((t) => /belum ada di PATH shell ini — buka ulang terminal/.test(t)), m.info.join("\n"));
    assert.deepEqual(m.gagal, []);
  });
}

test("pastikanAlat: idempoten — yang sudah ada tidak dipasang ulang (tanpa unduhan)", () => {
  const home = baru("home"), dir = baru("alat"), bin = baru("bin");
  for (const b of ["uv", "uvx"]) biner(bin, b, `${b} 1.0.0`);
  biner(bin, "claude", "2.5.0 (Claude Code)");
  const uv = pemasangDenganBiner(dir, "pasang-uv", { home, bins: ["uv"], versi: () => "x", osLogis: process.platform });
  const cl = pemasangDenganBiner(dir, "pasang-claude", { home, bins: ["claude"], versi: () => "x", osLogis: process.platform });
  const { m, lapor } = catat();
  const env = { ...process.env, PATH: bin + path.delimiter + baru("kosong"), RUDISONE_PEMASANG_UV: uv.exe, RUDISONE_PEMASANG_CLAUDE: cl.exe, RUDISONE_CLAUDE_BIN: "" };
  const asli = process.env.PATH; process.env.PATH = env.PATH;
  let h; try { h = pastikanAlat({ home, os: process.platform, env, lapor, versiMinClaude: "2.1.300" }); } finally { process.env.PATH = asli; }
  assert.deepEqual(h, { dipasang: [], gagal: [] });
  assert.ok(!ada(uv.jejak) && !ada(cl.jejak), "pemasang tidak boleh dipanggil");
  assert.match(m.ok.join("\n"), /uv\/uvx: uv 1\.0\.0 .*sudah ada, tidak dipasang ulang/);
  assert.match(m.ok.join("\n"), /Claude Code CLI: 2\.5\.0 .*sudah ada, tidak dipasang ulang/);
  assert.deepEqual(m.gagal, []);
  assert.ok(!m.info.some((t) => /memasang otomatis/.test(t)));
});

test("pastikanAlat: biner ada di ~/.local/bin tetapi belum di PATH → dikenali (tidak dipasang ulang) + saran buka ulang terminal", () => {
  const home = baru("home"), dir = baru("alat");
  for (const b of ["uv", "uvx", "claude"]) biner(path.join(home, ".local", "bin"), b, `${b} 3.0.0`);
  const uv = pemasangDenganBiner(dir, "pasang-uv", { home, bins: ["uv"], versi: () => "x", osLogis: process.platform });
  const { m, lapor } = catat();
  const env = envKosong({ RUDISONE_PEMASANG_UV: uv.exe, RUDISONE_PEMASANG_CLAUDE: uv.exe, RUDISONE_CLAUDE_BIN: "" });
  const asli = process.env.PATH; process.env.PATH = env.PATH;
  let h, pathSesudah; try { h = pastikanAlat({ home, os: process.platform, env, lapor }); pathSesudah = process.env.PATH; } finally { process.env.PATH = asli; }
  assert.deepEqual(h, { dipasang: [], gagal: [] });
  assert.ok(pathSesudah.split(path.delimiter).includes(path.join(home, ".local", "bin")), "PATH proses diperpanjang agar langkah berikutnya (uvx) menemukannya");
  assert.ok(!ada(uv.jejak));
  assert.ok(m.info.some((t) => /belum ada di PATH shell ini/.test(t)));
});

test("pastikanAlat: pemasang gagal → peringatan + perintah manual, tidak melempar; yang lain tetap lanjut", () => {
  const home = baru("home"), dir = baru("alat");
  const versi = (b) => `${b} 7.0.0`;
  const gagal = pemasangTiruan(dir, "pasang-uv", { home, bins: [], versi, kode: 3 });
  const cl = pemasangDenganBiner(dir, "pasang-claude", { home, bins: ["claude"], versi, osLogis: process.platform });
  const { m, lapor } = catat();
  const env = envKosong({ RUDISONE_PEMASANG_UV: gagal.exe, RUDISONE_PEMASANG_CLAUDE: cl.exe, RUDISONE_CLAUDE_BIN: "" });
  const asli = process.env.PATH; process.env.PATH = env.PATH;
  let h; try { h = pastikanAlat({ home, os: "linux", env, lapor }); } finally { process.env.PATH = asli; }
  assert.deepEqual(h.dipasang, ["claude"]); assert.deepEqual(h.gagal, ["uv"]);
  assert.ok(m.gagal.some((t) => /pemasangan uv\/uvx gagal \(kode keluar 3\) — jalankan manual: curl -LsSf https:\/\/astral\.sh\/uv\/install\.sh \| sh/.test(t)), m.gagal.join("\n"));
  assert.match(m.ok.join("\n"), /claude --version → claude 7\.0\.0/);
});

test("pastikanAlat: pemasang 'sukses' tetapi biner tak ditemukan → peringatan + manual", () => {
  const home = baru("home"), dir = baru("alat");
  const diam = pemasangTiruan(dir, "pasang-diam", { home, bins: [], versi: () => "x", kode: 0 });
  const { m, lapor } = catat();
  const env = envKosong({ RUDISONE_PEMASANG_UV: diam.exe, RUDISONE_PEMASANG_CLAUDE: diam.exe, RUDISONE_CLAUDE_BIN: "" });
  const asli = process.env.PATH; process.env.PATH = env.PATH;
  let h; try { h = pastikanAlat({ home, os: "linux", env, lapor }); } finally { process.env.PATH = asli; }
  assert.deepEqual(h.gagal.sort(), ["claude", "uv", "uvx"]);
  assert.ok(m.gagal.some((t) => /uv --version gagal sesudah pemasangan — manual: curl/.test(t)), m.gagal.join("\n"));
  assert.ok(m.gagal.some((t) => /claude --version gagal sesudah pemasangan — manual: curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash/.test(t)));
});

test("pastikanAlat: Linux tanpa curl/wget → peringatan + perintah manual, tanpa mencoba", { skip: WIN }, () => {
  const home = baru("home");
  const { m, lapor } = catat();
  const asli = process.env.PATH; process.env.PATH = baru("kosong");
  let h; try { h = pastikanAlat({ home, os: "linux", env: { ...process.env, RUDISONE_CLAUDE_BIN: "" }, lapor }); } finally { process.env.PATH = asli; }
  assert.deepEqual(h.gagal.sort(), ["claude", "uv"]);
  assert.ok(m.gagal.some((t) => /curl tidak ada — pasang curl lalu: curl -LsSf/.test(t)), m.gagal.join("\n"));
});

test("pastikanAlat: tanpaUnduh (--tanpa-unduh) → tidak mengunduh, peringatan + perintah manual", () => {
  const home = baru("home"), dir = baru("alat");
  const uv = pemasangDenganBiner(dir, "pasang-uv", { home, bins: ["uv"], versi: () => "x", osLogis: process.platform });
  const { m, lapor } = catat();
  const env = envKosong({ RUDISONE_PEMASANG_UV: uv.exe, RUDISONE_PEMASANG_CLAUDE: uv.exe, RUDISONE_CLAUDE_BIN: "" });
  const asli = process.env.PATH; process.env.PATH = env.PATH;
  let h; try { h = pastikanAlat({ home, os: "win32", tanpaUnduh: true, env, lapor }); } finally { process.env.PATH = asli; }
  assert.deepEqual(h.dipasang, []); assert.deepEqual(h.gagal.sort(), ["claude", "uv"]);
  assert.ok(!ada(uv.jejak));
  assert.ok(m.gagal.some((t) => /--tanpa-unduh\)\. Manual: powershell -ExecutionPolicy ByPass/.test(t)), m.gagal.join("\n"));
  assert.ok(m.gagal.some((t) => /Manual: irm https:\/\/claude\.ai\/install\.ps1 \| iex/.test(t)));
});

test("claude lama (< 2.1.300) → hanya saran `claude update`, tidak dipasang/diperbarui", () => {
  const home = baru("home"), bin = baru("bin");
  for (const b of ["uv", "uvx"]) biner(bin, b, `${b} 1.0.0`);
  biner(bin, "claude", "2.1.281 (Claude Code)");
  const { m, lapor } = catat();
  const env = { ...process.env, PATH: bin, RUDISONE_CLAUDE_BIN: "" };
  const asli = process.env.PATH; process.env.PATH = bin;
  let h; try { h = pastikanAlat({ home, os: process.platform, env, lapor, versiMinClaude: "2.1.300" }); } finally { process.env.PATH = asli; }
  assert.deepEqual(h, { dipasang: [], gagal: [] });
  assert.ok(m.info.some((t) => /2\.1\.281.*< 2\.1\.300.*claude update/.test(t)));
  assert.deepEqual(m.gagal, []);
});

test("cariAlat: tidak ada di PATH maupun ~/.local/bin → null", () => {
  const asli = process.env.PATH; process.env.PATH = baru("kosong");
  try { assert.equal(cariAlat("uv", { os: "linux", home: baru("home") }), null); } finally { process.env.PATH = asli; }
});

test("install.mjs end-to-end (HOME sementara, pemasang tiruan): memasang uv & claude, lalu idempoten di jalan kedua", { skip: WIN }, () => {
  const home = baru("home"), dir = baru("alat"), pathKosong = baru("path");
  // PATH minimal: node dipanggil lewat process.execPath; git/bash dari sistem agar langkah lain install.mjs jalan
  const sistem = ["/usr/bin", "/bin"].join(path.delimiter);
  const versi = (b) => ({ uv: "uv 8.8.8 (palsu)", uvx: "uvx 8.8.8 (palsu)", claude: "8.8.8 (Claude Code)" })[b];
  const uv = pemasangDenganBiner(dir, "pasang-uv", { home, bins: ["uv", "uvx"], versi, osLogis: process.platform });
  const cl = pemasangDenganBiner(dir, "pasang-claude", { home, bins: ["claude"], versi, osLogis: process.platform });
  const env = { ...process.env, HOME: home, USERPROFILE: home, PATH: pathKosong + path.delimiter + sistem, RUDISONE_INSTALL_PAKSA: "1",
    RUDISONE_SESI: path.join(dir, "sesi.json"), RUDISONE_RAHASIA_DIR: path.join(dir, "rahasia"), RUDISONE_CLAUDE_BIN: "",
    RUDISONE_PEMASANG_UV: uv.exe, RUDISONE_PEMASANG_CLAUDE: cl.exe, RUDISONE_TANPA_UNDUH: "" };
  const jalan = (args) => spawnSync(process.execPath, [path.join(REPO, "install.mjs"), "--tanpa-perkakas", "--tanpa-hook", ...args], { encoding: "utf8", env });
  if (spawnSync("uv", ["--version"], { env, stdio: "ignore" }).status === 0) return;   // uv sistem di /usr/bin: uji tidak bermakna
  const r1 = jalan([]);
  assert.match(r1.stdout, /\[\.\.\]\s+uv\/uvx tidak ditemukan — memasang otomatis dari https:\/\/astral\.sh\/uv\/install\.sh/, r1.stdout);
  assert.match(r1.stdout, /\[\.\.\]\s+Claude Code CLI tidak ditemukan — memasang otomatis dari https:\/\/claude\.ai\/install\.sh/);
  assert.match(r1.stdout, /\[ok\]\s+claude --version → 8\.8\.8 \(Claude Code\)/);
  assert.match(r1.stdout, /\[ok\]\s+uvx --version → uvx 8\.8\.8/);
  fs.rmSync(uv.jejak); fs.rmSync(cl.jejak);
  const r2 = jalan([]);
  assert.match(r2.stdout, /sudah ada, tidak dipasang ulang/);
  assert.ok(!ada(uv.jejak) && !ada(cl.jejak), "jalan kedua tidak boleh memasang ulang");
  // --tanpa-unduh: tidak memasang walau belum ada
  fs.rmSync(path.join(home, ".local"), { recursive: true });
  const r3 = jalan(["--tanpa-unduh"]);
  assert.match(r3.stdout, /\[!!\]\s+uv\/uvx tidak ditemukan — pemasangan dilewati \(--tanpa-unduh\)\. Manual: curl -LsSf/);
  assert.ok(!ada(uv.jejak) && !ada(cl.jejak));
});
