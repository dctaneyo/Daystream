# Daystream design system

**Status:** draft v0.2 · 2026-11-01
**Two layers.** `UX-nn` rules decide *behaviour*. `UI-nn` rules decide *appearance*. When they
disagree, UX wins and the UI rule gets rewritten. A visual choice that cannot name the UX rule it
serves is decoration, and decoration loses.

Read this before touching a screen. If a change needs a rule that is not here, add the rule in the
same commit — this document grows by use, not by decree.

**Mobile first, absolutely.** About 95% of use is a phone held in one hand; the rest is a tablet or
a desktop. The 360–430px viewport is therefore the design target, not the fallback case: every
screen is designed, reviewed and tested at **390×844** before it is widened, and a surface that is
only complete at `lg` is unfinished. Two consequences run through this document — thumb reach
decides placement (`UX-05`), and anything a keyboard can do must also be doable with a tap, because
phone keyboards have no `Ctrl`, `Cmd`, `Alt`, `Option`, arrow keys, or a usable `Shift`
(`UX-31`, `UX-32`).

---

## 1. What Daystream is

A daily log written in five-second bursts: one hand, keyboard open, sometimes no network, sometimes
with another person already typing in the same place. It has to be as easy to start as Apple Notes
and as structured as Notion or Twos when you want it to be.

### Three jobs, ranked

| Job | Success test |
| --- | --- |
| **Capture** | Cold open → cursor in a Note → first Thing typed in ≤3s; one return per Thing |
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

- **UX-01 No unclaimed structure.** No avoidable decision precedes typing: the type defaults to
  Text and the day to today. The one decision capture does ask is the home, and it arrives
  pre-answered (UX-33). *Fails if* a Thing can be created without a Note.
- **UX-02 The Note is the home.** Every Thing has exactly one Note. Notes are the categorical
  container people navigate; Things are the lines people write.
- **UX-03 The day is a stamp, not a home.** Every Thing carries the day it belongs to. Days are a
  lens over Notes, never a second place a Thing can live.
- **UX-04 Honest state.** Never claim saved when the write is only local. *Precedent to keep:*
  "Saved on this device instantly. The pill above tells you when it reached the server."
- **UX-05 Thumb first.** The primary action and the composer live in the bottom third, inside thumb
  reach; no two-finger gestures; nothing requires precision aiming.
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
  "in two places" state. A Thing is created only inside a Note; when nobody has chosen yet, the
  Inbox answers (UX-10), and the Note used last in this workspace is offered first (UX-33).
- **UX-10 Inbox always exists, and is never shown.** Every workspace has an Inbox Note that cannot
  be deleted: it is the answer to "where did it go?" and the reason capture never has to
  interrupt. It is structure, not a surface — no tab, label, route or endpoint carries the word.
  Loose Things are written and read under **Backlog**, and the Inbox never appears in a day's list
  of Notes.
- **UX-11 Moving a Thing is a Move.** Move changes its Note, its day, or both — one gesture,
  undoable, never a duplicate. `UX-06` applies: no confirmation, an undo instead.
- **UX-12 Creating a Note is cheap.** One action, a title, nothing else required. A Note is a shelf,
  not a project to administer.
- **UX-13 Deleting a Note is the one dangerous action.** A Note holds other people's Things, so its
  deletion names the Note and counts what is inside. This is the confirm case of §5.4.
- **UX-30 Access follows the Note.** A Note is the unit of sharing: being added to a Note grants
  its Things and nothing else — not the owner's other Notes, days, or backlog. Membership of a
  workspace and access to a Note are different questions and must stay different.
- **UX-33 Capture begins with the home.** Every capture starts with one decision: an existing Note,
  or a new one. It is a single tap, pre-filled with the Note used last in this workspace, and the
  composer states the home it will write into. *Fails if* a Thing can be created without a Note, if
  the home is invisible at the moment of typing, or if choosing it costs more than one tap.

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

- **UX-34 A session never silently runs an old build.** The running bundle identifies itself, the
  server states what it serves, and when they differ the app says it is shipping the new build and
  reloads exactly once. The comparison runs on load, when the tab comes back into view, and on every
  realtime reconnect — because a deploy is what ends the socket, so the reconnect is the earliest
  honest notice. *Fails if* a tab can keep running yesterday's code without saying so, or if the
  recovery can loop.

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

### 5.5 Shortcuts and their controls (UX-19, UX-31, UX-32)

