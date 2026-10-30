#!/usr/bin/env node
// Metrik lintas sesi per ID tugas (M2–M6, handoff/T-20261030-2/metrik-definisi.md) dari transkrip Claude Code.
// Node ≥18, tanpa dependensi. Hanya membaca: ~/.claude/projects/*/*.jsonl (+ <sesi>/subagents/agent-*.jsonl) dan
// metadata Desktop (judul sesi). Override untuk uji: RUDISONE_METRIK_PROJECTS, RUDISONE_METRIK_DESKTOP, RUDISONE_METRIK_TARIF.
//
//   node bin/metrik.mjs tugas <ID> [--json] [--sejak YYYY-MM-DD] [--atribusi dasar|diperluas|keduanya]
//                                  [--tarif <file.json>] [--tanpa-biaya]
//
// Format transkrip yang dipakai (diperiksa pada Claude Code 2.1.x):
//  - baris {type:"assistant", message:{id, model, usage, content:[satu blok]}, timestamp, isSidechain}: satu pesan API
//    ditulis sebagai beberapa baris (satu per blok konten) dengan message.id dan usage yang sama → usage di-dedup per message.id.
//  - usage: input_tokens, cache_creation_input_tokens (rinci cache_creation.ephemeral_5m/1h_input_tokens),
//    cache_read_input_tokens, output_tokens.
//  - baris {type:"user"} tanpa tool_result = pesan masuk: origin.kind "human" (ketikan pengguna), teks berisi
//    <cross-session-message from=…> (pesan lintas sesi), system-reminder "The session … you started … finished a turn"
//    (notifikasi sesi anak), origin.kind "peer"/"task-notification" (hand-back subagent / notifikasi tugas).
//    isMeta tanpa origin = ekspansi skill (bukan pesan masuk). tool_result AskUserQuestion: toolUseResult.answers.
//  - tool_use: SendMessage {to, message}, AskUserQuestion {questions}, mcp__ccd_session__start_session.
//  - baris {type:"agent-setting"|"custom-title"}: peran & judul sesi; metadata Desktop local_*.json: cliSessionId → title.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentsCli, backendSesi, folderDesktop, normalAgents } from "./sesi.mjs";

const HOME = os.homedir();
const PROJECTS = () => process.env.RUDISONE_METRIK_PROJECTS || path.join(HOME, ".claude", "projects");
const DESKTOP = () => process.env.RUDISONE_METRIK_DESKTOP || folderDesktop();

const AUDIT = () => process.env.RUDISONE_AUDIT || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "handoff", "audit");
/** Anggaran keputusan pengguna per jenis tugas (T-20261030-6 · F8): sasaran, bukan aturan keras. */
export const ANGGARAN_KEPUTUSAN = { bug: 3, fitur: 5 };
export const POLA_ID = /T-\d{8}-\d+/;
const POLA_ID_G = /T-\d{8}-\d+/g;
export const TANPA_ID = "tanpa-ID";

/** Tarif USD per 1 juta token — harga daftar API (perkiraan; akun paket berlangganan tidak ditagih per token).
 *  Sumber: tabel model skill claude-api (cache 2026-10-06); tulis cache 5m = 1,25× input, 1h = 2× input. */
export const TARIF_BAWAAN = {
  "claude-fable-5-1": { input: 10, output: 50, cache_write_5m: 12.5, cache_write_1h: 20, cache_read: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cache_write_5m: 5, cache_write_1h: 8, cache_read: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5 },
  "claude-opus-4-7": { input: 5, output: 25, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cache_write_5m: 2.5, cache_write_1h: 4, cache_read: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cache_write_5m: 2.5, cache_write_1h: 4, cache_read: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cache_write_5m: 3.75, cache_write_1h: 6, cache_read: 0.3 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cache_write_5m: 0.125, cache_write_1h: 0.2, cache_read: 0.01 },
  "claude-haiku-4-5": { input: 1, output: 5, cache_write_5m: 1.25, cache_write_1h: 2, cache_read: 0.1 },
};

