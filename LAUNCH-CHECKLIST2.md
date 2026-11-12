# LAUNCH CHECKLIST: Director Kollo app

Work through this once before real clients depend on the app, and repeat the **bold** items after every big update. Tick each box.

## 1. Database (Supabase SQL Editor): run each file ONCE, in this order
- [ ] `supabase/schema.sql`
- [ ] `supabase/admin-update.sql`
- [ ] `supabase/hardening-update.sql`
- [ ] `supabase/approvals-update.sql`
- [ ] `supabase/offline-sync-update.sql`
- [ ] `supabase/statuses-update.sql`
- [ ] `supabase/money-devices-update.sql`
- [ ] `supabase/deadlines-update.sql`
- [ ] `supabase/security-update.sql`
- [ ] `supabase/calendar-update.sql` (re-run it any time you re-run `security-update.sql`)
- [ ] **`supabase/rls-checks.sql`: every row of the result must say PASS (SKIP means no data to test with). Fix FAIL rows before going live.**
- [ ] Your own extra files (for example `hide-admin.sql`) if you use them

## 2. Supabase dashboard settings
- [ ] Authentication, Email provider: **minimum password length 10**
- [ ] Authentication, URL settings: Site URL and redirect URLs are ONLY your real site address
- [ ] Authentication: **MFA (TOTP) switched on** (needed for two-step sign-in)
- [ ] Optional: CAPTCHA (Cloudflare Turnstile) switched on, with the site key in `VITE_TURNSTILE_SITE_KEY`. Set both or neither
- [ ] A custom email sender is set, so reset emails are trusted
- [ ] **Your own Supabase, Netlify and GitHub logins have MFA on**
- [ ] Project backups are on (check your plan). Run the Security Advisor and fix what it reports
- [ ] The project region is the closest one to your users

## 3. Netlify
- [ ] Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_TURNSTILE_SITE_KEY`)
- [ ] The service role key is NOT anywhere in Netlify or in the code
- [ ] Deploy, open the site, open the browser console on the sign-in page: no red "Refused to load" (CSP) messages
- [ ] Calendar: after creating a link in Settings, open it in a browser. You should download or see a `.ics` file

## 4. People and roles
- [ ] The owner signs up FIRST and becomes the Admin. Sign-ups from strangers are not approved
- [ ] A second Admin exists (Settings, Team). Keep `supabase/recover-admin.sql` somewhere safe
- [ ] A Director and a staff member can sign up, wait for approval, and are approved
- [ ] The Director sees money. Staff do NOT see payments, prices or reports
- [ ] Staff see only their own clients (or all, if you chose that in Admin, Studio)
- [ ] **A Director cannot delete or edit a payment. Only the Admin can delete a client for good**
- [ ] Suspend a test person: their phone loses access, and the offline copy is removed next time it connects

## 5. Offline and sync (use a real phone and real airplane mode)
- [ ] Sign in while online. Open the app once so it downloads the clients
- [ ] Airplane mode: add a client, edit one, change a status, add photo codes, record a payment
- [ ] Close and reopen the app, still offline: the changes are still there, marked "Not synced"
- [ ] Turn airplane mode off: the banner clears and a second device sees the changes
- [ ] Conflict: edit the same client offline on phone A and online on phone B, then reconnect A. A shows the "someone else changed this" message
- [ ] Leave a change waiting for a day: the banner turns amber (use a test phone). Admin, Devices lists the phone
- [ ] **Sign out with a change waiting: the app warns you first**

## 6. Backup and restore: test BEFORE you need it
- [ ] Admin, Data tools: download an encrypted backup (use a passphrase you store safely)
- [ ] Create a free test Supabase project, run all the SQL files there, and restore the backup into it. Check the clients and payments appear
- [ ] Restore never deletes anything. Confirm that on the test project

## 7. Updates
- [ ] Change `"version"` in `package.json`, add an entry at the top of `src/changelog.js`, deploy
- [ ] On an open phone: the green "new version is ready" banner appears. Tapping Update now reloads it
- [ ] Settings, App shows the new version and the "What's new" note appears once
- [ ] Optional: set a minimum version in Admin, Studio (only a version that is already deployed)

## 8. Install on real devices
- [ ] Android Chrome: Install app works, opens full screen, works offline
- [ ] iPhone Safari: Share, Add to Home Screen works, opens full screen, works offline
- [ ] Desktop: the clients table and side panel look right at your screen size

## 9. Two-step sign-in and calendar
- [ ] Admin: Settings, Account, Set up two-step sign-in. Sign out and in again: a code is asked for
- [ ] Optional: Admin, Studio, "Require it for Admin and Director", only after both have set it up
- [ ] Settings, Account, Create my calendar link. Add it to a phone calendar. A session shows with the right time
- [ ] Make a new link: the old one stops working

## 10. Privacy basics (check local rules with a lawyer)
- [ ] A privacy notice is on the landing page (Admin, Studio, About)
- [ ] You know how to delete one client's data: Detail, Delete permanently (Admin only)
- [ ] Staff phones have a screen lock. The saved copy of the clients on a phone is not encrypted by this app

## Known limits (so nothing surprises you)
- The offline copy on a phone is not encrypted. A screen lock and signing out protect it.
- An encrypted backup cannot be opened if the passphrase is lost.
- Google refreshes subscribed calendars slowly, sometimes many hours.
- The Devices list shows what each phone last reported while online.
