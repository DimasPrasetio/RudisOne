# Izin deploy tetap (opsional)

Per device, dipasang pengguna sendiri.

Agar System Administrator bisa deploy satu app terdaftar tanpa bertanya, buat
`~/Documents/Neuron/ai-agent/RudisOne/ruang/system-administrator/.claude/settings.local.json` (ganti `<alias>` dan
`<app>` dengan nilai di `konfigurasi/server.json`):
```json
{
  "agent": "system-administrator",
  "permissions": {
    "allow": ["Bash(ssh <alias> 'cd ~/<app> && ./deploy.sh *)"]
  }
}
```
