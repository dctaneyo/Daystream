# Daystream — design system

The product is a calendar you can write in. One day at a time, notes are pages;
pages hold lines. The interface should feel like a well-made paper planner: warm
stock, thin rules, margins that breathe, and nothing that looks like software
trying to be friendly.

`UX-nn` rules describe behaviour and outrank `UI-nn` rules (appearance) when
they conflict.

---

## 1. The model

- **Workspace** → **Day** → **Note** → lines.
- A note belongs to exactly one day. `assigned_date` is that day; it is not a tag.
- A note can be **globally pinned** (`pin_mode = 'global'`) or **pinned**
  (`pin_mode = 'day'`), or ordinary (`none`).
- Notes are written, not composed. There is no title field: the first non-empty
  line becomes the title in the day stack, the rest becomes the excerpt.

## 2. Signature element: the ruled rail

The date rail is the one thing that should be recognisable with the wordmark
covered (`UI-10`). It is a horizontal ledger strip:

- 60px cells at 390px, 68px on desktop, separated by 1px hairlines.
- Weekday in 9px tracked caps; day number in tabular sans.
- The selected day is chalk on the paper (`bg-surface`) with a 1px accent rule
  along its bottom edge.
- Today is a heavier numeral, not a dot or a badge.
- Activity is a 3px muted dot. Collaborator footprints are 5px dots in each
  person's ink. Marks sit in a fixed 6px row so the rail never jitters.
- The rail holds 35 days and keeps its window until the selected day nears an
  edge, then re-anchors. Selection moves under the thumb; the strip does not
  rebuild. It scrolls horizontally only. A month calendar sheet is the way to
  jump beyond the window, not more rail cells.

The cover test: date rail + serif day title + flat note rows + "New note" rule
should still read as Daystream with "DAYSTREAM" hidden.

## 3. Tokens

Colour, type and spacing are fixed in `src/styles.css`. Do not add a third
palette, a tinted surface, or a translucent panel.

### Light (default)

| Token | Value | Use |
| --- | --- | --- |
| `--bg-canvas` | `#F9F8F6` | the paper |
| `--bg-surface` | `#FFFFFF` | the open page, sheets, active day |
| `--text-primary` | `#1A1A18` | ink |
| `--text-muted` | `#706F6C` | annotations, metadata |
| `--border-clean` | `#E6E4E0` | every 1px rule |

### Dark

| Token | Value |
| --- | --- |
| `--bg-canvas` | `#121211` |
| `--bg-surface` | `#1C1C1A` |
| `--text-primary` | `#E4E4E1` |
| `--text-muted` | `#8E8D88` |
| `--border-clean` | `#2C2C2A` |

### Accents (user choice, per device)

| Accent | Light ink | Dark ink |
| --- | --- | --- |
| Sage (default) | `#4A5D4E` | `#7A8F7F` |
| Slate | `#4A5568` | `#A0AEC0` |
| Clay | `#8C6239` | `#D69E2E` |
| Oxblood | `#742A2A` | `#FEB2B2` |
| Monochrome | `#1A1A18` | `#E4E4E1` |

Accent is *ink*, not paint: selection rule, checked box, presence dots, caret
labels, active pin choice, focus ring. It never fills a card, never glows, never
becomes a gradient.

### Type

