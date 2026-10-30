// Uji perkakas resmi dengan repo git palsu (origin bare + HOME sementara). Jalankan: node --test bin/
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deteksiProyek, jenisProyek, normalSumber, periksaAllowlist, rencanaSdd, sumberDiizinkan, tugasEngineeringBerjalan } from "./perkakas.mjs";

const SKRIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "perkakas.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "perkakas-uji-"));
const HOME = path.join(tmp, "home");
const ENV = {
  ...process.env, HOME,
  GIT_AUTHOR_NAME: "Uji", GIT_AUTHOR_EMAIL: "uji@contoh", GIT_COMMITTER_NAME: "Uji", GIT_COMMITTER_EMAIL: "uji@contoh",
  RUDISONE_PERKAKAS_MANIFEST: path.join(tmp, "perkakas.json"),
  RUDISONE_PERKAKAS_STATE: path.join(tmp, "state.json"),
  RUDISONE_REGISTER: path.join(tmp, "register-tugas.md"),
  // Terisolasi dari device: tanpa gitconfig sistem/pengguna (helper kredensial), Keychain & uvx palsu.
  GIT_CONFIG_NOSYSTEM: "1", XDG_CONFIG_HOME: path.join(tmp, "xdg"),
  RUDISONE_KEYCHAIN_BIN: path.join(tmp, "keychain-palsu.sh"), RUDISONE_UVX_BIN: path.join(tmp, "uvx-palsu.sh"),
  // Uji Keychain berjalan sama di macOS dan Linux (Keychain palsu); jalur berkas rahasia diuji terpisah (RUDISONE_OS=linux).
  RUDISONE_OS: "darwin", RUDISONE_RAHASIA_DIR: path.join(tmp, "rahasia"),
};
// Token sungguhan dari lingkungan sesi tidak boleh ikut ke proses uji.
for (const k of ["GL_TOKEN", "GITLAB_TOKEN", "CI_JOB_TOKEN", "GIT_ASKPASS", "SSH_ASKPASS", "RUDIS_MARKETPLACE_URL", "RUDIS_NEUDELA_REPO"]) delete ENV[k];
const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8" });
  assert.equal(r.status, 0, `${cmd} ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const perkakas = (...args) => spawnSync("node", [SKRIP, ...args], { env: ENV, encoding: "utf8" });
const tulis = (p, isi) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, isi); };

// Origin palsu: repo skill (akar repo + paket zip + install.sh) dan repo pustaka.
const kerjaSkill = path.join(tmp, "kerja-skill"), kerjaLib = path.join(tmp, "kerja-lib");
function rilisSkill(isiSkill) {
  const staging = path.join(tmp, "staging");
  fs.rmSync(staging, { recursive: true, force: true });
  tulis(path.join(staging, "rudis-monorepo", "SKILL.md"), isiSkill);
  const paket = path.join(kerjaSkill, "dist", "rudis-monorepo.skill");
  fs.mkdirSync(path.dirname(paket), { recursive: true });
  fs.rmSync(paket, { force: true });
  sh("zip", ["-qr", paket, "rudis-monorepo"], staging);
  tulis(path.join(kerjaSkill, "SKILL.md"), isiSkill);
  sh("git", ["add", "-A"], kerjaSkill);
  sh("git", ["commit", "-qm", `rilis ${isiSkill}`], kerjaSkill);
  sh("git", ["push", "-q", "origin", "main"], kerjaSkill);
}
function commitLib(nama) {
  tulis(path.join(kerjaLib, "modules", `${nama}.md`), nama);
  sh("git", ["add", "-A"], kerjaLib);
  sh("git", ["commit", "-qm", nama], kerjaLib);
  sh("git", ["push", "-q", "origin", "main"], kerjaLib);
}
for (const [kerja, bare] of [[kerjaSkill, "skill.git"], [kerjaLib, "lib.git"]]) {
  sh("git", ["init", "-q", "--bare", "-b", "main", path.join(tmp, bare)]);
  sh("git", ["init", "-q", "-b", "main", kerja]);
  sh("git", ["remote", "add", "origin", path.join(tmp, bare)], kerja);
  tulis(path.join(kerja, ".githooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
}
tulis(path.join(kerjaSkill, "install.sh"), `#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
rm -rf "$HOME/.claude/skills/rudis-monorepo"; mkdir -p "$HOME/.claude/skills"
unzip -q "$DIR/dist/rudis-monorepo.skill" -d "$HOME/.claude/skills"
`);
rilisSkill("versi-1");
commitLib("auth");

tulis(ENV.RUDISONE_PERKAKAS_MANIFEST, JSON.stringify({ perkakas: [
  { id: "rudis-monorepo", jenis: "skill", label: "rudis", repo: path.join(tmp, "skill.git"), lokal: "~/Documents/Neuron/ai-agent/rudis-monorepo",
    paket: "dist/rudis-monorepo.skill", pasang: "install.sh",
    terpasang: "~/.claude/skills/rudis-monorepo", hooks: ".githooks" },
  { id: "rudis-modules", jenis: "pustaka", label: "lib", repo: path.join(tmp, "lib.git"), lokal: "~/Documents/Neuron/ai-agent/rudis-modules",
    hooks: ".githooks" },
] }));
const SKILL = path.join(HOME, "Documents", "Neuron", "ai-agent", "rudis-monorepo"), LIB = path.join(HOME, "Documents", "Neuron", "ai-agent", "rudis-modules");
const TERPASANG = path.join(HOME, ".claude", "skills", "rudis-monorepo", "SKILL.md");
const bukuBesar = (perkakasSel) => tulis(ENV.RUDISONE_REGISTER, `## Aktif

| ID | Tugas | Folder | Divisi | Pemilik | Prioritas | Status | Fase | Kunci | Bergantung | Perkakas | Diperbarui |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-20261024-9 | Fitur kasir | \`~/Documents/kasir\` | Engineering · Tim 1 | Tech Lead · kasir | normal | berjalan | Konstruksi | repo:kasir | — | ${perkakasSel} | 2026-10-24 10:00 |
`);