/** Tarif bawaan digabung dengan berkas override ({model: {input, output, cache_write_5m, cache_write_1h, cache_read}}). */
export function muatTarif(berkas = process.env.RUDISONE_METRIK_TARIF) {
  const t = structuredClone(TARIF_BAWAAN);
  if (berkas) for (const [m, v] of Object.entries(JSON.parse(fs.readFileSync(berkas, "utf8")))) t[m] = { ...t[m], ...v };
  return t;
}
/** Kunci tarif untuk nama model (akhiran tanggal/varian diabaikan; awalan terpanjang). */
export function kunciTarif(model, tarif) {
  if (!model) return null;
  const m = String(model).replace(/\[.*\]$/, "");
  return Object.keys(tarif).filter((k) => m === k || m.startsWith(`${k}-`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

// ---------- token ----------
const tokenKosong = () => ({ input: 0, cache_creation: 0, cache_creation_5m: 0, cache_creation_1h: 0, cache_read: 0, output: 0, total: 0 });
function tambahUsage(t, u = {}) {
  const cc = u.cache_creation_input_tokens ?? 0;
  const c1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const c5m = u.cache_creation?.ephemeral_5m_input_tokens ?? (cc - c1h);
  t.input += u.input_tokens ?? 0;
  t.cache_creation += cc;
  t.cache_creation_5m += c5m;
  t.cache_creation_1h += c1h;
  t.cache_read += u.cache_read_input_tokens ?? 0;
  t.output += u.output_tokens ?? 0;
  t.total = t.input + t.cache_creation + t.cache_read + t.output;
  return t;
}
function gabungToken(a, b) {
  for (const k of Object.keys(a)) a[k] += b[k] ?? 0;
  return a;
}
/** Biaya perkiraan dari token per model. → {usd, tanpa_tarif:[model]} */
export function hitungBiaya(perModel, tarif) {
  let usd = 0;
  const tanpa = [];
  for (const [model, t] of Object.entries(perModel)) {
    const k = kunciTarif(model, tarif);
    if (!k) { tanpa.push(model); continue; }
    const r = tarif[k];
    usd += (t.input * r.input + t.output * r.output + t.cache_creation_5m * r.cache_write_5m
      + t.cache_creation_1h * r.cache_write_1h + t.cache_read * r.cache_read) / 1e6;
  }
  return { usd: Math.round(usd * 1e4) / 1e4, tanpa_tarif: tanpa };
}

// ---------- pembacaan ----------
export function bacaJsonl(file) {
  const hasil = [];
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { hasil.push(JSON.parse(l)); } catch { /* baris terpotong */ }
  }
  return hasil;
}
const teksDari = (c) => (typeof c === "string" ? c
  : Array.isArray(c) ? c.filter((b) => b?.type === "text").map((b) => b.text ?? "").join("\n") : "");
const tanpaPengingat = (t) => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
const ts = (o) => (o?.timestamp ? Date.parse(o.timestamp) : NaN);
const barisPertama = (t) => String(t ?? "").trim().split("\n")[0] ?? "";
const potong = (t, n = 120) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** Klasifikasi baris transkrip sebagai pesan masuk; null bila bukan. → {jenis, teks, id, dari, isi} */
export function pesanMasuk(o) {
  if (o?.type !== "user" || o.isSidechain) return null;
  const c = o.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === "tool_result")) return null;
  const teks = teksDari(c);
  if (!teks) return null;
  const asal = o.origin?.kind;
  if (o.isMeta && asal !== "peer") return null; // ekspansi skill/command, bukan pesan masuk
  const lintas = teks.match(/<cross-session-message\b([^>]*)>([\s\S]*?)(?:<\/cross-session-message>|$)/);
  let jenis, isi = tanpaPengingat(teks), dari = null;
  if (lintas) {
    jenis = "lintas-sesi";
    dari = lintas[1].match(/\bfrom="([^"]+)"/)?.[1] ?? null;
    isi = lintas[2];
  } else if (asal === "human") jenis = "pengguna";
  else if (asal === "peer") { jenis = "subagent"; dari = o.origin.from ?? null; }
  else if (asal === "task-notification") jenis = "notifikasi";
  else if (/The session "[^"]*" you started/.test(teks)) { jenis = "notifikasi-sesi"; isi = teks; }
  else if (!o.promptSource && !asal && !isi.trimStart().startsWith("<task-notification")) jenis = "pengguna"; // format lama
  else if (/<command-name>/.test(teks)) jenis = "pengguna";
  else jenis = "lain";
  const id = isi.match(POLA_ID)?.[0] ?? null;
  return { jenis, teks, isi, id, dari };
}

