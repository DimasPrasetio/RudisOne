# Daftar uji RudisOne di Linux dan Windows (WSL2)

RudisOne dikembangkan di macOS; jalur Linux baru dibuktikan dengan simulasi (`uji/simulasi-linux/jalankan.sh`), belum di
mesin Linux sungguhan. Daftar ini untuk rekan dengan **Linux** (Ubuntu/Debian LTS) atau **Windows 10 (22H2) / 11 lewat
WSL2**. Waktu ±30–45 menit. Linux: lewati bagian A dan catatan "WSL"/"Windows" lainnya. Jalankan berurutan; salin
**keluaran** tiap langkah bertanda 📋 ke satu berkas teks lalu kirim ke COO (pemilik RudisOne). Jangan kirim PAT, password,
atau isi `~/.config/rudisone/rahasia/`. Batas saat ini di Linux/WSL (tanpa Claude Desktop): README › Pasang di device baru.

> macOS **sudah terverifikasi** (Claude Desktop, Claude Code CLI, ekstensi VS Code) — lihat [`uji/macos.md`](macos.md). Jangan
> merekomendasikan atau mengulang uji di macOS; daftar ini hanya untuk Linux dan Windows (WSL2).

## A. Siapkan WSL2 — khusus Windows (PowerShell sebagai Administrator)
1. `wsl --install -d Ubuntu` → restart bila diminta, buat user Linux.
   Harapan: `wsl -l -v` 📋 menampilkan `Ubuntu … VERSION 2`.

Semua langkah berikut di terminal **Linux** — di Windows: terminal **Ubuntu** WSL (bukan PowerShell, bukan `/mnt/c`).

## B. Prasyarat
2. `sudo apt update && sudo apt install -y git curl zip unzip`
3. Node.js ≥ 18 (mis. nvm): `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`, buka terminal
   baru, `nvm install --lts`.
4. GitHub CLI: ikuti https://github.com/cli/cli/blob/trunk/docs/install_linux.md, lalu `gh auth login`.
5. uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`, buka terminal baru.
6. Claude Code (installer resmi Claude Code; di Windows: di dalam WSL), login.
   Harapan 📋: `node -v` ≥ v18 · `git --version` · `gh --version` · `uvx --version` · `claude --version` semuanya mencetak versi.

## C. Pasang RudisOne
7. `mkdir -p ~/Documents/Neuron/ai-agent && git clone https://github.com/DimasPrasetio/RudisOne.git ~/Documents/Neuron/ai-agent/RudisOne`
8. 📋 `cd ~/Documents/Neuron/ai-agent/RudisOne && pwd && node bin/peran.mjs cek; ls -l .claude/agents/coo.md`
   Harapan: path `/home/<user>/Documents/Neuron/ai-agent/RudisOne` (WSL: bukan `/mnt/c/...`); `peran.mjs cek` melaporkan
   "mutakhir"; `coo.md` berkas biasa (huruf pertama `-`, bukan symlink).
9. 📋 `./install.sh`
   Harapan: baris `[ok]` untuk lokasi repo, peran tertaut, skill tertaut, perkakas `bin/*.sh`, Node.js. Baris `[!!]` yang
   **wajar** pada device baru: hook kebijakan/inti belum terpasang (langkah 10), PAT rudis-sdd belum ada (langkah 11).
   Perkakas: `rudis-monorepo` & `rudis-modules` di-clone ke `~/Documents/Neuron/ai-agent/`.
10. `bin/kebijakan.sh pasang && bin/inti.sh pasang`, lalu 📋 `./install.sh | tail -5`.

## D. PAT RUDIS SDD (repo privat git.neuron.id)
11. 📋 `bin/perkakas.sh cek --segera | grep rudis-sdd`
    Harapan: pesan `butuh PAT — belum ada di berkas rahasia (~/.config/rudisone/rahasia/rudisone-rudis-sdd, mode 0600)`
    beserta perintah `… bin/perkakas.sh pat rudisone-rudis-sdd` (**bukan** perintah `security` macOS).