- **UX-19 Keyboard is an accelerator.** Every capability is reachable by touch; the keyboard makes it
  faster. Tab order matches visual order, and `Esc` closes any open menu and returns focus to its
  opener.
- **UX-31 No orphan shortcuts.** A shortcut ships only alongside a visible, touch-reachable control,
  in the same change. The touch column below may never be empty.
- **UX-32 No modifier-only capabilities.** Nothing may require a modifier key, hover, right-click, or
  a drag with no tap alternative — on a phone none of those exist.

| Shortcut | Does | Touch equivalent |
| --- | --- | --- |
| `Enter` in the composer | commit the Thing | **Add** button beside the input |
| `Enter` in a Thing | commit the line | tap outside the line |
| `Shift+Enter` | line break inside a Thing | **line-break control on the format bar — currently missing** |
| `Cmd/Ctrl+Enter` | Text ⇄ Task | `⋯` menu → Convert to Text / Task |
| `Cmd/Ctrl+B`, `I` | bold, italic | format bar buttons |
| `Esc` while editing | leave editing, keep the text | tap outside |
| `Esc` on a menu | close it, return focus | tap outside |
| `Tab`, arrow keys | move focus, walk a menu | sequential tap |

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

- **UX-23 One view: a day.** A single surface, and it is a date: the Notes belonging to that day,
  each one edited where it sits. A Note is not a destination — its title and its Things are typed
  straight into the page. Days are a `?d=` parameter, and search, the backlog and the scratchpad
  open as sheets over the same page. Settings is the only other destination; no feed, no Notes
  index, no Note page, no search page.
- **UX-24 URL is state.** The day lives in the URL as `?d=`, written in place with `replaceState`
  rather than a navigation, so a reload, a bookmark or a shared link lands on the same day without
  the view being torn down. Opening the app lands on today. Sheet state stays local: a sheet is not
  a place.
- **UX-25 Admin is a separate tree.** `/admin` is an operator surface: its own layout, its own
  navigation, never mixed into product chrome.
- **UX-26 Lenses never nest.** Today can be grouped by Note, but a lens never contains another lens.

---

- **UX-35 The Note is the page.** There is no composer outside a Note and no Note behind a tap: the
  day is a stack of Notes and the cursor lives in one of them. A line is a Thing; return starts the
  next one; an empty line takes backspace and is gone. This is the Apple Notes surface with the
  structure of Twos underneath — the model does the work, not the chrome. A Note is made by one
  control in the header, never by a form waiting at the bottom of the page.
- **UX-36 The month is a sheet.** A calendar control sits with the date it changes and opens a
  month over the page: the month's shape, a dot per day that has writing, and one tap to land on it.
  Jumping months is an arrow, never a URL, and picking a day does not reload the view.

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
- **UI-11 Breakpoints enhance, never enable.** `sm:`/`md:`/`lg:` may add density or a sidebar; they
  may never be the only place a destination or a required control appears, and no control may be
  revealable only by hover. Check 360×740, 390×844, 768×1024 and 1440×900 — in that order.

### Visual identity: bespoke, not generated (VI-01…VI-12)

The failure mode here is not ugliness — it's looking like every other generated app. Restraint alone
does not produce identity: a system UI font, a slate scale and an indigo accent *are* the default
SaaS look, and it is where this code sits today (`--accent: #4c56d8`). Identity has to be chosen,
named, and then defended on every screen.

- **VI-01 The tell list.** None of these ship, however good they look alone: gradient or aurora
  backgrounds; gradient text; glow on dark surfaces; glassmorphism cards (blur is allowed only for a
  sticky bar over scrolling content); bento grids and floating cards with large soft shadows; a
  rounded-square icon from a general-purpose set beside every label; emoji in chrome or copy;
  sparkles or “AI”/“magic”/“smart” affordances; streaming-dot loaders; badge soup (pill counts, New,
  Beta, Pro); radii above 16px; pure black text or pure white cards in dark mode; skeleton shimmer as
  the default loading state; a marketing hero inside the app; the greeting-plus-emoji header;
  “Let's get started”; and `01 / 02 / 03` markers unless order genuinely carries meaning.
- **VI-02 One accent, three uses per screen.** Accent marks the primary action, the current position
  (today, active nav, selection) — and nothing else. No second hue may exist except the semantic
  `success`/`warning`/`danger` tokens, and those appear on state, never on identity.
