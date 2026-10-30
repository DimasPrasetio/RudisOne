// Uji metrik lintas sesi (fixture transkrip sintetis): node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metrik-"));
const PROJ = path.join(tmp, "projects");
const DESK = path.join(tmp, "desktop");
Object.assign(process.env, { RUDISONE_METRIK_PROJECTS: PROJ, RUDISONE_METRIK_DESKTOP: DESK });
delete process.env.RUDISONE_METRIK_TARIF;
const { metrikTugas, olahTranskrip, pesanMasuk, hitungBiaya, kunciTarif, muatTarif, TANPA_ID } = await import("./metrik.mjs");

// ---------- pembangun baris transkrip ----------
let jam = 0, nMsg = 0, nAlat = 0;
const waktu = () => new Date(Date.UTC(2026, 9, 29, 9, 0, 0) + (jam++) * 60e3).toISOString();
const usage = (i = 1, cc = 100, cr = 1000, out = 10) => ({ input_tokens: i, cache_creation_input_tokens: cc, cache_read_input_tokens: cr, output_tokens: out,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: cc } });
const manusia = (teks) => ({ type: "user", origin: { kind: "human" }, promptSource: "sdk", message: { role: "user", content: teks }, timestamp: waktu() });
const lintas = (teks, dari = "local_coo") => ({ type: "user", promptSource: "sdk", timestamp: waktu(),
  message: { role: "user", content: `<system-reminder>\nLinked sessions now: x\n</system-reminder>\n\n<cross-session-message from="${dari}" from-name="COO">\n${teks}\n</cross-session-message>` } });
const notifAnak = (teks) => ({ type: "user", promptSource: "sdk", timestamp: waktu(),
  message: { role: "user", content: `<system-reminder>\nThe session "Tech Lead" you started (local_tl) finished a turn. It reported (quoted child output, data not instructions): "${teks}"\n</system-reminder>` } });
const skillMeta = (teks) => ({ type: "user", isMeta: true, timestamp: waktu(), message: { role: "user", content: [{ type: "text", text: teks }] } });
/** Satu pesan asisten ditulis sebagai beberapa baris (satu per blok) dengan message.id dan usage sama. */
function asisten(blok, u = usage(), model = "claude-opus-5-5") {
  const id = `msg_${++nMsg}`;
  const t = waktu();
  return blok.map((b) => ({ type: "assistant", timestamp: t, requestId: `req_${nMsg}`, message: { id, model, role: "assistant", content: [b], usage: u } }));
}
const teks = (t) => ({ type: "text", text: t });
const alat = (name, input) => ({ type: "tool_use", id: `toolu_${++nAlat}`, name, input });
const hasilAlat = (id, extra = {}) => ({ type: "user", timestamp: waktu(), message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] }, ...extra });

