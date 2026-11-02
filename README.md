# Director Kollo Studios — Client Tracker (React + Supabase PWA)

## GO LIVE
1. **Supabase:** create a project. SQL Editor > paste and run `supabase/schema.sql`. Leave public sign-ups ON.
2. **Realtime:** nothing to click. `schema.sql` already enables it for the tables. To check, run in SQL Editor: `select tablename from pg_publication_tables where pubname = 'supabase_realtime';` (you should see `clients`, `payments`, `profiles`).
3. **Env vars:** copy `.env.example` to `.env`, fill the URL and anon key from Supabase > Settings > API.
4. **Deploy:** push to GitHub, import into Netlify (build `npm run build`, publish `dist`), add the two env vars.
5. **The studio owner signs up FIRST** (before sharing the link): that account becomes the Admin.
   Then the Director and staff sign up themselves, and the Admin sets their roles and activates them in the Team screen.

## ROLES
- **Admin** (first sign-up): everything the Director can do, plus the Team screen (roles, access, remove people).
- **Director**: clients, payments, prices, delete.
- **Staff**: clients and sessions only, no money.
- New sign-ups are staff + suspended until the Admin activates them.

## RUN LOCALLY
```
npm install
npm run dev
```

## WHAT IS IN THE APP
Original Director Kollo design (same CSS, landing page, tabs, light/dark/system theme). Landing page with photo gallery, Home dashboard, Clients with search and filters, client form with duplicate photo-code and package-limit warnings, automatic pricing rules, Calendar with reminders and double-booking check, staff assignment, Payments and numbered invoices (PDF), Reports (CSV and PDF), Settings (Team, Packages and pricing), Admin tab (Overview, Activity, Data tools, Studio), profile photo that follows the account, live sync, installable PWA.

## DATABASE FILES (run in this order, once each, in Supabase > SQL Editor)
1. `supabase/schema.sql`
2. `supabase/admin-update.sql`
3. `supabase/hardening-update.sql`  (atomic saves, archive, invoice numbers, staff access rule, activity log triggers, photo bucket)
4. `supabase/approvals-update.sql`  (Director can approve staff, Admin permanent delete)
5. `supabase/offline-sync-update.sql`  (offline sync support, conflict detection)

## OFFLINE: HOW IT WORKS
Staff and Directors can work with no signal.
- **Works offline:** add clients, edit clients, change status, photo codes, gallery link, record payments.
- **Needs a connection:** archive or delete, packages and pricing, team and approvals, Admin tab, backups, PDF invoices, signing in for the first time.
- Changes are shown at once, kept on the phone, and marked "Not synced yet". They are sent automatically, in order, when the connection returns (or tap Sync now).
- The phone keeps a saved copy of every client the person can see, so lists open with no signal. Connect once after signing in to download it.
- **Conflicts: latest save wins.** If someone else changed the same client meanwhile, your version is saved and you get a message naming the client.
- **Money is sent as changes, not totals,** so two people adding payments offline add up instead of overwriting each other.
- Sending the same change twice is safe (no duplicate clients or payments).
- If the server refuses a change, it stays on the phone under "Review", where you can retry or discard it.
- **Phone security:** the saved copy contains client names and phone numbers. Use a screen lock. Signing out removes the copy from the phone (and warns you first if changes are still waiting).
- Run `supabase/offline-sync-update.sql` once. Do not re-run hardening-update.sql afterwards.

## STAFF ACCESS
By default staff only see clients assigned to them (or that they added). Admin can switch this to "all clients" in Admin > Studio. Staff never see payments or prices.

## BACKUPS
Admin > Data tools downloads and restores a JSON copy (all rows). It contains personal data, so store it privately. Switch on your Supabase plan's own backups as the real safety net, and test a restore once on a copy of the project.

## TESTS AND LINT
```
npm test       # unit tests for pricing, double-booking, reminders, CSV safety
npm run lint
```

## PROFILE FIX (if you signed up BEFORE running schema.sql)
Error 406 or a "Profile missing" screen means your login exists but has no profile row. Run this in the Supabase SQL Editor (put your email in), then sign in again. It makes you the Admin:
```sql
insert into public.profiles (id, name, email, role, status)
select id, coalesce(raw_user_meta_data->>'name', ''), email, 'admin', 'active'
from auth.users where email = 'YOUR-EMAIL-HERE'
on conflict (id) do nothing;
```

