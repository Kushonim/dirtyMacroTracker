-- Macro Loadout database schema.
--
-- Currently `restaurants` and `menu_items` are defined here but not yet
-- read from at runtime — the live app still serves a hardcoded mock menu
-- from the frontend. These tables are the intended next step: move that
-- data into Postgres and add a GET /api/menu-items endpoint, without
-- needing any schema changes at that point.

CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES restaurants(id),
  name VARCHAR(150) NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'standard',  -- 'standard' | 'breakfast'
  category VARCHAR(50),
  calories INTEGER NOT NULL,
  protein_g NUMERIC(5,1) NOT NULL,
  carbs_g NUMERIC(5,1) NOT NULL,
  fat_g NUMERIC(5,1) NOT NULL,
  sodium_mg INTEGER,
  source_updated DATE  -- when the nutrition figures were last verified against the chain's published data
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash, never plaintext
  sex VARCHAR(10),                -- 'male' | 'female' — required by the Mifflin-St Jeor BMR formula
  age INTEGER,                    -- null until onboarding is completed
  height_cm NUMERIC(5,1),         -- always stored in cm regardless of the unit shown in the UI
  weight_kg NUMERIC(5,1),         -- always stored in kg regardless of the unit shown in the UI
  activity_level VARCHAR(20),     -- 'sedentary' | 'moderate' | 'active'
  goal_type VARCHAR(20),          -- 'bulk' | 'dirty_bulk' | 'cut' | 'maintain' | 'keto'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Not yet wired up to any route — planned for a future "save this loadout"
-- feature so users can revisit a combination of items instead of rebuilding
-- it from scratch each time.
CREATE TABLE saved_loadouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE loadout_items (
  id SERIAL PRIMARY KEY,
  loadout_id INTEGER REFERENCES saved_loadouts(id),
  menu_item_id INTEGER REFERENCES menu_items(id),
  quantity INTEGER DEFAULT 1
);

-- Backs the "Don't see what you're looking for?" feature — anyone,
-- including guests, can suggest a restaurant or menu item to add.
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  request_type VARCHAR(20) NOT NULL,   -- 'restaurant' | 'menu_item'
  restaurant_name VARCHAR(150),
  item_name VARCHAR(150),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
