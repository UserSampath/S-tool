# FE

React + Vite front end for **S tools** — a single place for the small tools used
every day.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
npm run lint
```

The API is expected on `http://localhost:3000` (see `src/lib/session.js`), so
start the `BE` server alongside it.

## Screens

| Screen    | File                   | What it does                                     |
| --------- | ---------------------- | ------------------------------------------------ |
| Auth      | `src/pages/AuthPage`   | 4-digit PIN login, email fallback, registration   |
| Home      | `src/pages/HomePage`   | Nav bar plus the grid of tool cards               |

`src/App.jsx` picks between them: on load it verifies any stored token against
`GET /api/auth/me`, so a token left over from a restarted server drops back to
the login screen instead of showing an empty workspace.

## Layout

```
src/
  App.jsx              session bootstrap + which page to render
  lib/session.js       API base and localStorage token/user helpers
  data/tools.js        the home grid: name, description, icon, accent, ready
  pages/               AuthPage, HomePage (+ HomePage.css)
  components/          Logo, NavBar, PinInput, icons
```

## Adding a tool

1. Add an entry to `src/data/tools.js` with an icon from `src/components/icons`.
2. Build the tool's screen and render it from `HomePage` when its card opens.
3. Flip `ready: true` so the card stops saying "Coming soon".

## PIN entry

`PinInput` renders four single-character boxes that behave as one field: typing
advances, backspace walks back, a pasted code fills the row, and completing the
fourth digit submits the login automatically. `PIN_LENGTH` there is the single
source of truth on the client; the server enforces the same rule in
`BE/src/utils/validate.js`.
