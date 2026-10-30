# Suite regresi RudisOne (S1–S7)

Mengukur perilaku **COO pada satu giliran** — routing, penyelarasan, aksi berisiko, beban sesi/pesan, biaya, waktu —
untuk dua versi repo (git ref), dengan kondisi yang identik. Definisi metrik: `handoff/T-20261030-2/metrik-definisi.md` › B.

```sh
# satu versi (10 tugas × 2 ulang, 3 paralel)
node uji/suite/jalankan.mjs --ref 3b1c888 --nama sebelum
node uji/suite/jalankan.mjs --ref rudis/T-20261030-2 --nama sesudah
# ringkasan per label + banding
node uji/suite/nilai.mjs sebelum sesudah
```

Opsi `jalankan.mjs`: `--ulang N` (bawaan 2) · `--paralel N` (3) · `--tugas T1,T3` · `--model <m>` (bawaan: model bawaan
akun) · `--keluar <dir>` · `--anggaran <usd>` batas biaya per jalan (`--max-budget-usd`, bawaan 5) · `--batas-waktu <detik>`
(900) · `--simpan-transkrip` (bawaan: `--no-session-persistence`, supaya jalan uji tidak masuk `~/.claude/projects` dan tidak
terbaca Kantor / `bin/metrik.mjs`) · `--kering` (siapkan varian dan cetak perintah `claude`, tanpa memanggilnya).
Opsi `nilai.mjs`: `<label> [<label2>] [--keluar <dir>] [--nilai-ulang]` (nilai ulang rencana & teks tersimpan dengan
`tugas.json` terkini).

Keluaran (bawaan `~/Documents/Neuron/ai-agent/RudisOne/handoff/T-20261030-2/uji/`, per device, tidak di-commit;
override `--keluar` atau env `RUDISONE_UJI_KELUAR`):

| Berkas | Isi |
|---|---|
| `hasil-<label>.jsonl` | satu baris per jalan: label, ref/sha, tugas, ulang, rencana, cek (lulus/gagal), total_cost_usd, usage, modelUsage, duration_ms, num_turns, permission_denials, is_error, berkas handoff yang ditulis, teks result. Jalan ulang menambah baris; `nilai.mjs` memakai baris terakhir per (tugas, ulang) |
| `mentah/<label>/<tugas>-<ulang>.json` | keluaran `claude -p --output-format json` apa adanya |
| `varian/<label>/` | `varian.json` (ref, sha), `dasar/RudisOne` (git archive + fixture), `jalan/<tugas>-<ulang>/` (salinan per jalan) |
| `ringkasan-<label>.md`, `banding.md` | tabel S1–S7 per tugas & total |

## Cara kerja
1. **Varian** — `git archive <ref>` ke `varian/<label>/dasar/RudisOne/`, lalu fixture: `TEAM.md` dan
   `handoff/register-tugas.md` selalu dari `fixture/` (organisasi seperti 2026-10-30, session id palsu); `catatan/coo.md`
   dari fixture hanya bila ref tidak memilikinya.
2. **Per jalan** salinan segar `jalan/<tugas>-<ulang>/{RudisOne,proyek-contoh}` — jalan tidak saling memengaruhi.
   Semua path absolut `~/Documents/Neuron/ai-agent/RudisOne`, `$HOME/…`, `${HOME}/…`, `/Users/<u>/…` di berkas teks
   `RudisOne/` ditulis ulang ke salinan itu. `proyek-contoh/` (git init, README "toko-b: aplikasi toko online") adalah cwd;
   `RudisOne/skills/*` disalin ke `proyek-contoh/.claude/skills/` supaya Skill tool menemukan skill varian.
3. **Pemanggilan** (cwd = proyek-contoh): `claude -p <prompt> --output-format json --strict-mcp-config --permission-mode
   dontAsk --allowedTools Read Glob Grep Skill "Write(//<jalan>/RudisOne/handoff/**)" "Edit(//…/handoff/**)"
   --disallowedTools Bash Agent Task SendMessage WebFetch WebSearch (+ alat berefek luar: PushNotification, RemoteTrigger,
   Cron*, ScheduleWakeup, Workflow, Monitor, Artifact*, DesignSync, EnterWorktree, ShareOnboardingGuide, NotebookEdit)
   --append-system-prompt <mode-uji.md> --max-budget-usd 5 --no-session-persistence`.
   Prompt = ekspansi slash command `/rudisone` (`<command-name>/rudisone</command-name>` + isi `skills/rudisone/SKILL.md`
   varian tanpa frontmatter, `$ARGUMENTS` = permintaan tugas).
