# Memperbarui dan menguji

## Memperbarui
Ubah peran/protokol → `bin/peran.sh bangun` (subagent ikut) → `bin/cek-konsistensi.sh --repo` → commit → push dari satu
device; device lain cukup `git pull` lalu `install.sh`. Peran & subagent ditautkan lewat symlink, jadi berlaku untuk
sesi berikutnya. Sesi inti yang sedang berjalan: minta COO mengirim instruksi "baca ulang peranmu". `catatan/` dan
`TEAM.md` per device dan tidak ikut git.

## Uji
Uji: `node --test bin/*.test.mjs kantor/*.test.mjs uji/suite/*.test.mjs` (Kantor, perkakas, register, kebijakan,
  pemeriksa, suite). Suite perilaku organisasi (berbiaya, memanggil `claude -p`): `uji/suite/README.md`.
