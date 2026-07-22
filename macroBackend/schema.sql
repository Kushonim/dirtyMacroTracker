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
  source_updated DATE
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  sex VARCHAR(10),                -- 'male' | 'female'
  age INTEGER,
  height_cm NUMERIC(5,1),         -- always stored in cm; frontend converts for display
  weight_kg NUMERIC(5,1),         -- always stored in kg
  activity_level VARCHAR(20),     -- 'sedentary' | 'moderate' | 'active'
  goal_type VARCHAR(20),          -- 'bulk' | 'dirty_bulk' | 'cut' | 'maintain' | 'keto'
  created_at TIMESTAMP DEFAULT NOW()
);

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
