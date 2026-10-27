#!/usr/bin/env node
// Kebijakan akses & batas kewenangan RudisOne — hook PreToolUse/PostToolUse Claude Code + perintah pengelola.
// Hanya aktif di sesi RudisOne (COO, divisi, tim engineering); sesi pribadi pengguna dilewati tanpa jejak.
// Jenjang 1 (baca) → allow · jenjang 2 (rutin, syarat terpenuhi) → allow · jenjang 3 / di luar akses jabatan → ask.
// Aksi yang tidak dikenali dibiarkan ke alur izin biasa. Galat apa pun → keluar 0 tanpa keputusan (gagal terbuka).
// Pemakaian:
//   hook            dibaca Claude Code (stdin JSON) — dipasang oleh `pasang`
//   pasang [--ya]   tambahkan hook ke ~/.claude/settings.json (dijalankan PENGGUNA; cadangan dibuat dulu)
//   lepas [--ya]    hapus hook dari ~/.claude/settings.json
//   cek             status pemasangan · tampil  ringkasan kebijakan · audit [n]  n catatan audit terakhir
//   uji '<json>'    simulasikan satu panggilan alat, mis. uji '{"cwd":"<RudisOne>/ruang/system-administrator","tool_name":"Bash","tool_input":{"command":"ssh <alias> uptime"}}'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { bacaKonfig, FILE_KONFIG } from "./konfig.mjs";

const HOME = os.homedir();
const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const FILE_KEBIJAKAN = process.env.RUDISONE_KEBIJAKAN || path.join(ROOT, "kebijakan-akses.json");
const DIR_AUDIT = process.env.RUDISONE_AUDIT || path.join(ROOT, "handoff", "audit");
const SETTINGS = process.env.RUDISONE_SETTINGS_USER || path.join(HOME, ".claude", "settings.json");
const PENANDA = `"${INI}"`;   // path absolut skrip ini — hook sistem lain yang juga bernama bin/kebijakan.mjs bukan milik kita

const rumah = (p) => String(p ?? "").replace(/^~(?=\/|$)/, HOME);
const di = (anak, induk) => { const a = path.resolve(rumah(anak)), b = path.resolve(induk); return a === b || a.startsWith(b + path.sep); };

/** Aturan generik (kebijakan-akses.json) + fakta per device (konfigurasi/server.json, lihat bin/konfig.mjs).
 *  Tanpa konfigurasi: tidak ada host ssh / aplikasi / MCP DNS yang dikenali → semuanya ke alur izin biasa. */
export function muatKebijakan(file = FILE_KEBIJAKAN, fileKonfig = FILE_KONFIG) {
  const K = JSON.parse(fs.readFileSync(file, "utf8"));
  K.penyedia ??= {};
  const cfg = bacaKonfig(fileKonfig);
  for (const [alias, s] of Object.entries(cfg?.server ?? {})) {
    if (s?.ssh_host) K.penyedia[alias] = { jenis: "ssh", host: s.ssh_host, kemampuan: "server", akun: s.akun ?? null };
  }
  K.aplikasi = cfg?.aplikasi ?? {};
  const mcp = cfg?.dns?.mcp_server;
  if (mcp && K.adapter_mcp?.[mcp]) K.penyedia[mcp] = { jenis: "mcp", server: mcp, ...K.adapter_mcp[mcp] };
  return K;
}

// ---------- pengenal sesi RudisOne & jabatan ----------
const WORKTREE = { lead: "tech-lead", bsa: "business-systems-analyst", se1: "software-engineer", se2: "software-engineer" };

