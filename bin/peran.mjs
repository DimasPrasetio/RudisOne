// Definisi subagent per peran RudisOne (protokol.md › Model sesi). Sumber tunggal: agents/<id-peran>.md + protokol.md;
// berkas agen/rudis-<id-peran>.md DIBANGKITKAN dari keduanya (jangan diedit tangan) lalu ditautkan install.sh ke
// ~/.claude/agents/ agar bisa dipanggil `Agent` dengan subagent_type "rudis-<id-peran>" dari sesi mana pun.
// Pemakaian: node bin/peran.mjs bangun | cek | daftar
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const RUMAH = "~/Documents/Neuron/ai-agent/RudisOne";
/** COO tidak dibangkitkan: ia utas utama (settings "agent": "coo" atau skill /rudisone), bukan subagent. */
const BUKAN_SUBAGENT = new Set(["coo"]);

/** Pisahkan frontmatter YAML sederhana (key: value satu baris) dari isi. */
export function pisahFrontmatter(teks) {
  const m = String(teks).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, isi: String(teks) };
  const fm = {};
  for (const l of m[1].split("\n")) { const k = l.match(/^([A-Za-z_-]+):\s*(.*)$/); if (k) fm[k[1]] = k[2]; }
  return { fm, isi: m[2] };
}

/** Jabatan (nama tampilan) dari baris "Peran: **<Jabatan>** …" berkas peran. */
export function jabatanDari(isi, id) {
  return String(isi).match(/Peran:\s*\*\*([^*]+)\*\*/)?.[1]?.trim() ?? id;
}

export function daftarPeran(root = ROOT) {
  return fs.readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3))
    .filter((id) => !BUKAN_SUBAGENT.has(id)).sort();
}

/** Isi berkas agen/rudis-<id>.md untuk satu peran — deterministik (tanpa waktu), agar `cek` bisa membandingkan. */
export function bangkitkan(id, root = ROOT) {
  const sumberPeran = fs.readFileSync(path.join(root, "agents", `${id}.md`), "utf8");
  const sumberInti = fs.readFileSync(path.join(root, "protokol.md"), "utf8");
  const { fm, isi } = pisahFrontmatter(sumberPeran);
  const jabatan = jabatanDari(isi, id);
  const sidik = crypto.createHash("sha1").update(sumberPeran).update("\0").update(sumberInti).digest("hex").slice(0, 12);
  const desk = `RudisOne · ${jabatan} (subagent dari definisi peran). ${String(fm.description ?? "").replace(/\s+/g, " ").trim()}`;
  const kepala = ["---", `name: rudis-${id}`, `description: ${JSON.stringify(desk)}`, "model: inherit"];
  if (fm.color) kepala.push(`color: ${fm.color}`);
  kepala.push("---");
  return `${kepala.join("\n")}
<!-- DIBANGKITKAN oleh bin/peran.mjs dari agents/${id}.md + protokol.md (sidik ${sidik}). Jangan diedit: ubah sumbernya lalu jalankan bin/peran.sh bangun. -->

Kamu adalah ${jabatan} di RudisOne, dipanggil sebagai **subagent** oleh COO atau seorang leader.

## Mode subagent (berlaku di atas bagian peran di bawah)
- Pemanggilmu adalah pemberi tugas. **Jawaban akhirmu adalah laporanmu**: baris pertama
  \`[Laporan ke <pemanggil>] <ID> · <judul>\` (tidak bisa lanjut: \`[Terhambat] <judul> — <sebab, yang dibutuhkan>\`),
  lalu isi sesuai format laporan peranmu — kriteria selesai per nomor + bukti yang dapat dieksekusi.
- Kamu tidak mengirim \`SendMessage\`, tidak membuat/mengelola sesi, tidak \`clear_session\`, dan tidak bertanya ke
  pengguna. Butuh keputusan pengguna → tulis di bagian "Keputusan yang dibutuhkan"; kerjakan bagian yang bisa.
- Kamu bekerja di folder pemanggil (atau worktree terisolasi bila diminta). Tulis hanya berkas yang disebut brief dan
  \`${RUMAH}/handoff/<ID>/\`. Pelajaran awet: tambahkan poin bertanggal ke \`${RUMAH}/catatan/${id}.md\` sebelum melapor
  (bila berkas itu ada); bacalah berkas itu di awal.
- Aksi berisiko (deploy, restart, ubah DNS/config server, push, commit ke branch utama, kirim pesan, tulis/hapus data
  production) tidak pernah kamu jalankan sebagai subagent — kembalikan rencananya ke pemanggil.
- Bagian peran di bawah ditulis juga untuk mode sesi: kalimat tentang sesi, \`SendMessage\`, tembusan, atau
  \`clear_session\` berlaku hanya bila kamu dijalankan sebagai sesi.

# Peran
${isi.trim()}

# Protokol inti RudisOne (salinan \`protokol.md\`)
${sumberInti.replace(/^# .*\n/, "").trim()}
`;
}

export function bangun(root = ROOT, tulis = true) {
  const dir = path.join(root, "agen");
  const hasil = [];
  if (tulis) fs.mkdirSync(dir, { recursive: true });
  const ada = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^rudis-.*\.md$/.test(f)) : []);
  for (const id of daftarPeran(root)) {
    const f = path.join(dir, `rudis-${id}.md`);
    const isi = bangkitkan(id, root);
    const lama = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
    ada.delete(`rudis-${id}.md`);
    if (lama === isi) { hasil.push({ id, status: "sama" }); continue; }
    if (tulis) fs.writeFileSync(f, isi);
    hasil.push({ id, status: lama === null ? "baru" : "basi" });
  }
  for (const sisa of ada) { if (tulis) fs.rmSync(path.join(dir, sisa)); hasil.push({ id: sisa.slice(6, -3), status: "yatim" }); }
  return hasil;
}

function utama(argv) {
  const [cmd = "cek"] = argv;
  if (cmd === "bangun") {
    for (const r of bangun()) if (r.status !== "sama") console.log(`  ${r.status === "yatim" ? "dihapus" : r.status === "baru" ? "dibuat" : "diperbarui"}  agen/rudis-${r.id}.md`);
    console.log(`Subagent peran siap: ${daftarPeran().length} berkas di agen/.`);
    return 0;
  }
  if (cmd === "cek") {
    const salah = bangun(ROOT, false).filter((r) => r.status !== "sama");
    if (!salah.length) { console.log(`Subagent peran mutakhir (${daftarPeran().length}).`); return 0; }
    for (const r of salah) console.log(`  ${r.status}: agen/rudis-${r.id}.md`);
    console.log("Jalankan: bin/peran.sh bangun");
    return 1;
  }
  if (cmd === "daftar") { for (const id of daftarPeran()) console.log(`rudis-${id}`); return 0; }
  console.error("Pemakaian: bin/peran.sh bangun | cek | daftar");
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = utama(process.argv.slice(2));