test("register tugas: tugas Engineering berjalan menunda, kolom Perkakas '—' tidak", () => {
  const kepala = "| ID | Tugas | Divisi | Status | Perkakas |\n|---|---|---|---|---|\n";
  const teks = kepala
    + "| T-20261024-1 | a | Engineering · Tim 1 | berjalan | rudis@abc lib@def |\n"
    + "| T-20261024-2 | b | Engineering · Tim 2 | berjalan | — |\n"
    + "| T-20261024-3 | c | Engineering · Tim 1 | antre | rudis@abc |\n"
    + "| T-20261024-4 | d | IT Operations | berjalan | |\n"
    + "\n| ID | Divisi | Status |\n|---|---|---|\n| T-20261024-5 | Engineering · Tim 3 | ditinjau |\n";
  assert.deepEqual(tugasEngineeringBerjalan(teks), ["T-20261024-1", "T-20261024-5"]);
});

test("jenis proyek dari isi folder", () => {
  const p = path.join(tmp, "proyek");
  fs.mkdirSync(p, { recursive: true });
  assert.equal(jenisProyek(p), "lain");
  fs.mkdirSync(path.join(p, "infra", "deploy"), { recursive: true });
  assert.equal(jenisProyek(p), "rudis-deploy");
  tulis(path.join(p, "modules.lock.json"), "{}");
  assert.equal(jenisProyek(p), "rudis-pustaka");
});

// ---- Mode proyek berbukti (D1–D6 di handoff/T-20261030-4/riset.md §3.1) -------------------------------------
const LOCK = (modul) => JSON.stringify({ lockVersion: 1, preset: null, modules: modul });
/** Proyek fixture: `isi` = { relpath: isi }; git = repo git dengan semua berkas di-add (tanpa commit). */
function proyekFixture(nama, isi, { git = true, abaikan = [] } = {}) {
  const p = path.join(tmp, "mode", nama);
  fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
  for (const [rel, teks] of Object.entries(isi)) tulis(path.join(p, rel), teks);
  if (git) {
    sh("git", ["init", "-q", "-b", "main"], p);
    sh("git", ["add", "-A", "--", ".", ...abaikan.map((f) => `:!${f}`)], p);
  }
  return p;
}
const STANDAR_GO = { "infra/deploy/compose.yml": "x", "apps/api/go.mod": "module app\n", "apps/web/package.json": '{"dependencies":{"react":"19.0.0"}}' };
const deteksi = (p) => deteksiProyek(p, { root: tmp });

test("mode A: lock ter-track, valid, ≥1 modul aktif, backend go — bukti lengkap", () => {
  const p = proyekFixture("a", { ...STANDAR_GO, "modules.lock.json": LOCK({ auth: { version: "1.0.0" }, users: { status: "detached" } }) });
  const h = deteksi(p);
  assert.equal(h.jenis, "rudis-pustaka");
  assert.equal(h.mode, "A");
  assert.equal(h.backend, "go");
  assert.ok(h.bukti.includes("modules.lock.json: ada, di-track git, JSON valid, 1 modul aktif, 1 detached"), h.bukti.join("\n"));
  assert.ok(h.bukti.includes("backend: go dari apps/api/go.mod"));
  assert.ok(h.bukti.includes("infra/deploy: ada"));
  assert.deepEqual(h.kartu, { ada: false });
});

test("mode B: NestJS standar tanpa lock, dan lock pada backend non-Go (pustaka hanya Go)", () => {
  const nest = { "infra/deploy/compose.yml": "x", "apps/api/package.json": '{"dependencies":{"@nestjs/core":"10"}}', "apps/web/package.json": "{}" };
  let h = deteksi(proyekFixture("b", nest));
  assert.equal(h.jenis, "rudis-deploy");
  assert.equal(h.mode, "B");
  assert.equal(h.backend, "node");
  h = deteksi(proyekFixture("b-lock", { ...nest, "modules.lock.json": LOCK({ "ui-kit": {} }) }));
  assert.equal(h.mode, "B");
  assert.ok(h.bukti.some((b) => /pustaka hanya Go/.test(b)), h.bukti.join("\n"));
  for (const [berkas, be] of [["composer.json", "php"], ["pom.xml", "java"], ["App.csproj", "dotnet"], ["requirements.txt", "python"], ["package.json", "lain"]]) {
    const r = deteksi(proyekFixture(`b-${be}`, { [berkas]: "{}" }, { git: false }));
    assert.equal(r.backend, be, berkas);
    assert.equal(r.mode, "B");
    assert.equal(r.jenis, "lain");
  }
});

test("D1: folder tidak ada → galat (exit 3, stderr), bukan `lain` diam-diam", () => {
  assert.throws(() => deteksi(path.join(tmp, "mode", "salah-ketik")), { code: "ENOENT" });
  const r = perkakas("proyek", path.join(tmp, "mode", "salah-ketik"));
  assert.equal(r.status, 3);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /folder tidak ada/);
});

test("D2: proyek baru (folder kosong) → B tanpa kartu; mode A untuk proyek baru diputuskan di kartu", () => {
  const h = deteksi(proyekFixture("d2", {}, { git: false }));
  assert.equal(h.jenis, "lain");
  assert.equal(h.mode, "B");
  assert.equal(h.backend, "-");
});

test("D3: scaffold standar + go tanpa lock → ragu", () => {
  const h = deteksi(proyekFixture("d3", STANDAR_GO));
  assert.equal(h.jenis, "rudis-deploy");
  assert.equal(h.mode, "ragu");
  assert.ok(h.bukti.some((b) => /^ragu: .*\(D3\)/.test(b)), h.bukti.join("\n"));
});

test("D4: semua modul detached (atau lock kosong) → ragu", () => {
  let h = deteksi(proyekFixture("d4", { ...STANDAR_GO, "modules.lock.json": LOCK({ auth: { status: "detached" } }) }));
  assert.equal(h.mode, "ragu");
  assert.ok(h.bukti.some((b) => /\(D4\)/.test(b)));
  h = deteksi(proyekFixture("d4-kosong", { ...STANDAR_GO, "modules.lock.json": "{}" }));
  assert.equal(h.mode, "ragu");
});