/** Peta metadata Desktop: cliSessionId → {title, localId} dan localId → title. Format internal aplikasi; boleh tidak ada. */
export function muatDesktop(dir = DESKTOP()) {
  const cli = new Map(), lokal = new Map();
  // backend cli: judul dari `claude agents --json --all` (termasuk sesi latar yang sudah selesai)
  if (!process.env.RUDISONE_METRIK_DESKTOP && backendSesi().backend === "cli") {
    for (const e of normalAgents(agentsCli())) { cli.set(e.cli, { title: e.title, localId: e.localId }); lokal.set(e.localId, e.title); }
    return { cli, lokal };
  }
  const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
  for (const a of ls(dir)) for (const o of ls(path.join(dir, a))) for (const n of ls(path.join(dir, a, o))) {
    if (!/^local_.*\.json$/.test(n)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, a, o, n), "utf8"));
      if (j.cliSessionId) cli.set(j.cliSessionId, { title: j.title ?? null, localId: j.sessionId ?? null });
      if (j.sessionId) lokal.set(j.sessionId, j.title ?? null);
    } catch { /* sedang ditulis */ }
  }
  return { cli, lokal };
}

/**
 * Olah satu transkrip menjadi giliran (segmen) beratribusi. Satu giliran = satu pesan masuk + semua baris sesudahnya
 * sampai pesan masuk berikutnya. Aturan "dasar" (metrik-definisi.md): pesan masuk yang memuat ID menetapkan ID aktif;
 * pesan tanpa ID tidak mengubahnya; sebelum ID pertama = tanpa-ID. Aturan "diperluas" (koreksi Research Analyst):
 * + bila pesan masuk tanpa ID dan giliran asisten memunculkan ID yang belum pernah ada di sesi, ID baru itu aktif mulai
 * giliran itu dan giliran tanpa-ID tepat sebelumnya ikut dibebankan; + sesi yang cwd-nya di handoff/<ID>/ seluruhnya ke ID itu.
 */
export function olahTranskrip(baris, { atribusi = "dasar" } = {}) {
  const segmen = [];
  const sesi = { cwd: null, judul: null, agentSetting: null, coo: false, mulai: NaN, akhir: NaN };
  const msgDilihat = new Set(), alatDilihat = new Set();
  const alatById = new Map();
  let seg = null;
  const segBaru = (masuk, t) => {
    seg = { masuk, mulai: t, akhir: t, idMasuk: masuk?.id ?? null, idsAsisten: [], token: tokenKosong(), perModel: {},
      panggilan: 0, alat: [], jawaban: [], id: TANPA_ID };
    segmen.push(seg);
  };
  for (const o of baris) {
    const t = ts(o);
    if (o.cwd && !sesi.cwd) sesi.cwd = o.cwd;
    if (o.type === "agent-setting") sesi.agentSetting = o.agentSetting ?? sesi.agentSetting;
    if (o.type === "custom-title") sesi.judul = o.customTitle ?? sesi.judul;
    if (o.type !== "user" && o.type !== "assistant") continue;
    if (Number.isFinite(t)) {
      if (!(sesi.mulai <= t)) sesi.mulai = t;
      if (!(sesi.akhir >= t)) sesi.akhir = t;
    }
    const masuk = pesanMasuk(o);
    if (masuk) {
      if (/<command-name>\/rudisone<\/command-name>/.test(masuk.teks)) sesi.coo = true;
      segBaru(masuk, t);
      continue;
    }
    if (!seg) segBaru(null, t);
    if (Number.isFinite(t) && !(seg.akhir >= t)) seg.akhir = t;
    if (o.type === "assistant") {
      const m = o.message ?? {};
      const kunci = m.id ?? o.requestId ?? o.uuid;
      if (!msgDilihat.has(kunci)) {
        msgDilihat.add(kunci);
        seg.panggilan++;
        tambahUsage(seg.token, m.usage);
        const model = m.model ?? "tidak-diketahui";
        if (model !== "<synthetic>") tambahUsage(seg.perModel[model] ??= tokenKosong(), m.usage);
      }
      for (const b of m.content ?? []) {
        if (b?.type === "text") for (const x of b.text?.match(POLA_ID_G) ?? []) seg.idsAsisten.push(x);
        if (b?.type !== "tool_use" || alatDilihat.has(b.id)) continue;
        alatDilihat.add(b.id);
        const a = { nama: b.name, input: b.input ?? {}, ts: t, sidechain: !!o.isSidechain, gagal: false };
        seg.alat.push(a);
        alatById.set(b.id, a);
        for (const x of JSON.stringify(b.input ?? {}).match(POLA_ID_G) ?? []) seg.idsAsisten.push(x);
        if (b.name === "Skill" && b.input?.skill === "rudisone") sesi.coo = true;
      }
    } else {
      // tool_result: jawaban AskUserQuestion & status gagal alat
      for (const b of Array.isArray(o.message?.content) ? o.message.content : []) {
        if (b?.type !== "tool_result") continue;
        const a = alatById.get(b.tool_use_id);
        if (a && b.is_error) a.gagal = true;
      }
      const ans = o.toolUseResult?.answers;
      if (ans && typeof ans === "object") for (const v of Object.values(ans)) seg.jawaban.push(Array.isArray(v) ? v.join(", ") : String(v));
    }
  }
  if (sesi.agentSetting === "coo" || /^COO\b/.test(sesi.judul ?? "")) sesi.coo = true;
  // atribusi
  const idFolder = atribusi === "diperluas" ? sesi.cwd?.match(/\/handoff\/(T-\d{8}-\d+)(?:\/|$)/)?.[1] : null;
  let aktif = TANPA_ID;
  const dilihat = new Set();
  segmen.forEach((s, i) => {
    if (s.idMasuk) aktif = s.idMasuk;
    else if (atribusi === "diperluas" && s.masuk) {
      const baru = s.idsAsisten.find((x) => !dilihat.has(x));
      if (baru) {
        aktif = baru;
        if (i > 0 && segmen[i - 1].id === TANPA_ID) segmen[i - 1].id = baru;
      }
    }
    s.id = idFolder ?? aktif;
    if (s.idMasuk) dilihat.add(s.idMasuk);
    for (const x of s.idsAsisten) dilihat.add(x);
  });
  return { sesi, segmen };
}

