#data #privacy

# Backup and restore (manual)

Reinstalling the app wipes its data. Rather than keeping a copy in iCloud or on our servers, the user exports a file and keeps it wherever they like (Files, iCloud Drive, email to themselves). That keeps the "nothing leaves your phone unless you choose" promise literal.

- **Export:** Me → Help → "Back up my data (file)". Contents: Dex, catch log (species, time, optional location), quest progress and claims, language, guide, name, match threshold, vibration, the active region id. Not included: photos, chat history, downloaded models and maps, and the sharing choices (Network, leaderboard, location sharing, crash reports). (Catch photos live in `documents/photos/`, copied there at catch time because the camera's cache folder can be emptied by the OS; `src/lib/photos.ts`.)
- **Online key:** the file can also hold the device's online identity (user id + secret) so the ranking and friends survive a reinstall. It is a secret: anyone with the file could act as that user online. It is only offered when there is data online, and the user chooses to include it or not.
- **Restore:** Me → Help → "Restore from a backup", or "Have a backup? Restore it" on the first screen. It **merges**: Dex and catches are unions, quest progress keeps the higher value, settings come from the file. Nothing is deleted. The identity is adopted only when the phone has no online data of its own, and then every sharing switch starts off; the app asks to download the region pack again.
- **Safety:** the file is untrusted input. `parseBackup` checks the schema, id formats, number ranges and sizes (50,000 entries max) before anything is applied.

Code: `src/lib/backup.ts` (format, validation, merge plan), `src/lib/useBackupActions.ts` (file picker, share sheet, dialogs). Related: [[backend-adapter]], [[i18n]].
