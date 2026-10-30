# Constitution — <proyek> (Mode A · standar rudis-monorepo)
<!-- Seed untuk /rudis.constitution, sekali per proyek (skill `rudis-sdd` › Langkah per fase). TIPIS: setiap prinsip hanya
     MUST + "Pemilik: <file>". Jangan menyalin isi standar — isi teknis tinggal di pemiliknya dan bisa berubah di sana.
     Hapus prinsip yang pemiliknya tidak ada di proyek ini; jangan menambah ringkasan repo. -->

Versi: 1.0.0 · Disahkan: <YYYY-MM-DD, pengguna> · Kartu: `.rudisone/kartu-proyek.md` (mode A)

## Prinsip
1. **Batas modul** — MUST: modul tidak saling impor; lintas modul hanya lewat port + kontrak, disambung di satu composition root.
   Pemilik: `.claude/rules/<backend>.md`, `knowledge/MODULE_MAP.md`.
2. **Kontrak API** — MUST: `/api/v1`, bentuk respons/galat baku; kontrak di satu tempat.
   Pemilik: `knowledge/API.md`, `packages/api-contract/`.
3. **Data** — MUST: skema hanya berubah lewat migrasi; satu DB + user per app. Pemilik: `knowledge/DATABASE.md`.
4. **Pustaka dulu** — MUST: kemampuan yang ada di pustaka dipasang dengan `module.mjs`, tidak disalin tangan.
   Pemilik: `modules.lock.json`, `analysis/` (tabel perakitan).
5. **Frontend & desain** — MUST: token/komponen kit dan brief desain proyek. Pemilik: `.claude/rules/frontend.md`, `knowledge/DESIGN.md`.
6. **Keamanan & rahasia** — MUST: tanpa rahasia di repo; `.env` tidak dibaca agent; gerbang mutu = tidak ada temuan baru;
   rahasia baru = BLOCKER. Pemilik: `.claude/rules/security.md` (bila ada), skill `rudis-sdd` › Gerbang mutu.
7. **Tes** — MUST: tidak ada tes hijau→merah; perilaku baru punya tes. Pemilik: `knowledge/TESTING.md` (bila ada).
8. **Alur kerja** — MUST: git hanya lewat peran RudisOne: commit sesudah command RUDIS di branch tugas `rudis/<ID>[-p<n>]`;
   checkpoint/rollback lewat `bin/rudis-git.sh checkpoint <ID>` / `… rollback` RudisOne (tanpa stash, `reset --hard`, `checkout <sha> --`, `--create-branch`);
   push/merge hanya atas permintaan pengguna. Pertanyaan ke pengguna lewat COO. Pemilik: `protokol.md` RudisOne.
9. **Spesifikasi** — MUST: spec berisi perilaku & kontrak, bukan detail implementasi; kontrak final dipindah ke pemiliknya.
   Pemilik: `specs/`, `knowledge/` (letak menurut kartu).

## Prioritas bila bertentangan
Aturan proyek (`CLAUDE.md`, `.claude/rules/`, `knowledge/`) > skill rudis-monorepo > constitution ini > default command RUDIS.

## Amendemen
Semver: MAJOR = prinsip dihapus/dibalik; MINOR = prinsip baru; PATCH = rujukan pemilik. Disahkan pengguna lewat COO.
