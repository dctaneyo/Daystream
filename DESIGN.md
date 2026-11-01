# Daystream design system

**Status:** draft v0.2 · 2026-11-01
**Two layers.** `UX-nn` rules decide *behaviour*. `UI-nn` rules decide *appearance*. When they
disagree, UX wins and the UI rule gets rewritten. A visual choice that cannot name the UX rule it
serves is decoration, and decoration loses.

Read this before touching a screen. If a change needs a rule that is not here, add the rule in the
same commit — this document grows by use, not by decree.

---

## 1. What Daystream is

A daily log written in five-second bursts: one hand, keyboard open, sometimes no network, sometimes
with another person already typing in the same place. It has to be as easy to start as Apple Notes
and as structured as Notion or Twos when you want it to be.

### Three jobs, ranked

| Job | Success test |
| --- | --- |
| **Capture** | Cold open → cursor in the composer in ≤3s; commit with one keystroke |
| **Review** | Any Note in ≤1 tap; any day in ≤2 taps; any Thing in ≤2 actions |
| **Share** | Sharing one Note with an existing account is one screen |

Anything serving none of these is out of scope for a product surface.

### Non-goals for v1

Rich-text editing, nested Notes or folders, tags-as-taxonomy, social features, per-user theming,
merge-conflict UI. Each can arrive later without breaking a rule below; none may be smuggled in as
"polish".

---

## 2. Principles

Each principle has a failure test. A rule that cannot be violated is not a rule.

- **UX-01 Capture before structure.** No decision precedes typing. *Fails if* the composer requires
  a type, Note, or date before text. The app guesses — last-used Note, type Text, day today — and
  lets the person correct afterwards.
- **UX-02 The Note is the home.** Every Thing has exactly one Note. Notes are the categorical
  container people navigate; Things are the lines people write.
- **UX-03 The day is a stamp, not a home.** Every Thing carries the day it belongs to. Days are a
  lens over Notes, never a second place a Thing can live.
- **UX-04 Honest state.** Never claim saved when the write is only local. *Precedent to keep:*
  "Saved on this device instantly. The pill above tells you when it reached the server."
- **UX-05 Thumb first.** Primary actions sit in the bottom third; no two-finger gestures; nothing
  requires precision aiming.
- **UX-06 Reversible over confirmed.** Undo replaces dialogs for edits. Confirmation is reserved for
  irreversible, wide-blast-radius actions.
- **UX-07 One word, one thing.** The vocabulary in §4 is law.
- **UX-08 Never lose a keystroke.** Typing survives offline, reload, a failed sync, and navigation.

---

## 3. The model: Workspace → Note → Thing

```
Workspace
├── Note "Groceries"          ← the home: categorical, what you open, what you share
│   ├── Thing  (Text)
│   └── Thing  (Task, open)
├── Note "Sprint 14"
│   └── Thing  (Text, stamped 2026-11-01)   ← the day is an attribute, not a folder
└── Inbox                     ← the default Note, always exists
```

- **UX-09 One home.** A Thing lives in exactly one Note at a time. There is no orphan state and no
  "in two places" state. If nothing was chosen, it lands in the Note last used in this workspace,
  falling back to **Inbox**.
- **UX-10 Inbox always exists.** Every workspace has an Inbox that cannot be deleted. It is the
  answer to "where did it go?" and the reason capture never has to interrupt.
- **UX-11 Moving a Thing is a Move.** Move changes its Note, its day, or both — one gesture,
  undoable, never a duplicate. `UX-06` applies: no confirmation, an undo instead.
- **UX-12 Creating a Note is cheap.** One action, a title, nothing else required. A Note is a shelf,
  not a project to administer.
- **UX-13 Deleting a Note is the one dangerous action.** A Note holds other people's Things, so its
  deletion names the Note and counts what is inside. This is the confirm case of §5.4.
- **UX-30 Access follows the Note.** A Note is the unit of sharing: being added to a Note grants
  its Things and nothing else — not the owner's other Notes, days, or backlog. Membership of a
  workspace and access to a Note are different questions and must stay different.

**Lenses, not containers.** Today, earlier days, Backlog, Calendar and Search are views over the
same set of Notes. Adding a lens never adds a place a Thing can live.

**Day semantics.** A Thing's day defaults to today in the workspace timezone (`APP_TIMEZONE`). Move
can change it or clear it. The day is what makes the chronological lens possible; the Note is what
makes the categorical one possible. Neither replaces the other.

---

## 4. Vocabulary (UX-14)

| UI says | Code says | Meaning |
| --- | --- | --- |
| **Workspace** | `workspaces` | the scope a person belongs to |
| **Note** | `notes` | the home a Thing lives in |
| **Thing** | `block` | one line inside a Note |
| **Day** | `room_date`, `/app/YYYY-MM-DD` | a stamp on a Thing |
| **Today** | — | the lens for the current day |
| **Backlog** | `backlog` lane | Things with no day |
| **Stream** | daily canvas | the chronological scroll |
| **Move** | `moveBlock` | carry a Thing to another Note or day |
| **Text** | `type: text` | a Thing with no state |
| **Task** | `type: todo` | a Thing that can be done |

