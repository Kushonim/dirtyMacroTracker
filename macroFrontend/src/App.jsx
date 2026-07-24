/**
 * Macro Loadout — main application file.
 *
 * Architecture: this is a single-file, three-screen app driven by one
 * top-level state machine (see the default-exported `App` component at the
 * bottom). `screen` decides which of AuthScreen / Onboarding / MacroApp
 * renders; each screen is otherwise a self-contained component with its
 * own local state.
 *
 * A known tradeoff worth calling out: each screen renders its own
 * <style> block with the same hover/cursor/font CSS repeated three times,
 * rather than one shared global stylesheet. That's a deliberate shortcut
 * for a single-file, fast-iterating personal project — the natural next
 * refactor would be hoisting that CSS into index.css once, or splitting
 * this file into separate component files.
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  Flame, Leaf, Plus, Minus, Trash2, Sparkles, Sunrise, ArrowRight,
  Pencil, LogOut, Moon, Sun, MessageSquarePlus, X, Bug, Flower2, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Save,
} from "lucide-react";
import {
  login, register, getProfile, updateProfile, submitRequest, submitBugReport,
  getLoadoutDates, getLoadoutForDate, saveLoadoutForDate, deleteLoadoutForDate,
} from "./api";

/**
 * Builds a "YYYY-MM-DD" key from the user's *local* time, not UTC.
 * Date.toISOString() would convert to UTC first, which can silently shift
 * a late-night loadout onto the wrong calendar day depending on the user's
 * timezone — this avoids that by reading the local year/month/day directly.
 */
function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Click sound ----------
// Four real wood-block recordings, one picked at random per click for
// natural variation instead of the same exact sound every time.
const WOOD_SOUND_FILES = ["/sounds/wood1.ogg", "/sounds/wood2.ogg", "/sounds/wood3.ogg", "/sounds/wood4.ogg"];
const woodAudioPool = WOOD_SOUND_FILES.map((src) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = 0.5;
  return audio;
});

/**
 * Plays one random wood-block click sound. Called from a single delegated
 * click listener in the top-level App component (see bottom of file) rather
 * than wired into every individual button — new buttons get the sound for
 * free with no extra code.
 */
function playClickSound() {
  try {
    const base = woodAudioPool[Math.floor(Math.random() * woodAudioPool.length)];
    // Clone so rapid clicks can overlap instead of cutting each other off.
    const instance = base.cloneNode();
    instance.volume = base.volume;
    instance.play().catch(() => {
      // Browsers block audio before the first user gesture on the page —
      // harmless, the very first click of a session may be silent.
    });
  } catch (e) {
    // Audio playback unsupported — fail silently, sound is a nice-to-have.
  }
}

// ---------- Theme presets ----------
// Two independent axes: `mode` (standard vs. breakfast, which changes both
// color palette AND which menu items are visible) and `isDark` (a straight
// light/dark swap layered on top of whichever mode is active). Every
// screen resolves its palette through resolveTheme() below rather than
// touching THEMES directly, so dark mode "just works" everywhere at once.
const THEMES = {
  standard: {
    light: {
      label: "Standard", icon: Leaf, bg: "#F2ECDD", bgGradient: "#F2ECDD", surface: "#FAF6EC",
      border: "#E7DCC4", ink: "#3A3229", muted: "#8A7F6E", primary: "#6B7F5E", accent: "#D9A441",
    },
    dark: {
      label: "Standard", icon: Leaf, bg: "#211F1A", bgGradient: "#211F1A", surface: "#2A2822",
      border: "#3D392F", ink: "#EDE6D6", muted: "#A69C89", primary: "#7FA06B", accent: "#E0B04E",
    },
  },
  breakfast: {
    light: {
      label: "Rise & Shine", icon: Sunrise, bg: "#FBEADD",
      bgGradient: "linear-gradient(180deg, #FDF1E4 0%, #F7D9B8 100%)", surface: "#FFF6EC",
      border: "#F0D9BE", ink: "#4A342A", muted: "#9C8171", primary: "#E8935A", accent: "#F2C14E",
    },
    dark: {
      label: "Rise & Shine", icon: Sunrise, bg: "#241A14",
      bgGradient: "linear-gradient(180deg, #241A14 0%, #2E2019 100%)", surface: "#2E2019",
      border: "#423024", ink: "#F5E4D3", muted: "#B99A85", primary: "#E8935A", accent: "#F2C14E",
    },
  },
};

function resolveTheme(modeKey, isDark) {
  return THEMES[modeKey][isDark ? "dark" : "light"];
}