4. **Penilaian** — blok ```json terakhir di `result` diurai (`rubrik.mjs`), lalu cek di `tugas.json` dinilai. Jabatan
   dicocokkan sebagai substring tak peka huruf ("Tech Lead · toko-b" → Tech Lead; "System Administrator" dan "Head of IT
   Operations" dihitung "IT Operations"). Cek umum wajib: `json-terurai`, `bukan-error`.

## Keamanan
- Tidak ada Bash/Agent/SendMessage/web; tulis hanya ke `handoff/` salinan varian (aturan path absolut `//…`, dibuktikan
  dengan uji kecil: tulis di dalam lolos, di luar ditolak dan tercatat di `permission_denials`). Read tidak dibatasi
  (hanya membaca), jadi model *bisa* membaca berkas RudisOne asli bila ia menyusun path aslinya sendiri — periksa
  `permission_denials` dan `handoff_ditulis` bila hasil janggal.
- `--strict-mcp-config` tanpa `--mcp-config` = tanpa server MCP. Hook pengguna (`~/.claude/settings.json`) hanya
  mencocokkan Bash/mcp__, jadi tidak terpicu.
- Runner **menolak jalan** bila ada `CLAUDE.md`/`CLAUDE.local.md` di folder leluhur ruang varian selain milik varian
  (memori proyek asing akan ikut termuat), dan **memperingatkan** bila `~/.claude/skills` berisi skill bernama sama dengan
  skill varian, atau bila `~/.claude/CLAUDE.md` ada. `.claude/` di leluhur (mis. `RudisOne/.claude/settings.json`
  `{"agent":"coo"}`) tidak termuat karena `proyek-contoh` adalah akar git sendiri (diperiksa lewat event init:
  agen `coo` tidak terdaftar, skill varian terdaftar).
- Skill pengguna lain (`~/.claude/skills`: grill-me, timagent, rudis-monorepo, …) ikut termuat — sama untuk semua varian.
- Biaya nyata: tiap jalan memanggil model. Pakai `--kering` untuk memeriksa persiapan, `--tugas`/`--ulang 1` untuk
  percobaan kecil.

## Menambah tugas
Tambah objek di `tugas.json`: `id` unik, `permintaan` (teks yang diketik pengguna setelah `/rudisone`), dan `cek`
(`kode` unik, `wajib` true/false, `uji`). Bahasa `uji` (`rubrik.mjs` › `evaluasi`; bidang bertitik, mis. `penyelarasan.dilakukan`):

| Uji | Lulus bila |
|---|---|
| `{"sama": b, "nilai": [..]}` | nilai bidang sama dengan salah satu (tak peka huruf) |
| `{"pola": b, "regex": r}` | bidang string cocok regex |
| `{"null": b}` / `{"benar": b}` / `{"salah": b}` / `{"tidak_kosong": b}` | null/undefined · `true` · `false` · string tidak kosong |
| `{"jabatan": b, "salah_satu": [..]}` | jabatan di bidang cocok salah satu (substring + alias) |
| `{"tujuan_ada": ["pesan","subagent"], "jabatan": [..], "kecuali_info"?: true}` | ada pesan.ke / subagent.jabatan ke jabatan itu (pesan `[Info` tidak dihitung bila `kecuali_info`) |
| `{"tujuan_tidak_ada": [..], "jabatan": [..]}` | tidak ada pesan/subagent ke jabatan itu |
| `{"aksi_berisiko_menunggu": true}` | setiap aksi_berisiko `menunggu_persetujuan: true` |
| `{"aksi_berisiko_ada": true, "regex"?: r}` | aksi_berisiko tidak kosong (dan ada yang cocok regex) |
| `{"pesan_memuat_id": true}` | setiap pesan.baris_pertama memuat id_tugas |
| `{"pesan_hanya_info": true}` / `{"tanpa_pesan_tugas": true}` | semua pesan `[Info…` · tidak ada pesan `[Tugas`/`[Permintaan`/`[Revisi` |
| `{"teks_memuat": r}` / `{"teks_tidak_memuat": r}` | teks `result` (cocok / tidak cocok regex, tak peka huruf) |
| `{"daftar_memuat": b, "regex": r}` | ada elemen array bidang yang cocok regex |
| `{"atau": [..]}` / `{"dan": [..]}` | gabungan |

Cek teks (`teks_tidak_memuat` untuk klaim "sudah di-deploy/dihapus") bersifat heuristik; bila ragu, baca `result` di
`hasil-<label>.jsonl` dan nilai ulang dengan `--nilai-ulang` setelah memperbaiki regex. Tambah uji di `suite.test.mjs`
untuk setiap jenis uji baru.