## PASSWORD RULES
The app requires at least 10 characters, blocks very common passwords (including "password2024" style variants), and blocks the studio name, the person's name and email. It shows a live strength bar, and nudges people who sign in with a weak password to change it. People already signed up are never locked out.
The app check is only a convenience: **Supabase is the real gatekeeper**, because anyone can call the sign-up API directly. In the Supabase dashboard, open Authentication, then the Email provider settings, and set **Minimum password length to 10**. If you are on the Pro plan, also switch on **leaked password protection**. Optional: turn on secure password change so a recent login is needed to change a password.

## CANCELLED AND NO-SHOW (run `supabase/statuses-update.sql` once)
Two extra statuses that sit outside the delivery pipeline. They leave the reminders, the pipeline counts, the workload and the double-booking check. If money is still recorded on a cancelled booking, the Director/Admin gets a "settle the balance" reminder (adjust the price or record a refund). Archived clients who still owe money are listed under Payments and mentioned next to the Outstanding balance, and the archive confirmation warns you first.

## APP UPDATES
- When you deploy a new build, phones download it quietly. A green banner appears: **A new version of the app is ready. Update now.** Settings > App shows the version, lets people check for updates, and shows what changed.
- **To release:** (1) change `"version"` in `package.json`, (2) add an entry at the top of `src/changelog.js`, (3) deploy. People who update see a short "What's new" note once.
- **Required update (Admin > Studio > Required app version):** set a minimum version that is ALREADY deployed. Staff and Directors on older copies see "Update required" while online. Offline work is never blocked, and the Admin is never blocked. Use it after a release that changes how data is saved.
- The banner asks before reloading if a form is open. Unsent offline changes survive an update because they are kept in the phone's storage.

## MONEY FLAGS, STALE PHONES AND ADMIN RECOVERY (run `supabase/money-devices-update.sql` once)
- **Overpaid:** a client who has paid more than the price is flagged on their card, in the table, in the reminders and under Payments.
- **Pay by (optional):** set a date on a client. The Director/Admin gets a reminder in the 3 days before it and a red reminder after it.
- **Stale offline changes:** the banner turns amber after 1 day and red after 3 days of waiting changes. The Admin sees every phone in **Admin, then Devices** (last seen, changes waiting, app version) and can forget old ones. A phone only reports while it is online.
- **Lost Admin account:** only an Admin can change roles, and no one can change their own role. Promote a second Admin in Settings > Team (a warning shows while you have only one). If every Admin account is lost, use `supabase/recover-admin.sql` in the Supabase SQL Editor, and protect your Supabase login.

## DELIVER BY, STUCK STAGES AND DATA CHECKS (run `supabase/deadlines-update.sql` once)
- **Deliver by (optional):** in the client form for everyone. Reminders before the date and a red "Delivery was due" after it.
- **Stuck stages:** a client in Shot, Selecting or Editing for longer than the limit (default 3, 7 and 14 days, changeable in Admin > Studio) is flagged. The app records when each stage began.
- **Behind schedule:** one filter (and one dashboard number) for everything overdue, late or stuck.
- **Data checks:** a warning when a client has no phone number or a wrong-looking one, and a warning in the form when the phone number, or the same name on the same date, already exists.

## SECURITY UPDATE, TWO-STEP SIGN-IN AND CALENDAR (run `supabase/security-update.sql`, then `supabase/calendar-update.sql`)
- **Payments are append-only.** A Director can add payments but not change or delete them. Only the Admin can delete. Fix a mistake with a new (negative) payment.
- **Locked-down functions.** People who are not signed in can no longer call database functions (except the calendar feed, which needs a secret token).
- **Size limits** on names, notes, photo codes and profile photos (applied to new and changed data).
- **Activity log** now also records backups, restores and imports. Run `supabase/rls-checks.sql` after every SQL change to prove the rules still hold.
- **Encrypted backups.** Optional passphrase in Admin, Data tools. Restore asks for it. No passphrase means no way in, so store it safely.
- **Two-step sign-in (authenticator app).** Settings, Account. Switch on MFA (TOTP) in the Supabase Authentication settings first. The Admin can require it for Admin and Director in Admin, Studio. When required, role changes and permanent deletes are refused unless the person signed in with a code.
- **Bot check (optional).** Put a Cloudflare Turnstile site key in `VITE_TURNSTILE_SITE_KEY` and switch on CAPTCHA in Supabase. Leave both blank to skip it.
- **Suspended or removed people:** the clients saved on their phone are deleted the next time that phone connects.
- **Phone calendar.** Settings, Account, Phone calendar. A private link shows your sessions (names, places, times; no phone numbers or money) in your phone's calendar. It runs through a Netlify function at `/api/calendar` and needs no new settings.
- See `LAUNCH-CHECKLIST.md` for the full pre-launch test script.
