# To-do

The order is `DESIGN.md` §14. One line per item, ticked as it lands.

## Now

- [x] **1. Mobile navigation** — `NavLinks` renders a bottom bar; every destination reachable on a
      phone (`UI-11`).
- [x] **2. Vocabulary copy + README truth** — "Convert to Text", Text/Task labels in search, the
      false `reminder_at` claim removed (`UX-14`).
- [x] **3. Undo + Toast** — one live region, `Undo` on delete, the primitive every later destructive
      action needs (`UX-06`, `UX-18`).
- [x] **4. `moveBlock` failure surfacing** — no more silent 8s timeout; a real message and a retry
      (`UX-17`).
- [x] **5. Note delete confirms with a count** — the confirmation names the note and, once the
      projection knows, how many Things go with it (`UX-13`).
- [x] **6. `note_id` + Inbox + note-room projection** — migration `004`, one Inbox per workspace
      (enforced by the database), every existing Thing backfilled into it, and `note:<id>` rooms now
      project, so a Thing written inside a Note is searchable and countable.

## Next

- [ ] **7. Capture defaults** — the composer names the Note it is writing into, and remembers the
      last one used per workspace; no picker on the capture path (`UX-01`, `UX-09`). *Partly done:*
      the Inbox is now visible and sorted first in the Notes list.
- [ ] **8. Retire the day/backlog lanes** — Today and Backlog become queries grouped by Note. Own
      change, after #7.
- [ ] **9. Token + type-scale sweep** — `success`/`warning`/`danger`, no raw palette, no off-scale
      sizes (`UI-02`, `UI-03`). *Started:* `--danger` exists and the toast uses it.
- [ ] **10. Stream identity pass** — mono day stamp as the signature, accent held to three uses, pass
      the cover test (`VI-04`, `VI-10`).
- [ ] **11. Menu + format bar** — 44px targets, focus in/return, arrow keys, the line-break control
      that replaces `Shift+Enter` (`UX-20`, `UX-31`).

## Later

- [ ] **12. Quick capture from anywhere** — share target / PWA shortcut, landing in the current Note.
- [ ] **13. Reminders, or delete the type** — needs `reminder_at` plus a scheduler; until then
      `reminder` is a Task wearing a promise.
- [ ] **14. Wikilinks / backlinks** — only meaningful once Notes contain Things.

## Not doing

Nested Notes, tags, rich text, drag-to-reorder, themes, a Note picker on the capture path, `toggle`,
and any new UI dependency without a `VI-07` rule.