/** ID aktif induk pada waktu t (segmen terakhir yang mulai ≤ t). */
function idPadaWaktu(segmen, t) {
  let id = TANPA_ID;
  for (const s of segmen) if (s.mulai <= t) id = s.id;
  return id;
}

/** Berkas transkrip utama (+ subagent) yang memuat ID — prasaring teks mentah supaya cepat. */
function daftarBerkas(id, sejakMs) {
  const akar = PROJECTS();
  const hasil = [];
  const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
  for (const d of ls(akar)) {
    const dir = path.join(akar, d);
    for (const n of ls(dir)) {
      if (!n.endsWith(".jsonl")) continue;
      const f = path.join(dir, n);
      let st;
      try { st = fs.statSync(f); } catch { continue; }
      if (sejakMs && st.mtimeMs < sejakMs) continue;
      let mentah;
      try { mentah = fs.readFileSync(f, "utf8"); } catch { continue; }
      if (!mentah.includes(id)) continue;
      const cli = n.slice(0, -".jsonl".length);
      const sub = path.join(dir, cli, "subagents");
      const subagent = ls(sub).filter((x) => /^agent-.*\.jsonl$/.test(x)).map((x) => path.join(sub, x));
      hasil.push({ file: f, proyek: d, cli, subagent });
    }
  }
  return hasil;
}

const ringkasJawaban = (js) => ({ jumlah: js.length, pilih_rekomendasi: js.filter((j) => /\(Rekomendasi\)/i.test(j)).length });

