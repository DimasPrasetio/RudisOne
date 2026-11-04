// Aktivitas di /state: ID tugas per langkah (dari awalan pesan masuk), tanpa perintah mentah & nama alat internal,
// dan tugas membawa waktu dibuat (lama berjalan). Proses terpisah dari uji.test.mjs (env server dibaca saat impor).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kantor-aktivitas-"));
const proj = path.join(tmp, "projects", "-contoh");
fs.mkdirSync(proj, { recursive: true });
fs.mkdirSync(path.join(tmp, "desktop"), { recursive: true });
const ROOT = path.join(tmp, "RudisOne");
process.env.RUDISONE_ROOT = ROOT;
process.env.RUDISONE_SERVER = path.join(tmp, "tidak-ada-server.json");
process.env.RUDISONE_KANTOR_PROJECTS = path.join(tmp, "projects");
process.env.RUDISONE_KANTOR_DESKTOP = path.join(tmp, "desktop");
process.env.RUDISONE_SESI = path.join(tmp, "sesi.json");
fs.writeFileSync(process.env.RUDISONE_SESI, JSON.stringify({ backend: "desktop" }));
process.env.RUDISONE_KANTOR_TEAM_MD = path.join(tmp, "TEAM.md");
process.env.RUDISONE_KANTOR_REGISTER = path.join(tmp, "register-tugas.md");
process.env.RUDISONE_KANTOR_REGISTER_JSON = path.join(tmp, "register-tugas.json");

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const alat = (msAgo, id, name, input) => ({ type: "assistant", timestamp: iso(msAgo), message: { content: [{ type: "tool_use", id, name, input }] } });
const pesan = (msAgo, teks) => ({ type: "user", timestamp: iso(msAgo), message: { content: teks } });
fs.writeFileSync(path.join(proj, "s-lead.jsonl"), [
  { type: "custom-title", customTitle: "Tech Lead · toko" },
  pesan(90e3, "Latar dari sesi lain …\n\nTask:\n[Tugas dari COO] T-20260101-2 · Perbaikan cetak\n\nKamu adalah Tech Lead di RudisOne. Baca …"),
  alat(80e3, "a1", "Bash", { command: "perl -0pi -e 's/rahasia/x/' a.mjs" }),
  alat(70e3, "a2", "Bash", { command: "node --test x", description: "Run kantor tests" }),
  alat(65e3, "a3", "SubagentHandback", {}),
  alat(64e3, "a4", "mcp__lain__alat_rahasia", { q: 1 }),
  // pesan antar-sesi baru (baris pertama berawalan) → langkah sesudahnya milik tugas itu
  pesan(60e3, '<cross-session-message from="local_coo" from-name="COO">\n[Revisi] T-20260101-3 · Insiden\nisi pesan</cross-session-message>'),
  alat(50e3, "a5", "Read", { file_path: "/x/y/server.mjs" }),
  // notifikasi tanpa ID tidak mengubah tugas yang sedang dikerjakan
  pesan(40e3, "<task-notification>selesai</task-notification>"),
  alat(30e3, "a6", "Edit", { file_path: "/x/y/kantor.mjs" }),
].map((b) => JSON.stringify(b)).join("\n") + "\n");
fs.writeFileSync(process.env.RUDISONE_KANTOR_REGISTER_JSON, JSON.stringify({ tugas: [
  { id: "T-20260101-2", judul: "Perbaikan cetak", folder: "~/Documents/toko", pemilik: "Tech Lead · toko", prioritas: "normal",
    status: "berjalan", fase: "Konstruksi", fase_sejak: iso(12 * 60e3), dibuat: iso(64 * 60e3), diperbarui: iso(1e3) },
] }));

const { scan, buildState } = await import("./server.mjs");
scan();
const st = buildState(now);
const lead = st.feed.filter((f) => f.agent === "Tech Lead · Tim 1").reverse();

test("setiap aktivitas membawa ID tugas dari awalan pesan masuk terakhir", () => {
  assert.deepEqual(lead.map((f) => [f.label, f.tugas]), [
    ["Mengubah berkas", "T-20260101-2"], ["Menjalankan tes", "T-20260101-2"], ["Menyerahkan hasil", "T-20260101-2"], ["Bekerja", "T-20260101-2"],
    ["Menerima pesan dari agent lain", "T-20260101-3"], ["Membaca kode", "T-20260101-3"], ["Menulis", "T-20260101-3"],
  ]);
});
test("aktivitas tanpa perintah mentah dan tanpa nama alat internal; rincian ≤ 50 karakter", () => {
  const teks = JSON.stringify(st.feed);
  assert.doesNotMatch(teks, /perl|rahasia|SubagentHandback|mcp__|alat_rahasia/);
  assert.equal(lead[1].detail, "Run kantor tests");
  for (const f of st.feed) assert.ok(f.detail.length <= 50, f.detail);
});
test("tugas register membawa waktu dibuat & kemajuan tahap (lama berjalan di kartu)", () => {
  const t = st.tugas.find((x) => x.id === "T-20260101-2");
  assert.equal(t.dibuat, Date.parse(iso(64 * 60e3)));
  assert.deepEqual(t.kemajuan, { menit: 12, anggaran: 25, lewat: false });
});
