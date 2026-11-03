// Uji pelari tes kontainer Linux (bin/tes-linux.mjs): prasyarat Docker diperiksa berurutan dengan pelari tiruan — tanpa Docker sungguhan.
// node --test bin/tes-linux.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { BERKAS_BAWAAN, imageBawaan, main, pastikanDocker, perintahPasangDocker, SKRIP_KONTAINER, uraiArgumen } from "./tes-linux.mjs";

/** Pelari tiruan: `ada` = peta "cmd arg1 arg2" → status; yang tidak terdaftar gagal (status 1). Mencatat semua panggilan. */
function tiruan(ada, { infoSetelah = 0 } = {}) {
  const log = [];
  let infoPanggil = 0;
  const jalankan = (cmd, args) => {
    const k = `${cmd} ${args.join(" ")}`;
    log.push(k);
    if (k.startsWith("docker info")) { infoPanggil++; return { status: infoPanggil > infoSetelah && ada.info !== false ? 0 : 1, stdout: "29.0" }; }
    if (k === "docker --version") return ada.docker === false ? { error: new Error("ENOENT"), status: null } : { status: 0, stdout: "Docker version 29" };
    if (k.startsWith("docker image inspect")) return { status: ada.image === false ? 1 : 0 };
    if (k.startsWith("docker pull")) return { status: ada.pull === false ? 1 : 0 };
    return { status: 0 };
  };
  return { jalankan, log };
}
const dasar = (j, extra = {}) => ({ jalankan: j.jalankan, tidur: () => {}, os: "win32", mulai: true, unduh: true, image: "node:24-bookworm", lapor: () => {}, ...extra });

test("docker tidak terpasang → tidak dipasang diam-diam: satu perintah baku, tidak ada panggilan lain", () => {
  const j = tiruan({ docker: false });
  const pesan = [];
  const h = pastikanDocker(dasar(j, { lapor: (t) => pesan.push(t) }));
  assert.equal(h.siap, false);
  assert.equal(h.perintah, "winget install -e --id Docker.DockerDesktop");
  assert.deepEqual(j.log, ["docker --version"]);
  assert.ok(pesan[0].includes("tidak dipasang otomatis"));
  assert.equal(perintahPasangDocker("darwin"), "brew install --cask docker");
  assert.match(perintahPasangDocker("linux"), /docs\.docker\.com/);
});

test("daemon mati → `docker desktop start` lalu menunggu sampai jalan; image ada → siap tanpa unduh", () => {
  const j = tiruan({}, { infoSetelah: 3 });   // info gagal 3 kali (termasuk pemeriksaan awal), lalu jalan
  const h = pastikanDocker(dasar(j));
  assert.deepEqual(h, { siap: true });
  assert.ok(j.log.includes("docker desktop start"));
  assert.ok(!j.log.some((l) => l.startsWith("docker pull")));
});

test("daemon mati + --tanpa-mulai → tidak menyalakan; waktu tunggu habis → perintah untuk pengguna", () => {
  const a = tiruan({ info: false });
  const h1 = pastikanDocker(dasar(a, { mulai: false }));
  assert.equal(h1.siap, false); assert.equal(h1.perintah, "docker desktop start");
  assert.ok(!a.log.includes("docker desktop start"));
  const b = tiruan({ info: false });
  const h2 = pastikanDocker(dasar(b, { tunggu_ms: 0 }));
  assert.equal(h2.siap, false); assert.match(h2.sebab, /tidak siap/);
});

test("image belum ada → docker pull (resmi); --tanpa-unduh dan pull gagal → perintah, bukan lanjut", () => {
  const a = tiruan({ image: false });
  assert.deepEqual(pastikanDocker(dasar(a)), { siap: true });
  assert.ok(a.log.includes("docker pull node:24-bookworm"));
  const b = tiruan({ image: false });
  const h = pastikanDocker(dasar(b, { unduh: false }));
  assert.equal(h.siap, false); assert.equal(h.perintah, "docker pull node:24-bookworm");
  assert.ok(!b.log.some((l) => l.startsWith("docker pull")));
  const c = tiruan({ image: false, pull: false });
  assert.equal(pastikanDocker(dasar(c)).siap, false);
});

test("argumen: bawaan = tiga berkas bercabang-OS; --semua; berkas ngawur/path keluar ditolak", () => {
  const o = uraiArgumen([]);
  assert.deepEqual([o.semua, o.mulai, o.unduh, o.image, o.berkas], [false, true, true, imageBawaan(), []]);
  assert.deepEqual(BERKAS_BAWAAN, ["bin/pasang-alat.test.mjs", "bin/peran.test.mjs", "bin/kebijakan.test.mjs"]);
  assert.deepEqual(uraiArgumen(["--semua", "--tanpa-mulai", "--tanpa-unduh", "--image", "node:22-bookworm", "bin/x.test.mjs"]),
    { semua: true, image: "node:22-bookworm", mulai: false, unduh: false, berkas: ["bin/x.test.mjs"] });
  for (const buruk of [["--ngawur"], ["--image"], ["../x.test.mjs"], ["/etc/passwd"], ["a;b"]]) assert.throws(() => uraiArgumen(buruk), buruk.join(" "));
  assert.equal(main(["--ngawur"]), 2);
});

test("skrip kontainer: repo read-only disalin tanpa .git, tidak ada tulis ke /src, menjalankan node --test atas argumen", () => {
  assert.match(SKRIP_KONTAINER, /--exclude=\.\/\.git/);
  assert.match(SKRIP_KONTAINER, /exec node --test "\$@"$/);
  assert.ok(!/(>|rm |mv ).*\/src/.test(SKRIP_KONTAINER), "tidak menulis ke /src");
});