/** Hitung metrik satu ID. → objek JSON (per sesi + total). */
export function metrikTugas(id, { sejak = null, atribusi = "dasar", tarif = muatTarif(), biaya = true } = {}) {
  if (!/^T-\d{8}-\d+$/.test(id)) throw new Error(`ID tidak valid (pakai ID induk T-YYYYMMDD-n): ${id}`);
  const memuat = (s) => new RegExp(`${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`).test(String(s ?? ""));
  const sejakMs = sejak ? Date.parse(`${sejak}T00:00:00Z`) : null;
  const desktop = muatDesktop();
  const sesiList = [];
  const pesanKeluar = [], pesanMasukLintas = [];
  let pertamaMemuatId = Infinity;
  const total = { token: tokenKosong(), perModel: {}, panggilan: 0, giliran: 0, waktu_aktif_ms: 0, waktu_aktif_subagent_ms: 0,
    ask: { panggilan: 0, pertanyaan: 0 }, jawaban: [], prompt_pengguna_coo: 0, prompt_pengguna_lain: 0, start_session: { panggilan: 0, gagal: 0 },
    pertama: Infinity, terakhir: -Infinity };
  const dalamRentang = (t) => !sejakMs || !(t < sejakMs);

  for (const b of daftarBerkas(id, sejakMs)) {
    const { sesi, segmen } = olahTranskrip(bacaJsonl(b.file), { atribusi });
    const d = desktop.cli.get(b.cli);
    const judul = d?.title ?? sesi.judul ?? sesi.agentSetting ?? null;
    // pesan ber-ID (lepas dari atribusi): keluar = SendMessage yang baris pertamanya memuat ID; masuk = lintas sesi ber-ID
    for (const s of segmen) {
      if (s.masuk && memuat(s.masuk.isi) && dalamRentang(s.mulai)) pertamaMemuatId = Math.min(pertamaMemuatId, s.mulai);
      if (s.masuk?.jenis === "lintas-sesi" && memuat(barisPertama(s.masuk.isi)) && dalamRentang(s.mulai))
        pesanMasukLintas.push({ sesi: b.cli, judul, dari: desktop.lokal.get(s.masuk.dari) ?? s.masuk.dari, ts: new Date(s.mulai).toISOString(),
          baris_pertama: potong(barisPertama(s.masuk.isi)), revisi: /^\s*\[Revisi/i.test(s.masuk.isi), perlu_revisi: /^\s*\[Hasil tinjauan\][^\n]*PERLU REVISI/.test(barisPertama(s.masuk.isi)) });
      for (const a of s.alat) {
        if (a.nama !== "SendMessage" || !dalamRentang(a.ts)) continue;
        const pesan = String(a.input.message ?? "");
        if (!memuat(barisPertama(pesan))) continue;
        pesanKeluar.push({ sesi: b.cli, judul, ke: desktop.lokal.get(a.input.to) ?? a.input.to ?? null, ts: new Date(a.ts).toISOString(),
          baris_pertama: potong(barisPertama(pesan)), revisi: /^\s*\[Revisi/i.test(pesan), perlu_revisi: /^\s*\[Hasil tinjauan\][^\n]*PERLU REVISI/.test(barisPertama(pesan)) });
      }
    }
    // giliran teratribusi
    const milik = segmen.filter((s) => s.id === id && dalamRentang(s.mulai));
    const subTerlibat = [];
    for (const f of b.subagent) {
      const sb = olahTranskrip(bacaJsonl(f), { atribusi: "dasar" });
      if (!Number.isFinite(sb.sesi.mulai) || idPadaWaktu(segmen, sb.sesi.mulai) !== id || !dalamRentang(sb.sesi.mulai)) continue;
      const tok = tokenKosong(), pm = {};
      let panggilan = 0;
      for (const s of sb.segmen) {
        gabungToken(tok, s.token);
        panggilan += s.panggilan;
        for (const [m, t] of Object.entries(s.perModel)) gabungToken(pm[m] ??= tokenKosong(), t);
      }
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(f.replace(/\.jsonl$/, ".meta.json"), "utf8")); } catch { /* opsional */ }
      subTerlibat.push({ file: f, jenis: meta.agentType ?? null, deskripsi: meta.description ?? null, token: tok, perModel: pm,
        panggilan, waktu_ms: sb.sesi.akhir - sb.sesi.mulai, mulai: sb.sesi.mulai, akhir: sb.sesi.akhir });
    }
    if (!milik.length && !subTerlibat.length) continue;
    const tok = tokenKosong(), pm = {};
    let panggilan = 0, aktifMs = 0, pertama = Infinity, terakhir = -Infinity, pPengguna = 0;
    const ask = { panggilan: 0, pertanyaan: 0 }, jawaban = [], ss = { panggilan: 0, gagal: 0 };
    for (const s of milik) {
      gabungToken(tok, s.token);
      for (const [m, t] of Object.entries(s.perModel)) gabungToken(pm[m] ??= tokenKosong(), t);
      panggilan += s.panggilan;
      aktifMs += Math.max(0, s.akhir - s.mulai);
      pertama = Math.min(pertama, s.mulai);
      terakhir = Math.max(terakhir, s.akhir);
      if (s.masuk?.jenis === "pengguna") pPengguna++;
      for (const a of s.alat) {
        if (a.nama === "AskUserQuestion") { ask.panggilan++; ask.pertanyaan += Array.isArray(a.input.questions) ? a.input.questions.length : 1; }
        if (a.nama === "mcp__ccd_session__start_session") { ss.panggilan++; if (a.gagal) ss.gagal++; }
      }
      jawaban.push(...s.jawaban);
    }
    const subTok = tokenKosong(), subPm = {};
    let subPanggilan = 0, subMs = 0;
    for (const x of subTerlibat) {
      gabungToken(subTok, x.token);
      for (const [m, t] of Object.entries(x.perModel)) gabungToken(subPm[m] ??= tokenKosong(), t);
      subPanggilan += x.panggilan;
      subMs += Math.max(0, x.waktu_ms);
      pertama = Math.min(pertama, x.mulai);
      terakhir = Math.max(terakhir, x.akhir);
    }
    const tokSemua = gabungToken(structuredClone(tok), subTok);
    const pmSemua = structuredClone(pm);
    for (const [m, t] of Object.entries(subPm)) gabungToken(pmSemua[m] ??= tokenKosong(), t);
    const entri = {
      sesi: b.cli, proyek: b.proyek, judul, cwd: sesi.cwd ? sesi.cwd.replace(HOME, "~") : null, peran: sesi.agentSetting, coo: sesi.coo,
      giliran: milik.length, panggilan_api: panggilan, token: tok,
      subagent: { jumlah: subTerlibat.length, panggilan_api: subPanggilan, token: subTok, waktu_ms: subMs,
        daftar: subTerlibat.map((x) => ({ jenis: x.jenis, deskripsi: x.deskripsi, panggilan_api: x.panggilan, token_total: x.token.total })) },
      token_termasuk_subagent: tokSemua, per_model: pmSemua,
      pertama: Number.isFinite(pertama) ? new Date(pertama).toISOString() : null,
      terakhir: Number.isFinite(terakhir) ? new Date(terakhir).toISOString() : null,
      waktu_aktif_ms: aktifMs,
      ask_user_question: ask, jawaban_pengguna: ringkasJawaban(jawaban), start_session: ss,
      prompt_pengguna: pPengguna,
    };
    if (biaya) entri.biaya_usd_perkiraan = hitungBiaya(pmSemua, tarif).usd;
    sesiList.push(entri);
    // total
    gabungToken(total.token, tokSemua);
    for (const [m, t] of Object.entries(pmSemua)) gabungToken(total.perModel[m] ??= tokenKosong(), t);
    total.panggilan += panggilan + subPanggilan;
    total.giliran += milik.length;
    total.waktu_aktif_ms += aktifMs;
    total.waktu_aktif_subagent_ms += subMs;
    if (sesi.coo) {
      total.ask.panggilan += ask.panggilan; total.ask.pertanyaan += ask.pertanyaan;
      total.jawaban.push(...jawaban);
      total.prompt_pengguna_coo += pPengguna;
    } else total.prompt_pengguna_lain += pPengguna;
    total.start_session.panggilan += ss.panggilan; total.start_session.gagal += ss.gagal;
    total.pertama = Math.min(total.pertama, pertama);
    total.terakhir = Math.max(total.terakhir, terakhir);
  }
  sesiList.sort((a, b) => String(a.pertama).localeCompare(String(b.pertama)));
  const revisi = {
    keluar_tag_revisi: pesanKeluar.filter((p) => p.revisi).length,
    keluar_perlu_revisi: pesanKeluar.filter((p) => p.perlu_revisi).length,
    masuk_tag_revisi: pesanMasukLintas.filter((p) => p.revisi).length,
    masuk_perlu_revisi: pesanMasukLintas.filter((p) => p.perlu_revisi).length,
  };
  revisi.total_m2 = revisi.keluar_tag_revisi + revisi.keluar_perlu_revisi;
  const jaw = ringkasJawaban(total.jawaban);
  const hasil = {
    id, atribusi, dibuat: new Date().toISOString(), sejak,
    sumber: { projects: PROJECTS().replace(HOME, "~"), desktop: DESKTOP().replace(HOME, "~") },
    total: {
      sesi_terlibat: sesiList.length,
      subagent: sesiList.reduce((n, s) => n + s.subagent.jumlah, 0),
      giliran: total.giliran, panggilan_api: total.panggilan,
      token: total.token, per_model: total.perModel,
      pertama_memuat_id: Number.isFinite(pertamaMemuatId) ? new Date(pertamaMemuatId).toISOString() : null,
      pertama: Number.isFinite(total.pertama) ? new Date(total.pertama).toISOString() : null,
      terakhir: Number.isFinite(total.terakhir) ? new Date(total.terakhir).toISOString() : null,
      rentang_ms: Number.isFinite(total.pertama) ? total.terakhir - total.pertama : null,
      waktu_aktif_ms: total.waktu_aktif_ms, waktu_aktif_subagent_ms: total.waktu_aktif_subagent_ms,
      pesan: { keluar: pesanKeluar.length, masuk_lintas_sesi: pesanMasukLintas.length },
      revisi,
      intervensi: { ask_user_question: total.ask, prompt_pengguna_coo: total.prompt_pengguna_coo,
        jawaban: jaw.jumlah, jawaban_pilih_rekomendasi: jaw.pilih_rekomendasi,
        rasio_pilih_rekomendasi: jaw.jumlah ? Math.round((jaw.pilih_rekomendasi / jaw.jumlah) * 1000) / 1000 : null,
        prompt_pengguna_sesi_lain: total.prompt_pengguna_lain },
      start_session: total.start_session,
    },
    sesi: sesiList,
    pesan_keluar: pesanKeluar.sort((a, b) => a.ts.localeCompare(b.ts)),
    pesan_masuk_lintas_sesi: pesanMasukLintas.sort((a, b) => a.ts.localeCompare(b.ts)),
    catatan: [
      "Token di-dedup per message.id; total sesi termasuk subagent (subagent mewarisi ID aktif induk saat mulai).",
      "pesan.keluar dan pesan.masuk_lintas_sesi bisa menghitung pesan yang sama dari dua sisi; M5 memakai keluar (+ masuk dari sesi di luar pindaian).",
      "revisi.total_m2 = peristiwa unik dari sisi pengirim: baris pertama SendMessage berawalan [Revisi] atau [Hasil tinjauan] … PERLU REVISI; 'tugas dibuka ulang' tidak terdeteksi otomatis.",
      "waktu_aktif = jumlah durasi giliran teratribusi (pesan masuk → baris terakhir giliran); kerja paralel bisa melebihi rentang.",
    ],
  };
  if (biaya) {
    const bi = hitungBiaya(total.perModel, tarif);
    hasil.total.biaya_usd_perkiraan = bi.usd;
    hasil.total.biaya_catatan = `perkiraan, harga daftar API per token${bi.tanpa_tarif.length ? `; tanpa tarif: ${bi.tanpa_tarif.join(", ")}` : ""}`;
  }
  return hasil;
}