**UX-14.** Product copy never says "block", "record", "entry", "item", "card", "notebook", or
"folder". The word **note** is reserved for the container and is never used for a single line: the
line is a **Thing** of type **Text**. Converting is "Convert to Text" / "Convert to Task", never
"Convert to note".

---

## 5. Interaction contracts

### 5.1 Write path (UX-15)

Every edit lands in the local document first and renders immediately. No interaction may block on a
network round-trip before showing the person their own text.

### 5.2 Sync truth (UX-16)

The status pill states carry an explicit promise. Copy may change; the promise may not.

| Pill | Guaranteed | Not guaranteed |
| --- | --- | --- |
| Connecting | nothing yet | never display "saved" |
| Connected | reached the server (document + projection) | — |
| Reconnecting… changes saved locally | safe in this browser's storage | other devices can see it |
| Working offline | this device only | survives clearing site data |

### 5.3 Failure (UX-17)

Errors say what happened and what to do, in the interface's voice. No `catch` that leaves the person
guessing; no spinner that clears itself as if nothing happened. A failed action retries visibly or
offers itself again.

### 5.4 Undo over confirm (UX-18)

| Action | Mechanism |
| --- | --- |
| Delete a Thing, move a Thing, edit text | immediate, with an undo affordance (~8s) |
| Delete a Note | dialog naming the Note and its Thing count; undo inside the dialog |
| Change PIN, share a Note | inline form with explicit submit |
| Suspend a person, delete a workspace or account | dialog naming the target and the blast radius |
| Sign out | none |

### 5.5 Keyboard (UX-19)

`Enter` commits in the composer. `Shift+Enter` breaks the line. `Esc` leaves editing and keeps the
text. `Cmd/Ctrl+Enter` converts Text ⇄ Task. `Esc` closes any open menu and returns focus to its
opener; arrow keys move between menu items. Tab order matches visual order.

### 5.6 Touch and pointer (UX-20)

Targets ≥44×44 CSS px. One tap to edit — never double-tap. Actions are always visible on touch and
revealed on hover on pointer devices only. A swipe requires ≥60px horizontal travel *and*
horizontal dominance over vertical, so it never fights scrolling.

### 5.7 Four states (UX-21)

No surface ships without all four defined:

| State | Requirement |
| --- | --- |
| Empty | an invitation to act, in one sentence, naming the next action |
| Loading | bounded and labelled; never an unresolvable spinner |
| Error | what failed, what still works, what to do next |
| Offline | what is still possible, and what is queued |

### 5.8 Motion (UX-22)

120–200ms, used for orientation only. Content never animates as it syncs. `prefers-reduced-motion`
is already honoured globally — keep it honoured by every new animation.

---

## 6. Information architecture

- **UX-23 Four destinations, all widths.** At most four primary destinations, every one reachable at
  every breakpoint. Recommended: **Notes, Today, Search, Settings** — with Backlog and Calendar as
  filters and panels inside Today, never as extra destinations.
- **UX-24 URL is state.** The open Note, the day, the month and the search query live in the URL, so
  a view can be reloaded, bookmarked and shared.
- **UX-25 Admin is a separate tree.** `/admin` is an operator surface: its own layout, its own
  navigation, never mixed into product chrome.
- **UX-26 Lenses never nest.** Today can be grouped by Note, but a lens never contains another lens.

---

## 7. Accessibility floor (UX-27…UX-29)

- **UX-27 Contrast and focus.** Body text ≥4.5:1; large text and meaningful borders ≥3:1; a visible
  focus ring on every interactive element, in both themes.
- **UX-28 Status is never colour alone.** State is carried by text, shape or label first and colour
  second.
- **UX-29 Operable without a mouse or a fine pointer.** Every action reachable by keyboard; icon-only
  controls carry an accessible name; inputs stay at 16px; the layout survives 200% zoom.

---

## 8. Visual layer

Derived from the existing implementation on purpose: this codifies the current direction instead of
replacing it.

- **UI-01 Semantic tokens only.** `canvas` (page), `panel` (surface), `raised` (input/control),
  `hover`, `edge` (border), `ink` (text), `muted` (secondary), `accent` (action, active, today),
  `accent-ink`, `accent-soft`. New concepts get a token, not a colour.
- **UI-02 No raw palette values in components.** `bg-amber-400`, `text-red-600`, `text-black` are
  violations wherever they appear; state colour comes from `success`, `warning`, `danger` tokens
  defined in both themes.
- **UI-03 Seven type steps.** 11 meta · 12 label/control · 14 secondary · 16 body and inputs · 18
  section title · 20 page title · 24 display. Arbitrary values such as `text-[10px]` or
  `text-[16px]` are replaced by the nearest step (16 is the body step; use it as a token).
