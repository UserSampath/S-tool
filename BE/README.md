# BE

Node + Express API server.

## Setup

```bash
npm install
```

## Run

```bash
npm start      # node src/server.js
npm run dev    # auto-restart on file changes
```

Server listens on `http://localhost:3000` (override with the `PORT` env var).

Copy `.env.example` to `.env` and fill in `MONGODB_URI` plus the secrets. The
server connects to MongoDB before it starts listening, so a bad URI or an
unreachable cluster fails at boot rather than on the first request.

`JWT_SECRET` and `PIN_INDEX_SECRET` fall back to a random per-boot value in dev
and are fatal if missing in production. Now that users persist, treat
`PIN_INDEX_SECRET` as permanent: it keys the PIN blind index, so changing it
orphans every stored `pinLookup` and locks every account out of PIN login.

## Database

MongoDB via mongoose. `src/db/connect.js` owns the connection, `src/models/User.js`
the schema, and `src/store/users.js` is the only module that queries it - every
one of its lookups is async, so callers must `await`.

Uniqueness for email, username (case-insensitively, via `usernameLower`) and
`pinLookup` is enforced by unique indexes, built on connect. The service still
checks first so each collision gets its own message; the index is what makes it
correct under concurrent registrations.

## Routes

| Method | Path                 | Auth   | Description                       |
| ------ | -------------------- | ------ | --------------------------------- |
| GET    | `/health`            | –      | Health check                      |
| POST   | `/api/auth/register` | –      | Create an account                 |
| POST   | `/api/auth/login`    | –      | Log in by PIN, or email+password  |
| GET    | `/api/auth/me`       | Bearer | Current user                      |
| GET    | `/api/plans`         | Bearer | Plans for `?horizon=short\|long`  |
| POST   | `/api/plans`         | Bearer | Create a plan                     |
| PATCH  | `/api/plans/reorder` | Bearer | Save a new manual order           |
| PATCH  | `/api/plans/:id`     | Bearer | Update title, done or priority    |
| DELETE | `/api/plans/done`    | Bearer | Clear completed plans             |
| DELETE | `/api/plans/:id`     | Bearer | Delete one plan                   |
| POST   | `/api/grammar`       | Bearer | Correct text with Gemini          |
| GET    | `/api/grammar/formats`  | Bearer | Output formats the server supports |
| GET    | `/api/grammar/presets`  | Bearer | The user's instruction chips    |
| POST   | `/api/grammar/presets`  | Bearer | Save a new instruction chip     |
| DELETE | `/api/grammar/presets/:id` | Bearer | Remove an instruction chip   |
| GET    | `/api/grammar/history`  | Bearer | Past corrections, newest first  |
| DELETE | `/api/grammar/history`  | Bearer | Clear all history               |
| DELETE | `/api/grammar/history/:id` | Bearer | Delete one history entry     |
| GET    | `/api/notes`         | Bearer | The whole folder/note tree, flat  |
| POST   | `/api/notes`         | Bearer | Create a folder or a note         |
| PATCH  | `/api/notes/:id/move`| Bearer | Move and reposition in the tree   |
| PATCH  | `/api/notes/:id`     | Bearer | Rename, edit content, collapse    |
| DELETE | `/api/notes/:id`     | Bearer | Delete (a folder takes its contents) |
| GET    | `/api/day-tasks`     | Bearer | Tasks for `?date=YYYY-MM-DD`      |
| GET    | `/api/day-tasks/backlog` | Bearer | Tasks with no day yet         |
| GET    | `/api/day-tasks/summary` | Bearer | Per-day counts for `?from=&to=` |
| POST   | `/api/day-tasks`     | Bearer | Add to a day, or to the backlog   |
| PATCH  | `/api/day-tasks/:id` | Bearer | Retitle or set status             |
| PATCH  | `/api/day-tasks/:id/move` | Bearer | Move to a day, the backlog, or a new position |
| DELETE | `/api/day-tasks/:id` | Bearer | Delete a task                     |
| GET    | `/api/swatches`      | Bearer | Saved colours, newest first       |
| POST   | `/api/swatches`      | Bearer | Save a colour, body `{ hex }`     |
| PATCH  | `/api/swatches/:id`  | Bearer | Name a saved colour               |
| DELETE | `/api/swatches/:id`  | Bearer | Remove a saved colour             |
| GET    | `/api/quick-notes`   | Bearer | Quick notes, newest first         |
| POST   | `/api/quick-notes`   | Bearer | Add a quick note, body `{ text }` |
| PATCH  | `/api/quick-notes/:id` | Bearer | Edit a quick note               |
| DELETE | `/api/quick-notes/:id` | Bearer | Delete a quick note             |
| GET    | `/api/projects`      | Bearer | List projects, pinned first       |
| POST   | `/api/projects`      | Bearer | Create a project, body `{ name }` |
| PATCH  | `/api/projects/:id`  | Bearer | Rename or pin/unpin               |
| DELETE | `/api/projects/:id`  | Bearer | Delete one project                |
| GET    | `/api/example`       | –      | List example items                |
| GET    | `/api/example/:id`   | –      | Get one item (404 if missing)     |
| POST   | `/api/example`       | –      | Create an item, body `{ "name" }` |

