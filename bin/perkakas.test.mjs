// Uji perkakas resmi dengan repo git palsu (origin bare + HOME sementara). Jalankan: node --test bin/
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jenisProyek, tugasEngineeringBerjalan } from "./perkakas.mjs";

const SKRIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "perkakas.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "perkakas-uji-"));
const HOME = path.join(tmp, "home");
const ENV = {
  ...process.env, HOME,
  GIT_AUTHOR_NAME: "Uji", GIT_AUTHOR_EMAIL: "uji@contoh", GIT_COMMITTER_NAME: "Uji", GIT_COMMITTER_EMAIL: "uji@contoh",
  RUDISONE_PERKAKAS_MANIFEST: path.join(tmp, "perkakas.json"),
  RUDISONE_PERKAKAS_STATE: path.join(tmp, "state.json"),
  RUDISONE_REGISTER: path.join(tmp, "register-tugas.md"),
};
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
});
