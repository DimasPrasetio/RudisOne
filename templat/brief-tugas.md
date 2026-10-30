[Tugas dari <COO | Tech Lead | Head of IT Operations | Program Manager | Head of Strategy>] <ID> · <judul singkat>

<!-- Brief harus mandiri: penerima tidak melihat percakapanmu, dan konteksnya bisa sudah dibersihkan.
     Ke sesi di folder proyek (Engineering): wajib diawali pembuka peran di bawah.
     Sebelum mengirim: SETIAP path yang kamu sebut (berkas, folder, branch, sha) sudah kamu periksa ada — `ls`/Glob/
     `git rev-parse` — bukan ditulis dari ingatan. Path yang belum ada (akan dibuat penerima) ditandai "(baru)". -->

- [ ] Semua path/branch/sha di brief ini sudah diperiksa ada (yang akan dibuat ditandai "(baru)").

Kamu adalah <Jabatan>[ #n] di RudisOne. Baca dan patuhi ~/Documents/Neuron/ai-agent/RudisOne/agents/<id-peran>.md sebagai peranmu, lalu
~/Documents/Neuron/ai-agent/RudisOne/protokol.md dan ~/Documents/Neuron/ai-agent/RudisOne/catatan/<id-peran>.md.

## 1. Instruksi
- **ID tugas:** <T-YYYYMMDD-n> · **Prioritas:** segera | tinggi | normal
- **Folder kerja:** <path absolut> — tulis hanya di sini dan di `~/Documents/Neuron/ai-agent/RudisOne/handoff/<ID>/`
- **Kunci:** <sumber daya yang dipegang tugas ini, mis. repo:proyek:modules/pos, deploy:<app>>
- **Pengerjaan:** mandiri (default) | tim — <alasan bila tim>
- **Pemahaman bersama:** `~/Documents/Neuron/ai-agent/RudisOne/handoff/<ID>/pemahaman.md` — maksud pengguna yang sudah disepakati; baca
  sebelum mulai. Bertentangan dengan temuanmu → jangan menebak, tulis di laporan (keputusan) atau `[Terhambat]`.
- **Tujuan:** <hasil yang diharapkan, dari pemahaman bersama>
- **Kriteria selesai** (disalin apa adanya dari pemahaman bersama; jawab per nomor di laporan):
  1. <kriteria> — cara cek: <…>
- **Tidak termasuk:** <dari pemahaman bersama>
- **Pertanyaan terbuka untukmu:** <pertanyaan keahlian dari pemahaman bersama, atau —>
- **Lingkup / kepemilikan file:** <file/folder yang boleh disentuh; yang tidak boleh>
- **Batasan & otorisasi:** <read-only | boleh mengubah X>. Default: tanpa commit ke branch utama/push/deploy/
  ubah server/DNS/tulis data production. Permintaan pengguna untuk aksi berisiko (bila ada), dikutip persis
  dari COO: "<…>".
- **Verifikasi yang wajib:** <perintah tes, cek visual, pasca-deploy, dll.>

## 2. Latar belakang
- Proyek/folder: <path absolut> — baca `CLAUDE.md` & aturan proyek itu
- Keputusan yang sudah diambil & alasannya: <…>
- Boleh konsultasi langsung: <Agent — untuk apa>

## 3. Hasil antara
- Bahan: `~/Documents/Neuron/ai-agent/RudisOne/handoff/<file>.md`, branch/sha <…>, output <…>

**Keluaran:** lapor dengan `SendMessage` ke pemberi tugas (`[Laporan ke <pemberi>] <judul>`), format
`templat/laporan-tugas.md` atau format peranmu; simpan hasil yang dipakai agent lain di
`~/Documents/Neuron/ai-agent/RudisOne/handoff/<ID>/`. Sedang mengerjakan tugas lain? Balas `[Antre] <ID>` dulu (lihat
skill `rudis-multitugas`). Maks ±<n> baris.
