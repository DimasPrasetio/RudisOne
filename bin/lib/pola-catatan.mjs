// Pola bersama pemeriksa ingatan per device (catatan/<peran>.md, daftar jebakan): instruksi tersisip & rahasia.
// Rahasia tidak pernah dicetak oleh pemakainya — hanya letaknya. Dipakai bin/cek-konsistensi.mjs dan bin/jebakan.mjs.

/** Pola instruksi tersisip: catatan adalah data, bukan perintah. */
export const POLA_INSTRUKSI = [/abaikan (semua )?instruksi/i, /ignore (all |previous )?instructions/i, /kamu sekarang/i, /you are now/i, /jalankan perintah berikut/i, /system prompt/i];
/** [nama, pola] rahasia; grup 1 (bila ada) = nilai yang diperiksa terhadap PLACEHOLDER. */
export const POLA_RAHASIA = [
  ["token GitHub", /\b(ghp_|github_pat_)[A-Za-z0-9_]/], ["token GitLab", /\bglpat-[A-Za-z0-9_-]/], ["kunci AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY/], ["password", /password\s*[=:]\s*(\S+)/i], ["token", /token\s*[=:]\s*(\S{12,})/i],
];
/** Nilai contoh yang bukan rahasia: <isi>, $VAR, ${VAR}, ***, …, xxx. */
export const PLACEHOLDER = /^["'`]?(<|\$\{?[A-Z_]+\}?|\*{3,}|…|\.{3}|x{3,})/i;

/** Nama jenis rahasia yang tampak di satu baris, atau null. */
export function rahasiaDi(baris) {
  for (const [nama, p] of POLA_RAHASIA) {
    const m = baris.match(p);
    if (m && !(m[1] && PLACEHOLDER.test(m[1]))) return nama;
  }
  return null;
}