### Grammar helper

```json
POST /api/grammar
{
  "text": "he go to school yesterday",
  "instructions": ["Make it sound formal and professional.", "Use British English spelling."],
  "format": "markdown"
}
```

Responds with `{ data: { text, model, format, usage, id, createdAt } }`.
`instructions` is a list - any number of chips can be on at once - and a bare
string is still accepted for a single one-off instruction.

**Instruction chips** live in `models/GrammarPreset.js`. A new account is seeded
with the defaults from `config/prompts.js` the first time it reads them, and
owns them after that. Seeding happens on read rather than at registration so
accounts made before the feature existed get them too; a user who deletes every
chip does not have them silently reappear.

**History** (`models/GrammarRun.js`) keeps the input, the output, the
instructions that were in effect and the format, newest first, capped at the
last 100 runs per user. It is written *after* a successful call, and a failed
history write is logged rather than thrown - losing the correction because the
record of it could not be saved would be the wrong trade.

**Formats** are declared in `config/prompts.js` and served by
`GET /api/grammar/formats`, so the dropdown never offers something the server
would reject. Add an entry to `GRAMMAR_FORMATS` and it appears in the UI. Models
tend to wrap markdown and html answers in a code fence even when told not to, so
`services/gemini.js` strips one if it finds it.

**The Gemini API key lives only on the server.** A key shipped to the browser is
readable by anyone who opens the site, and they would be spending your quota, so
the frontend calls this route and this route calls Google. `GEMINI_API_KEY` is
never sent to the client and never appears in the built bundle.

The wording sent to Gemini is in **`src/config/prompts.js`**, on its own so it
can be read and reworded without touching request code. Edit it and restart.

Two things the request deliberately keeps apart: the standing instruction and
anything typed into "Additional instructions" both go in the *system* turn,
where they steer the model, while the text being corrected goes in the *user*
turn. That is what stops a pasted paragraph that happens to read like an order
("ignore all previous instructions...") from being followed as one - it comes
back corrected, not obeyed.

Guards: signed-in only, 40 requests per IP per 15 minutes, 12,000 characters of
text, 500 characters of instructions, and a 45 second timeout. Every call spends
real quota, so this is the one route where a loop in the client costs money.

### Day tasks

The Today plan tool: one task list per calendar day, each task `todo`, `doing`
or `done`.

```json
POST /api/day-tasks
{ "date": "2026-08-26", "title": "Ship the day planner" }
```

