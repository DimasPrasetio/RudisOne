// Snapshot kesehatan server deploy — READ-ONLY.
// Server & path playbook dibaca dari konfigurasi per device (bin/konfig.sh host|playbook). Bila server punya
// playbook dengan tabel "## App registry", daftar app dibaca dari situ, jadi app baru otomatis ikut diperiksa.
// Pemakaian: bin/server-cek.sh [alias-server]   (bawaan: server_bawaan di konfigurasi/server.json)
// Exit: 0 = sehat, 1 = ada peringatan, 2 = tidak bisa terhubung, 3 = konfigurasi server belum ada.
// Pemeriksaan berjalan di server (bin/remoto/server-cek.sh) lewat ssh; modul ini hanya penghubungnya.
import { dariKonfig, jalankanDiServer } from "./lib/ssh-jauh.mjs";

const alias = process.argv[2] ?? "";
const host = dariKonfig("host", alias);
if (host === null) process.exit(3);
const playbook = dariKonfig("playbook", alias);
if (playbook === null) process.exit(3);

const rc = jalankanDiServer(host, "server-cek", [playbook]);
if (rc === 255) { console.error(`Tidak bisa terhubung ke ${host}`); process.exit(2); }
process.exit(rc);
