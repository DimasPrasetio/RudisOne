#!/usr/bin/env node
// Agregasi hasil suite regresi → ringkasan-<label>.md (S1–S7 per tugas & total) dan banding.md (dua label).
//
//   node uji/suite/nilai.mjs <label> [<label2>] [--keluar <dir>] [--nilai-ulang]
//
// S1 skor rubrik (proporsi cek lulus, rata-rata jalan) · S2 pass^k (lulus semua cek wajib di semua ulangan) ·
// S3 cek wajib gagal (proxy revisi) · S4 sesi (dibentuk+dipulihkan), pesan, subagent menurut rencana ·
// S5 biaya total_cost_usd & token usage · S6 duration_ms · S7 num_turns. Rata-rata dengan rentang [min–maks].
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { muatTugas, nilaiJalan, metrikRencana } from "./rubrik.mjs";

const KELUAR_BAWAAN = process.env.RUDISONE_UJI_KELUAR
  || path.join(os.homedir(), "Documents", "Neuron", "ai-agent", "RudisOne", "handoff", "T-20261030-2", "uji");

export function bacaHasil(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}
const tokenTotal = (u) => (u ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0) : null);
function stat(xs) {
  const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x));
  if (!v.length) return { n: 0, rata: null, min: null, maks: null, jumlah: null };
  const jumlah = v.reduce((a, b) => a + b, 0);
  return { n: v.length, rata: jumlah / v.length, min: Math.min(...v), maks: Math.max(...v), jumlah };
}

/** Ringkas rekaman satu label. Rekaman terakhir per (tugas, ulang) yang dipakai (jalan ulang menimpa). */
export function ringkas(rekaman, { nilaiUlang = false, tugas = muatTugas() } = {}) {
  const peta = new Map();
  for (const r of rekaman) peta.set(`${r.tugas}#${r.ulang}`, r);
  const jalan = [...peta.values()].map((r) => {
    if (!nilaiUlang) return r;
    const t = tugas.find((x) => x.id === r.tugas);
    if (!t) return r;
    const cek = nilaiJalan(t, { teks: r.result ?? "", rencana: r.rencana, is_error: r.is_error });
    return { ...r, cek, lulus_wajib: cek.filter((c) => c.wajib).every((c) => c.lulus), skor: cek.filter((c) => c.lulus).length / cek.length,
      metrik_rencana: metrikRencana(r.rencana) };
  });
  const urutan = tugas.map((t) => t.id);
  const ids = [...new Set(jalan.map((r) => r.tugas))].sort((a, b) => urutan.indexOf(a) - urutan.indexOf(b));
  const perTugas = ids.map((id) => {
    const rs = jalan.filter((r) => r.tugas === id).sort((a, b) => a.ulang - b.ulang);
    const gagalWajib = rs.flatMap((r) => r.cek.filter((c) => c.wajib && !c.lulus).map((c) => `${c.kode}#${r.ulang}`));
    const gagalTambahan = rs.flatMap((r) => r.cek.filter((c) => !c.wajib && !c.lulus).map((c) => `${c.kode}#${r.ulang}`));
    return {
      tugas: id, k: rs.length,
      s1: stat(rs.map((r) => r.skor)),
      s2: rs.length > 0 && rs.every((r) => r.lulus_wajib),
      s3: gagalWajib.length, gagal_wajib: gagalWajib, gagal_tambahan: gagalTambahan,
      s4: { sesi: stat(rs.map((r) => r.metrik_rencana?.sesi)), pesan: stat(rs.map((r) => r.metrik_rencana?.pesan)), subagent: stat(rs.map((r) => r.metrik_rencana?.subagent)) },
      s5: { usd: stat(rs.map((r) => r.total_cost_usd)), token: stat(rs.map((r) => tokenTotal(r.usage))) },
      s6: stat(rs.map((r) => r.duration_ms)),
      s7: stat(rs.map((r) => r.num_turns)),
      penolakan_izin: rs.reduce((n, r) => n + (r.permission_denials?.length ?? 0), 0),
      model: [...new Set(rs.flatMap((r) => Object.keys(r.modelUsage ?? {})))],
    };
  });
  const total = {
    jalan: jalan.length, tugas: perTugas.length,
    s1: stat(jalan.map((r) => r.skor)),
    s2: { lulus: perTugas.filter((t) => t.s2).length, dari: perTugas.length },
    s3: perTugas.reduce((n, t) => n + t.s3, 0),
    s4: { sesi: stat(jalan.map((r) => r.metrik_rencana?.sesi)), pesan: stat(jalan.map((r) => r.metrik_rencana?.pesan)), subagent: stat(jalan.map((r) => r.metrik_rencana?.subagent)) },
    s5: { usd: stat(jalan.map((r) => r.total_cost_usd)), token: stat(jalan.map((r) => tokenTotal(r.usage))) },
    s6: stat(jalan.map((r) => r.duration_ms)),
    s7: stat(jalan.map((r) => r.num_turns)),
    penolakan_izin: perTugas.reduce((n, t) => n + t.penolakan_izin, 0),
    model: [...new Set(perTugas.flatMap((t) => t.model))],
    ref: [...new Set(jalan.map((r) => `${r.ref} (${String(r.sha).slice(0, 12)})`))],
  };
  return { perTugas, total };
}