**A day is stored as a `YYYY-MM-DD` string, not a `Date`.** A Date is an
absolute instant, so a task added at 11pm would be filed under the next or
previous day depending on the timezone the server happened to be in. The client
derives the key from the user's *local* calendar (`FE/src/lib/dates.js`), never
from `toISOString()`, which converts to UTC first.

Dates are checked for being real days, not just the right shape - `2026-02-31`
and `2027-02-29` are both rejected, while `2028-02-29` is accepted.

`GET /summary?from=&to=` returns `{ date, total, done, doing, todo }` per day,
aggregated in the database. The calendar only needs four numbers per day, so
fetching a month of tasks to count them client-side would be wasteful.

#### The product backlog

A task whose `date` is `null` is in the **product backlog**: work that is real
but not promised to a day. It is the same collection and the same document -
the backlog is a date the user has not chosen yet, which is what `null` already
means, so it needs no second collection and no `isBacklog` flag.

Two rules fall out of that and are enforced on the server:

- **Only a `todo` task can go back to the backlog.** Once something is `doing`
  or `done` it is a record of a day that happened, and un-dating it would erase
  that - the calendar would quietly lose a day it had already counted.
- **A backlog task has no status.** It cannot have started, because there is no
  day it could have started on. `PATCH` with a `status` returns 400, not 404, so
  the reason is legible.

Backlog tasks never reach `/summary`: `null` sorts below every string in BSON,
so the date range match excludes them without having to say so.

`POST` requires `date` to be present - `null` for the backlog, a day otherwise.
An *absent* date is rejected rather than filed in the backlog, because that is a
client that forgot one, and guessing would turn a bug into a quietly growing
pile of undated tasks.

#### Moving

```json
PATCH /api/day-tasks/:id/move
{ "date": "2026-08-27", "index": 2 }
```

One route covers all three gestures: onto a day, back to the backlog
(`date: null`), and to a new position in the list it is already in.

`index` is the position among the destination's tasks **with the moved one
taken out**, which is what a drag actually describes. That definition is what
lets the client predict the result: a row dropped on itself resolves to -1,
which the client reads as the no-op it is. It is clamped to the list, so a drop
past the end lands last rather than erroring.

The move rewrites the whole destination list as `0..n-1` in one `bulkWrite`.
The source list keeps its gaps - order values are only ever compared, never
counted - and they close themselves the next time something lands there.

### Swatches

The saved half of the colour palette tool. Picking and adjusting happens
entirely in the browser (`FE/src/lib/color.js`); only colours you deliberately
keep reach the server.

```json
POST /api/swatches
{ "hex": "#6d28d9", "name": "Brand violet" }
```

Hex is normalised to one lowercase six-digit form on the way in, so `#F80`,
`#ff8800` and `#FF8800` are recognised as the same colour and a palette cannot
hold it three times. A unique index enforces that, with an explicit check in
front of it for the window where a new collection's index is still building.

### Quick notes

One piece of text, nothing else - no title, no folder, no formatting.

```json
POST /api/quick-notes
{ "text": "Ring the dentist on Monday" }
```

Deliberately separate from the Notepad tool rather than a corner of it. The
Notepad is for things you file: folders, rich text, structure worth keeping.
This is for things you catch before they get away, and the moment it grows a
title and a parent folder it stops being quick.

### Notes

Folders and notes live in one collection (`models/Node.js`) as an adjacency
list: each node has a `parent` (null at the root) and an `order` among its
siblings. Both kinds are the same thing to the tree - both have a parent, both
sit in an order, both can be dragged - so splitting them would have meant two
queries and two id spaces for every move.

```json
PATCH /api/notes/<id>/move
{ "parent": "<folder id or null>", "index": 2 }
```

Two rules the server enforces rather than trusting the client with:

- **A folder cannot be moved into itself or any of its descendants.** That
  would cut the branch off from the root and lose it. `subtreeIds` walks the
  subtree and the move is refused if the destination is in it.