function petaNama(K) {
  const m = [];
  for (const [id, j] of Object.entries(K.jabatan)) for (const n of [j.nama, ...(j.alias ?? [])]) m.push([n, id]);
  return m.sort((a, b) => b[0].length - a[0].length);
}
function jabatanDariTeks(teks, K) {
  const m = String(teks).match(/Kamu adalah \**([A-Za-z][A-Za-z &-]*?)\**(?:\s*#\d)?\s+di RudisOne/);
  if (!m) return null;
  return petaNama(K).find(([n]) => m[1].trim() === n)?.[1] ?? null;
}
function teksPesanPengguna(baris) {
  if (baris?.type !== "user" || !baris.message) return "";
  const c = baris.message.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  return "";
}

/** { rudisOne, jabatan } untuk satu sesi; transkrip dibaca bertahap dan hasilnya disimpan per sesi. */
export function kenaliSesi(input, K) {
  const cwd = rumah(input.cwd || "");
  if (cwd && di(cwd, ROOT)) {
    const rel = path.relative(ROOT, path.resolve(cwd)).split(path.sep);
    const id = rel[0] === "ruang" && K.jabatan[rel[1]] ? rel[1] : "coo";
    return { rudisOne: true, jabatan: id };
  }
  const wt = cwd.match(/\/\.claude\/worktrees\/r[1-3]-(lead|bsa|se1|se2)-/);
  if (wt) return { rudisOne: true, jabatan: WORKTREE[wt[1]] };
  if (!input.transcript_path || !input.session_id) return { rudisOne: false, jabatan: null };

  const dirSesi = path.join(DIR_AUDIT, ".sesi");
  const fileSesi = path.join(dirSesi, `${String(input.session_id).replace(/[^\w.-]/g, "_")}.json`);
  let st = { offset: 0, rudisOne: false, jabatan: null };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(fileSesi, "utf8")) }; } catch { /* sesi baru */ }
  if (st.rudisOne && st.jabatan) return { rudisOne: true, jabatan: st.jabatan };   // jabatan sesi tidak berubah
  let ukuran = 0;
  try { ukuran = fs.statSync(input.transcript_path).size; } catch { return { rudisOne: st.rudisOne, jabatan: st.jabatan }; }
  if (ukuran < st.offset) st.offset = 0;
  if (ukuran > st.offset) {
    const fd = fs.openSync(input.transcript_path, "r");
    const buf = Buffer.alloc(ukuran - st.offset);
    fs.readSync(fd, buf, 0, buf.length, st.offset);
    fs.closeSync(fd);
    const teks = buf.toString("utf8");
    const akhir = teks.lastIndexOf("\n");
    if (akhir >= 0) {
      for (const l of teks.slice(0, akhir).split("\n")) {
        if (!l.trim()) continue;
        let b; try { b = JSON.parse(l); } catch { continue; }
        const t = teksPesanPengguna(b);
        const j = t && jabatanDariTeks(t, K);
        if (j) { st.rudisOne = true; st.jabatan = j; continue; }
        const panggilRudisone = t.includes("<command-name>/rudisone</command-name>")
          || (b.type === "assistant" && Array.isArray(b.message?.content)
            && b.message.content.some((c) => c?.type === "tool_use" && c.name === "Skill" && c.input?.skill === "rudisone"));
        if (panggilRudisone && !st.jabatan) { st.rudisOne = true; st.jabatan = "coo"; }
      }
      st.offset += Buffer.byteLength(teks.slice(0, akhir + 1), "utf8");
    }
    try { fs.mkdirSync(dirSesi, { recursive: true }); fs.writeFileSync(fileSesi, JSON.stringify(st)); } catch { /* cache opsional */ }
  }
  return { rudisOne: st.rudisOne, jabatan: st.jabatan };
}

