#!/usr/bin/env bash
# RUDIS SDD lewat perkakas resmi: `uvx --from <lokal perkakas.json › rudis-sdd> rudis <argumen…>`.
# Selalu menambah --no-marketplace pada `init` (kecuali sumber marketplace-nya ada di allowlist), menolak perintah
# marketplace di luar allowlist dan perintah yang tidak dipakai RudisOne (run ultimate/deploy/operate, tui).
# GL_TOKEN untuk init/update diambil dari Keychain (rudisone-rudis-sdd) ke proses anak saja. Rincian: bin/perkakas.mjs › sdd.
# Pemakaian: bin/rudis-sdd.sh <perintah rudis …>   mis. bin/rudis-sdd.sh init --here --force --ai claude --script sh
exec node "$(cd "$(dirname "$0")" && pwd)/perkakas.mjs" sdd "$@"
