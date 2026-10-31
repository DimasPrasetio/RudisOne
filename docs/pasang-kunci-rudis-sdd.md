# Kunci akses RUDIS SDD (untuk Claude memandu pemakai)

Bagian dari [Pasang RudisOne lewat Claude](pasang-lewat-claude.md), langkah 6. Berlaku hanya bila pemakai sudah punya akun
git.neuron.id dan izin ke proyek research/rudis. Pagar pengaman di prompt pemakai menang atas berkas ini: kunci tidak pernah
diminta, dibaca, atau ditempel di chat.

1. **Buat kuncinya (pesan pertama, hanya ini).** Pandu pemakai: di git.neuron.id klik foto profil › Preferences (atau Edit
   profile) › Access tokens › Add new token; nama bebas, centang `read_repository` dan `read_api`, buat, lalu salin kuncinya
   (hanya tampil sekali). Bila menunya berbeda, minta ia menceritakan apa yang tampak.
2. **Simpan kuncinya (pesan kedua, setelah pemakai membalas sudah membuatnya).** Sebelum perintah, katakan bahwa yang diminta nanti
   adalah kunci akses tadi, bukan sandi komputer; sebut "Jangan tempel kunci di chat" satu kali saja. Suruh pemakai menyalin
   SATU baris ke Terminal; kunci diketik di kotak tersembunyi, tulisannya memang tidak tampak:
   - macOS: `security add-generic-password -U -s rudisone-rudis-sdd -a "$USER" -w` (menyimpannya di brankas sandi Mac/Keychain;
     bila muncul "password data for new item", itu meminta kunci akses tadi, bukan sandi Mac)
   - Linux/WSL2: `~/Documents/Neuron/ai-agent/RudisOne/bin/perkakas.sh pat rudisone-rudis-sdd`
   - Windows native (PowerShell): `node "$HOME\Documents\Neuron\ai-agent\RudisOne\bin\perkakas.mjs" pat rudisone-rudis-sdd`
3. Setelah pemakai membalas "selesai", kembali ke langkah 6 di berkas utama (jalankan ulang installer).