// ---------- pengurai perintah shell (sadar tanda kutip) ----------
/** Pecah di &&, ||, ;, |, baris baru di luar kutip. `kompleks` = ada $( … ) atau backtick di luar kutip tunggal. */
export function pisahSegmen(cmd) {
  const seg = []; let cur = "", q = null, kompleks = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i], n = cmd[i + 1];
    if (q) { if (c === "\\" && q === '"') { cur += c + (n ?? ""); i++; continue; } if (c === q) q = null; if (q !== "'" && (c === "`" || (c === "$" && n === "("))) kompleks = true; cur += c; continue; }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (c === "\\") { cur += c + (n ?? ""); i++; continue; }
    if (c === "`" || (c === "$" && n === "(")) kompleks = true;
    if ((c === "&" && n === "&") || (c === "|" && n === "|")) { seg.push(cur); cur = ""; i++; continue; }
    if (c === ";" || c === "\n" || (c === "|" && n !== "&")) { seg.push(cur); cur = ""; continue; }
    cur += c;
  }
  seg.push(cur);
  return { segmen: seg.map((s) => s.trim()).filter(Boolean), kompleks };
}
/** Pecah satu segmen jadi kata, tanda kutip dibuang. */
export function kata(seg) {
  const out = []; let cur = "", q = null, ada = false;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (q) { if (c === q) q = null; else if (c === "\\" && q === '"' && i + 1 < seg.length) cur += seg[++i]; else cur += c; continue; }
    if (c === "'" || c === '"') { q = c; ada = true; continue; }
    if (c === "\\" && i + 1 < seg.length) { cur += seg[++i]; ada = true; continue; }
    if (/\s/.test(c)) { if (cur || ada) out.push(cur); cur = ""; ada = false; continue; }
    cur += c; ada = true;
  }
  if (cur || ada) out.push(cur);
  return out;
}
const tanpaBuangan = (s) => s.replace(/\d?>\s*\/dev\/null/g, "").replace(/\d?>&\d/g, "");
const adaTulisBerkas = (s) => />/.test(tanpaBuangan(s).replace(/'[^']*'|"[^"]*"/g, ""));

// ---------- klasifikasi ----------
const OPSI_SSH_BERNILAI = new Set(["-o", "-p", "-i", "-l", "-F", "-J", "-L", "-R", "-D", "-c", "-m", "-E", "-b", "-S", "-W", "-w", "-O", "-Q", "-B", "-e"]);

function klasifikasiRemote(remote, prov, K) {
  const { segmen, kompleks } = pisahSegmen(remote);
  const rahasia = new RegExp(K.ssh_rahasia, "i");
  // deploy: cd ~/<app> && ./deploy.sh <sha40>
  if (segmen.length === 2 && /^cd\s+\S+$/.test(segmen[0])) {
    const sha = segmen[1].match(/^\.\/deploy\.sh\s+([0-9a-f]{40})$/)?.[1];
    if (sha) {
      const folder = segmen[0].split(/\s+/)[1].replace(/\/$/, "");
      const app = Object.entries(K.aplikasi ?? {}).find(([, a]) => a.server === prov && a.folder.replace(/\/$/, "") === folder);
      return [{ kemampuan: "server", jenjang: 2, jenis: "deploy", aksi: `deploy ${app?.[0] ?? folder} ${sha.slice(0, 12)}`, app: app?.[0] ?? null, repo: app?.[1].repo ?? null, sha }];
    }
  }
  const baca = K.ssh_baca.map((r) => new RegExp(r));
  const tidakBaca = segmen.filter((s) => {
    if (/\bsudo\b/.test(s) || adaTulisBerkas(s) || rahasia.test(s)) return true;
    if (/^mysql\b/.test(s)) return !/\s-e\s*(['"]?)\s*(select|show|describe|explain)\b[^;]*;?\s*\1\s*$/i.test(s.replace(/^mysql\b.*?(\s-e)/, " -e"));
    return !baca.some((r) => r.test(s));
  });
  const kemampuan = segmen.some((s) => /^mysql\b/.test(s)) ? "data-produksi" : "server";
  if (!tidakBaca.length && !kompleks) return [{ kemampuan, jenjang: 1, aksi: `baca server ${prov}` }];
  return [{ kemampuan, jenjang: 3, aksi: `perintah server ${prov}: ${(tidakBaca[0] ?? remote).slice(0, 80)}` }];
}

function klasifikasiSegmen(seg, K) {
  const w = kata(seg);
  while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) w.shift();
  if (!w.length) return { jenis: "netral" };
  const prog = w[0], nama = path.basename(prog);
  // perkakas baca RudisOne (bin/<nama>.sh)
  const pk = nama.match(/^([a-z-]+)\.sh$/)?.[1];
  if (pk && K.perkakas_baca[pk] && (prog.startsWith("bin/") || prog.startsWith("./bin/") || rumah(prog).startsWith(path.join(ROOT, "bin")))) {
    return { jenis: "infra", aksi: [{ kemampuan: K.perkakas_baca[pk], jenjang: 1, aksi: `perkakas ${pk}`, perkakas: pk, args: w.slice(1) }] };
  }
  const cli = Object.entries(K.penyedia).find(([, p]) => p.jenis === "cli" && p.perintah === nama);
  if (cli) {
    const [id, p] = cli;
    let rest = w.slice(1);
    if (nama === "git") while (rest.length && rest[0].startsWith("-")) rest = rest.slice(["-C", "-c", "--git-dir", "--work-tree"].includes(rest[0]) ? 2 : 1);
    const args = rest.join(" ");
    if (p.tulis_remote) return new RegExp(p.tulis_remote).test(args)
      ? { jenis: "infra", aksi: [{ kemampuan: p.kemampuan, jenjang: 3, aksi: `${nama} ${args}`.slice(0, 80) }] } : { jenis: "netral" };
    if ((p.baca ?? []).some((r) => new RegExp(r).test(args))) return { jenis: "infra", aksi: [{ kemampuan: p.kemampuan, jenjang: 1, aksi: `${id} baca` }] };
    if (p.api_baca && /^api\s/.test(args) && !/(^|\s)(-X|--method)\s*(POST|PUT|PATCH|DELETE)|(^|\s)(-f|-F|--field|--raw-field|--input)(\s|=|$)/i.test(args))
      return { jenis: "infra", aksi: [{ kemampuan: p.kemampuan, jenjang: 1, aksi: `${id} api baca` }] };
    if (p.repo_buat_privat && new RegExp(p.repo_buat_privat).test(args))
      return { jenis: "infra", aksi: [{ kemampuan: p.kemampuan, jenjang: 2, jenis: "repo_buat_privat", aksi: `${id} buat repo privat ${w[3] ?? ""}`.trim() }] };
    return { jenis: "infra", aksi: [{ kemampuan: p.kemampuan, jenjang: 3, aksi: `${nama} ${args}`.slice(0, 80) }] };
  }
  if (nama === "ssh" || nama === "scp" || nama === "rsync") {
    const hostDikenal = (h) => Object.entries(K.penyedia).find(([, p]) => p.jenis === "ssh" && p.host === h);
    if (nama === "ssh") {
      let i = 1;
      for (; i < w.length; i++) { if (OPSI_SSH_BERNILAI.has(w[i])) { i++; continue; } if (!w[i].startsWith("-")) break; }
      const host = (w[i] ?? "").replace(/^[^@]*@/, ""), prov = hostDikenal(host);
      if (!prov) return { jenis: "lain" };
      const remote = w.slice(i + 1).join(" ");
      if (!remote) return { jenis: "infra", aksi: [{ kemampuan: "server", jenjang: 3, aksi: `sesi shell interaktif ${host}` }] };
      return { jenis: "infra", aksi: klasifikasiRemote(remote, prov[0], K) };
    }
    const prov = w.slice(1).map((a) => a.match(/^(?:[^@\s]+@)?([^:\s/]+):/)?.[1]).map((h) => h && hostDikenal(h)).find(Boolean);
    return prov ? { jenis: "infra", aksi: [{ kemampuan: "server", jenjang: 3, aksi: `${nama} ke ${prov[1].host}` }] } : { jenis: "lain" };
  }
  if (K.lokal_netral.includes(nama) && !(nama === "sed" && w.includes("-i"))) return { jenis: "netral" };
  return { jenis: "lain" };
}

function klasifikasiMcp(toolName, input, K) {
  const m = toolName.match(/^mcp__(.+?)__(.+)$/);
  if (!m) return null;
  const prov = Object.entries(K.penyedia).find(([, p]) => p.jenis === "mcp" && p.server === m[1]);
  if (!prov) return null;
  const [id, p] = prov;
  const kemampuanOp = (op) => { const a = Object.entries(p.kemampuan_menurut_awalan ?? {}).find(([pre]) => pre !== "*" && op.startsWith(pre)); return a ? a[1] : (p.kemampuan_menurut_awalan?.["*"] ?? "hosting"); };
  const satu = (op, params = {}) => {
    const kem = kemampuanOp(op);
    if (new RegExp(p.baca_operasi).test(op)) return { kemampuan: kem, jenjang: 1, aksi: `${id} ${op}` };
    if (op === p.dns_tambah_operasi && dnsTambahSah(params, K)) return { kemampuan: kem, jenjang: 2, jenis: "dns_tambah", aksi: `${id} tambah record ${(params.zone ?? []).map((z) => `${z.name}.${params.domain} ${z.type}`).join(", ")}` };
    return { kemampuan: kem, jenjang: 3, aksi: `${id} ${op}${params.domain ? ` ${params.domain}` : ""}` };
  };
  if (m[2] === "search") return [{ kemampuan: p.kemampuan_menurut_awalan?.["*"] ?? "hosting", jenjang: 1, aksi: `${id} cari operasi` }];
  if (m[2] === "execute") return [satu(String(input?.operation ?? ""), input?.params)];
  if (m[2] === "multi-execute") return (input?.steps ?? []).map((s) => satu(String(s?.operation ?? ""), s?.params));
  return [{ kemampuan: p.kemampuan_menurut_awalan?.["*"] ?? "hosting", jenjang: /^(get|list|search|read|view|fetch|find)[_-]/.test(m[2]) ? 1 : 3, aksi: `${id} ${m[2]}` }];
}

function dnsTambahSah(params, K) {
  const a = K.jenjang2.dns_tambah;
  if (!params?.domain || params.overwrite === true || !Array.isArray(params.zone) || !params.zone.length) return false;
  return params.zone.every((z) => a.tipe.includes(z?.type) && typeof z?.name === "string" && !a.nama_dilarang.includes(z.name.trim()) && !z.name.includes("*"));
}

/** Semua aksi infrastruktur dalam satu panggilan alat + apakah panggilan itu sepenuhnya dipahami. */
export function klasifikasi(input, K) {
  if (input.tool_name === "Bash") {
    const cmd = String(input.tool_input?.command ?? "");
    const { segmen, kompleks } = pisahSegmen(cmd);
    const hasil = segmen.map((s) => klasifikasiSegmen(s, K));
    const aksi = hasil.flatMap((h) => h.aksi ?? []);
    return { aksi, dipahami: !kompleks && hasil.every((h) => h.jenis !== "lain"), ringkasan: cmd };
  }
  if (String(input.tool_name).startsWith("mcp__")) {
    const aksi = klasifikasiMcp(input.tool_name, input.tool_input, K) ?? [];
    return { aksi, dipahami: true, ringkasan: `${input.tool_name} ${JSON.stringify(input.tool_input ?? {})}` };
  }
  return { aksi: [], dipahami: false, ringkasan: "" };
}

// ---------- audit ----------
const RAHASIA = [/((?:pass(?:word)?|passwd|token|secret|api[_-]?key|authorization)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi,
  /(bearer\s+)\S+/gi, /(\s-p)(\S+)/g, /(gh[pousr]_)[A-Za-z0-9]{20,}/g];
export function samarkan(s) { let t = String(s); for (const r of RAHASIA) t = t.replace(r, "$1***"); return t.length > 400 ? `${t.slice(0, 400)}…` : t; }

function berkasAudit(tgl = new Date()) { return path.join(DIR_AUDIT, `${tgl.toISOString().slice(0, 7)}.jsonl`); }
export function bacaAudit(bulan = 2) {
  const out = []; const now = new Date();
  for (let i = bulan - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    try { for (const l of fs.readFileSync(berkasAudit(d), "utf8").split("\n")) if (l.trim()) try { out.push(JSON.parse(l)); } catch { /* baris rusak */ } } catch { /* belum ada */ }
  }
  return out;
}
/** ID tugas dari pesan masuk sesi itu (brief "[Tugas dari …] T-…", [Revisi], dst.), bukan dari teks yang ditulis agent
 *  atau isi berkas — di sesi COO yang membahas banyak tugas hasilnya sering kosong, dan kosong lebih jujur daripada salah. */
function tugasTerakhir(transcript) {
  try {
    const st = fs.statSync(transcript), n = Math.min(st.size, 524288), fd = fs.openSync(transcript, "r"), b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, st.size - n); fs.closeSync(fd);
    let id = null;
    for (const l of b.toString("utf8").split("\n")) {
      if (!l.includes('"user"')) continue;
      let baris; try { baris = JSON.parse(l); } catch { continue; }
      const m = teksPesanPengguna(baris).match(/^\s*\[[^\]]{1,80}\]\s*(T-\d{8}-\d+(?:\.\d+)?)/m);
      if (m) id = m[1];
    }
    return id;
  } catch { return null; }
}

// ---------- keputusan ----------
function rilisSiap(repo, sha, K) {
  if (!repo || !sha) return false;
  const batas = Date.now() - (K.jenjang2.deploy.rilis_cek_maks_jam ?? 24) * 3600e3;
  return bacaAudit().some((r) => r.jenis === "rilis-cek" && r.hasil === "SIAP DEPLOY" && r.repo?.toLowerCase() === repo.toLowerCase()
    && r.sha && r.sha.length >= 7 && (sha.startsWith(r.sha) || r.sha.startsWith(sha)) && Date.parse(r.waktu) >= batas);
}

/** { keputusan: "allow" | "ask" | null, alasan } — null = biarkan alur izin biasa. */
export function putuskan(input, K) {
  const sesi = kenaliSesi(input, K);
  if (!sesi.rudisOne) return { keputusan: null, alasan: "bukan sesi RudisOne", sesi };
  const { aksi, dipahami } = klasifikasi(input, K);
  if (!aksi.length) return { keputusan: null, alasan: "bukan aksi infrastruktur", sesi };
  const nama = sesi.jabatan ? K.jabatan[sesi.jabatan]?.nama ?? sesi.jabatan : "jabatan tak dikenal";
  const tanya = [];
  for (const a of aksi) {
    const akses = K.kemampuan[a.kemampuan]?.akses;
    if (sesi.jabatan && akses && !akses.includes(sesi.jabatan)) { tanya.push(`${a.aksi} — di luar akses ${nama} (${K.kemampuan[a.kemampuan].nama})`); continue; }
    if (a.jenjang === 3) { tanya.push(`${a.aksi} — jenjang 3, keputusan pemilik`); continue; }
    if (a.jenjang === 2) {
      const aturan = K.jenjang2[a.jenis];
      if (!aturan || !sesi.jabatan || !aturan.jabatan.includes(sesi.jabatan)) { tanya.push(`${a.aksi} — jenjang 2 bukan wewenang ${nama}`); continue; }
      if (a.jenis === "deploy" && !a.app) { tanya.push(`${a.aksi} — app belum terdaftar di kebijakan`); continue; }
      if (a.jenis === "deploy" && !rilisSiap(a.repo, a.sha, K)) { tanya.push(`${a.aksi} — belum ada rilis-cek "SIAP DEPLOY" untuk sha ini dalam ${K.jenjang2.deploy.rilis_cek_maks_jam} jam`); continue; }
    }
  }
  if (tanya.length) return { keputusan: "ask", alasan: `RudisOne · ${nama}: ${tanya.join("; ")}`, sesi, aksi };
  if (!dipahami) return { keputusan: null, alasan: "perintah memuat bagian yang tidak dikenali kebijakan", sesi, aksi };
  const maks = Math.max(...aksi.map((a) => a.jenjang));
  return { keputusan: "allow", alasan: `RudisOne · ${nama}: jenjang ${maks} — ${aksi.map((a) => a.aksi).join("; ")}`, sesi, aksi };
}

export function catatSesudah(input, K) {
  const sesi = kenaliSesi(input, K);
  if (!sesi.rudisOne) return null;
  const { aksi, ringkasan } = klasifikasi(input, K);
  const out = typeof input.tool_response === "string" ? input.tool_response : String(input.tool_response?.stdout ?? JSON.stringify(input.tool_response ?? ""));
  const rekam = [];
  for (const a of aksi) {
    if (a.perkakas === "rilis-cek") rekam.push({ jenis: "rilis-cek", repo: a.args?.[0] ?? null, sha: a.args?.[1] ?? null, hasil: /SIAP DEPLOY/.test(out) ? "SIAP DEPLOY" : "belum siap" });
    else if (a.jenjang >= 2) rekam.push({ jenis: a.jenis ?? "ubah", jenjang: a.jenjang, kemampuan: a.kemampuan, aksi: a.aksi });
  }
  if (!rekam.length) return null;
  const dasar = { waktu: new Date().toISOString(), sesi: input.session_id ?? null, jabatan: sesi.jabatan, tugas: tugasTerakhir(input.transcript_path),
    cwd: input.cwd ?? null, alat: input.tool_name, ringkasan: samarkan(ringkasan) };
  fs.mkdirSync(DIR_AUDIT, { recursive: true });
  for (const r of rekam) fs.appendFileSync(berkasAudit(), `${JSON.stringify({ ...dasar, ...r })}\n`);
  return rekam;
}

// ---------- pemasangan (dijalankan pengguna) ----------
function entriHook() {
  return { matcher: "^(Bash|mcp__.*)$", hooks: [{ type: "command", command: `"${process.execPath}" "${INI}" hook`, timeout: 10 }] };
}
const milikKita = (e) => (e?.hooks ?? []).some((h) => String(h?.command ?? "").includes(PENANDA));
function bacaSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
export function statusPasang() {
  const s = bacaSettings();
  return ["PreToolUse", "PostToolUse"].every((ev) => (s.hooks?.[ev] ?? []).some(milikKita));
}
/** Program yang dipanggil hook masih ada? (mis. Node versi nvm lama dihapus → hook diam-diam tidak berjalan). */
export function programHookAda() {
  const s = bacaSettings();
  const cmds = Object.values(s.hooks ?? {}).flat().flatMap((e) => e?.hooks ?? []).map((h) => String(h?.command ?? "")).filter((c) => c.includes(PENANDA));
  return cmds.every((c) => [...c.matchAll(/"([^"]+)"/g)].every((m) => fs.existsSync(m[1])));
}
async function konfirmasi(pesan, opsi) {
  if (opsi.includes("--ya")) return true;
  if (!process.stdin.isTTY) { console.error("Bukan terminal interaktif — tambahkan --ya bila memang dijalankan pemilik."); return false; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const j = await new Promise((r) => rl.question(`${pesan} [y/N] `, r)); rl.close();
  return /^y(a|es)?$/i.test(j.trim());
}
function tulisSettings(s) {
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.cadangan-rudisone-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, `${JSON.stringify(s, null, 2)}\n`);
}
async function pasang(opsi) {
  const s = bacaSettings();
  if (statusPasang()) { console.log(`Sudah terpasang di ${SETTINGS}.`); return 0; }
  console.log(`Akan menambahkan hook kebijakan RudisOne ke ${SETTINGS} (PreToolUse + PostToolUse, alat: Bash & MCP):`);
  console.log(`  ${entriHook().hooks[0].command}`);
  console.log("Hook hanya bertindak di sesi RudisOne; sesi pribadi dilewati. Aturan izin yang sudah ada tidak diubah; cadangan settings dibuat dulu.");
  if (!(await konfirmasi("Pasang sekarang?", opsi))) { console.log("Dibatalkan."); return 1; }
  s.hooks ??= {};
  for (const ev of ["PreToolUse", "PostToolUse"]) { s.hooks[ev] = (s.hooks[ev] ?? []).filter((e) => !milikKita(e)); s.hooks[ev].push(entriHook()); }
  tulisSettings(s);
  console.log("Terpasang. Claude Code biasanya langsung memakainya, termasuk di sesi yang sedang terbuka; bila belum, mulai ulang sesinya.");
  return 0;
}
async function lepas(opsi) {
  const s = bacaSettings();
  if (!statusPasang() && !["PreToolUse", "PostToolUse"].some((ev) => (s.hooks?.[ev] ?? []).some(milikKita))) { console.log("Tidak terpasang."); return 0; }
  if (!(await konfirmasi(`Hapus hook kebijakan RudisOne dari ${SETTINGS}?`, opsi))) { console.log("Dibatalkan."); return 1; }
  for (const ev of ["PreToolUse", "PostToolUse"]) {
    if (!s.hooks?.[ev]) continue;
    s.hooks[ev] = s.hooks[ev].filter((e) => !milikKita(e));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  tulisSettings(s);
  console.log("Dilepas.");
  return 0;
}

function tampil(K) {
  const nama = (id) => K.jabatan[id]?.nama ?? id;
  console.log("Akses per jabatan (kemampuan → jabatan yang boleh; lainnya selalu ditanya):");
  for (const [, k] of Object.entries(K.kemampuan)) console.log(`  ${k.nama.padEnd(26)} ${k.akses.map(nama).join(", ")}`);
  console.log("\nJenjang 2 (rutin — disetujui sekali di chat COO, berjalan tanpa prompt bila syarat terpenuhi):");
  for (const [, j] of Object.entries(K.jenjang2)) console.log(`  ${j.nama}\n    oleh: ${j.jabatan.map(nama).join(", ")}`);
  console.log("\nPenyedia terdaftar:");
  for (const [id, p] of Object.entries(K.penyedia)) console.log(`  ${id.padEnd(16)} ${p.jenis.padEnd(4)} ${p.server ?? p.perintah ?? p.host}${p.status ? ` (${p.status})` : ""}`);
  console.log(`\nAplikasi deploy jenjang 2: ${Object.keys(K.aplikasi ?? {}).join(", ") || "—"}`);
  console.log("Jenjang 1 = baca (tanpa tanya) · jenjang 3 = ubah berisiko / di luar daftar (selalu ke pemilik).");
}

async function bacaStdin() { let s = ""; for await (const c of process.stdin) s += c; return s; }

export async function main(argv) {
  const [perintah, ...opsi] = argv;
  if (perintah === "hook") {
    try {
      const input = JSON.parse(await bacaStdin());
      const K = muatKebijakan();
      if (input.hook_event_name === "PreToolUse") {
        const p = putuskan(input, K);
        if (p.keputusan) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: p.keputusan, permissionDecisionReason: p.alasan } }));
      } else if (input.hook_event_name === "PostToolUse") catatSesudah(input, K);
    } catch { /* gagal terbuka: alur izin biasa berlaku */ }
    return 0;
  }
  if (perintah === "pasang") return pasang(opsi);
  if (perintah === "lepas") return lepas(opsi);
  if (perintah === "cek") {
    let ok = statusPasang();
    console.log(ok ? `Kebijakan RudisOne terpasang di ${SETTINGS}.` : `Belum terpasang — pemilik menjalankan: ${ROOT}/bin/kebijakan.sh pasang`);
    if (ok && !programHookAda()) { ok = false; console.log(`Program yang dipanggil hook tidak ditemukan (Node berpindah versi?) — pemilik menjalankan ulang: ${ROOT}/bin/kebijakan.sh lepas && ${ROOT}/bin/kebijakan.sh pasang`); }
    try { muatKebijakan(); console.log(`Kebijakan terbaca: ${FILE_KEBIJAKAN}`); } catch (e) { console.log(`Kebijakan rusak: ${e.message}`); return 1; }
    return ok ? 0 : 1;
  }
  if (perintah === "tampil") { tampil(muatKebijakan()); return 0; }
  if (perintah === "audit") {
    const n = Number(opsi[0] ?? 20);
    for (const r of bacaAudit().slice(-n)) console.log(`${r.waktu}  ${(r.jabatan ?? "?").padEnd(22)} ${r.tugas ?? "—"}  ${r.jenis === "rilis-cek" ? `rilis-cek ${r.repo} ${r.sha} → ${r.hasil}` : `[j${r.jenjang}] ${r.aksi}`}`);
    return 0;
  }
  if (perintah === "uji") {
    const input = { session_id: "uji", hook_event_name: "PreToolUse", ...JSON.parse(opsi[0] ?? "{}") };
    const p = putuskan(input, muatKebijakan());
    console.log(JSON.stringify({ keputusan: p.keputusan ?? "alur biasa", alasan: p.alasan, jabatan: p.sesi?.jabatan ?? null, aksi: p.aksi ?? [] }, null, 2));
    return 0;
  }
  console.error(fs.readFileSync(INI, "utf8").split("\n").slice(1, 13).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) main(process.argv.slice(2)).then((k) => { process.exitCode = k; });