/** X14 — beban keputusan pengguna untuk satu tugas: pertanyaan AskUserQuestion + prompt pengguna di sesi COO yang
 *  teratribusi + prompt izin yang disetujui pemilik (audit: jenjang ≥3 dan berkas-terlindung ber-ID tugas itu).
 *  Perintah yang harus diketik pengguna sendiri tidak terlihat mesin — dicatat manual di laporan bila ada. */
export function bebanKeputusan(id, intervensi, { jenis = null, dirAudit = AUDIT() } = {}) {
  let prompt_izin = 0;
  try {
    for (const f of fs.readdirSync(dirAudit).filter((x) => /^\d{4}-\d{2}\.jsonl$/.test(x))) {
      for (const l of fs.readFileSync(path.join(dirAudit, f), "utf8").split("\n")) {
        if (!l.trim()) continue;
        let r; try { r = JSON.parse(l); } catch { continue; }
        if (r.tugas && String(r.tugas).split(".")[0] === id.split(".")[0] && (r.jenjang >= 3 || r.jenis === "berkas-terlindung")) prompt_izin++;
      }
    }
  } catch { /* audit belum ada */ }
  const pertanyaan = intervensi?.ask_user_question?.pertanyaan ?? 0;
  const prompt_pengguna = intervensi?.prompt_pengguna_coo ?? 0;
  const total = pertanyaan + prompt_pengguna + prompt_izin;
  const anggaran = jenis ? ANGGARAN_KEPUTUSAN[jenis] ?? null : null;
  return { pertanyaan, prompt_pengguna, prompt_izin, total, jenis, anggaran, dalam_anggaran: anggaran == null ? null : total <= anggaran };
}

