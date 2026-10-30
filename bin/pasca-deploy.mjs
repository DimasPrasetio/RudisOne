// Verifikasi setelah deploy — READ-ONLY. Menunggu healthcheck (maks ±60 dtk), lalu memastikan app
// menjalankan image <sha>, healthy, /readyz 200, dan app lain di server tetap healthy.
// Container & port dibaca dari "App registry" di playbook server (path: bin/konfig.sh playbook).
// Pemakaian: bin/pasca-deploy.sh <app> <sha> [alias-server]   contoh: bin/pasca-deploy.sh app-saya 6385363
// Exit: 0 = lolos, 1 = gagal, 3 = argumen salah / app tak terdaftar / konfigurasi belum ada / tak bisa terhubung.
// Pemeriksaan berjalan di server (bin/remoto/pasca-deploy.sh) lewat ssh; modul ini hanya penghubungnya.
import { dariKonfig, jalankanDiServer } from "./lib/ssh-jauh.mjs";

const [app = "", sha = "", alias = ""] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(app) || !/^[0-9a-f]{7,40}$/.test(sha)) {
  console.error("Pemakaian: bin/pasca-deploy.sh <app> <sha> [alias-server]");
  process.exit(3);
}
const host = dariKonfig("host", alias);
if (host === null) process.exit(3);
const playbook = dariKonfig("playbook", alias);
if (playbook === null) process.exit(3);
if (!playbook) {
  console.error("Playbook server belum dikonfigurasi (server.<alias>.playbook) — container & port app tidak bisa dibaca");
  process.exit(3);
}

const rc = jalankanDiServer(host, "pasca-deploy", [app, sha, playbook]);
if (rc === 255) { console.error(`Tidak bisa terhubung ke ${host}`); process.exit(3); }
process.exit(rc);