test("D5: beberapa app dengan backend berbeda → ragu; web React tidak dihitung backend", () => {
  const h = deteksi(proyekFixture("d5", { ...STANDAR_GO, "modules.lock.json": LOCK({ auth: {} }),
    "apps/worker/package.json": '{"dependencies":{"express":"4"}}' }));
  assert.equal(h.mode, "ragu");
  assert.ok(h.bukti.includes("app: apps/worker → node (package.json (express))"), h.bukti.join("\n"));
  assert.ok(h.bukti.some((b) => /beberapa backend: go, node \(D5\)/.test(b)));
  const sub = deteksi(proyekFixture("d5-sub", { "layanan-a/go.mod": "module a", "layanan-b/composer.json": "{}", "layanan-b/package.json": '{"dependencies":{"express":"4"}}' }, { git: false }));
  assert.equal(sub.mode, "ragu");
});

test("D6: lock tidak di-track, rusak, atau di luar repo git → ragu", () => {
  const isi = { ...STANDAR_GO, "modules.lock.json": LOCK({ auth: {} }) };
  let h = deteksi(proyekFixture("d6-track", isi, { abaikan: ["modules.lock.json"] }));
  assert.equal(h.mode, "ragu");
  assert.ok(h.bukti.some((b) => /TIDAK di-track git/.test(b)));
  h = deteksi(proyekFixture("d6-rusak", { ...isi, "modules.lock.json": "{rusak" }));
  assert.equal(h.mode, "ragu");
  assert.ok(h.bukti.some((b) => /JSON rusak/.test(b)));
  h = deteksi(proyekFixture("d6-nongit", isi, { git: false }));
  assert.equal(h.mode, "ragu");
  assert.ok(h.bukti.some((b) => /lock di luar repo git \(D6\)/.test(b)));
});

test("artefak RUDIS: docs/trace-reports/ belum di-gitignore → bukti peringatan; kartu terbaca", () => {
  const p = proyekFixture("artefak", { ...STANDAR_GO, "modules.lock.json": LOCK({ auth: {} }), ".rudis/x": "", "specs/001-a/spec.md": "",
    ".rudisone/kartu-proyek.md": "---\nmode: A\nmode_mesin: A\noverride: -\n---\n# Kartu\n" });
  let h = deteksi(p);
  assert.ok(h.bukti.includes("peringatan: docs/trace-reports/ atau docs/test-reports/ belum di-gitignore"));
  assert.ok(h.bukti.includes("specs/: ada (1 folder)"));
  assert.equal(h.kartu.mode, "A");
  tulis(path.join(p, ".gitignore"), "docs/trace-reports/\n");
  assert.ok(deteksiProyek(p).bukti.some((b) => /test-reports/.test(b)));   // test-reports juga wajib
  tulis(path.join(p, ".gitignore"), "docs/trace-reports/\ndocs/test-reports/\n");
  h = deteksi(p);
  assert.ok(!h.bukti.some((b) => /trace-reports/.test(b)));
});

test("CLI proyek: baris pertama jenis lama, lalu mode/backend/bukti/kartu; --json", () => {
  const p = proyekFixture("cli", { ...STANDAR_GO, "modules.lock.json": LOCK({ auth: {} }) });
  const r = perkakas("proyek", p);
  assert.equal(r.status, 0, r.stderr);
  const baris = r.stdout.trim().split("\n");
  assert.equal(baris[0], "rudis-pustaka");
  assert.equal(baris[1], "mode-mesin: A");
  assert.equal(baris[2], "backend: go");
  assert.ok(baris.slice(3, -1).every((b) => b.startsWith("bukti: ")));
  assert.match(baris.at(-1), /^kartu: tidak ada$/);
  const j = JSON.parse(perkakas("proyek", p, "--json").stdout);
  assert.equal(j.mode, "A");
  assert.equal(j.jenis, "rudis-pustaka");
});

test("cek di device kosong tidak mengubah apa pun", () => {
  const r = perkakas("cek");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /belum ada di ~\/Documents\/Neuron\/ai-agent\/rudis-monorepo/);
  assert.equal(fs.existsSync(SKILL), false);
});

test("siapkan di device kosong: clone keduanya, pasang skill, aktifkan hook", () => {
  const r = perkakas("siapkan");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(TERPASANG, "utf8"), "versi-1");
  assert.ok(fs.existsSync(path.join(LIB, "modules", "auth.md")));
  assert.equal(sh("git", ["-C", SKILL, "config", "core.hooksPath"]), ".githooks");
  const v = perkakas("versi").stdout.trim();
  assert.match(v, /^rudis@[0-9a-f]{7,} lib@[0-9a-f]{7,}$/);
});

test("versi baru ditunda selama tugas Engineering berjalan, lalu --paksa memperbarui", () => {
  rilisSkill("versi-2");
  commitLib("users");
  bukuBesar("rudis@lama lib@lama");
  let r = perkakas("siapkan", "--segera");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /pemasangan ditunda — tugas Engineering berjalan: T-20261024-9/);
  assert.match(r.stdout, /rudis-modules: 1 commit baru, ditunda/);
  assert.equal(fs.readFileSync(TERPASANG, "utf8"), "versi-1");
  assert.equal(fs.existsSync(path.join(LIB, "modules", "users.md")), false);

  bukuBesar("—"); // tugas itu tidak memakai perkakas rudis
  r = perkakas("siapkan", "--segera");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(fs.readFileSync(TERPASANG, "utf8"), "versi-2");
  assert.ok(fs.existsSync(path.join(LIB, "modules", "users.md")));

  rilisSkill("versi-3");
  bukuBesar("rudis@lama");
  r = perkakas("siapkan", "--segera", "--paksa");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(fs.readFileSync(TERPASANG, "utf8"), "versi-3");
});