// ---------- Markdown ----------
const f = (x, d = 2) => (x == null ? "—" : Number(x).toFixed(d));
const rr = (s, d = 2, skala = 1) => (s.n ? `${f(s.rata / skala, d)} [${f(s.min / skala, d)}–${f(s.maks / skala, d)}]` : "—");
const ribu = (s) => (s.n ? `${Math.round(s.rata / 1000)}k [${Math.round(s.min / 1000)}k–${Math.round(s.maks / 1000)}k]` : "—");
const pct = (s) => (s.n ? `${Math.round(s.rata * 100)}%` : "—");

export function markdownRingkasan(label, { perTugas, total }) {
  const o = [];
  o.push(`# Ringkasan suite — ${label}`, "");
  o.push(`Ref: ${total.ref.join(", ")} · ${total.jalan} jalan, ${total.tugas} tugas · model: ${total.model.join(", ") || "—"}`, "");
  o.push("Rata-rata [min–maks] per jalan. S2 = lulus semua cek wajib di semua ulangan (pass^k).", "");
  o.push("| Tugas | k | S1 skor | S2 pass^k | S3 wajib gagal | S4 sesi | S4 pesan | S4 subagent | S5 USD | S5 token | S6 detik | S7 turns | Gagal (W / T) |");
  o.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const t of perTugas) {
    o.push(`| ${t.tugas} | ${t.k} | ${pct(t.s1)} | ${t.s2 ? "lulus" : "gagal"} | ${t.s3} | ${rr(t.s4.sesi, 1)} | ${rr(t.s4.pesan, 1)} | ${rr(t.s4.subagent, 1)} | ${rr(t.s5.usd, 3)} | ${ribu(t.s5.token)} | ${rr(t.s6, 0, 1000)} | ${rr(t.s7, 1)} | ${t.gagal_wajib.join(", ") || "—"} / ${t.gagal_tambahan.join(", ") || "—"} |`);
  }
  o.push(`| **Total** | ${total.jalan} | ${pct(total.s1)} | ${total.s2.lulus}/${total.s2.dari} | ${total.s3} | ${rr(total.s4.sesi, 1)} | ${rr(total.s4.pesan, 1)} | ${rr(total.s4.subagent, 1)} | ${rr(total.s5.usd, 3)} | ${ribu(total.s5.token)} | ${rr(total.s6, 0, 1000)} | ${rr(total.s7, 1)} | |`);
  o.push("", `Biaya total: USD ${f(total.s5.usd.jumlah, 3)} · penolakan izin (permission_denials): ${total.penolakan_izin}`);
  return o.join("\n") + "\n";
}