- UI and numerals: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  Helvetica, Arial, sans-serif`.
- Notes: `Georgia, "Times New Roman", serif`.
- Scale: 12 / 14 / 16 / 20 / 28px.
- No web fonts. No font loading state. No letter-spacing below 9px numerals.

### Spacing

Multiples of 4: 4, 8, 12, 16, 24, 32. Screen side padding is 20px (36px on
desktop). Day title gets 28px above and 20px below on mobile.

## 4. Behaviour rules

- **UX-01** The app is one view: a day. Notes open as an editor: full-screen on
  phones, and confined to the centre column on desktop so the workspace stays
  visible. No note route, no separate search or feed.
- **UX-02** New notes are created with one tap and open immediately, cursor at
  the end of an empty page.
- **UX-03** Typing is never blocked by saving. Text lands in the CRDT document
  and IndexedDB first; Postgres catches up.
- **UX-04** Swiping the day left/right moves one day. Arrow keys do the same on
  desktop; `T` returns to today. `?d=YYYY-MM-DD` is the shareable day.
- **UX-05** The rail is the primary date control; tapping a date is one action,
  no confirmation. The Calendar action opens a month grid so any date is two
  taps away, including dates outside the rail's window.
- **UX-06** Presence: the rail shows where others are in the workspace, the
  editor shows their carets. Presence is ephemeral and never written to
  Postgres. No polling, ever.
- **UX-07** The session locks after 4 hours idle or 4 hours backgrounded. Unlock
  is PIN-only: six digits, no ID. Local digest first, server confirmation
  behind it.
- **UX-08** The seven-day session wall is absolute. Never extend it, never
  silently re-authenticate; send the person back to the full ID + PIN screen.
- **UX-09** A globally pinned note is visible on every date. It leaves its
  day's stack and lives under **Global pins**.
- **UX-10** A pinned note keeps its date and sorts above ordinary notes.
  Unpinning sends it to the end of the stack.
- **UX-11** Deleting is two taps in place ("Delete note" → "Tap again to
  delete"). No browser confirm dialogs.
- **UX-12** Pin control has exactly three options: Free, Pinned, Global pin.
  Their meaning is stated once under the control; no other pin semantics.
- **UX-13** Marks: activity is a muted dot, presence is ink-coloured. Never mix
  meaning into one dot.
- **UX-14** Empty states are sentences, not illustrations: "Nothing written for
  this day." with a single text action.
- **UX-15** Sheets (account, templates) open from the bottom on mobile, centred
  on desktop, and close on Escape or backdrop tap.
- **UX-16** A failed network call keeps the local view intact and says so in one
  line. Never blank the page to show an error.
- **UX-17** Offline: existing notes stay editable and sync on reconnect. Creating
  a note or changing a pin needs the server; the UI disables those actions only
  while a request is in flight, not pre-emptively.
- **UX-18** Mobile indentation: swipe right to indent, left to outdent on a
  list line, with Outdent/Indent in the editor footer as the keyboard-free twin.
  A control is disabled when the current line cannot actually move.
- **UX-19** Selection and caret are the platform's; never replace the native
  keyboard or text menu.
- **UX-20** Respect `prefers-reduced-motion`; no motion is load-bearing.
- **UX-21** Administration is a separate page at `/admin`, outside the day shell.
  It uses the same paper and hairlines, but never adds admin controls to the
  notebook itself.
- **UX-22** Workspace membership and note sharing are different promises. A
  workspace invite opens every note in it; a note share opens exactly one note
  and nothing else. A note sharee can edit the body but cannot pin, move,
  delete or invite. The Share sheet states this distinction in place.
- **UX-23** Workspace switching, members and invites live in their own Workspace
  sheet opened from the header — not inside Account. Account holds appearance,
  identity, locking and sign-out only.
- **UX-24** A note row carries no redundant "Note"/"Blank" label. The only
  optional row marker is the accent rule and a pin glyph with "Pinned" for a
  day pin.
- **UX-25** At 1100px and wider the app uses the width: month calendar and
  people on the left, the day in the centre, global pins/shared notes on the right.
  Opening a note replaces only the centre column's day view, below the rail;
  both side columns remain visible and usable, and no backdrop covers them. The
  mobile single column is still the primary design, not a fallback.
- **UX-26** A member may change their own display name; the six-digit ID never
  changes. Display names stay unique case-insensitively.
- **UX-27** The area around the iOS keyboard is paper, never the day view. On
  phones, the editor's opaque full-viewport backdrop covers any
  layout-viewport gap; use the native keyboard and do not blur the page as a
  substitute. On desktop the backdrop is absent because the editor is already
  bounded by the two side columns.
- **UX-28** Icons are navigation and action aids, not decoration. Use the one
  bespoke 1.25px stroke family at 14–16px; keep the word beside the icon except
  for conventional controls such as month arrows and close, which keep an
  accessible name.
- **UX-29** A public link is a read-only capability, not a collaboration role.
  It opens one note at `/p/<token>` without an account and cannot edit, pin,
  move, delete, invite, or see the workspace. The page says "Read only" and the
  link can be revoked from the Share sheet at any time; a revoked or unknown
  token gets a plain unavailable state, never a sign-in prompt.

## 5. Writing contract

The editor is Tiptap with Yjs collaboration. Markdown markers are consumed on
space; no visible syntax and no hover toolbar.

| Typed | Then | Result |
| --- | --- | --- |
| `#` | space | H1 headline |
| `##` | space | H2 |
| `-` or `*` | space | bullet |
| `1.` | space | numbered item |
| `>` | space | indented grey quote |
| `[]` or `[ ]` | space | checkbox item |

