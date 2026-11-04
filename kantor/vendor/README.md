# Pustaka pihak ketiga Kantor (disalin, versi terkunci)

Kantor berjalan **tanpa internet**: semua pustaka dan huruf dilayani `kantor/server.mjs` dari folder ini (rute `/vendor/`).
Jangan diubah tangan — perbarui dengan menyalin ulang dari paket npm versi baru, lalu perbarui tabel ini.

| Berkas | Sumber (paket npm @ versi) | Integritas paket (npm `dist.integrity`) | Lisensi |
|---|---|---|---|
| `three/build/three.module.js`, `three/build/three.core.js` | `three@0.186.0` › `build/` | `sha512-cr/fIM2ddMSVbYVgkfD4jLJv7Fh/8ZTjvo+7gQeSVGUZHxpx9FDwoL5iC7hUz/LiRA8wMbqfnb90xKfm1/HHkQ==` | MIT — `three/LICENSE` |
| `three/addons/controls/OrbitControls.js`, `three/addons/environments/RoomEnvironment.js`, `three/addons/utils/BufferGeometryUtils.js` | `three@0.186.0` › `examples/jsm/` (diimpor sebagai `three/addons/…`) | sama | MIT — `three/LICENSE` |
| `fonts/geist-latin-wght-normal.woff2` | `@fontsource-variable/geist@5.3.0` › `files/` | `sha512-j0m+vLQuG5XAYoHtGCVu0spvlGreR3EzpECUVzkFmI1mTVnAO38l/NEPDCFgZ177JxzYJCLSmTQibIiYPilGrA==` | SIL OFL 1.1 — `fonts/LICENSE-geist.txt` |
| `fonts/bricolage-grotesque-latin-opsz-normal.woff2` | `@fontsource-variable/bricolage-grotesque@5.3.0` › `files/` | `sha512-TLi9Q4hJjS2UvoTMRSS2nHu6c4R56lAw60NR9QYtVRCHn0XtsFpiEhNffZ8Glsoxu6wEEwLKBP8lb94J52PNBA==` | SIL OFL 1.1 — `fonts/LICENSE-bricolage-grotesque.txt` |

Sidik SHA-256 berkas yang disalin diperiksa tes `kantor/vendor.test.mjs` (berkas berubah tanpa tabel diperbarui → tes gagal).
