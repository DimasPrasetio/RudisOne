# Kunci akses RUDIS SDD (untuk Claude memandu pemakai)

Part of [Pasang RudisOne lewat Claude](pasang-lewat-claude.md), step 6. Applies only if the user already has a git.neuron.id account and access to project research/rudis. The user prompt's guardrails override this file: the key is never requested, read, or pasted in chat.

1. **Create the key (first message, only this).** Guide the user (Indonesian): at git.neuron.id click profile photo › Preferences (or Edit profile) › Access tokens › Add new token; any name, tick `read_repository` and `read_api`, create, then copy the key (shown only once). If the menu differs, ask the user to describe what they see.
2. **Store the key (second message, after the user replies they created it).** Before the command, say the thing asked for next is the access key just made, not the computer password; say "Jangan tempel kunci di chat" once only. Have the user copy ONE line into Terminal; the key is typed in a hidden box, so the text not appearing is expected:
   - macOS: `security add-generic-password -U -s rudisone-rudis-sdd -a "$USER" -w` (stores it in the Mac password vault/Keychain; if "password data for new item" appears, it asks for the access key just made, not the Mac password)
   - Linux/WSL2: `~/Documents/Neuron/ai-agent/RudisOne/bin/perkakas.sh pat rudisone-rudis-sdd`
   - Windows native (PowerShell): `node "$HOME\Documents\Neuron\ai-agent\RudisOne\bin\perkakas.mjs" pat rudisone-rudis-sdd`
3. After the user replies "selesai", return to step 6 in the main file (re-run the installer).