test("perubahan lokal pengguna tidak pernah ditimpa", () => {
  fs.rmSync(ENV.RUDISONE_REGISTER, { force: true });
  fs.writeFileSync(path.join(LIB, "modules", "auth.md"), "sedang diubah pengguna");
  commitLib("rbac");
  const r = perkakas("siapkan", "--segera");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /perubahan lokal belum di-commit — tidak ditarik/);
  assert.equal(fs.readFileSync(path.join(LIB, "modules", "auth.md"), "utf8"), "sedang diubah pengguna");
  assert.equal(fs.existsSync(path.join(LIB, "modules", "rbac.md")), false);
  assert.match(perkakas("versi").stdout, /lib@[0-9a-f]+\+lokal/);
});

test("skill terpasang yang diubah tangan dipulihkan dari paket; jeda fetch dihormati", () => {
  fs.writeFileSync(TERPASANG, "diubah tangan");
  const r = perkakas("siapkan"); // tanpa --segera: fetch dilewati (baru saja), pemeriksaan lokal tetap jalan
  assert.match(r.stdout, /skill dipasang ulang dari paket sumber/);
  assert.equal(fs.readFileSync(TERPASANG, "utf8"), "versi-3");
});

test("argumen salah → exit 3", () => {
  assert.equal(perkakas("entah").status, 3);
  assert.equal(perkakas("proyek").status, 3);
  assert.equal(perkakas("marketplace").status, 3);
});

// ---- RUDIS SDD (entri rudis-sdd dari perkakas.json asli; repo, lokal diganti fixture) ---------------------------

const ROOT = path.resolve(path.dirname(SKRIP), "..");
const NYATA = JSON.parse(fs.readFileSync(path.join(ROOT, "perkakas.json"), "utf8"));
const SDD_NYATA = NYATA.perkakas.find((t) => t.id === "rudis-sdd");
const PAT_UJI = "pat-uji-rahasia-123";
const KC = path.join(tmp, "keychain"), UVX_LOG = path.join(tmp, "uvx.log"), KC_LOG = path.join(tmp, "keychain.log");
fs.mkdirSync(KC, { recursive: true });
// Keychain palsu: `find-generic-password -s <layanan> [-w]`; item = berkas KC/<layanan>. Log hanya argumen.
tulis(ENV.RUDISONE_KEYCHAIN_BIN, `#!/bin/sh
echo "$*" >> "${KC_LOG}"
[ "$1" = "find-generic-password" ] && [ "$2" = "-s" ] || exit 2
[ -f "${KC}/$3" ] || exit 44
[ "$4" = "-w" ] && cat "${KC}/$3"
exit 0
`);
// uvx palsu: mencatat argumen dan apakah GL_TOKEN = PAT uji (nilainya tidak pernah ditulis).
tulis(ENV.RUDISONE_UVX_BIN, `#!/bin/sh
[ "$1" = "--version" ] && { echo "uvx 0.0.0-uji"; exit 0; }
printf '%s\\n' "$@" > "${UVX_LOG}"
if [ -z "$GL_TOKEN" ]; then echo "GL_TOKEN=kosong"; elif [ "$GL_TOKEN" = "${PAT_UJI}" ]; then echo "GL_TOKEN=cocok"; else echo "GL_TOKEN=lain"; fi >> "${UVX_LOG}"
exit 0
`);
fs.chmodSync(ENV.RUDISONE_KEYCHAIN_BIN, 0o755);
fs.chmodSync(ENV.RUDISONE_UVX_BIN, 0o755);
const simpanPat = (isi = PAT_UJI) => fs.writeFileSync(path.join(KC, SDD_NYATA.auth.keychain), `${isi}\n`);
const hapusPat = () => fs.rmSync(path.join(KC, SDD_NYATA.auth.keychain), { force: true });

// Origin RUDIS palsu: berkas sumber yang memuat flag --no-marketplace.
const kerjaSdd = path.join(tmp, "kerja-sdd"), BUKTI = SDD_NYATA.tanpa_marketplace.bukti;
sh("git", ["init", "-q", "--bare", "-b", "main", path.join(tmp, "sdd.git")]);
sh("git", ["init", "-q", "-b", "main", kerjaSdd]);
sh("git", ["remote", "add", "origin", path.join(tmp, "sdd.git")], kerjaSdd);
tulis(path.join(kerjaSdd, BUKTI), 'no_marketplace: bool = typer.Option(False, "--no-marketplace")\n');
tulis(path.join(kerjaSdd, "pyproject.toml"), '[project.scripts]\nrudis = "rudis_cli:main"\n');
function commitSdd(nama) {
  tulis(path.join(kerjaSdd, "docs", `${nama}.md`), nama);
  sh("git", ["add", "-A"], kerjaSdd);
  sh("git", ["commit", "-qm", nama], kerjaSdd);
  sh("git", ["push", "-q", "origin", "main"], kerjaSdd);
}
commitSdd("awal");

const SDD = path.join(HOME, "Documents", "Neuron", "ai-agent", "rudis");
const sddEntri = (ubah = {}) => ({ ...SDD_NYATA, repo: path.join(tmp, "sdd.git"), ...ubah });
function manifest(nama, perkakasList, allowlist = []) {
  const f = path.join(tmp, `manifest-${nama}.json`);
  tulis(f, JSON.stringify({ perkakas: perkakasList, kebijakan_marketplace: { ...NYATA.kebijakan_marketplace, allowlist } }));
  return f;
}
const [ENTRI_SKILL, ENTRI_LIB] = JSON.parse(fs.readFileSync(ENV.RUDISONE_PERKAKAS_MANIFEST, "utf8")).perkakas;
const M_TIGA = manifest("tiga", [ENTRI_SKILL, ENTRI_LIB, sddEntri()]);
const M_SDD = manifest("sdd", [sddEntri()]);
const jalan = (m, args, envTambah = {}) => spawnSync("node", [SKRIP, ...args],
  { env: { ...ENV, RUDISONE_PERKAKAS_MANIFEST: m, ...envTambah }, encoding: "utf8" });