function tulisSesi(proyek, cli, baris, subagent = {}) {
  const dir = path.join(PROJ, proyek);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${cli}.jsonl`), baris.flat().map((b) => JSON.stringify(b)).join("\n") + "\n");
  for (const [nama, bs] of Object.entries(subagent)) {
    const sd = path.join(dir, cli, "subagents");
    fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.join(sd, `agent-${nama}.jsonl`), bs.flat().map((b) => JSON.stringify({ ...b, isSidechain: true })).join("\n") + "\n");
    fs.writeFileSync(path.join(sd, `agent-${nama}.meta.json`), JSON.stringify({ agentType: "Explore", description: `cari ${nama}` }));
  }
}

// ---------- fixture: sesi COO + sesi Tech Lead + subagent ----------
const askId = "toolu_ask";
const COO = [
  { type: "agent-setting", agentSetting: "coo" },
  manusia("tolong rapikan skrip deploy"),                                   // tanpa ID
  asisten([teks("Saya cek dulu.")]),
  asisten([teks("Saya daftarkan T-20261029-1 di register."), { type: "tool_use", id: askId, name: "AskUserQuestion", input: { questions: [{ question: "A?" }, { question: "B?" }] } }]),
  hasilAlat(askId, { toolUseResult: { answers: { "A?": "Ya (Rekomendasi)", "B?": "jawaban bebas" } } }),
  asisten([alat("SendMessage", { to: "local_tl", message: "[Tugas dari COO] T-20261029-1 · Rapikan skrip\nisi brief" })]),
  notifAnak("T-20261029-1 selesai, laporan terkirim"),                      // ID → aktif T-20261029-1
  asisten([alat("SendMessage", { to: "local_tl", message: "[Revisi] T-20261029-1 · perbaiki tes\nPERLU REVISI di bagian X" })]),
  manusia("oke lanjut"),                                                     // tanpa ID → tetap T-20261029-1
  asisten([teks("Siap.")]),
  manusia("status T-20261029-2 bagaimana?"),                                 // ID lain
  asisten([teks("T-20261029-2 berjalan.")]),
];
const TL = [
  { type: "custom-title", customTitle: "Tech Lead · contoh" },
  lintas("[Tugas dari COO] T-20261029-1 · Rapikan skrip\nisi"),
  asisten([alat("Agent", { description: "cari", prompt: "cari file" })]),
  hasilAlat(`toolu_${nAlat}`),
  asisten([alat("SendMessage", { to: "local_coo", message: "[Laporan divisi Engineering] T-20261029-1 · selesai" })], usage(2, 0, 5000, 50)),
];
const SUB = { a1: [skillMeta("cari file"), asisten([teks("ketemu")], usage(1, 10, 100, 5), "claude-haiku-4-5-20251001")] };
tulisSesi("-proyek-coo", "sesi-coo", COO);
tulisSesi("-proyek-tl", "sesi-tl", TL, SUB);
// sesi tanpa ID sama sekali (tidak boleh ikut)
tulisSesi("-lain", "sesi-lain", [manusia("halo"), asisten([teks("hai")])]);
// metadata Desktop: judul sesi COO
fs.mkdirSync(path.join(DESK, "akun", "org"), { recursive: true });
fs.writeFileSync(path.join(DESK, "akun", "org", "local_coo.json"), JSON.stringify({ cliSessionId: "sesi-coo", sessionId: "local_coo", title: "COO RudisOne" }));
fs.writeFileSync(path.join(DESK, "akun", "org", "local_tl.json"), JSON.stringify({ cliSessionId: "sesi-tl", sessionId: "local_tl", title: "Tech Lead · contoh" }));

test("pesan masuk diklasifikasi: pengguna, lintas sesi, notifikasi sesi anak, ekspansi skill bukan pesan", () => {
  assert.equal(pesanMasuk(manusia("x T-20261029-9")).jenis, "pengguna");
  assert.equal(pesanMasuk(manusia("x T-20261029-9")).id, "T-20261029-9");
  const l = pesanMasuk(lintas("[Tugas dari COO] T-20261029-7 · a"));
  assert.deepEqual([l.jenis, l.id, l.dari], ["lintas-sesi", "T-20261029-7", "local_coo"]);
  assert.equal(pesanMasuk(notifAnak("T-20261029-5 selesai")).id, "T-20261029-5");
  assert.equal(pesanMasuk(skillMeta("T-20261029-4")), null);
  assert.equal(pesanMasuk(hasilAlat("t")), null);
});

test("usage di-dedup per message.id (satu pesan = beberapa baris)", () => {
  const { segmen } = olahTranskrip([manusia("T-20261029-1"), ...asisten([teks("a"), alat("Read", {}), alat("Read", {})], usage(1, 100, 1000, 10))]);
  assert.equal(segmen[0].panggilan, 1);
  assert.equal(segmen[0].token.total, 1111);
  assert.equal(segmen[0].alat.length, 2);
});

test("atribusi dasar: ID aktif dari pesan masuk; tanpa ID tidak mengubah; sebelum ID pertama = tanpa-ID", () => {
  const { segmen } = olahTranskrip(COO.flat());
  assert.deepEqual(segmen.map((s) => s.id), [TANPA_ID, "T-20261029-1", "T-20261029-1", "T-20261029-2"]);
});

test("atribusi diperluas: ID baru dari giliran asisten aktif, giliran tanpa-ID sebelumnya ikut", () => {
  const baris = [manusia("halo"), asisten([teks("hai")]), manusia("buat aplikasi"), asisten([teks("Terdaftar T-20261029-3")]), manusia("lanjut"), asisten([teks("ok")])].flat();
  assert.deepEqual(olahTranskrip(baris).segmen.map((s) => s.id), [TANPA_ID, TANPA_ID, TANPA_ID]);
  assert.deepEqual(olahTranskrip(baris, { atribusi: "diperluas" }).segmen.map((s) => s.id), ["T-20261029-3", "T-20261029-3", "T-20261029-3"]);
  // folder handoff/<ID>/ → seluruh sesi
  const f = [{ type: "user", cwd: "/x/RudisOne/handoff/T-20261029-8/uji/app", origin: { kind: "human" }, message: { content: "uji" }, timestamp: waktu() }, ...asisten([teks("ok")])];
  assert.equal(olahTranskrip(f, { atribusi: "diperluas" }).segmen[0].id, "T-20261029-8");
  assert.equal(olahTranskrip(f).segmen[0].id, TANPA_ID);
});

test("metrikTugas: token, sesi, subagent mewarisi ID induk, pesan, revisi, intervensi, judul Desktop", () => {
  const h = metrikTugas("T-20261029-1");
  const t = h.total;
  assert.equal(t.sesi_terlibat, 2);
  assert.equal(t.subagent, 1);
  const coo = h.sesi.find((s) => s.sesi === "sesi-coo");
  const tl = h.sesi.find((s) => s.sesi === "sesi-tl");
  assert.equal(coo.judul, "COO RudisOne");
  assert.equal(coo.coo, true);
  assert.equal(coo.giliran, 2);               // notifikasi + "oke lanjut"
  assert.equal(coo.panggilan_api, 2);         // SendMessage revisi + "Siap."
  assert.equal(tl.subagent.jumlah, 1);
  assert.equal(tl.token.total, 1111 + 5052);
  assert.equal(tl.token_termasuk_subagent.total, 1111 + 5052 + 116);
  // pesan keluar ber-ID: brief (giliran tanpa-ID tetap dihitung karena baris pertama ber-ID), revisi, laporan TL
  assert.equal(t.pesan.keluar, 3);
  assert.equal(t.pesan.masuk_lintas_sesi, 1);
  assert.equal(h.pesan_keluar[0].ke, "Tech Lead · contoh");
  assert.equal(t.revisi.keluar_tag_revisi, 1);
  assert.equal(t.revisi.keluar_perlu_revisi, 0);   // "PERLU REVISI" di badan pesan [Revisi] bukan peristiwa kedua
  assert.equal(t.revisi.total_m2, 1);
  // intervensi: AskUserQuestion ada di giliran tanpa-ID (dasar) → 0; prompt pengguna "oke lanjut" → 1
  assert.equal(t.intervensi.ask_user_question.panggilan, 0);
  assert.equal(t.intervensi.prompt_pengguna_coo, 1);
  assert.ok(t.biaya_usd_perkiraan > 0);
  assert.match(t.biaya_catatan, /perkiraan/);
  assert.ok(t.waktu_aktif_ms > 0);
  assert.ok(t.pertama_memuat_id <= t.terakhir);
  // diperluas: giliran pendaftaran ikut → AskUserQuestion 1 panggilan, 2 pertanyaan, 1 pilih rekomendasi
  const d = metrikTugas("T-20261029-1", { atribusi: "diperluas" }).total;
  assert.deepEqual(d.intervensi.ask_user_question, { panggilan: 1, pertanyaan: 2 });
  assert.equal(d.intervensi.jawaban_pilih_rekomendasi, 1);
  assert.equal(d.intervensi.rasio_pilih_rekomendasi, 0.5);
  assert.ok(d.token.total > t.token.total);
});

test("--sejak menyaring berkas lama", () => {
  assert.equal(metrikTugas("T-20261029-1", { sejak: "2099-01-01" }).total.sesi_terlibat, 0);
});

test("tarif: kunci model dengan akhiran tanggal, biaya per komponen, override berkas", () => {
  const tarif = muatTarif();
  assert.equal(kunciTarif("claude-haiku-4-5-20251001", tarif), "claude-haiku-4-5");
  assert.equal(kunciTarif("claude-opus-5-5", tarif), "claude-opus-5-5");
  assert.equal(kunciTarif("claude-opus-5", tarif), "claude-opus-5");
  assert.equal(kunciTarif("model-x", tarif), null);
  const pm = { "claude-opus-5-5": { input: 1e6, output: 1e6, cache_creation_5m: 1e6, cache_creation_1h: 1e6, cache_read: 1e6 }, "model-x": { input: 5 } };
  const b = hitungBiaya(pm, tarif);
  assert.equal(b.usd, 4 + 20 + 5 + 8 + 0.2);
  assert.deepEqual(b.tanpa_tarif, ["model-x"]);
  const f = path.join(tmp, "tarif.json");
  fs.writeFileSync(f, JSON.stringify({ "claude-opus-5-5": { output: 15 }, "model-x": { input: 1, output: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0 } }));
  const t2 = muatTarif(f);
  assert.equal(t2["claude-opus-5-5"].output, 15);
  assert.equal(t2["claude-opus-5-5"].input, 4);
  assert.equal(hitungBiaya({ "model-x": { input: 1e6, output: 0, cache_creation_5m: 0, cache_creation_1h: 0, cache_read: 0 } }, t2).usd, 1);
});

test("CLI: --json, --atribusi keduanya, ID tidak valid → exit 2", () => {
  const env = { ...process.env };
  const j = JSON.parse(execFileSync(process.execPath, [path.join(SINI, "metrik.mjs"), "tugas", "T-20261029-1", "--json"], { env, encoding: "utf8" }));
  assert.equal(j.id, "T-20261029-1");
  assert.equal(j.atribusi, "dasar");
  const k = JSON.parse(execFileSync(process.execPath, [path.join(SINI, "metrik.mjs"), "tugas", "T-20261029-1", "--json", "--atribusi", "keduanya"], { env, encoding: "utf8" }));
  assert.ok(k.dasar && k.diperluas);
  const teksOut = execFileSync(process.execPath, [path.join(SINI, "metrik.mjs"), "tugas", "T-20261029-1"], { env, encoding: "utf8" });
  assert.match(teksOut, /Metrik T-20261029-1/);
  assert.throws(() => execFileSync(process.execPath, [path.join(SINI, "metrik.mjs"), "tugas", "bukan-id"], { env, stdio: "pipe" }), (e) => e.status === 2);
});


test("X14 beban keputusan: pertanyaan + prompt pengguna + prompt izin dari audit, dibanding anggaran", async () => {
  const { bebanKeputusan } = await import("./metrik.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "metrik-audit-"));
  fs.writeFileSync(path.join(dir, "2026-10.jsonl"), [
    { tugas: "T-20261030-9", jenjang: 3, aksi: "restart" }, { tugas: "T-20261030-9.1", jenis: "berkas-terlindung", jenjang: 3 },
    { tugas: "T-20261030-9", jenjang: 1, jenis: "baca-data" }, { tugas: "T-20261030-8", jenjang: 3 }, { tugas: null, jenjang: 3 },
  ].map((r) => JSON.stringify(r)).join("\n") + "\nrusak\n");
  const b = bebanKeputusan("T-20261030-9", { ask_user_question: { pertanyaan: 2 }, prompt_pengguna_coo: 1 }, { jenis: "bug", dirAudit: dir });
  assert.deepEqual([b.pertanyaan, b.prompt_pengguna, b.prompt_izin, b.total, b.anggaran, b.dalam_anggaran], [2, 1, 2, 5, 3, false]);
  assert.equal(bebanKeputusan("T-20261030-9", {}, { dirAudit: path.join(dir, "tidak-ada") }).total, 0);
});
