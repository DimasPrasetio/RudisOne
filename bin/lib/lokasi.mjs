// Lokasi-lokasi tetap RudisOne di device ini — satu sumber untuk installer, pemeriksa, dan perkakas.
// Peran dan aturan merujuk `~/Documents/Neuron/ai-agent/RudisOne` (`~` = folder rumah pengguna; di Windows
// `%USERPROFILE%`), jadi repo harus berada di path itu di semua OS.
import os from "node:os";
import path from "node:path";

export const BAGIAN_RUMAH = ["Documents", "Neuron", "ai-agent", "RudisOne"];
/** Penulisan lokasi di dokumen dan keluaran (selalu garis miring ke depan). */
export const RUMAH_TAMPIL = `~/${BAGIAN_RUMAH.join("/")}`;
/** Lokasi rumah repo di device ini. */
export const rumahRepo = (home = os.homedir()) => path.join(home, ...BAGIAN_RUMAH);
/** Folder konfigurasi Claude Code pengguna. */
export const folderClaudeUser = (home = os.homedir()) => path.join(home, ".claude");

/** Dua path sama? Tidak membedakan huruf besar/kecil dan pemisah di Windows. */
export function samaPath(a, b) {
  const n = (p) => { const r = path.resolve(p); return process.platform === "win32" ? r.toLowerCase() : r; };
  return n(a) === n(b);
}
