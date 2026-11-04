// Pustaka & huruf pihak ketiga Kantor (kantor/vendor/): disalin apa adanya dari paket berversi terkunci (vendor/README.md).
// Isi berubah tanpa tabel ini diperbarui → gagal; berkas baru yang tak terdaftar → gagal. Halaman tidak memuat apa pun dari luar.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), VENDOR = path.join(HERE, "vendor");
const SIDIK = {
  "fonts/LICENSE-bricolage-grotesque.txt": "923f4ddf0fd39f9b7794ab0df7332f3d95dc43e8ad7ec2289d6d9e8491177f51",
  "fonts/LICENSE-geist.txt": "71609cbb5c78b5870d712eab73a31d76622635c6ed034ab5cee3b9ecbda8685f",
  "fonts/bricolage-grotesque-latin-opsz-normal.woff2": "a79fdb52d4a5c76552452f69202add96e287401fff03d3e8c0e38b4dcb5a99cd",
  "fonts/geist-latin-wght-normal.woff2": "19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1",
  "three/LICENSE": "8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc",
  "three/addons/controls/OrbitControls.js": "3d79d07ecb686b4e5d93232eedab255331c1beef711e13164eaa1f68655a5f2b",
  "three/addons/environments/RoomEnvironment.js": "55f466192cc84298755a424c5e040345006b2ee1455589b3b54126c2ea4123f4",
  "three/addons/utils/BufferGeometryUtils.js": "9fb63427ce6641fa14fd0baff9cc4d1b5f9c3d85fd084bf2e90e803c44ec1797",
  "three/build/three.core.js": "9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6",
  "three/build/three.module.js": "9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea",
};

test("sidik SHA-256 berkas vendor sama dengan yang dicatat; tidak ada berkas tak terdaftar", () => {
  const ada = [];
  (function jalan(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) jalan(f); else if (e.name !== "README.md") ada.push(path.relative(VENDOR, f).split(path.sep).join("/")); } })(VENDOR);
  assert.deepEqual(ada.sort(), Object.keys(SIDIK).sort());
  for (const [rel, h] of Object.entries(SIDIK)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(VENDOR, rel))).digest("hex"), h, rel);
});

test("lisensi ikut tersalin dan versi three.js = r186 (sama dengan panduan Three.js terpasang)", () => {
  assert.match(fs.readFileSync(path.join(VENDOR, "three/LICENSE"), "utf8"), /MIT License/);
  for (const f of ["fonts/LICENSE-geist.txt", "fonts/LICENSE-bricolage-grotesque.txt"]) assert.match(fs.readFileSync(path.join(VENDOR, f), "utf8"), /SIL Open Font License/);
  assert.match(fs.readFileSync(path.join(VENDOR, "three/build/three.core.js"), "utf8"), /const REVISION = '186'/);
  assert.match(fs.readFileSync(path.join(VENDOR, "README.md"), "utf8"), /three@0\.186\.0/);
});

test("halaman & kode Kantor tidak merujuk alamat luar (tanpa CDN/Google Fonts)", () => {
  const berkas = [path.join(HERE, "index.html"), ...fs.readdirSync(path.join(HERE, "app")).map((f) => path.join(HERE, "app", f))];
  for (const f of berkas) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+\.[a-z]{2,}/i, path.basename(f));
});