/** Small reusable sun/moon toggle button, dropped into all three screens. */
function DarkModeToggle({ isDark, onToggle, theme, className }) {
  return (
    <button
      onClick={onToggle}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${className || ""}`}
      style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun size={16} color={theme.accent} /> : <Moon size={16} color={theme.muted} />}
    </button>
  );
}

// ---------- Goal + macro calculation config ----------
// calAdjust scales TDEE up/down per goal; ratios split the resulting
// calories into protein/carb/fat grams. Keto's ratio (high fat, ~5% carb)
// is what actually distinguishes it from "maintain" — same calorie target,
// completely different macro split.
const GOAL_CONFIG = {
  bulk: { label: "Bulk", desc: "Steady surplus", calAdjust: 1.15, ratios: { protein: 0.30, carb: 0.45, fat: 0.25 } },
  dirty_bulk: { label: "Dirty Bulk", desc: "Aggressive surplus", calAdjust: 1.30, ratios: { protein: 0.25, carb: 0.50, fat: 0.25 } },
  cut: { label: "Cut", desc: "Lean deficit", calAdjust: 0.80, ratios: { protein: 0.40, carb: 0.35, fat: 0.25 } },
  maintain: { label: "Maintain", desc: "Hold steady", calAdjust: 1.0, ratios: { protein: 0.30, carb: 0.40, fat: 0.30 } },
  keto: { label: "Keto", desc: "High fat, low carb", calAdjust: 1.0, ratios: { protein: 0.25, carb: 0.05, fat: 0.70 } },
};

// Short badge text shown on a menu item card when it matches the
// currently selected goal.
const GOAL_MATCH_LABELS = {
  keto: "Keto friendly",
  cut: "Great for cutting",
  bulk: "Good bulk pick",
  dirty_bulk: "High-calorie pick",
  maintain: "Balanced pick",
};

/**
 * Simple per-goal fit check used to highlight and surface relevant menu
 * items — not a nutrition-science-grade classifier, just a reasonable
 * heuristic per goal:
 *  - keto: low carb, since that's the entire point of the diet
 *  - cut: moderate calories with protein making up a decent share of them
 *  - bulk / dirty_bulk: higher-calorie items, since the goal is a surplus
 *  - maintain: calories and protein-share both sitting in a middle band
 */
function matchesGoal(item, goalKey) {
  const proteinShare = (item.p * 4) / item.cal;
  switch (goalKey) {
    case "keto":
      return item.c <= 20;
    case "cut":
      return item.cal <= 500 && proteinShare >= 0.30;
    case "bulk":
      return item.cal >= 500;
    case "dirty_bulk":
      return item.cal >= 650;
    case "maintain":
      return item.cal >= 300 && item.cal <= 550 && proteinShare >= 0.20 && proteinShare <= 0.40;
    default:
      return false;
  }
}

// Standard TDEE activity multipliers (sedentary / moderate / active).
const ACTIVITY_LEVELS = {
  sedentary: { label: "Sedentary", factor: 1.2 },
  moderate: { label: "Moderate", factor: 1.55 },
  active: { label: "Active", factor: 1.725 },
};

// Shown as a hover tooltip in onboarding so users can self-select an
// activity level from a concrete example instead of guessing what
// "moderate" means.
const ACTIVITY_EXAMPLES = {
  sedentary: "Desk job, mostly sitting, little to no structured exercise",
  moderate: "Workouts or sports 3-5 days a week, or an on-your-feet job",
  active: "Hard training 6-7 days a week, or physically demanding work",
};

/**
 * Core macro math: Mifflin-St Jeor BMR -> TDEE (via activity multiplier)
 * -> goal-adjusted calorie target -> macro grams (via the goal's ratio).
 * This is what turns "I'm a 25-year-old male, 170lb, moderately active,
 * trying to bulk" into an actual calorie + protein/carb/fat number,
 * rather than showing the same fixed target to everyone.
 */
function computeTargets(profile, goalKey) {
  const { sex, age, heightIn, weightLb, activity } = profile;
  const heightCm = heightIn * 2.54;
  const weightKg = weightLb * 0.453592;
  const bmr = sex === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const tdee = bmr * ACTIVITY_LEVELS[activity].factor;
  const goal = GOAL_CONFIG[goalKey];
  const calories = Math.round(tdee * goal.calAdjust);
  const protein = Math.round((calories * goal.ratios.protein) / 4);
  const carbs = Math.round((calories * goal.ratios.carb) / 4);
  const fat = Math.round((calories * goal.ratios.fat) / 9);
  return { calories, protein, carbs, fat };
}

// ---------- Mock restaurant menu data ----------
// Placeholder for what should eventually be a real `menu_items` table
// (see schema.sql) served through a GET /api/menu-items endpoint. Figures
// here were cross-checked against each chain's published nutrition info
// at the time of writing, not pulled from a live API.
const RESTAURANTS = {
  mcdonalds: {
    name: "McDonald's",
    items: [
      { id: "m1", name: "Big Mac", cal: 590, p: 25, c: 45, f: 34, period: "standard" },
      { id: "m2", name: "Quarter Pounder w/ Cheese", cal: 520, p: 30, c: 41, f: 26, period: "standard" },
      { id: "m3", name: "Double Cheeseburger", cal: 440, p: 25, c: 34, f: 23, period: "standard" },
      { id: "m4", name: "Hamburger", cal: 250, p: 12, c: 31, f: 9, period: "standard" },
      { id: "m5", name: "10 pc Chicken McNuggets", cal: 410, p: 23, c: 26, f: 24, period: "standard" },
      { id: "m6", name: "Medium Fries", cal: 340, p: 4, c: 44, f: 16, period: "standard" },
      { id: "m7", name: "Egg McMuffin", cal: 310, p: 17, c: 30, f: 13, period: "breakfast" },
      { id: "m8", name: "Sausage McMuffin w/ Egg", cal: 480, p: 21, c: 31, f: 31, period: "breakfast" },
      { id: "m9", name: "Hotcakes (3, no syrup/butter)", cal: 350, p: 8, c: 60, f: 8, period: "breakfast" },
      { id: "m10", name: "Hash Browns", cal: 150, p: 1, c: 15, f: 9, period: "breakfast" },
      { id: "m11", name: "Filet-O-Fish", cal: 390, p: 16, c: 38, f: 19, period: "standard" },
      { id: "m12", name: "McDouble", cal: 390, p: 22, c: 33, f: 19, period: "standard" },
      { id: "m13", name: "Oreo McFlurry (small)", cal: 510, p: 12, c: 80, f: 16, period: "standard" },
      { id: "m14", name: "Fruit & Yogurt Parfait", cal: 150, p: 4, c: 28, f: 2, period: "breakfast" },
      { id: "m15", name: "Quarter Pounder w/ Cheese, no bun (protein style)", cal: 340, p: 28, c: 6, f: 22, period: "standard" },
    ],
  },
  chipotle: {
    name: "Chipotle",
    items: [
      { id: "c1", name: "Chicken Bowl (rice, black beans, salsa, cheese)", cal: 680, p: 52, c: 70, f: 15, period: "standard" },
      { id: "c2", name: "Chicken Burrito (standard toppings)", cal: 1065, p: 61, c: 123, f: 34, period: "standard" },
      { id: "c3", name: "Steak Bowl w/ rice & beans", cal: 700, p: 40, c: 66, f: 22, period: "standard" },
      { id: "c4", name: "Barbacoa Bowl w/ rice & beans", cal: 650, p: 40, c: 60, f: 24, period: "standard" },
      { id: "c5", name: "Chicken Salad w/ salsa (no dressing)", cal: 400, p: 40, c: 20, f: 18, period: "standard" },
      { id: "c6", name: "Chips (side)", cal: 540, p: 7, c: 65, f: 27, period: "standard" },
      { id: "c7", name: "Sofritas Bowl (rice, black beans, salsas)", cal: 720, p: 22, c: 95, f: 25, period: "standard" },
      { id: "c8", name: "Guacamole (side)", cal: 230, p: 2, c: 8, f: 22, period: "standard" },
      { id: "c9", name: "Keto Lifestyle Bowl (double protein, fajita veggies, cheese, guac, lettuce)", cal: 650, p: 45, c: 14, f: 45, period: "standard" },
    ],
  },
  tacobell: {
    name: "Taco Bell",
    items: [
      { id: "t1", name: "Crunchwrap Supreme", cal: 530, p: 15, c: 73, f: 20, period: "standard" },
      { id: "t2", name: "Power Menu Bowl - Chicken", cal: 470, p: 26, c: 46, f: 20, period: "standard" },
      { id: "t3", name: "Cheesy Gordita Crunch", cal: 500, p: 18, c: 41, f: 29, period: "standard" },
      { id: "t4", name: "Crunchy Taco", cal: 170, p: 8, c: 13, f: 10, period: "standard" },
      { id: "t5", name: "Bean Burrito", cal: 380, p: 13, c: 54, f: 9, period: "standard" },
      { id: "t6", name: "Mexican Pizza", cal: 540, p: 20, c: 46, f: 30, period: "standard" },
      { id: "t7", name: "Breakfast Crunchwrap", cal: 610, p: 20, c: 53, f: 36, period: "breakfast" },
      { id: "t8", name: "Hash Brown", cal: 160, p: 1, c: 15, f: 10, period: "breakfast" },
      { id: "t9", name: "Doritos Locos Taco", cal: 170, p: 7, c: 13, f: 10, period: "standard" },
      { id: "t10", name: "Chicken Quesadilla", cal: 500, p: 26, c: 39, f: 27, period: "standard" },
      { id: "t11", name: "Nacho Fries", cal: 320, p: 4, c: 33, f: 19, period: "standard" },
      { id: "t12", name: "Black Bean Chalupa", cal: 330, p: 10, c: 39, f: 14, period: "standard" },
      { id: "t13", name: "Power Bowl, no rice/beans (protein style)", cal: 300, p: 25, c: 10, f: 18, period: "standard" },
    ],
  },
};

// Shown as disabled, dashed "Soon" buttons in the main app — signals
// planned scope to a reviewer rather than looking like a missing feature.
const WIP_CHAINS = ["Wendy's", "Chick-fil-A", "Subway"];

// Used for "Skip for now" guest mode — a reasonable average adult so the
// app is immediately usable without any signup friction.
const GENERIC_DEFAULT_PROFILE = { sex: "male", age: 30, heightIn: 68, weightLb: 170, activity: "moderate" };

/**
 * The signature visual element: a stem that grows and sprouts leaves as a
 * given macro (calories/protein/carbs/fat) approaches its daily target,
 * instead of a standard flat progress bar. The stem's height is scaled to
 * use nearly the full container (rather than topping out partway with
 * empty space above it), and leaves are spaced proportionally along the
 * *current* stem height so they always sit on visible stem rather than
 * floating at fixed spots disconnected from the actual growth. A flower
 * blooms at the top once the goal is nearly or fully hit (90%+); going
 * over swaps that for a warning icon and tints the whole plant red.
 */
function PlantMeter({ pct, current, target, label, color, ink, muted }) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  const isOver = (pct || 0) > 100;
  const atGoal = clamped >= 90; // blooms a bit before hitting exactly 100%, not just right at it
  const stemColor = isOver ? "#C1594A" : color;

  // Container is h-32 (128px) — cap stem growth at ~112px so there's still
  // a little headroom above it for the bloom/warning icon at 100%.
  const maxStemHeight = 112;
  const stemHeight = 4 + (clamped / 100) * (maxStemHeight - 4);
  const leafCount = Math.floor(clamped / 20); // up to 5, one every 20%

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="relative h-32 w-10 flex items-end justify-center">
        <div className="w-1.5 rounded-full transition-all duration-700 ease-out" style={{ height: `${stemHeight}px`, backgroundColor: stemColor }} />
        {Array.from({ length: leafCount }).map((_, i) => {
          // Spaced along the stem's *actual current height*, not fixed pixel offsets —
          // this is what keeps leaves visually attached to the stem as it grows.
          const leafBottom = ((i + 1) / (leafCount + 0.5)) * stemHeight;
          return (
            <div key={i} className="absolute transition-all duration-500"
              style={{ bottom: `${leafBottom}px`, left: i % 2 === 0 ? "2px" : "auto", right: i % 2 !== 0 ? "2px" : "auto", transform: i % 2 === 0 ? "rotate(-25deg)" : "rotate(25deg) scaleX(-1)" }}>
              <Leaf size={16} color={stemColor} fill={stemColor} fillOpacity={0.35} />
            </div>
          );
        })}
        {atGoal && (
          <div className="absolute transition-all duration-500" style={{ bottom: `${stemHeight - 4}px` }}>
            {isOver
              ? <AlertTriangle size={18} color="#C1594A" fill="#C1594A" fillOpacity={0.2} />
              : <Flower2 size={20} color={color} />}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-xs font-medium tracking-wide" style={{ color: ink }}>{label}</div>
        <div className="text-[11px] font-medium" style={{ color: isOver ? "#C1594A" : muted }}>
          {Math.round(current)}/{Math.round(target)}
        </div>
      </div>
    </div>
  );
}

// ---------- Screen 1: Auth (login / signup / guest skip) ----------
// ---------- Screen 0: Welcome (brief intro before asking for an account) ----------
// Shown once per fresh visit to new/logged-out visitors — returning users
// with a valid saved token skip straight past this (see the mount effect
// in the top-level App component below).
function WelcomeScreen({ onGetStarted, onSkip, isDark, onToggleDark }) {
  const theme = resolveTheme("standard", isDark);
  const highlights = [
    "Personalized calorie & macro targets — not the same fixed number for everyone",
    "Standard and Breakfast menus that actually match what each chain serves",
    "Bulk, Cut, Maintain, Dirty Bulk, or Keto — items that fit your goal get highlighted",
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative" style={{ backgroundColor: theme.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }
        button:not(:disabled), .clickable { transition: filter 0.15s ease, transform 0.1s ease; }
        button:not(:disabled):hover, .clickable:hover { filter: brightness(1.08); }
        button:not(:disabled):active { transform: scale(0.96); }
      `}</style>
      <div className="absolute top-6 right-6">
        <DarkModeToggle isDark={isDark} onToggle={onToggleDark} theme={theme} />
      </div>

      <div className="w-full max-w-md px-6 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: theme.primary }}>
            <Leaf size={26} color={theme.surface} />
          </div>
        </div>
        <h1 className="font-display text-3xl mb-2" style={{ color: theme.ink }}>Macro Loadout</h1>
        <p className="text-sm mb-8" style={{ color: theme.muted }}>
          Hit your macros with the fast food you're already ordering.
        </p>

        <div className="rounded-3xl p-5 mb-6 text-left" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
          {highlights.map((h, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm ${i > 0 ? "mt-3" : ""}`} style={{ color: theme.ink }}>
              <Sparkles size={14} color={theme.accent} className="mt-0.5 flex-shrink-0" />
              <span>{h}</span>
            </div>
          ))}
        </div>

        <button onClick={onGetStarted}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-medium transition-transform active:scale-95"
          style={{ backgroundColor: theme.ink, color: theme.surface }}>
          Get started <ArrowRight size={16} />
        </button>
        <button onClick={onSkip} className="w-full text-center text-xs mt-4 underline" style={{ color: theme.muted }}>
          Skip for now — use general numbers
        </button>
      </div>
    </div>
  );
}

function AuthScreen({ onAuthed, onSkip, isDark, onToggleDark }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // only collected/used on signup, not login
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const theme = resolveTheme("standard", isDark);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login" ? await login(username, password) : await register(username, email, password);
      onAuthed(data.token, rememberMe);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative" style={{ backgroundColor: theme.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }

        button:not(:disabled), .clickable {
          transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        }
        button:not(:disabled):hover, .clickable:hover {
          filter: brightness(1.08);
        }
        button:not(:disabled):active {
          transform: scale(0.96);
        }
        .food-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext x='0' y='24' font-size='24'%3E%F0%9F%8D%B4%3C/text%3E%3C/svg%3E") 16 16, pointer;
        }
        .food-card button {
          cursor: inherit;
        }
        .food-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 18px rgba(0,0,0,0.15);
        }
        @keyframes goalPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--glow-color, transparent); }
          50% { box-shadow: 0 0 16px 3px var(--glow-color, transparent); }
        }
        .goal-match {
          animation: goalPulse 2.4s ease-in-out infinite;
        }
      `}</style>
      <div className="absolute top-6 right-6">
        <DarkModeToggle isDark={isDark} onToggle={onToggleDark} theme={theme} />
      </div>
      <div className="w-full max-w-sm px-6">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: theme.primary }}>
            <Leaf size={20} color={theme.surface} />
          </div>
          <h1 className="font-display text-2xl" style={{ color: theme.ink }}>Macro Loadout</h1>
        </div>

        <div className="rounded-3xl p-6" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
          <div className="flex rounded-full p-1 gap-1 mb-5" style={{ backgroundColor: theme.bg }}>
            <button onClick={() => setMode("login")} className="flex-1 py-2 rounded-full text-sm font-medium transition-all"
              style={{ backgroundColor: mode === "login" ? theme.primary : "transparent", color: mode === "login" ? theme.surface : theme.ink }}>
              Log in
            </button>
            <button onClick={() => setMode("signup")} className="flex-1 py-2 rounded-full text-sm font-medium transition-all"
              style={{ backgroundColor: mode === "signup" ? theme.primary : "transparent", color: mode === "signup" ? theme.surface : theme.ink }}>
              Sign up
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            {mode === "signup" && (
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            )}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            <label className="flex items-center gap-2 text-xs" style={{ color: theme.muted }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="clickable" />
              Stay signed in on this device
            </label>
            {error && <p className="text-xs" style={{ color: "#B9705E" }}>{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-2xl py-3 font-medium transition-transform active:scale-95"
              style={{ backgroundColor: theme.ink, color: theme.surface, opacity: loading ? 0.6 : 1 }}>
              {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>

        <button onClick={onSkip} className="w-full text-center text-xs mt-4 underline" style={{ color: theme.muted }}>
          Skip for now — use general numbers
        </button>
      </div>
    </div>
  );
}

// ---------- Screen 2: Onboarding (goal + profile stats) ----------
// Reached either right after signup (new account, no profile yet) or via
// "Edit profile" from the main app. `initial` pre-fills the form when
// editing an existing profile; left undefined on a fresh signup.
function Onboarding({ initial, onComplete, isDark, onToggleDark }) {
  const [goalKey, setGoalKey] = useState(initial?.goalKey || "bulk");
  const [sex, setSex] = useState(initial?.profile?.sex || "male");
  const [age, setAge] = useState(initial?.profile?.age || 25);
  const initialTotalIn = Math.round(initial?.profile?.heightIn || 68);
  const [heightFeet, setHeightFeet] = useState(Math.floor(initialTotalIn / 12));
  const [heightInches, setHeightInches] = useState(initialTotalIn % 12);
  const [weightLb, setWeightLb] = useState(Math.round(initial?.profile?.weightLb || 170));
  const [activity, setActivity] = useState(initial?.profile?.activity || "moderate");
  const [hoveredActivity, setHoveredActivity] = useState(null);
  const theme = resolveTheme("standard", isDark);

  const heightIn = heightFeet * 12 + heightInches;

  const preview = computeTargets({ sex, age, heightIn, weightLb, activity }, goalKey);

  return (
    <div className="min-h-screen w-full relative" style={{ backgroundColor: theme.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="absolute top-6 right-6">
        <DarkModeToggle isDark={isDark} onToggle={onToggleDark} theme={theme} />
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }

        button:not(:disabled), .clickable {
          transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        }
        button:not(:disabled):hover, .clickable:hover {
          filter: brightness(1.08);
        }
        button:not(:disabled):active {
          transform: scale(0.96);
        }
        .food-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext x='0' y='24' font-size='24'%3E%F0%9F%8D%B4%3C/text%3E%3C/svg%3E") 16 16, pointer;
        }
        .food-card button {
          cursor: inherit;
        }
        .food-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 18px rgba(0,0,0,0.15);
        }
        @keyframes goalPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--glow-color, transparent); }
          50% { box-shadow: 0 0 16px 3px var(--glow-color, transparent); }
        }
        .goal-match {
          animation: goalPulse 2.4s ease-in-out infinite;
        }
      `}</style>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: theme.primary }}>
            <Leaf size={20} color={theme.surface} />
          </div>
          <h1 className="font-display text-2xl" style={{ color: theme.ink }}>Macro Loadout</h1>
        </div>

        <div className="rounded-3xl p-6 mb-5" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
          <h2 className="font-display text-lg mb-4" style={{ color: theme.ink }}>Pick your goal</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(GOAL_CONFIG).map(([key, g]) => (
              <button key={key} onClick={() => setGoalKey(key)} className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{ backgroundColor: goalKey === key ? theme.primary : theme.bg, color: goalKey === key ? theme.surface : theme.ink }}>
                {g.label}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: theme.muted }}>{GOAL_CONFIG[goalKey].desc}</p>
        </div>

        <div className="rounded-3xl p-6 mb-5" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
          <h2 className="font-display text-lg mb-4" style={{ color: theme.ink }}>About you</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={() => setSex("male")} className="py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: sex === "male" ? theme.primary : theme.bg, color: sex === "male" ? theme.surface : theme.ink }}>Male</button>
            <button onClick={() => setSex("female")} className="py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: sex === "female" ? theme.primary : theme.bg, color: sex === "female" ? theme.surface : theme.ink }}>Female</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: theme.muted }}>Age</span>
              {/* Empty string is a valid, intermediate state here (not coerced to 0) so the
                  field can actually be cleared and retyped instead of getting stuck showing "0". */}
              <input type="number" step="1" value={age} onChange={(e) => { const v = e.target.value; setAge(v === "" ? "" : Math.round(Number(v))); }}
                className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: theme.muted }}>Weight (lb)</span>
              <input type="number" step="1" value={weightLb} onChange={(e) => { const v = e.target.value; setWeightLb(v === "" ? "" : Math.round(Number(v))); }}
                className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            </label>
          </div>
          <div className="mb-3">
            <span className="text-xs" style={{ color: theme.muted }}>Height</span>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: theme.muted }}>Feet</span>
                <input type="number" step="1" min="0" value={heightFeet} onChange={(e) => { const v = e.target.value; setHeightFeet(v === "" ? "" : Math.round(Number(v))); }}
                  className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: theme.muted }}>Inches</span>
                <input type="number" step="1" min="0" max="11" value={heightInches} onChange={(e) => { const v = e.target.value; setHeightInches(v === "" ? "" : Math.round(Number(v))); }}
                  className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>
            </div>
          </div>
          <span className="text-xs" style={{ color: theme.muted }}>Activity level</span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {Object.entries(ACTIVITY_LEVELS).map(([key, a]) => (
              <div key={key} className="relative" onMouseEnter={() => setHoveredActivity(key)} onMouseLeave={() => setHoveredActivity(null)}>
                <button onClick={() => setActivity(key)} className="w-full py-2 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: activity === key ? theme.accent : theme.bg, color: theme.ink }}>
                  {a.label}
                </button>
                {hoveredActivity === key && (
                  <div className="absolute z-10 left-1/2 -translate-x-1/2 top-full mt-2 w-40 rounded-xl px-3 py-2 text-[11px] leading-snug shadow-lg"
                    style={{ backgroundColor: theme.ink, color: theme.surface }}>
                    {ACTIVITY_EXAMPLES[key]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl p-5 mb-5" style={{ backgroundColor: theme.primary }}>
          <p className="text-xs mb-1" style={{ color: theme.surface, opacity: 0.85 }}>Your daily target</p>
          <p className="font-display text-xl" style={{ color: theme.surface }}>
            {preview.calories} cal · Protein {preview.protein}g · Carbs {preview.carbs}g · Fat {preview.fat}g
          </p>
        </div>

        <button
          onClick={() => onComplete({ profile: { sex, age, heightIn, weightLb, activity }, goalKey })}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-medium transition-transform active:scale-95"
          style={{ backgroundColor: theme.ink, color: theme.surface }}>
          Start my loadout <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------- "Don't see what you're looking for?" request modal ----------
// Public feature — works for guests too, since it POSTs to an
// unauthenticated endpoint (see backend/routes/requests.js).
function RequestModal({ onClose, theme }) {
  const [requestType, setRequestType] = useState("restaurant");
  const [restaurantName, setRestaurantName] = useState("");
  const [itemName, setItemName] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'sending' | 'sent' | 'error'

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await submitRequest({
        request_type: requestType,
        restaurant_name: restaurantName || null,
        item_name: requestType === "menu_item" ? itemName : null,
        note: note || null,
      });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-3xl p-6 relative" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
        <button onClick={onClose} className="absolute top-4 right-4">
          <X size={18} color={theme.muted} />
        </button>

        {status === "sent" ? (
          <div className="text-center py-6">
            <p className="font-display text-lg mb-2" style={{ color: theme.ink }}>Thanks!</p>
            <p className="text-sm" style={{ color: theme.muted }}>Your request has been sent — appreciate the suggestion.</p>
            <button onClick={onClose} className="mt-4 rounded-xl px-4 py-2 text-sm font-medium" style={{ backgroundColor: theme.primary, color: theme.surface }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="font-display text-lg mb-1" style={{ color: theme.ink }}>Don't see what you're looking for?</h3>
            <p className="text-xs mb-4" style={{ color: theme.muted }}>Request a restaurant or a specific menu item and we'll consider adding it.</p>

            <div className="flex rounded-full p-1 gap-1 mb-4" style={{ backgroundColor: theme.bg }}>
              <button type="button" onClick={() => setRequestType("restaurant")} className="flex-1 py-2 rounded-full text-xs font-medium"
                style={{ backgroundColor: requestType === "restaurant" ? theme.primary : "transparent", color: requestType === "restaurant" ? theme.surface : theme.ink }}>
                A restaurant
              </button>
              <button type="button" onClick={() => setRequestType("menu_item")} className="flex-1 py-2 rounded-full text-xs font-medium"
                style={{ backgroundColor: requestType === "menu_item" ? theme.primary : "transparent", color: requestType === "menu_item" ? theme.surface : theme.ink }}>
                A menu item
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: theme.muted }}>Restaurant name</span>
                <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required
                  placeholder="e.g. Wendy's" className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>

              {requestType === "menu_item" && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: theme.muted }}>Menu item name</span>
                  <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} required
                    placeholder="e.g. Baconator" className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
                </label>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: theme.muted }}>Anything else? (optional)</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  className="rounded-lg px-3 py-2 text-sm resize-none" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>
            </div>

            {status === "error" && <p className="text-xs mt-2" style={{ color: "#B9705E" }}>Something went wrong — try again in a bit.</p>}

            <button type="submit" disabled={status === "sending"}
              className="w-full mt-4 rounded-2xl py-3 font-medium transition-transform active:scale-95"
              style={{ backgroundColor: theme.ink, color: theme.surface, opacity: status === "sending" ? 0.6 : 1 }}>
              {status === "sending" ? "Sending..." : "Send request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- Bug report modal ----------
// Same public, no-auth pattern as RequestModal — a bug can happen to a
// guest just as easily as a logged-in user, so this shouldn't require
// signing in to report.
function BugReportModal({ onClose, theme }) {
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'sending' | 'sent' | 'error'

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await submitBugReport({ description, contact_info: contactInfo || null });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-3xl p-6 relative" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
        <button onClick={onClose} className="absolute top-4 right-4">
          <X size={18} color={theme.muted} />
        </button>

        {status === "sent" ? (
          <div className="text-center py-6">
            <p className="font-display text-lg mb-2" style={{ color: theme.ink }}>Thanks for the heads up!</p>
            <p className="text-sm" style={{ color: theme.muted }}>Your bug report has been sent — appreciate you flagging it.</p>
            <button onClick={onClose} className="mt-4 rounded-xl px-4 py-2 text-sm font-medium" style={{ backgroundColor: theme.primary, color: theme.surface }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="font-display text-lg mb-1 flex items-center gap-2" style={{ color: theme.ink }}>
              <Bug size={18} /> Report a bug
            </h3>
            <p className="text-xs mb-4" style={{ color: theme.muted }}>Something broken or acting weird? Let us know what happened.</p>

            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: theme.muted }}>What happened?</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required
                  placeholder="e.g. The macro meters didn't update after I added an item"
                  className="rounded-lg px-3 py-2 text-sm resize-none" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: theme.muted }}>Contact info (optional)</span>
                <input type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Email, if you'd like a reply" className="rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>
            </div>

            {status === "error" && <p className="text-xs mt-2" style={{ color: "#B9705E" }}>Something went wrong — try again in a bit.</p>}

            <button type="submit" disabled={status === "sending"}
              className="w-full mt-4 rounded-2xl py-3 font-medium transition-transform active:scale-95"
              style={{ backgroundColor: theme.ink, color: theme.surface, opacity: status === "sending" ? 0.6 : 1 }}>
              {status === "sending" ? "Sending..." : "Send bug report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Small ticking local date/time display shown in the main app header. */
function LiveClock({ theme }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-xs text-right leading-tight" style={{ color: theme.muted }}>
      <div>{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
      <div>{now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</div>
    </div>
  );
}

/**
 * Month-grid calendar for browsing loadout history. Fetches the lightweight
 * date-list (date + total calories) once on open rather than every day's
 * full item list — clicking a specific day is what triggers fetching that
 * day's full items (handled by the parent via onSelectDate).
 */
function CalendarModal({ theme, token, currentDateKey, onSelectDate, onClose }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = currentDateKey.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const [markedDates, setMarkedDates] = useState({}); // { 'YYYY-MM-DD': totalCal }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLoadoutDates(token)
      .then((rows) => {
        const map = {};
        rows.forEach((r) => { map[r.date] = r.totalCal; });
        setMarkedDates(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateKey(new Date());

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-sm rounded-3xl p-6 relative" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
        <button onClick={onClose} className="absolute top-4 right-4">
          <X size={18} color={theme.muted} />
        </button>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonthCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={18} color={theme.muted} />
          </button>
          <h3 className="font-display text-lg" style={{ color: theme.ink }}>
            {monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
          <button onClick={() => setMonthCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={18} color={theme.muted} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-[10px]" style={{ color: theme.muted }}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasData = markedDates[key] != null;
            const isToday = key === todayKey;
            const isViewing = key === currentDateKey;
            return (
              <button
                key={i}
                onClick={() => onSelectDate(key)}
                className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative"
                style={{
                  backgroundColor: isViewing ? theme.primary : "transparent",
                  color: isViewing ? theme.surface : theme.ink,
                  border: isToday && !isViewing ? `1px solid ${theme.accent}` : "1px solid transparent",
                }}
              >
                {day}
                {hasData && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: isViewing ? theme.surface : theme.accent }} />
                )}
              </button>
            );
          })}
        </div>

        {loading && <p className="text-xs mt-3 text-center" style={{ color: theme.muted }}>Loading history...</p>}
      </div>
    </div>
  );
}

// ---------- Screen 3: Main app (restaurant browser + macro tracker) ----------
function MacroApp({ profile, goalKey, onEditProfile, onLogout, isGuest, isDark, onToggleDark, username, token }) {
  const [chainKey, setChainKey] = useState("mcdonalds");
  const [mode, setMode] = useState("standard"); // 'standard' | 'breakfast' — drives both theme and visible menu items
  const [cart, setCart] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewingDateKey, setViewingDateKey] = useState(() => localDateKey(new Date()));
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'
  const todayKey = localDateKey(new Date());
  const isViewingToday = viewingDateKey === todayKey;

  // On first load, restore today's saved loadout (if any) so refreshing the
  // page doesn't lose progress. Guests never persist, so this is skipped
  // for them — their cart only ever lives in this component's state.
  useEffect(() => {
    if (isGuest || !token) return;
    getLoadoutForDate(token, todayKey)
      .then((data) => {
        if (data && data.items) setCart(data.items);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targets = computeTargets(profile, goalKey);
  const chain = RESTAURANTS[chainKey];
  const theme = resolveTheme(mode, isDark);
  const ModeIcon = theme.icon;
  const visibleItems = chain.items.filter((i) => i.period === mode);
  // Goal-matching items float to the top — .sort() is stable in modern JS
  // engines, so items that don't match keep their original relative order.
  const sortedItems = [...visibleItems].sort(
    (a, b) => (matchesGoal(b, goalKey) ? 1 : 0) - (matchesGoal(a, goalKey) ? 1 : 0)
  );

  const addItem = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const changeQty = (id, delta) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0));
  };

  // Explicit save rather than autosave-on-every-change — predictable, and
  // avoids firing a network request on every single quantity click.
  const handleSaveLoadout = async () => {
    if (isGuest || !token) return;
    setSaveStatus("saving");
    try {
      await saveLoadoutForDate(token, viewingDateKey, { items: cart, goal_type: goalKey });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
    }
  };

  const handleSelectDate = async (dateKey) => {
    setShowCalendar(false);
    setViewingDateKey(dateKey);
    if (isGuest || !token) return;
    try {
      const data = await getLoadoutForDate(token, dateKey);
      setCart(data && data.items ? data.items : []);
    } catch (err) {
      setCart([]);
    }
  };

  const handleBackToToday = async () => {
    setViewingDateKey(todayKey);
    if (isGuest || !token) return;
    try {
      const data = await getLoadoutForDate(token, todayKey);
      setCart(data && data.items ? data.items : []);
    } catch (err) {
      setCart([]);
    }
  };

  const handleDeleteViewedDay = async () => {
    if (isGuest || !token) return;
    try {
      await deleteLoadoutForDate(token, viewingDateKey);
      setCart([]);
    } catch (err) {
      // best-effort — leave the cart as-is if the delete fails
    }
  };
  // Running totals across whatever's currently in the cart, recalculated
  // only when the cart itself changes.
  const totals = useMemo(() => cart.reduce((acc, c) => ({
    cal: acc.cal + c.cal * c.qty, p: acc.p + c.p * c.qty, c: acc.c + c.c * c.qty, f: acc.f + c.f * c.qty,
  }), { cal: 0, p: 0, c: 0, f: 0 }), [cart]);

  return (
    <div className="min-h-screen w-full transition-all duration-500" style={{ background: theme.bgGradient, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }

        button:not(:disabled), .clickable {
          transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
        }
        button:not(:disabled):hover, .clickable:hover {
          filter: brightness(1.08);
        }
        button:not(:disabled):active {
          transform: scale(0.96);
        }
        .food-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext x='0' y='24' font-size='24'%3E%F0%9F%8D%B4%3C/text%3E%3C/svg%3E") 16 16, pointer;
        }
        .food-card button {
          cursor: inherit;
        }
        .food-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 18px rgba(0,0,0,0.15);
        }
        @keyframes goalPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--glow-color, transparent); }
          50% { box-shadow: 0 0 16px 3px var(--glow-color, transparent); }
        }
        .goal-match {
          animation: goalPulse 2.4s ease-in-out infinite;
        }
      `}</style>

      <header className="max-w-5xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: theme.primary }}>
            <ModeIcon size={20} color={theme.surface} />
          </div>
          <div>
            {!isGuest && username && (
              <p className="text-xs mb-0.5" style={{ color: theme.muted }}>Hello, {username}</p>
            )}
            <h1 className="font-display text-2xl transition-colors duration-500" style={{ color: theme.ink }}>
              {mode === "breakfast" ? "Rise & Shine" : "Macro Loadout"}
            </h1>
            <p className="text-sm transition-colors duration-500" style={{ color: theme.muted }}>
              {GOAL_CONFIG[goalKey].label} plan · {targets.calories} cal target {isGuest && "· guest mode"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LiveClock theme={theme} />
          {!isGuest && (
            <button onClick={() => setShowCalendar(true)} className="flex items-center gap-1 text-xs" style={{ color: theme.muted }}>
              <Calendar size={12} /> History
            </button>
          )}
          {/* Guests see "Sign up" (routes to AuthScreen) instead of "Edit profile"
              (routes to Onboarding) — see handleEditProfile below for the branch. */}
          <button onClick={onEditProfile} className="flex items-center gap-1 text-xs" style={{ color: theme.muted }}>
            {isGuest ? <><ArrowRight size={12} /> Sign up / Sign in</> : <><Pencil size={12} /> Edit profile</>}
          </button>
          {!isGuest && (
            <button onClick={onLogout} className="flex items-center gap-1 text-xs" style={{ color: theme.muted }}>
              <LogOut size={12} /> Log out
            </button>
          )}
          <div className="flex rounded-full p-1 gap-1" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
            <button onClick={() => setMode("standard")} className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: mode === "standard" ? resolveTheme("standard", isDark).primary : "transparent", color: mode === "standard" ? resolveTheme("standard", isDark).surface : theme.muted }}>
              <Leaf size={14} /> Standard
            </button>
            <button onClick={() => setMode("breakfast")} className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: mode === "breakfast" ? resolveTheme("breakfast", isDark).primary : "transparent", color: mode === "breakfast" ? resolveTheme("breakfast", isDark).surface : theme.muted }}>
              <Sunrise size={14} /> Breakfast
            </button>
          </div>
          <DarkModeToggle isDark={isDark} onToggle={onToggleDark} theme={theme} />
        </div>
      </header>

      {!isGuest && !isViewingToday && (
        <div className="max-w-5xl mx-auto px-6 -mt-3 mb-3">
          <div className="rounded-xl px-4 py-2 flex items-center justify-between text-xs" style={{ backgroundColor: theme.accent, color: theme.ink }}>
            <span>Viewing {viewingDateKey} — this is a past day, not today's live loadout.</span>
            <button onClick={handleBackToToday} className="underline font-medium">Back to today</button>
          </div>
        </div>
      )}


      <main className="max-w-5xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(RESTAURANTS).map(([key, r]) => (
                <button key={key} onClick={() => setChainKey(key)} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ backgroundColor: chainKey === key ? theme.accent : theme.surface, color: chainKey === key ? theme.ink : theme.muted, border: `1px solid ${theme.border}` }}>
                  {r.name}
                </button>
              ))}
              {WIP_CHAINS.map((name) => (
                <button key={name} disabled className="px-4 py-2 rounded-xl text-sm font-semibold cursor-not-allowed"
                  style={{ backgroundColor: "transparent", color: theme.muted, border: `1px dashed ${theme.border}`, opacity: 0.6 }}>
                  {name} · Soon
                </button>
              ))}
            </div>

            <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-1.5 text-xs mb-4 underline" style={{ color: theme.muted }}>
              <MessageSquarePlus size={13} /> Don't see what you're looking for?
            </button>

            {visibleItems.length === 0 ? (
              <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: theme.surface, border: `1px dashed ${theme.border}`, color: theme.muted }}>
                <p className="text-sm">{chain.name} doesn't have a breakfast menu here yet — try McDonald's or Taco Bell, or switch back to Standard.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {sortedItems.map((item) => {
                  const isMatch = matchesGoal(item, goalKey);
                  return (
                    <div key={item.id}
                      className={`food-card rounded-2xl p-4 flex flex-col justify-between transition-colors duration-500 relative ${isMatch ? "goal-match" : ""}`}
                      style={{
                        backgroundColor: theme.surface,
                        border: isMatch ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`,
                        ...(isMatch ? { "--glow-color": `${theme.accent}88` } : {}),
                      }}>
                      {isMatch && (
                        <span className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shadow-sm"
                          style={{ backgroundColor: theme.accent, color: theme.ink }}>
                          <Sparkles size={10} /> {GOAL_MATCH_LABELS[goalKey]}
                        </span>
                      )}
                      <div>
                        <h3 className="font-semibold text-sm" style={{ color: theme.ink }}>{item.name}</h3>
                        <p className="text-xs mt-1" style={{ color: theme.muted }}>{item.cal} cal</p>
                        <p className="text-xs" style={{ color: theme.muted }}>Protein {item.p}g · Carbs {item.c}g · Fat {item.f}g</p>
                      </div>
                      <button onClick={() => addItem(item)} className="mt-3 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-medium transition-transform active:scale-95"
                        style={{ backgroundColor: theme.primary, color: theme.surface }}>
                        <Plus size={14} /> Add to loadout
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl p-5 h-fit sticky top-6 transition-colors duration-500" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
          <h2 className="font-display text-lg mb-4 flex items-center gap-2" style={{ color: theme.ink }}>
            <Sparkles size={18} color={theme.accent} /> Today's growth
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-6">
            <PlantMeter pct={(totals.cal / targets.calories) * 100} current={totals.cal} target={targets.calories} label="Cal" color={theme.accent} ink={theme.ink} muted={theme.muted} />
            <PlantMeter pct={(totals.p / targets.protein) * 100} current={totals.p} target={targets.protein} label="Protein" color={theme.primary} ink={theme.ink} muted={theme.muted} />
            <PlantMeter pct={(totals.c / targets.carbs) * 100} current={totals.c} target={targets.carbs} label="Carbs" color="#B98D5E" ink={theme.ink} muted={theme.muted} />
            <PlantMeter pct={(totals.f / targets.fat) * 100} current={totals.f} target={targets.fat} label="Fat" color="#E8B4A0" ink={theme.ink} muted={theme.muted} />
          </div>
          <div className="space-y-2 mb-4">
            {cart.length === 0 && <p className="text-xs italic" style={{ color: theme.muted }}>Nothing added yet — pick something that sounds good.</p>}
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl px-3 py-2 transition-colors duration-500" style={{ backgroundColor: theme.bg }}>
                <div className="text-xs" style={{ color: theme.ink }}>
                  <div className="font-medium">{item.name}</div>
                  <div style={{ color: theme.muted }}>{item.cal * item.qty} cal</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(item.id, -1)}><Minus size={14} color={theme.muted} /></button>
                  <span className="text-xs w-4 text-center">{item.qty}</span>
                  <button onClick={() => changeQty(item.id, 1)}><Plus size={14} color={theme.muted} /></button>
                </div>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="flex items-center gap-1 text-xs" style={{ color: "#B9705E" }}>
              <Trash2 size={12} /> Clear loadout
            </button>
          )}

          {!isGuest && (
            <div className="flex items-center gap-3 mt-3">
              <button onClick={handleSaveLoadout} disabled={saveStatus === "saving"}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: theme.primary, color: theme.surface, opacity: saveStatus === "saving" ? 0.6 : 1 }}>
                <Save size={12} />
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Try again" : `Save ${isViewingToday ? "today's" : "this"} loadout`}
              </button>
              {!isViewingToday && (
                <button onClick={handleDeleteViewedDay} className="flex items-center gap-1 text-xs" style={{ color: "#B9705E" }}>
                  <Trash2 size={12} /> Delete this day
                </button>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 flex items-center gap-2 text-xs transition-colors duration-500" style={{ borderTop: `1px solid ${theme.border}`, color: theme.muted }}>
            <Flame size={14} color={theme.accent} />
            {totals.cal} / {targets.calories} cal {isViewingToday ? "today" : `on ${viewingDateKey}`}
          </div>
        </aside>
      </main>

      {showRequestModal && <RequestModal theme={theme} onClose={() => setShowRequestModal(false)} />}
      {showBugModal && <BugReportModal theme={theme} onClose={() => setShowBugModal(false)} />}
      {showCalendar && (
        <CalendarModal
          theme={theme}
          token={token}
          currentDateKey={viewingDateKey}
          onSelectDate={handleSelectDate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      <button
        onClick={() => setShowBugModal(true)}
        className="fixed bottom-6 right-6 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium shadow-lg z-40"
        style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.muted }}
      >
        <Bug size={14} /> Report a bug
      </button>
    </div>
  );
}

// ---------- Top-level state machine ----------
// Owns everything that needs to persist or be shared across screens:
// which screen is active, the auth token, the resolved profile/goal, guest
// status, and dark mode. Each screen is a "dumb" component below this one —
// they receive data and callbacks as props and don't talk to localStorage
// or the API directly (except AuthScreen/Onboarding calling api.js, which
// bubbles results back up through the callbacks passed in here).
export default function App() {
  const [screen, setScreen] = useState("loading"); // 'loading' | 'auth' | 'onboarding' | 'app'
  const [token, setToken] = useState(() => localStorage.getItem("token") || sessionStorage.getItem("token") || null);
  const [profile, setProfile] = useState(null);
  const [goalKey, setGoalKey] = useState("bulk");
  const [isGuest, setIsGuest] = useState(false);
  const [username, setUsername] = useState(null);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("darkMode") === "true");

  const toggleDark = () => {
    setIsDark((prev) => {
      localStorage.setItem("darkMode", String(!prev));
      return !prev;
    });
  };

  // Single delegated click listener for the wood-block sound — covers
  // every button (and anything marked .clickable) app-wide without each
  // one needing its own onClick wiring for audio.
  useEffect(() => {
    const handleClick = (e) => {
      const target = e.target.closest("button, .clickable");
      if (target && !target.disabled) playClickSound();
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // On mount, if a token was saved from a previous visit, try to restore
  // the session by fetching the profile. A profile with no `age` set means
  // the account exists but never finished onboarding (e.g. signed up, then
  // closed the tab) — send them there instead of assuming default stats.
  useEffect(() => {
    if (!token) { setScreen("welcome"); return; }
    getProfile(token)
      .then((data) => {
        setUsername(data.username);
        if (data.age == null) {
          setScreen("onboarding");
        } else {
          setProfile({
            sex: data.sex, age: data.age,
            heightIn: Number(data.height_cm) / 2.54,
            weightLb: Number(data.weight_kg) / 0.453592,
            activity: data.activity_level,
          });
          setGoalKey(data.goal_type || "bulk");
          setScreen("app");
        }
      })
      .catch(() => {
        // Token expired or invalid — clear it (from both possible storages)
        // and fall back to a fresh login rather than getting stuck on a
        // broken "logged in" state.
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        setToken(null);
        setScreen("auth");
      });
  }, [token]);

  // "Stay signed in" -> localStorage (survives closing the browser).
  // Unchecked -> sessionStorage (cleared once the browser/tab is closed),
  // so someone on a shared or public computer isn't left logged in.
  const handleAuthed = (newToken, rememberMe) => {
    if (rememberMe) {
      localStorage.setItem("token", newToken);
    } else {
      sessionStorage.setItem("token", newToken);
    }
    setToken(newToken);
  };

  const handleSkip = () => {
    setIsGuest(true);
    setProfile(GENERIC_DEFAULT_PROFILE);
    setGoalKey("maintain");
    setScreen("app");
  };

  const handleOnboardingComplete = async ({ profile: p, goalKey: g }) => {
    // Guests never touch the backend — their profile only ever lives in
    // this component's state and disappears on refresh, by design.
    if (!isGuest && token) {
      await updateProfile(token, {
        sex: p.sex, age: p.age,
        height_cm: p.heightIn * 2.54,
        weight_kg: p.weightLb * 0.453592,
        activity_level: p.activity,
        goal_type: g,
      });
    }
    setProfile(p);
    setGoalKey(g);
    setScreen("app");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setToken(null);
    setProfile(null);
    setIsGuest(false);
    setUsername(null);
    setScreen("auth");
  };

  // Guests get sent to sign up for real (their local-only profile would
  // otherwise vanish); logged-in users go back to onboarding to edit their
  // existing stats.
  const handleEditProfile = () => {
    if (isGuest) {
      setIsGuest(false);
      setScreen("auth");
    } else {
      setScreen("onboarding");
    }
  };

  if (screen === "loading") return null;
  if (screen === "welcome") return <WelcomeScreen onGetStarted={() => setScreen("auth")} onSkip={handleSkip} isDark={isDark} onToggleDark={toggleDark} />;
  if (screen === "auth") return <AuthScreen onAuthed={handleAuthed} onSkip={handleSkip} isDark={isDark} onToggleDark={toggleDark} />;
  if (screen === "onboarding") return <Onboarding initial={{ profile, goalKey }} onComplete={handleOnboardingComplete} isDark={isDark} onToggleDark={toggleDark} />;
  return <MacroApp profile={profile} goalKey={goalKey} onEditProfile={handleEditProfile} onLogout={handleLogout} isGuest={isGuest} isDark={isDark} onToggleDark={toggleDark} username={username} token={token} />;
}