- **UI-04 Spacing.** 4px layout rhythm; 2px allowed for control padding; steps 2/4/8/12/16/24/32/48.
- **UI-05 Radius.** 6 control · 8 input · 12 card · 16 composer/sheet · full pill. Nothing else.
- **UI-06 Elevation.** Borders before shadows. One shadow, for overlays only.
- **UI-07 Dark parity.** Every token is defined in both themes; nothing may exist in one theme only.

---

## 9. Components

- **UI-08 Rule of three.** No abstraction before the third use; no second copy of an existing one.
- **UI-09 One component per behaviour.** A second popover, a second sync indicator, or a second
  composer is a bug, not a variation. The Thing reader exists twice (`src/lib/blocks.ts` and
  `server/blocks.mjs`) — a model change has to be made in both.
- **UI-10 Overlays.** Every menu, popover and dialog closes on `Esc` and outside click, moves focus
  into itself, and returns focus to its opener.

**Present:** `ds-input`, `ds-textarea`, `ds-button`, `InlineMarkdown`, `FormatBar`, `StatusPill`,
`CalendarPanel`, `NavLinks`, `DailyCanvas` (day / backlog / note), `NoteComposer`, `NoteSharePanel`,
`Scratchpad`.

**Missing, in priority order:** Undo/Toast · `ConfirmDialog` · `Menu` (the Thing menu is close; it
needs focus and arrow keys) · `Field` (label + hint + error) · `EmptyState` · `Skeleton` · `Sheet`
· `NotePicker` (the §3 default-home control).

---

## 10. Definition of done for any UI change

Four states defined · keyboard path · touch path · both themes · contrast and focus checked · copy
follows §4 · no new raw colour or off-scale size · the rule served is cited in the change · this
document updated if a rule changed.

---

## 11. Adopting one home for Things

Notes and `note_members` already exist, and a Note is already its own room (`note:<id>`). The gap is
containment: today there are **three parallel homes** — a day room, the backlog room, and a note
room — so a Thing is filed by whichever screen it was typed on, and a Note is a document that
happens to look like one.

Target shape:

```sql
-- 1. Make the home explicit. Day stays a stamp.
alter table things add column note_id uuid references notes(id) on delete cascade;

-- 2. Guarantee the default home, so capture never has to ask.
alter table notes add column is_inbox boolean not null default false;
create unique index notes_one_inbox on notes (workspace_id) where is_inbox;
```

- Backfill every workspace's existing day/backlog Things into its Inbox Note, then set `note_id`
  `not null`. Nothing orphans, and nothing is lost if the day lanes are later retired.
- Project note-room Things into `things` with their `note_id` and day stamp, so search, the calendar
  heat-map and the open-task roll-up can see Things written inside a Note. Today they cannot.
- Then the lenses are queries: Today = `things` where the day matches, grouped by Note; Backlog =
  `things` where the day is null. The day and backlog *rooms* retire, or survive as an Inbox-only
  fast path.
- Order matters: ship `note_id` + Inbox + projection first (invisible to people, fixes search), then
  move capture, then retire lanes. Doing it in that order never leaves a Thing homeless.

Do not rename the `block` type or the room format in the same change; those are separate, mechanical
pieces of vocabulary debt (`UX-14`, `UI-09`).

---

## 12. What this system exposes in today's code

1. Three homes for one entity: `dayRoom`, `backlogRoom`, `noteRoom`. A Thing filed by typing is not
   filed by intent (`UX-02`, `UX-03`, `UX-09`).
2. Mobile header hardcodes **Search** and **Backlog**; Notes and Settings are unreachable on a phone
   without typing a URL (`UX-23`).
3. Five destinations in `NavLinks` against a budget of four (`UX-23`).
4. `StatusPill` uses raw `amber`/`emerald`/`red`, `text-[10px]` and `text-black`; `BlockItem` uses
   `text-red-600`/`text-[16px]`; `NoteComposer` repeats the raw red (`UI-02`, `UI-03`).
5. Thing menus are label-only for pointer users, and "Convert to note" now collides with the
   container (`UX-14`).
6. Delete is immediate and permanent; there is no undo anywhere (`UX-06`, `UX-18`).
7. Note deletion is a single unconfirmed action on a document that may be shared (`UX-13`).
8. Search renders `item.type` straight from the database, so people read `todo` and `reminder`
   (`UX-14`); `toggle` is a declared type with no behaviour that would render as `toggle`.
9. `note_members` only has `editor`; there is no read-only sharing, though the UI implies levels
   (`UX-30`).

---

## 13. Changing the system

Propose it in writing, add the rule here, then apply it in one change. Deprecations get a date.
Decision log entries look like:

> **2026-11-01 · UX-02/UX-03 ·** Notes became the home and the day became a stamp, because
> organisation needs a categorical container while chronology still needs to be addressable.