// ---------- tampilan teks ----------
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("id-ID"));
const menit = (ms) => (ms == null ? "—" : `${(ms / 60000).toFixed(1)} mnt`);
export function formatTeks(h) {
  const t = h.total;
  const out = [];
  out.push(`Metrik ${h.id} (atribusi ${h.atribusi}${h.sejak ? `, sejak ${h.sejak}` : ""})`);
  out.push(`Sesi terlibat ${t.sesi_terlibat} (+${t.subagent} subagent) · giliran ${t.giliran} · panggilan API ${fmt(t.panggilan_api)}`);
  out.push(`Token: input ${fmt(t.token.input)} · cache_creation ${fmt(t.token.cache_creation)} · cache_read ${fmt(t.token.cache_read)} · output ${fmt(t.token.output)} · total ${fmt(t.token.total)}`);
  if (t.biaya_usd_perkiraan != null) out.push(`Biaya ≈ USD ${t.biaya_usd_perkiraan.toFixed(2)} (${t.biaya_catatan})`);
  out.push(`Waktu: pertama memuat ID ${t.pertama_memuat_id ?? "—"} · aktivitas ${t.pertama ?? "—"} → ${t.terakhir ?? "—"} (${menit(t.rentang_ms)}) · aktif ${menit(t.waktu_aktif_ms)} (+subagent ${menit(t.waktu_aktif_subagent_ms)})`);
  out.push(`Pesan ber-ID: keluar ${t.pesan.keluar} · masuk lintas sesi ${t.pesan.masuk_lintas_sesi} · revisi (M2) ${t.revisi.total_m2}`);
  if (t.beban_keputusan) { const b = t.beban_keputusan; out.push(`Beban keputusan (X14): ${b.total} = pertanyaan ${b.pertanyaan} + prompt pengguna ${b.prompt_pengguna} + prompt izin ${b.prompt_izin}${b.anggaran != null ? ` · anggaran ${b.jenis} ≤${b.anggaran} → ${b.dalam_anggaran ? "dalam" : "MELEBIHI"}` : ""}`); }
  out.push(`Intervensi (sesi COO): AskUserQuestion ${t.intervensi.ask_user_question.panggilan} panggilan/${t.intervensi.ask_user_question.pertanyaan} pertanyaan · prompt pengguna ${t.intervensi.prompt_pengguna_coo} · pilih rekomendasi ${t.intervensi.jawaban_pilih_rekomendasi}/${t.intervensi.jawaban}`);
  out.push("");
  out.push("| Sesi | Judul | Giliran | Panggilan | Token total | Subagent | Biaya≈ | Aktif |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const s of h.sesi) out.push(`| ${s.sesi.slice(0, 8)} | ${s.judul ?? "—"}${s.coo ? " (COO)" : ""} | ${s.giliran} | ${s.panggilan_api} | ${fmt(s.token_termasuk_subagent.total)} | ${s.subagent.jumlah} | ${s.biaya_usd_perkiraan != null ? s.biaya_usd_perkiraan.toFixed(2) : "—"} | ${menit(s.waktu_aktif_ms)} |`);
  return out.join("\n");
}

function main(argv) {
  const [cmd, id, ...rest] = argv;
  const opsi = { json: false, sejak: null, atribusi: "dasar", tarif: null, biaya: true, jenis: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") opsi.json = true;
    else if (a === "--sejak") opsi.sejak = rest[++i];
    else if (a === "--atribusi") opsi.atribusi = rest[++i];
    else if (a === "--tarif") opsi.tarif = rest[++i];
    else if (a === "--tanpa-biaya") opsi.biaya = false;
    else if (a === "--jenis") opsi.jenis = rest[++i];
    else { console.error(`Opsi tidak dikenal: ${a}`); return 2; }
  }
  if (cmd !== "tugas" || !id || !POLA_ID.test(id)) {
    console.error("Pakai: node bin/metrik.mjs tugas <T-YYYYMMDD-n> [--json] [--sejak YYYY-MM-DD] [--atribusi dasar|diperluas|keduanya] [--tarif file.json] [--tanpa-biaya] [--jenis bug|fitur]");
    return 2;
  }
  if (opsi.sejak && !/^\d{4}-\d{2}-\d{2}$/.test(opsi.sejak)) { console.error("--sejak harus YYYY-MM-DD"); return 2; }
  if (opsi.jenis && !(opsi.jenis in ANGGARAN_KEPUTUSAN)) { console.error(`--jenis: ${Object.keys(ANGGARAN_KEPUTUSAN).join(" | ")}`); return 2; }
  if (!["dasar", "diperluas", "keduanya"].includes(opsi.atribusi)) { console.error("--atribusi: dasar | diperluas | keduanya"); return 2; }
  const tarif = muatTarif(opsi.tarif ?? undefined);
  const jalan = (atribusi) => {
    const h = metrikTugas(id, { sejak: opsi.sejak, atribusi, tarif, biaya: opsi.biaya });
    h.total.beban_keputusan = bebanKeputusan(id, h.total.intervensi, { jenis: opsi.jenis });
    return h;
  };
  if (opsi.atribusi === "keduanya") {
    const h = { id, dasar: jalan("dasar"), diperluas: jalan("diperluas") };
    console.log(opsi.json ? JSON.stringify(h, null, 2) : `${formatTeks(h.dasar)}\n\n${formatTeks(h.diperluas)}`);
  } else {
    const h = jalan(opsi.atribusi);
    console.log(opsi.json ? JSON.stringify(h, null, 2) : formatTeks(h));
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
