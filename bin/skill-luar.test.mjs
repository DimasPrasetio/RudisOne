// Uji skill luar (cek & pasang dari sumber resmi) tanpa internet: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-luar-"));
const CLAUDE = path.join(tmp, "claude");
fs.mkdirSync(CLAUDE, { recursive: true });
process.env.RUDISONE_CLAUDE_DIR = CLAUDE;

// Sumber git: repo skill dengan skrip pasang (sync) yang menyalin ke folder tujuan.
const SUMBER = path.join(tmp, "sumber-neuron");
fs.mkdirSync(path.join(SUMBER, "scripts"), { recursive: true });
fs.writeFileSync(path.join(SUMBER, "SKILL.md"), "---\nname: docx-neuron\n---\n");
fs.writeFileSync(path.join(SUMBER, "scripts", "sync.sh"), 'mkdir -p "$1" && cp -R "$(dirname "$0")/.." "$1.tmp" && rm -rf "$1" && mv "$1.tmp" "$1"\n');
fs.writeFileSync(path.join(SUMBER, "scripts", "setup.sh"), "exit 0\n");
const g = (...a) => execFileSync("git", ["-C", SUMBER, ...a], { stdio: "ignore" });
g("init", "-q", "-b", "main"); g("add", "-A"); g("-c", "user.name=u", "-c", "user.email=u@x", "commit", "-qm", "awal");

// CLI claude palsu: marketplace add → known_marketplaces.json; plugin install → installed_plugins.json + SKILL.md.
const BIN = path.join(tmp, "claude-palsu.sh");
fs.writeFileSync(BIN, `#!/bin/sh
D="${CLAUDE}/plugins"; mkdir -p "$D"
case "$1 $2" in
  "--version ") echo "9.9.9 (Claude Code)";;
  "plugin marketplace") echo "{\\"anthropic-agent-skills\\":{}}" > "$D/known_marketplaces.json"; echo "$4" >> "${tmp}/panggilan";;
  "plugin install") P="$D/cache/document-skills"; for s in docx pdf pptx xlsx frontend-design; do mkdir -p "$P/skills/$s"; echo x > "$P/skills/$s/SKILL.md"; done
    echo "{\\"version\\":2,\\"plugins\\":{\\"$3\\":[{\\"installPath\\":\\"$P\\"}]}}" > "$D/installed_plugins.json"; echo "install $3" >> "${tmp}/panggilan";;
  *) exit 1;;
esac
`);
fs.chmodSync(BIN, 0o755);
process.env.RUDISONE_CLAUDE_BIN = BIN;

const { cariSkill, cariEntri, pastikan, laporan } = await import("./skill-luar.mjs");
const DAFTAR = [
  { id: "docx-neuron", jenis: "git", skill: ["docx-neuron"], repo: SUMBER, lokal: path.join(tmp, "simpan", "docx-neuron"), pasang: "scripts/sync.sh", prasyarat: "scripts/setup.sh" },
  { id: "document-skills", jenis: "plugin", skill: ["docx", "pdf", "pptx", "xlsx"], marketplace: { nama: "anthropic-agent-skills", sumber: "anthropics/skills" }, plugin: "document-skills@anthropic-agent-skills" },
  { id: "frontend-design", jenis: "plugin", skill: ["frontend-design"], marketplace: { nama: "claude-plugins-official", sumber: "anthropics/claude-plugins-official" }, plugin: "frontend-design@claude-plugins-official" },
  { id: "claude-docs", jenis: "platform", skill: ["docs"], catatan: "bawaan aplikasi Claude", alternatif: "docx" },
];
const diam = { log: () => {} };

test("entri dicari lewat id, nama skill, atau nama berawalan plugin", () => {
  assert.equal(cariEntri(DAFTAR, "anthropic-skills:pdf").id, "document-skills");
  assert.equal(cariEntri(DAFTAR, "docx-neuron").id, "docx-neuron");
  assert.equal(cariEntri(DAFTAR, "tidak-ada"), null);
  assert.equal(pastikan(DAFTAR, "tidak-ada", diam), 3);
});

test("skill dari aplikasi Claude (synced) dianggap tersedia, tanpa memasang apa pun", () => {
  const f = path.join(CLAUDE, "skills", "synced", "akun", "docs", "SKILL.md");
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x");
  assert.match(cariSkill("anthropic-skills:docs", CLAUDE).lokasi, /aplikasi Claude/);
  assert.equal(pastikan(DAFTAR, "docs", diam), 0);
  fs.rmSync(path.join(CLAUDE, "skills", "synced"), { recursive: true });
  assert.equal(pastikan(DAFTAR, "docs", diam), 2);   // platform & tidak ada → pakai alternatif
});

test("jenis git: repo disimpan di `lokal`, skill dipasang, pemanggilan kedua tidak memasang ulang", () => {
  assert.equal(pastikan(DAFTAR, "docx-neuron", diam), 0);
  assert.ok(fs.existsSync(path.join(tmp, "simpan", "docx-neuron", ".git")));
  assert.equal(cariSkill("docx-neuron", CLAUDE).lokasi, "pribadi");
  const log = [];
  assert.equal(pastikan(DAFTAR, "docx-neuron", { log: (s) => log.push(s) }), 0);
  assert.match(log.join("\n"), /tersedia \(pribadi\)/);
});

test("jenis plugin: marketplace resmi ditambahkan lalu plugin dipasang; skill plugin lain tidak ikut terhitung", () => {
  assert.equal(pastikan(DAFTAR, "anthropic-skills:pdf", diam), 0);
  const panggilan = fs.readFileSync(path.join(tmp, "panggilan"), "utf8");
  assert.match(panggilan, /anthropics\/skills/);
  assert.match(panggilan, /install document-skills@anthropic-agent-skills/);
  assert.match(cariSkill("xlsx", CLAUDE, DAFTAR).lokasi, /plugin document-skills/);
  // cache document-skills memuat folder frontend-design, tetapi plugin itu tidak menyediakannya
  assert.equal(cariSkill("frontend-design", CLAUDE, DAFTAR), null);
  const baris = laporan(DAFTAR, CLAUDE);
  assert.deepEqual(baris.map(([t]) => t), ["ok", "ok", "..", ".."]);
});
