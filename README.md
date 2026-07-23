# Dirty Macro Tracker

A full-stack app that helps you hit your daily fitness macros using favorite fast food places — pick a goal (bulk, dirty bulk, cut, maintain, or keto), and build a "loadout" from real restaurant menu items that fits your daily targets.

**Live site:** https://dirty-macro-tracker.vercel.app/ 
**Live API:** https://dirtymacrotracker.onrender.com (note: free-tier hosting spins down when idle, so the first request after inactivity can take ~30-50 seconds to respond)

## Why I built this

I wanted a portfolio project that combined things I actually care about — fitness, nutrition & food, and organizational tools — instead of another generic to-do app. The core idea: fast food doesn't have to be off-limits when you're tracking macros, you just need to know what to order.

## Features

- **Personalized macro targets** — calculates calorie and macro goals from your sex, age, height, weight, and activity level using the Mifflin-St Jeor equation, then adjusts for your selected goal
- **Guest mode** — skip account creation and use generalized default numbers immediately
- **Standard vs. Breakfast mode** — toggles the whole UI theme and filters the menu to what each chain actually serves at that time of day
- **Account system** — signup/login with hashed passwords and JWT-based sessions, so your profile and goal persist across visits
- **A signature "growing plant" macro meter** instead of a standard progress bar — your daily macros visually grow like a plant as you build your loadout

## Tech stack

- **Frontend:** React (Vite), Tailwind CSS — deployed on Vercel
- **Backend:** Node.js, Express — deployed on Render
- **Database:** PostgreSQL (hosted on Neon)
- **Auth:** bcryptjs password hashing, JWT sessions (switched from native `bcrypt` to the pure-JS `bcryptjs` to avoid platform-specific binary issues between local Windows development and Linux-based deployment)

## Project structure

```
MacroLoadout/
├── macroBackend/     — Express API, auth routes, database schema
└── macroFrontend/    — React app (Vite + Tailwind)
```

## Running locally

See the README inside `macroBackend/` for API setup, and `macroFrontend/` uses a standard `npm install && npm run dev`.

## Roadmap

- Real nutrition data sourced from each chain's official published values (replacing the current mock dataset)
- Additional restaurant chains (Wendy's, Chick-fil-A, Subway are shown as "coming soon" in the UI)
- Saved loadouts / meal history