- **VI-03 Type is the interface.** This is a text product, so words are the visual. Body stays at
  16px native faces: they feel like the phone, survive any accessibility text size, and cost nothing
  to load. Identity comes from treatment instead of novelty — the **day stamp is mono, uppercase and
  tracked**, titles are tight-tracked semibold, labels are sentence case. Do not pair a display face
  into the app: a stranger's letterforms date faster than a layout does.
- **VI-04 Signature: the stream and the stamp.** The one memorable thing is chronological rhythm —
  the day header in mono, spacing rather than hairlines between days, the composer pinned below,
  presence marks in the margin. One signature per screen; a screen without one should be almost
  invisible instead.
- **VI-05 Earn every element.** Structure encodes something true or it goes: no eyebrow above a
  heading that already says it, no divider between things space already separates, no icon repeating
  a visible word.
- **VI-06 Copy is design material.** Sentence case, plain verbs, active voice; no exclamation marks,
  no emoji, no self-praise (“beautiful”, “seamless”, “powerful”), no “Powered by”. Errors say what
  happened and what to do; empty states invite the next action; words name what the person controls,
  never how it is built.
- **VI-07 No slop by dependency.** A font, icon set, animation library or component kit is a design
  decision: it needs a rule in this document and a UX rule it serves, in the same change. Reaching
  for a Stock component kit “because it's fast” is precisely how a bespoke app becomes a template.
- **VI-08 Motion is orientation.** `UX-22` already caps it: nothing bounces, floats, pulses, or
  reveals on scroll inside the app.
- **VI-09 Density is the feature.** A notes app earns trust by showing many lines calmly: steady
  line-height, no card around every line, no chrome around text someone is reading.
- **VI-10 The cover test.** Review at 390×844 with the brand hidden. If the screenshot could belong
  to any notes app — or to any generated demo — the screen is unfinished, not done.
- **VI-11 Native where native is better.** Follow platform conventions (keyboard behaviour, safe
  areas, tap targets) instead of reinventing them; a custom control must beat the native one on
  `UX-05` or `UX-32` grounds to be worth building.
- **VI-12 Remove one accessory.** Before shipping, delete the least useful visual element on the
  screen. If nothing can go, the screen wasn't designed — it accumulated.

---

## 9. Components

- **UI-08 Rule of three.** No abstraction before the third use; no second copy of an existing one.
- **UI-09 One component per behaviour.** A second popover, a second sync indicator, or a second
  composer is a bug, not a variation. The Thing reader exists twice (`src/lib/blocks.ts` and
  `server/blocks.mjs`) — a model change has to be made in both.
- **UI-10 Overlays.** Every menu, popover and dialog closes on `Esc` and outside click, moves focus
  into itself, and returns focus to its opener.
- **UI-13 No browser primitives.** Anything a person sees is ours: no `window.confirm`, `alert` or
  `prompt`, no `<select>`, no native validation bubbles, no `title` tooltips carrying information.
  Confirmation, menus, pickers, dates, validation and status all come from `src/components`. Native
  controls are acceptable only where the platform is genuinely better at it — a text field, the
  on-screen keyboard, native scrolling, the safe area (`VI-11`) — never for chrome.

**Present:** `ds-input`, `ds-textarea`, `ds-button`, `InlineMarkdown`, `FormatBar`, `StatusPill`,
`CalendarPanel`, `NavLinks`, `DailyCanvas` (day / backlog / note), `NoteComposer`, `NoteSharePanel`,
`Scratchpad`.

**Present:** `Toast` · `ConfirmDialog` · `NotePicker` · `Menu` (the Thing menu, needs arrow keys).

**Missing, in priority order:** `Field` (label + hint + error, so validation never becomes a browser
bubble) · `EmptyState` · `Skeleton` · `Sheet` (note and confirm sheets share their shell).

---

## 10. Definition of done for any UI change

Designed and checked at 390×844 first, then widened · four states defined · thumb-only touch path ·
keyboard path · every shortcut has its on-screen twin · both themes · contrast and focus checked ·
copy follows §4 · no new raw colour or off-scale size · passes the cover test (`VI-10`) · the rule
served is cited in the change · this document updated if a rule changed.

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
10. `Shift+Enter` is the only way to put a second line inside a Thing, and no phone keyboard offers
    `Shift` mid-typing — multiline Things are desktop-only (`UX-31`, `UX-32`).