- **Enter** inside a checkbox adds the next empty checkbox.
- **Enter** on an empty checkbox removes the checkbox and returns a plain
  paragraph (the escape clause).
- **Tab / Shift-Tab** sink and lift list items on desktop.
- Checkboxes are flat 15px squares: 1px ink rule, accent fill when checked,
  muted strikethrough text.
- Body: 17px serif, 1.72 line-height, max 680px measure, 20px side padding.
- Carets are 1px vertical rules in the collaborator's ink with a 9px name label.

## 6. Component rules

- **UI-01** Every separation is one 1px `--border-clean` rule. Nothing is a
  floating card; nothing has a shadow. Text actions carry a hairline underline
  so their affordance never depends on colour alone. Icons are monochrome
  strokes in the current ink, never coloured badges or pictogram tiles.
- **UI-02** No gradients, glows, glass, blur, or neon. No dark-neon inverse.
- **UI-03** Corners are square. 0 radius everywhere, including inputs and
  checkboxes.
- **UI-04** No emoji, no decorative icons, no icon-per-label. Text is the
  affordance; a 12px hairline may mark "new".
- **UI-05** No badge soup. One status at a time: Live/Local, or the pin mark, or
  the note count. Not all three in one row.
- **UI-06** Numerals are tabular in the rail, IDs and dates.
- **UI-07** New fonts, icon sets, animation libraries or component kits are
  design decisions, not conveniences; they need a rule here first.
- **UI-08** Accent is used sparingly: one underline, one checked box, one dot.
  If two accents compete in a viewport, remove one.
- **UI-09** Sheets use `bg-surface`, a 1px top rule, and 20px padding. No
  rounded top corners, no drag handle.
- **UI-10** The cover test: hide the wordmark at 390×844; the screen must still
  be identifiable as Daystream.
- **UI-11** Text buttons are 13px muted, going to ink on hover. Filled buttons
  are ink with paper text and are rare (one per auth screen).
- **UI-12** Focus is a 1px accent outline with 2px offset; never a glow.
- **UI-13** Never use browser primitives for product UI (`confirm`, `alert`,
  `prompt`, `<select>`, `<dialog>`, validation bubbles).
- **UI-14** Images and icons are generated flat assets; no photography, no
  illustrations inside the app chrome.
- **UI-15** The keypad is a 3×4 hairline grid, 64px cells, 21px numerals,
  numbers only. Digits appear as 7px dots in six underlined slots.
- **UI-16** Motion, when present, is 140–220ms ease-out opacity or a small
  translate. Nothing springs, bounces, or parallaxes.

## 7. Copy

- Short, declarative, no exclamation marks, no cheerleading.
- "Nothing written for this day." not "No notes yet!".
- Errors name the next action: "Too many tries. Wait five minutes, then try
  again."
- The ID warning is explicit: "Write this down. This ID and your PIN are the only
  way back in."