- **Deleting a folder deletes everything inside it**, in one `deleteMany`.
  Anything else would leave nodes pointing at a parent that no longer exists.

`index` is the position in the sibling list **with the moved node taken out**,
which is the list the server splices into. The client computes it the same way;
counting the dragged node would put a row one place too far down whenever it
moves forward within its own folder.

Note content is HTML from a contentEditable editor, so it is passed through
`utils/richText.js` on every write. The allowlist is enforced by `sanitize-html`
rather than by hand - script tags, event handler attributes, `javascript:` urls
and `url()` inside styles do not survive it.

### Projects

A project is just a name plus a pinned flag. Like plans, every route is scoped
to the signed-in user.

```json
POST /api/projects
{ "name": "Website redesign" }
```

The list is ordered **pinned first, then newest first**, and that order is
applied by the server rather than by each client, so everything agrees on it.
There is no manual ordering - pinning is the only lever, which keeps the tool
as simple as the data behind it.

### Plans

Both plan tools share one collection, split by `horizon` (`short` or `long`).
Every route is scoped to the signed-in user, so another account's plans cannot
be read, edited, deleted or reordered - `reorder` in particular drops any id it
does not own rather than trusting the list it was sent.

```json
POST /api/plans
{ "horizon": "short", "title": "Ship the plans tool", "priority": 8 }
```

`priority` is a whole number 0-10 and defaults to 5. `order` is the manual
position and is assigned by the server; new plans land at the bottom.

```json
PATCH /api/plans/reorder
{ "horizon": "short", "ids": ["<id>", "<id>", "<id>"] }
```

Order and priority are deliberately independent. Dragging a plan sets `order`
and leaves `priority` alone; changing `priority` never moves the row. Sorting
by priority is an explicit action that rewrites `order` once, so the list never
rearranges itself under the user.

### Register

```json
POST /api/auth/register
{ "username": "nalaka", "email": "nalaka@example.com", "password": "supersecret1", "pin": "4829" }
```

Rules: username 3-30 chars (letters, numbers, underscore), valid email,
password at least 8 chars, PIN exactly 4 digits. Email, username and PIN must
each be unique. Responds `201` with the new user and a JWT.

### Login

Two shapes, same endpoint:

```json
POST /api/auth/login
{ "email": "nalaka@example.com", "password": "supersecret1" }
```

```json
POST /api/auth/login
{ "pin": "4829" }
```

Both respond `200` with a JWT. Send it as `Authorization: Bearer <token>` on
protected routes.

## Security notes

- Passwords and PINs are hashed with bcrypt; neither is ever returned.
- PIN login is limited to 5 attempts per IP per 15 minutes, email+password to 20.
- Login errors are deliberately vague, and a missing account still costs a
  bcrypt compare, so accounts cannot be enumerated by message or by timing.
- **PIN-only login is inherently weak**: with no username, the 4-digit PIN is
  the entire credential and the search space is only 10^4 across all users –
  which also caps how many accounts can ever exist, since PINs must be unique.
  It is fine for a low-value convenience login (like a kiosk or a second factor
  on a trusted device); do not use it alone to guard anything sensitive.
- Users are stored in MongoDB. The schema's `toJSON` transform strips
  `passwordHash`, `pinHash` and `pinLookup`, so the hashes cannot leak even if a
  raw document is handed to `res.json`.
- The rate limiter is still per-process and in-memory (`src/middleware/rateLimit.js`).
  With more than one instance behind a load balancer, the effective PIN limit
  multiplies by the instance count - move it to Redis before scaling out.

## Quick test

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" ^
  -d "{\"username\":\"nalaka\",\"email\":\"nalaka@example.com\",\"password\":\"supersecret1\",\"pin\":\"4829\"}"

curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"pin\":\"4829\"}"

curl http://localhost:3000/api/auth/me -H "Authorization: Bearer <token>"
```
