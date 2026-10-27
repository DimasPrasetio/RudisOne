# Deploy <app> <sha pendek> — <YYYY-MM-DD HH:MM WIB>

System Administrator

1. **Status:** <selesai/gagal> — `<sha lama>` → `<sha baru>`
2. **Pra-deploy:** `bin/rilis-cek.sh <repo> <sha>` → <SIAP DEPLOY / …>
3. **Deploy:** `ssh <ssh_host> 'cd <folder app> && ./deploy.sh <sha>'` — backup: <file>, migrasi: <…>
4. **Pasca-deploy:** `bin/pasca-deploy.sh <app> <sha>` → <LOLOS/GAGAL> (ringkas hasil per cek)
5. **Rollback (bila perlu):** `ssh <ssh_host> 'cd <folder app> && ./deploy.sh <sha lama>'`