const bacaUvx = () => (fs.existsSync(UVX_LOG) ? fs.readFileSync(UVX_LOG, "utf8").trim().split("\n") : null);

test("perkakas.json: entri rudis-sdd & kebijakan marketplace berbentuk benar (allowlist awal kosong & sah)", () => {
  assert.equal(SDD_NYATA.label, "sdd");
  assert.equal(SDD_NYATA.repo, "https://git.neuron.id/research/rudis.git");
  assert.deepEqual(SDD_NYATA.jalan, ["uvx", "--from", "{lokal}", "rudis"]);
  assert.equal(SDD_NYATA.auth.keychain, "rudisone-rudis-sdd");
  assert.deepEqual(SDD_NYATA.tanpa_marketplace.perintah, ["init"]);
  assert.equal(NYATA.kebijakan_marketplace.default, "tanpa-marketplace");
  assert.deepEqual(NYATA.kebijakan_marketplace.allowlist, []);
});

test("rudis-sdd: cek melaporkan belum ada, siapkan meng-clone, versi menambah sdd@<sha>", () => {
  let r = jalan(M_TIGA, ["cek"]);
  assert.match(r.stdout, /rudis-sdd: belum ada di ~\/Documents\/Neuron\/ai-agent\/rudis/);
  assert.equal(fs.existsSync(SDD), false);
  r = jalan(M_SDD, ["siapkan"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /rudis-sdd: di-clone ke ~\/Documents\/Neuron\/ai-agent\/rudis/);
  assert.match(r.stdout, /rudis-sdd: jalan lewat bin\/rudis-sdd\.sh \(uvx --from ~\/Documents\/Neuron\/ai-agent\/rudis rudis, --no-marketplace\)/);
  assert.ok(fs.existsSync(path.join(SDD, BUKTI)));
  const sha = sh("git", ["-C", kerjaSdd, "rev-parse", "--short", "HEAD"]);
  assert.match(jalan(M_TIGA, ["versi"]).stdout.trim(), new RegExp(`^rudis@[0-9a-f]{7,}(\\+lokal)? lib@[0-9a-f]{7,}(\\+lokal)? sdd@${sha}$`));
  r = jalan(M_SDD, ["cek", "--segera"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /rudis-sdd: mutakhir dengan origin/);
});

test("rudis-sdd: pull --ff-only ditunda selama tugas Engineering berjalan, lalu diperbarui", () => {
  commitSdd("kedua");
  bukuBesar("rudis@lama lib@lama sdd@lama");
  let r = jalan(M_SDD, ["siapkan", "--segera"]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /rudis-sdd: 1 commit baru, ditunda — tugas Engineering berjalan: T-20261024-9/);
  assert.equal(fs.existsSync(path.join(SDD, "docs", "kedua.md")), false);
  r = jalan(M_SDD, ["cek", "--segera"]);
  assert.match(r.stdout, /rudis-sdd: 1 commit baru, ditunda/);
  bukuBesar("—");
  r = jalan(M_SDD, ["siapkan", "--segera"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /rudis-sdd: diperbarui 1 commit \(pull --ff-only\)/);
  assert.ok(fs.existsSync(path.join(SDD, "docs", "kedua.md")));
  assert.match(jalan(M_SDD, ["versi"]).stdout.trim(), new RegExp(`^sdd@${sh("git", ["-C", kerjaSdd, "rev-parse", "--short", "HEAD"])}$`));
  fs.rmSync(ENV.RUDISONE_REGISTER, { force: true });
});

test("override RUDISONE_LOKAL_RUDIS_SDD: clone & versi di folder lain, lokal bawaan tidak disentuh", () => {
  const lain = path.join(tmp, "uji-nyata", "rudis");
  const sebelum = sh("git", ["-C", SDD, "rev-parse", "HEAD"]);
  const env = { RUDISONE_LOKAL_RUDIS_SDD: lain };
  const r = jalan(M_SDD, ["siapkan"], env);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, new RegExp(`rudis-sdd: di-clone ke ${lain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.ok(fs.existsSync(path.join(lain, BUKTI)));
  assert.match(jalan(M_SDD, ["versi"], env).stdout, /^sdd@[0-9a-f]{7,}\n$/);
  assert.equal(sh("git", ["-C", SDD, "rev-parse", "HEAD"]), sebelum);
});

test("bin/rudis-sdd.sh: init selalu --no-marketplace; GL_TOKEN dari Keychain hanya ke proses anak", () => {
  const wrapper = path.join(ROOT, "bin", "rudis-sdd.sh");
  const env = { ...ENV, RUDISONE_PERKAKAS_MANIFEST: M_SDD };
  let r = spawnSync(wrapper, ["init", "--here", "--force", "--ai", "claude", "--script", "sh"], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(bacaUvx(), ["--from", SDD, "rudis", "init", "--no-marketplace", "--here", "--force", "--ai", "claude", "--script", "sh", "GL_TOKEN=kosong"]);
  assert.match(r.stderr, /GL_TOKEN tidak ada di Keychain \(rudisone-rudis-sdd\).*security add-generic-password -s rudisone-rudis-sdd -a "\$USER" -w/);

  simpanPat();
  r = spawnSync(wrapper, ["init", "--here", "--no-marketplace"], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(bacaUvx(), ["--from", SDD, "rudis", "init", "--here", "--no-marketplace", "GL_TOKEN=cocok"]);
  assert.ok(!(r.stdout + r.stderr).includes(PAT_UJI), "PAT tidak boleh tercetak");
  assert.match(r.stderr, /GL_TOKEN diambil dari Keychain \(rudisone-rudis-sdd\) untuk proses ini saja/);

  r = jalan(M_SDD, ["sdd", "version"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(bacaUvx(), ["--from", SDD, "rudis", "version", "GL_TOKEN=kosong"]);
  r = jalan(M_SDD, ["sdd", "init", "--help"]);
  assert.deepEqual(bacaUvx(), ["--from", SDD, "rudis", "init", "--help", "GL_TOKEN=kosong"]);
  assert.ok(!fs.readFileSync(KC_LOG, "utf8").includes(PAT_UJI));
  hapusPat();
});

test("bin/rudis-sdd.sh menolak marketplace di luar allowlist, perintah terlarang, dan PAT di argumen", () => {
  const ditolak = [
    [["run", "ultimate", "x"], /S1/],
    [["run", "deploy"], /IT Operations/],
    [["run", "plan", "x"], /U2/],
    [["--verbose", "run", "ultimate"], /opsi sebelum subperintah/],
    [["-v", "init", "--here"], /opsi sebelum subperintah/],
    [["run", "ultimate", "--help", "--force"], /S1|U2/],
    [["tui"], /interaktif/],
    [[], /tanpa subperintah/],
    [["skill", "install", "x"], /rudis-marketplace-tooling\.git, yang tidak ada di allowlist/],
    [["governance", "use", "x"], /tidak ada di allowlist/],
    [["utilities", "catalog"], /neudela\.git, yang tidak ada di allowlist/],
    [["init", "--here", "--profile", "rudis-monorepo"], /tidak ada di allowlist/],
    [["init", "--here", "--gitlab-token", "abc"], /--gitlab-token menaruh PAT di argumen/],
  ];
  for (const [args, pola] of ditolak) {
    fs.rmSync(UVX_LOG, { force: true });
    const r = jalan(M_SDD, ["sdd", ...args]);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, pola, args.join(" "));
    assert.equal(bacaUvx(), null, `uvx tidak boleh dipanggil: ${args.join(" ")}`);
  }
  // Sumber flag hilang di versi RUDIS ini → init ditolak (gagal tertutup).
  fs.writeFileSync(path.join(SDD, BUKTI), "tanpa flag\n");
  let r = jalan(M_SDD, ["sdd", "init", "--here"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--no-marketplace tidak ditemukan/);
  r = jalan(M_SDD, ["cek"]);
  assert.match(r.stdout, /\[!!\]\s+rudis-sdd: --no-marketplace tidak ditemukan di src\/rudis_cli\/__init__\.py/);
  sh("git", ["-C", SDD, "checkout", "--", BUKTI]);
  // RUDIS belum ada → arahkan ke siapkan.
  r = jalan(M_SDD, ["sdd", "version"], { RUDISONE_LOKAL_RUDIS_SDD: path.join(tmp, "tidak-ada") });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RUDIS belum ada .* jalankan bin\/perkakas\.sh siapkan/);
});

test("bin/rudis-sdd.sh: sumber marketplace di allowlist → init tanpa --no-marketplace, perintah marketplace diizinkan", () => {
  const pin = "a".repeat(40);
  const m = manifest("izin", [sddEntri()], [{ sumber: SDD_NYATA.marketplace.bawaan, pin, auto_update: false, disetujui: "uji: \"boleh\"" }]);
  let r = jalan(m, ["sdd", "init", "--here"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(bacaUvx(), ["--from", SDD, "rudis", "init", "--here", "GL_TOKEN=kosong"]);
  assert.match(r.stderr, /diizinkan allowlist \(pin a{40}\); rudis sendiri tidak menegakkan pin/);
  r = jalan(m, ["sdd", "skill", "list"]);
  assert.equal(r.status, 0, r.stderr);
  // --marketplace-url lain tetap ditolak walau marketplace bawaan diizinkan.
  r = jalan(m, ["sdd", "skill", "install", "x", "--marketplace-url", "https://contoh.test/lain.git"]);
  assert.equal(r.status, 1);
  r = jalan(m, ["sdd", "init", "--here", "--marketplace-url=https://contoh.test/lain.git"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(bacaUvx().includes("--no-marketplace"));   // URL marketplace lain tidak diizinkan → tetap tanpa marketplace
});

test("marketplace cek: validasi entri (pin 40 hex, auto_update false, disetujui) dan izin sumber", () => {
  const sah = { sumber: "https://github.com/Contoh/Plugins.git", pin: "0123456789abcdef0123456789abcdef01234567", auto_update: false, disetujui: "Pengguna 2026-10-30: \"pasang\"" };
  const mKosong = manifest("kosong", [sddEntri()]);
  assert.equal(jalan(mKosong, ["marketplace", "cek"]).status, 0);
  let r = jalan(mKosong, ["marketplace", "cek", "contoh/plugins"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Tidak diizinkan: contoh\/plugins/);

  const mSah = manifest("sah", [sddEntri()], [sah]);
  r = jalan(mSah, ["marketplace", "cek", "contoh/plugins"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Diizinkan: contoh\/plugins \(pin 0123456789abcdef/);
  assert.equal(jalan(mSah, ["marketplace", "cek", "git@github.com:contoh/plugins.git"]).status, 0);
  assert.equal(jalan(mSah, ["marketplace", "cek", "contoh/lain"]).status, 1);

  const rusak = [
    { ...sah, pin: "0123456" },
    { ...sah, sumber: "contoh/b", auto_update: true },
    { ...sah, sumber: "contoh/c", disetujui: "" },
  ];
  const mRusak = manifest("rusak", [sddEntri()], rusak);
  r = jalan(mRusak, ["marketplace", "cek"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /pin wajib sha commit penuh \(40 hex\)/);
  assert.match(r.stdout, /auto_update wajib false/);
  assert.match(r.stdout, /disetujui wajib memuat kutipan keputusan pemilik/);
  for (const s of ["contoh/plugins", "contoh/b", "contoh/c"]) assert.equal(jalan(mRusak, ["marketplace", "cek", s]).status, 1, s);

  // Fungsi murni.
  assert.equal(normalSumber("https://git.neuron.id/research/rudis-marketplace-tooling.git/"), "git.neuron.id/research/rudis-marketplace-tooling");
  assert.equal(normalSumber("https://token@git.neuron.id/x/y"), "git.neuron.id/x/y");
  assert.deepEqual(periksaAllowlist({ allowlist: [sah] })[0].galat, []);
  assert.equal(sumberDiizinkan({ allowlist: rusak }, "contoh/b"), null);
  assert.equal(sumberDiizinkan(undefined, "contoh/plugins"), null);
  assert.deepEqual(rencanaSdd(SDD_NYATA, { allowlist: [] }, ["check"]), { argv: ["check"], glToken: false, catatan: [] });
});

// ---- PAT lewat Keychain ke git (GIT_ASKPASS) — server git HTTP lokal dengan Basic auth --------------------------

function serverGit(akar, pat) {
  const harap = `Basic ${Buffer.from(`oauth2:${pat}`).toString("base64")}`;
  const lihat = { auth: [] };
  const srv = http.createServer((req, res) => {
    lihat.auth.push(Boolean(req.headers.authorization));
    if (req.headers.authorization !== harap) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="uji"' }); res.end("401"); return; }
    const u = new URL(req.url, "http://lokal");
    const cgi = spawn("git", ["http-backend"], { env: { ...ENV, GIT_PROJECT_ROOT: akar, GIT_HTTP_EXPORT_ALL: "1",
      PATH_INFO: decodeURIComponent(u.pathname), QUERY_STRING: u.search.slice(1), REQUEST_METHOD: req.method,
      CONTENT_TYPE: req.headers["content-type"] ?? "", HTTP_CONTENT_ENCODING: req.headers["content-encoding"] ?? "",
      GIT_PROTOCOL: req.headers["git-protocol"] ?? "", REMOTE_USER: "oauth2", REMOTE_ADDR: "127.0.0.1" } });
    req.pipe(cgi.stdin);
    const isi = [];
    cgi.stdout.on("data", (d) => isi.push(d));
    cgi.on("close", () => {
      const buf = Buffer.concat(isi);
      let i = buf.indexOf("\r\n\r\n"), lompat = 4;
      if (i < 0) { i = buf.indexOf("\n\n"); lompat = 2; }
      const kepala = {};
      let status = 200;
      for (const b of buf.subarray(0, i).toString().split(/\r?\n/)) {
        const [k, ...v] = b.split(":");
        if (/^status$/i.test(k)) status = parseInt(v.join(":"), 10);
        else if (k) kepala[k.trim()] = v.join(":").trim();
      }
      res.writeHead(status, kepala);
      res.end(buf.subarray(i + lompat));
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, lihat, url: `http://127.0.0.1:${srv.address().port}` })));
}
const jalanAsync = (m, args, envTambah = {}) => new Promise((ok) => {
  const p = spawn("node", [SKRIP, ...args], { env: { ...ENV, RUDISONE_PERKAKAS_MANIFEST: m, ...envTambah } });
  let stdout = "", stderr = "";
  p.stdout.on("data", (d) => { stdout += d; });
  p.stderr.on("data", (d) => { stderr += d; });
  p.on("close", (status) => ok({ status, stdout, stderr }));
});

test("repo privat: PAT tidak ada → perintah Keychain + exit 1 tanpa menghentikan entri lain; PAT ada → clone via askpass", async () => {
  const { srv, lihat, url } = await serverGit(tmp, PAT_UJI);
  try {
    const lokal = path.join(tmp, "http", "rudis");
    const m = manifest("http", [{ ...ENTRI_LIB, id: "pustaka-lain", lokal: LIB }, sddEntri({ repo: `${url}/sdd.git`, lokal })]);
    hapusPat();
    let r = await jalanAsync(m, ["siapkan"]);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /rudis-sdd: clone http:\/\/127\.0\.0\.1:\d+\/sdd\.git ditolak — butuh PAT — belum ada di Keychain \(rudisone-rudis-sdd\)/);
    assert.ok(r.stdout.includes('security add-generic-password -s rudisone-rudis-sdd -a "$USER" -w'), r.stdout);
    assert.match(r.stdout, /pustaka-lain: /, "entri lain tetap diproses");
    assert.equal(fs.existsSync(path.join(lokal, ".git")), false);

    simpanPat();
    r = await jalanAsync(m, ["siapkan"]);
    assert.match(r.stdout, /rudis-sdd: di-clone ke /, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(lokal, BUKTI)));
    assert.ok(lihat.auth.includes(true), "server menerima Authorization");
    for (const teks of [r.stdout, r.stderr, fs.readFileSync(path.join(lokal, ".git", "config"), "utf8"), fs.readFileSync(KC_LOG, "utf8")]) {
      assert.ok(!teks.includes(PAT_UJI), "PAT tidak boleh tercetak/tersimpan");
    }
    assert.doesNotMatch(fs.readFileSync(path.join(lokal, ".git", "config"), "utf8"), /helper|askpass|oauth2@/i);

    commitSdd("ketiga");
    r = await jalanAsync(m, ["siapkan", "--segera"]);
    assert.match(r.stdout, /rudis-sdd: diperbarui 1 commit \(pull --ff-only\)/, r.stdout + r.stderr);

    simpanPat("pat-salah");
    r = await jalanAsync(m, ["cek", "--segera"]);
    assert.match(r.stdout, /rudis-sdd: fetch ditolak — PAT di Keychain \(rudisone-rudis-sdd\) ditolak/);
    assert.ok(r.stdout.includes('security add-generic-password -U -s rudisone-rudis-sdd -a "$USER" -w'), r.stdout);
  } finally {
    hapusPat();
    srv.closeAllConnections?.();
    srv.close();
  }
});

// ---- PAT di Linux/WSL2: berkas rahasia 0600 (RUDISONE_OS=linux) ----------------------------------------------------

const LINUX = { RUDISONE_OS: "linux" };
const RAHASIA = ENV.RUDISONE_RAHASIA_DIR, BERKAS_PAT = path.join(RAHASIA, SDD_NYATA.auth.keychain);
const SKRIP_SH = path.join(ROOT, "bin", "perkakas.sh");
const simpanPatLinux = (isi = PAT_UJI) => spawnSync(SKRIP_SH, ["pat", SDD_NYATA.auth.keychain],
  { env: { ...ENV, ...LINUX }, input: `${isi}\n`, encoding: "utf8" });

test("Linux: bin/perkakas.sh pat menyimpan PAT dari stdin ke berkas 0600 (folder 0700), tanpa mencetaknya", () => {
  fs.rmSync(RAHASIA, { recursive: true, force: true });
  let r = simpanPatLinux();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(BERKAS_PAT, "utf8"), `${PAT_UJI}\n`);
  assert.equal(fs.statSync(BERKAS_PAT).mode & 0o777, 0o600);
  assert.equal(fs.statSync(RAHASIA).mode & 0o777, 0o700);
  assert.ok(!(r.stdout + r.stderr).includes(PAT_UJI), "PAT tidak boleh tercetak");
  r = simpanPatLinux("pat-kedua");
  assert.equal(fs.readFileSync(BERKAS_PAT, "utf8"), "pat-kedua\n", "perbarui menimpa");
  for (const salah of [[], ["pat"], ["pat", "../x"], ["pat", ".x"], ["pat", "a b"]]) {
    assert.equal(spawnSync(SKRIP_SH, salah.length ? salah : ["pat"], { env: { ...ENV, ...LINUX }, input: "x\n" }).status, 3, salah.join(" "));
  }
  assert.equal(spawnSync(SKRIP_SH, ["pat", "kosong"], { env: { ...ENV, ...LINUX }, input: "\n" }).status, 1);
  assert.equal(fs.existsSync(path.join(RAHASIA, "kosong")), false);
  fs.rmSync(RAHASIA, { recursive: true, force: true });
});

test("Linux: rudis-sdd.sh menampilkan perintah pat; GL_TOKEN dari berkas 0600 saja (mode longgar diabaikan)", () => {
  fs.rmSync(RAHASIA, { recursive: true, force: true });
  const wrapper = path.join(ROOT, "bin", "rudis-sdd.sh");
  const env = { ...ENV, ...LINUX, RUDISONE_PERKAKAS_MANIFEST: M_SDD };
  let r = spawnSync(wrapper, ["init", "--here"], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(bacaUvx().at(-1), "GL_TOKEN=kosong");
  assert.match(r.stderr, /GL_TOKEN tidak ada di berkas rahasia \(.*rahasia\/rudisone-rudis-sdd, mode 0600\)/);
  assert.match(r.stderr, /bin\/perkakas\.sh pat rudisone-rudis-sdd/);
  assert.doesNotMatch(r.stderr, /security add-generic-password/);

  assert.equal(simpanPatLinux().status, 0);
  r = spawnSync(wrapper, ["init", "--here"], { env, encoding: "utf8" });
  assert.equal(bacaUvx().at(-1), "GL_TOKEN=cocok");
  assert.ok(!(r.stdout + r.stderr).includes(PAT_UJI));

  fs.chmodSync(BERKAS_PAT, 0o644);
  r = spawnSync(wrapper, ["init", "--here"], { env, encoding: "utf8" });
  assert.equal(bacaUvx().at(-1), "GL_TOKEN=kosong", "berkas yang terbaca orang lain tidak dipakai");
  fs.rmSync(RAHASIA, { recursive: true, force: true });
});

test("Linux: repo privat via askpass dari berkas rahasia; PAT belum ada → perintah pat", async () => {
  fs.rmSync(RAHASIA, { recursive: true, force: true });
  const { srv, lihat, url } = await serverGit(tmp, PAT_UJI);
  try {
    const lokal = path.join(tmp, "http-linux", "rudis");
    const m = manifest("http-linux", [sddEntri({ repo: `${url}/sdd.git`, lokal })]);
    let r = await jalanAsync(m, ["siapkan"], LINUX);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /butuh PAT — belum ada di berkas rahasia \(/);
    assert.match(r.stdout, /bin\/perkakas\.sh pat rudisone-rudis-sdd/);
    assert.equal(simpanPatLinux().status, 0);
    r = await jalanAsync(m, ["siapkan"], LINUX);
    assert.match(r.stdout, /rudis-sdd: di-clone ke /, r.stdout + r.stderr);
    assert.ok(lihat.auth.includes(true));
    for (const teks of [r.stdout, r.stderr, fs.readFileSync(path.join(lokal, ".git", "config"), "utf8")]) assert.ok(!teks.includes(PAT_UJI));
    assert.equal(simpanPatLinux("pat-salah").status, 0);
    r = await jalanAsync(m, ["cek", "--segera"], LINUX);
    assert.match(r.stdout, /PAT di berkas rahasia \(.*\) ditolak — .*bin\/perkakas\.sh pat rudisone-rudis-sdd/);
  } finally {
    fs.rmSync(RAHASIA, { recursive: true, force: true });
    srv.closeAllConnections?.();
    srv.close();
  }
});

test("tanpa RUDISONE_OS: penyimpan & perintah PAT mengikuti OS sebenarnya (darwin → Keychain, lainnya → pat)", () => {
  fs.rmSync(RAHASIA, { recursive: true, force: true });
  const env = { ...ENV, RUDISONE_PERKAKAS_MANIFEST: M_SDD };
  delete env.RUDISONE_OS;
  const r = spawnSync(path.join(ROOT, "bin", "rudis-sdd.sh"), ["init", "--here"], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  if (process.platform === "darwin") assert.match(r.stderr, /GL_TOKEN tidak ada di Keychain \(rudisone-rudis-sdd\).*security add-generic-password/);
  else {
    assert.match(r.stderr, /GL_TOKEN tidak ada di berkas rahasia \(.*\).*bin\/perkakas\.sh pat rudisone-rudis-sdd/);
    // `pat` di bash memakai uname: Linux → berkas, bukan Keychain
    const p = spawnSync(SKRIP_SH, ["pat", SDD_NYATA.auth.keychain], { env, input: `${PAT_UJI}\n`, encoding: "utf8" });
    assert.equal(p.status, 0, p.stderr);
    assert.equal(fs.statSync(BERKAS_PAT).mode & 0o777, 0o600);
  }
  fs.rmSync(RAHASIA, { recursive: true, force: true });
});