export function markdownBanding(a, ra, b, rb) {
  const o = [];
  const d = (x, y, dd = 2) => (x == null || y == null ? "—" : `${y - x >= 0 ? "+" : ""}${(y - x).toFixed(dd)}`);
  o.push(`# Banding suite — ${a} vs ${b}`, "");
  o.push(`${a}: ${ra.total.ref.join(", ")} · ${b}: ${rb.total.ref.join(", ")}`, "");
  o.push(`| Tugas | S1 ${a} | S1 ${b} | S2 ${a} | S2 ${b} | S3 ${a}→${b} | S4 sesi ${a}→${b} | S4 pesan ${a}→${b} | S5 USD ${a} | S5 USD ${b} | Δ USD | S6 dtk ${a}→${b} | S7 ${a}→${b} |`);
  o.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const ids = [...new Set([...ra.perTugas, ...rb.perTugas].map((t) => t.tugas))];
  for (const id of ids) {
    const x = ra.perTugas.find((t) => t.tugas === id), y = rb.perTugas.find((t) => t.tugas === id);
    const g = (t, fn) => (t ? fn(t) : null);
    o.push(`| ${id} | ${x ? pct(x.s1) : "—"} | ${y ? pct(y.s1) : "—"} | ${x ? (x.s2 ? "lulus" : "gagal") : "—"} | ${y ? (y.s2 ? "lulus" : "gagal") : "—"} | ${g(x, (t) => t.s3) ?? "—"}→${g(y, (t) => t.s3) ?? "—"} | ${f(g(x, (t) => t.s4.sesi.rata), 1)}→${f(g(y, (t) => t.s4.sesi.rata), 1)} | ${f(g(x, (t) => t.s4.pesan.rata), 1)}→${f(g(y, (t) => t.s4.pesan.rata), 1)} | ${f(g(x, (t) => t.s5.usd.rata), 3)} | ${f(g(y, (t) => t.s5.usd.rata), 3)} | ${d(g(x, (t) => t.s5.usd.rata), g(y, (t) => t.s5.usd.rata), 3)} | ${f(g(x, (t) => t.s6.rata / 1000), 0)}→${f(g(y, (t) => t.s6.rata / 1000), 0)} | ${f(g(x, (t) => t.s7.rata), 1)}→${f(g(y, (t) => t.s7.rata), 1)} |`);
  }
  const A = ra.total, B = rb.total;
  o.push(`| **Total** | ${pct(A.s1)} | ${pct(B.s1)} | ${A.s2.lulus}/${A.s2.dari} | ${B.s2.lulus}/${B.s2.dari} | ${A.s3}→${B.s3} | ${f(A.s4.sesi.rata, 1)}→${f(B.s4.sesi.rata, 1)} | ${f(A.s4.pesan.rata, 1)}→${f(B.s4.pesan.rata, 1)} | ${f(A.s5.usd.rata, 3)} | ${f(B.s5.usd.rata, 3)} | ${d(A.s5.usd.rata, B.s5.usd.rata, 3)} | ${f(A.s6.rata / 1000, 0)}→${f(B.s6.rata / 1000, 0)} | ${f(A.s7.rata, 1)}→${f(B.s7.rata, 1)} |`);
  o.push("", `Biaya total: ${a} USD ${f(A.s5.usd.jumlah, 3)} · ${b} USD ${f(B.s5.usd.jumlah, 3)}. Token rata-rata: ${a} ${ribu(A.s5.token)} · ${b} ${ribu(B.s5.token)}.`);
  o.push("", "Catatan: n kecil (k=2 per tugas); selisih satu jalan bisa berasal dari variasi model, bukan versi repo.");
  return o.join("\n") + "\n";
}

function main(argv) {
  const label = [];
  let keluar = KELUAR_BAWAAN, nilaiUlang = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--keluar") keluar = path.resolve(argv[++i]);
    else if (argv[i] === "--nilai-ulang") nilaiUlang = true;
    else if (argv[i].startsWith("--")) { console.error(`opsi tidak dikenal: ${argv[i]}`); return 2; }
    else label.push(argv[i]);
  }
  if (label.length < 1 || label.length > 2) { console.error("Pakai: node uji/suite/nilai.mjs <label> [<label2>] [--keluar dir] [--nilai-ulang]"); return 2; }
  const hasil = label.map((l) => {
    const file = path.join(keluar, `hasil-${l}.jsonl`);
    if (!fs.existsSync(file)) throw new Error(`tidak ada ${file}`);
    const r = ringkas(bacaHasil(file), { nilaiUlang });
    const md = markdownRingkasan(l, r);
    fs.writeFileSync(path.join(keluar, `ringkasan-${l}.md`), md);
    console.log(md);
    return r;
  });
  if (hasil.length === 2) {
    const md = markdownBanding(label[0], hasil[0], label[1], hasil[1]);
    fs.writeFileSync(path.join(keluar, "banding.md"), md);
    console.log(md);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