12. Bila punya PAT GitLab (scope `read_repository` + `read_api`): `bin/perkakas.sh pat rudisone-rudis-sdd` → ketik PAT saat
    diminta (tidak tampil). 📋 `ls -ld ~/.config/rudisone/rahasia && ls -l ~/.config/rudisone/rahasia`
    Harapan: folder `drwx------`, berkas `-rw-------` (jangan kirim isinya).
13. 📋 `bin/perkakas.sh siapkan --segera | grep rudis-sdd`
    Harapan: `rudis-sdd: di-clone ke ~/Documents/Neuron/ai-agent/rudis` (atau `mutakhir`) dan `jalan lewat bin/rudis-sdd.sh`.
    Tanpa PAT: lewati langkah 12–13 dan tulis "tanpa PAT".

## E. Tes & pemeriksa
14. 📋 `node --test bin/ kantor/ 2>&1 | grep -E '^# (tests|pass|fail)'` — Harapan: `# fail 0`.
15. 📋 `bin/cek-konsistensi.sh; echo "exit=$?"` — Harapan: `exit=0` (atau 1 = peringatan saja; sebutkan barisnya).
16. 📋 `bin/register.sh tampil; echo "exit=$?"` — Harapan: tabel/teks register (boleh kosong) dan `exit=0`.
17. 📋 `bin/kantor.sh --tanpa-browser && curl -s -m 2 http://127.0.0.1:7421/health` — Harapan: `ok <sidik>`; buka
    http://127.0.0.1:7421/ di browser (Windows: browser Windows; WSL2 meneruskan localhost) → halaman Kantor tampil.

## F. Pakai sungguhan
18. Di terminal Linux/WSL: `cd ~/Documents/Neuron/ai-agent/RudisOne && claude`, ketik `/rudisone status tugas`.
    Harapan: COO menjawab dan menutup dengan baris `Pantau tim: http://127.0.0.1:7421/`.

## G. Uji asap backend sesi cli (Claude Code ≥ 2.1.300)
19. 📋 `bin/sesi.sh backend && bin/sesi.sh cek; echo "exit=$?"` — Harapan: `cli (konfigurasi/sesi.json)`, `[ok] Claude Code
    2.1.3xx`, `[ok] pengaman sesi latar`; folder yang belum dipercaya dicetak sebagai `cd <folder> && claude`. Jalankan
    baris-baris itu (terima prompt percaya, `/exit`), lalu ulangi sampai `exit=0`.
20. Di sesi COO (terminal, `/rudisone`): minta "bentuk sesi System Administrator untuk uji". 📋 `claude agents --json` —
    Harapan: sesi `rudis-sysadmin` (kind `background`, cwd `…/ruang/system-administrator`) dan COO menerima "Siap" lewat pesan.
21. Minta COO mengirim `[Info dari COO] uji pesan` ke `rudis-sysadmin` dan meminta balasan. Harapan: balasan masuk di sesi
    COO (cross-session messaging), tanpa prompt izin.
22. Minta COO: "System Administrator jalankan `sudo true`" (jenjang 3). 📋 `bin/sesi.sh daftar` — Harapan: sesi `blocked`
    (`permission prompt`) + `perlu pengguna: claude attach …`; jalankan perintah itu, tolak prompt, `←` kembali.
23. 📋 Kantor (http://127.0.0.1:7421/): kursi System Administrator tampil, berstatus "Menunggu keputusan Anda" saat langkah 22.
24. Minta COO menghentikan sesi itu. 📋 `claude agents --json --all | grep -A3 rudis-sysadmin` — Harapan: state `stopped`
    (bukan dihapus); tidak ada branch/PR baru di remote (`git ls-remote origin | wc -l` sama seperti sebelum langkah 20).

## Kirim ke COO
Berkas teks berisi keluaran 📋 langkah 1, 6, 8, 9, 10, 11, (12–13 atau "tanpa PAT"), 14–24, plus versi OS (`cat /etc/os-release | head -2`; Windows: juga `winver`).
Tandai langkah yang hasilnya berbeda dari "Harapan".
