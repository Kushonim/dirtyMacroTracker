# Macro Loadout Backend

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your real `DATABASE_URL` and a random `JWT_SECRET`
3. Create the database, then run the schema:
   `psql $DATABASE_URL -f schema.sql`
4. Seed the test account (username: `user`, password: `ADMIN` — dev/test only, don't ship this to production):
   `npm run seed`
5. Start the server: `npm run dev`

## Endpoints
- `POST /api/auth/register` — { username, password } -> { token, user }
- `POST /api/auth/login` — { username, password } -> { token, user }
- `GET /api/auth/profile` — requires `Authorization: Bearer <token>` header
- `PUT /api/auth/profile` — requires auth header, body: { sex, age, height_cm, weight_kg, activity_level, goal_type }

## Notes
- Heights/weights are stored in cm/kg regardless of what unit the frontend displays — do the in/cm and lb/kg conversion client-side before sending to the API.
- Menu items (restaurants/menu_items tables) aren't wired to routes yet — next step is a GET /api/menu-items?restaurant=mcdonalds&period=standard endpoint once you've populated real data.