11. The shell is written desktop-first: a fixed `lg` sidebar plus a `lg:hidden` header makes the
    phone the exception path instead of the base case (`UI-11`, and the unreachable Notes in item 2).
12. The identity is the fourth default rather than a chosen one: system UI font, slate ramp, indigo
    accent. The only element that could not belong to another product is the three-bar `Brand`
    glyph (`VI-01`, `VI-02`, `VI-04`).

---

## 13. Changing the system

Propose it in writing, add the rule here, then apply it in one change. Deprecations get a date.
Decision log entries look like:

> **2026-11-01 · UX-02/UX-03 ·** Notes became the home and the day became a stamp, because
> organisation needs a categorical container while chronology still needs to be addressable.

> **2026-11-01 · doctrine, UX-31/UX-32/UI-11 ·** Mobile became the design target rather than the
> shrunk case, because ~95% of use is one thumb on a phone. Shortcuts and hover are now explicitly
> accelerators: no capability may exist only behind a key a phone does not have.

> **2026-11-01 · VI-01…VI-12 ·** Added an identity layer with a tell list and a cover test, because
> “clean and restrained” had quietly produced the default SaaS palette. Identity now comes from the
> stream, the mono day stamp and a single accent — not from novelty typefaces or an icon set.

> **2026-11-01 · UX-01, UX-09, UX-33 ·** Reversed the earlier "capture before structure" stance: a
> Thing cannot exist without a Note, so the home is the first thing capture decides, pre-answered by
> the last Note used. Silence was the wrong default — it made Inbox look like the product's idea
> rather than the person's choice.

> **2026-11-01 · UX-23 ·** Collapsed the product to one date-dependent view. A day lists its Notes; a
> Note is entered to add Things. The daily feed, the backlog and the Notes index each answered a
> question the day could answer, so they were removed rather than reorganised.

## 14. Order of work

Dependency first, then risk, then visibility. Two things gate everything else: people must be able to
*reach* the app on a phone (`UI-11`), and destructive actions must be *safe* (`UX-18`) before any
change adds a new way to be destructive. Identity work is late but not last — retrofitting it onto
screens the containment change rewrites would be rework.

**Standing rule: whatever you touch, you finish.** Any screen opened for another reason gets its
`VI` pass and its 390×844 check in the same change, so identity arrives with the work instead of
waiting for its own project.

| # | Work | Why in this position | Effort | Risk |
| --- | --- | --- | --- | --- |
| 1 | Mobile navigation | Notes and Settings unreachable on ~95% of usage | ~30 min | none |
| 2 | Vocabulary copy + README truth | cheap; stops "note" meaning two things | ~30 min | none |
| 3 | Undo + Toast | every later move depends on it | ~1 day | low |
| 4 | `moveBlock` failure surfacing | silent not-moving is the worst failure shape | ~1 h | low |
| 5 | Note delete confirms with a count | one tap, irreversible, possibly shared | ~1 h | low |
| 6 | `note_id` + Inbox + note-room projection | fixes search blindness; invisible to people | ~1 day | medium: live DB |
| 7 | Capture defaults + Inbox visible | makes Notes the home in the UI | ~1 day | low |
| 8 | Retire the day/backlog lanes | one home, finally | ~2 days | high |
| 9 | Token + type-scale sweep | mechanical; settles before identity | ~1 day | low |
| 10 | Stream identity pass (`VI-04`, `VI-10`) | the screen that defines the product | ~1 day | low |
| 11 | Menu + format bar: 44px, focus, line break | last keyboard-only gap (`UX-31`) | ~½ day | low |
| 12 | Quick capture from anywhere | biggest lever for a capture app | ~1–2 days | medium |
| 13 | Reminders, or delete the type | a checkbox that promises nothing | ~2 days | medium |
| 14 | Wikilinks / backlinks | depth that only means something after #8 | ~2 days | medium |

Not on the list, and not to be smuggled in: nested Notes, tags, rich text, drag-to-reorder, themes, and
any new UI dependency without a `VI-07` rule.

Two cautions. Migrations run at boot (`AGENTS.md`), so `004` must be idempotent, create each
workspace's Inbox **before** backfilling into it, backfill in one transaction, and only then set
`note_id not null`. And #8 must not ship inside the same change as #6 or #7: if it goes wrong a Thing
is homeless, and the undo stack from #3 is the only way back.
