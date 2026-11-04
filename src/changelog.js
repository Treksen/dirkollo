import { versionCmp } from './version'

// Add a new entry at the TOP for every release, and bump "version" in package.json to match.
export const CHANGELOG = [
  {
    v: '2.5.3', date: '2026-11-03',
    items: ['Refreshing the page now keeps you on the page you were on (and the section inside Settings and Admin), instead of going back to Home.'],
  },
  {
    v: '2.5.2', date: '2026-11-02',
    items: ['Admin > Studio: the Save button now stays in view at the bottom of the screen and tells you when there are unsaved changes.'],
  },
  {
    v: '2.5.1', date: '2026-11-01',
    items: ['A light/dark switch button now sits next to the page title, on every screen.'],
  },
  {
    v: '2.5.0', date: '2026-10-31',
    items: [
      'Sessions can show in your phone calendar: Settings > Account > Phone calendar.',
      'Optional two-step sign-in with an authenticator app (Settings > Account). The Admin can require it for Admin and Director.',
      'Backups can be encrypted with a passphrase. Backups, restores and imports are written to the activity log.',
      'Payment records can no longer be changed or deleted by a Director.',
    ],
  },
  {
    v: '2.4.0', date: '2026-10-30',
    items: [
      'Optional Deliver by date for each client, with reminders before and after it.',
      'Clients stuck too long in Shot, Selecting or Editing are flagged. The Admin sets the limits in Admin > Studio.',
      'A Behind filter shows everything overdue, late or stuck in one list.',
      'Warnings for clients with no phone number or a wrong-looking one, and for possible duplicate clients.',
    ],
  },
  {
    v: '2.3.0', date: '2026-10-29',
    items: [
      'Overpaid clients are flagged, and each client can have an optional Pay by date that triggers a payment reminder.',
      'The offline banner changes colour the longer changes have been waiting. The Admin can see which phones are behind (Admin > Devices).',
      'Settings > Team warns when there is only one Admin.',
    ],
  },
  {
    v: '2.2.0', date: '2026-10-28',
    items: [
      'A banner tells you when a new version of the app is ready, and Settings > App lets you check for updates yourself.',
      'Settings > App shows which version you are running.',
      'The Admin can require a minimum version (Admin > Studio) so old copies of the app cannot send out-of-date changes.',
    ],
  },
  {
    v: '2.1.0', date: '2026-10-27',
    items: [
      'Desktop layout: sortable clients table with a details panel, and a denser dashboard.',
      'Sessions whose date passed while still Booked are flagged as Overdue.',
      'Cancelled and No-show statuses, a No date filter, and archived clients who still owe money are listed under Payments.',
      'Staff and Directors can work offline; changes send automatically when the connection returns.',
    ],
  },
]

// Entries newer than `since` and no newer than the running version, newest first (at most 3)
export const newerEntries = (since, current) =>
  CHANGELOG.filter((e) => versionCmp(e.v, since) > 0 && versionCmp(e.v, current) <= 0).sort((a, b) => versionCmp(b.v, a.v)).slice(0, 3)
