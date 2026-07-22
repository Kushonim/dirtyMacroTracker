import React, { useState, useEffect, useMemo } from "react";
import { Flame, Leaf, Plus, Minus, Trash2, Sparkles, Sunrise, ArrowRight, Pencil, LogOut } from "lucide-react";
import { login, register, getProfile, updateProfile } from "./api";

// ---------- Theme presets ----------
const THEMES = {
  standard: {
    label: "Standard", icon: Leaf, bg: "#F2ECDD", bgGradient: "#F2ECDD", surface: "#FAF6EC",
    border: "#E7DCC4", ink: "#3A3229", muted: "#8A7F6E", primary: "#6B7F5E", accent: "#D9A441",
  },
  breakfast: {
    label: "Rise & Shine", icon: Sunrise, bg: "#FBEADD",
    bgGradient: "linear-gradient(180deg, #FDF1E4 0%, #F7D9B8 100%)", surface: "#FFF6EC",
    border: "#F0D9BE", ink: "#4A342A", muted: "#9C8171", primary: "#E8935A", accent: "#F2C14E",
  },
};

const GOAL_CONFIG = {
  bulk: { label: "Bulk", desc: "Steady surplus", calAdjust: 1.15, ratios: { protein: 0.30, carb: 0.45, fat: 0.25 } },
  dirty_bulk: { label: "Dirty Bulk", desc: "Aggressive surplus", calAdjust: 1.30, ratios: { protein: 0.25, carb: 0.50, fat: 0.25 } },
  cut: { label: "Cut", desc: "Lean deficit", calAdjust: 0.80, ratios: { protein: 0.40, carb: 0.35, fat: 0.25 } },
  maintain: { label: "Maintain", desc: "Hold steady", calAdjust: 1.0, ratios: { protein: 0.30, carb: 0.40, fat: 0.30 } },
  keto: { label: "Keto", desc: "High fat, low carb", calAdjust: 1.0, ratios: { protein: 0.25, carb: 0.05, fat: 0.70 } },
};

const ACTIVITY_LEVELS = {
  sedentary: { label: "Sedentary", factor: 1.2 },
  moderate: { label: "Moderate", factor: 1.55 },
  active: { label: "Active", factor: 1.725 },
};

const ACTIVITY_EXAMPLES = {
  sedentary: "Desk job, mostly sitting, little to no structured exercise",
  moderate: "Workouts or sports 3-5 days a week, or an on-your-feet job",
  active: "Hard training 6-7 days a week, or physically demanding work",
};

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
    ],
  },
};

const WIP_CHAINS = ["Wendy's", "Chick-fil-A", "Subway"];

const GENERIC_DEFAULT_PROFILE = { sex: "male", age: 30, heightIn: 68, weightLb: 170, activity: "moderate" };

function PlantMeter({ pct, label, color, ink, muted }) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  const stemHeight = 6 + clamped * 0.5;
  const leafCount = Math.floor(clamped / 20);
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="relative h-32 w-10 flex items-end justify-center">
        <div className="w-1.5 rounded-full transition-all duration-700 ease-out" style={{ height: `${stemHeight}px`, backgroundColor: color }} />
        {Array.from({ length: leafCount }).map((_, i) => (
          <div key={i} className="absolute transition-all duration-500"
            style={{ bottom: `${12 + i * 20}px`, left: i % 2 === 0 ? "2px" : "auto", right: i % 2 !== 0 ? "2px" : "auto", transform: i % 2 === 0 ? "rotate(-25deg)" : "rotate(25deg) scaleX(-1)" }}>
            <Leaf size={16} color={color} fill={color} fillOpacity={0.35} />
          </div>
        ))}
      </div>
      <div className="text-center">
        <div className="text-xs font-medium tracking-wide" style={{ color: ink }}>{label}</div>
        <div className="text-[11px]" style={{ color: muted }}>{Math.round(clamped)}%</div>
      </div>
    </div>
  );
}

// ---------- Auth screen: login/signup + skip ----------
function AuthScreen({ onAuthed, onSkip }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const theme = THEMES.standard;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = mode === "login" ? await login(username, password) : await register(username, password);
      onAuthed(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: theme.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }
      `}</style>
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
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
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

// ---------- Onboarding ----------
function Onboarding({ initial, onComplete }) {
  const [goalKey, setGoalKey] = useState(initial?.goalKey || "bulk");
  const [sex, setSex] = useState(initial?.profile?.sex || "male");
  const [age, setAge] = useState(initial?.profile?.age || 25);
  const initialTotalIn = Math.round(initial?.profile?.heightIn || 68);
  const [heightFeet, setHeightFeet] = useState(Math.floor(initialTotalIn / 12));
  const [heightInches, setHeightInches] = useState(initialTotalIn % 12);
  const [weightLb, setWeightLb] = useState(Math.round(initial?.profile?.weightLb || 170));
  const [activity, setActivity] = useState(initial?.profile?.activity || "moderate");
  const [hoveredActivity, setHoveredActivity] = useState(null);
  const theme = THEMES.standard;

  const heightIn = heightFeet * 12 + heightInches;

  const preview = computeTargets({ sex, age, heightIn, weightLb, activity }, goalKey);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: theme.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }
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
              <input type="number" step="1" value={age} onChange={(e) => setAge(Math.round(Number(e.target.value)))}
                className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: theme.muted }}>Weight (lb)</span>
              <input type="number" step="1" value={weightLb} onChange={(e) => setWeightLb(Math.round(Number(e.target.value)))}
                className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
            </label>
          </div>
          <div className="mb-3">
            <span className="text-xs" style={{ color: theme.muted }}>Height</span>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: theme.muted }}>Feet</span>
                <input type="number" step="1" min="0" value={heightFeet} onChange={(e) => setHeightFeet(Math.round(Number(e.target.value)))}
                  className="rounded-lg px-2 py-2 text-sm" style={{ backgroundColor: theme.bg, color: theme.ink, border: `1px solid ${theme.border}` }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: theme.muted }}>Inches</span>
                <input type="number" step="1" min="0" max="11" value={heightInches} onChange={(e) => setHeightInches(Math.round(Number(e.target.value)))}
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
            {preview.calories} cal · P{preview.protein} C{preview.carbs} F{preview.fat}
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

// ---------- Main macro loadout app ----------
function MacroApp({ profile, goalKey, onEditProfile, onLogout, isGuest }) {
  const [chainKey, setChainKey] = useState("mcdonalds");
  const [mode, setMode] = useState("standard");
  const [cart, setCart] = useState([]);

  const targets = computeTargets(profile, goalKey);
  const chain = RESTAURANTS[chainKey];
  const theme = THEMES[mode];
  const ModeIcon = theme.icon;
  const visibleItems = chain.items.filter((i) => i.period === mode);

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
  const totals = useMemo(() => cart.reduce((acc, c) => ({
    cal: acc.cal + c.cal * c.qty, p: acc.p + c.p * c.qty, c: acc.c + c.c * c.qty, f: acc.f + c.f * c.qty,
  }), { cal: 0, p: 0, c: 0, f: 0 }), [cart]);

  return (
    <div className="min-h-screen w-full transition-all duration-500" style={{ background: theme.bgGradient, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Baloo 2', system-ui, sans-serif; }
      `}</style>

      <header className="max-w-5xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: theme.primary }}>
            <ModeIcon size={20} color={theme.surface} />
          </div>
          <div>
            <h1 className="font-display text-2xl transition-colors duration-500" style={{ color: theme.ink }}>
              {mode === "breakfast" ? "Rise & Shine" : "Macro Loadout"}
            </h1>
            <p className="text-sm transition-colors duration-500" style={{ color: theme.muted }}>
              {GOAL_CONFIG[goalKey].label} plan · {targets.calories} cal target {isGuest && "· guest mode"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onEditProfile} className="flex items-center gap-1 text-xs" style={{ color: theme.muted }}>
            <Pencil size={12} /> Edit profile
          </button>
          {!isGuest && (
            <button onClick={onLogout} className="flex items-center gap-1 text-xs" style={{ color: theme.muted }}>
              <LogOut size={12} /> Log out
            </button>
          )}
          <div className="flex rounded-full p-1 gap-1" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
            <button onClick={() => setMode("standard")} className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: mode === "standard" ? THEMES.standard.primary : "transparent", color: mode === "standard" ? THEMES.standard.surface : theme.muted }}>
              <Leaf size={14} /> Standard
            </button>
            <button onClick={() => setMode("breakfast")} className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: mode === "breakfast" ? THEMES.breakfast.primary : "transparent", color: mode === "breakfast" ? THEMES.breakfast.surface : theme.muted }}>
              <Sunrise size={14} /> Breakfast
            </button>
          </div>
        </div>
      </header>

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

            {visibleItems.length === 0 ? (
              <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: theme.surface, border: `1px dashed ${theme.border}`, color: theme.muted }}>
                <p className="text-sm">{chain.name} doesn't have a breakfast menu here yet — try McDonald's or Taco Bell, or switch back to Standard.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {visibleItems.map((item) => (
                  <div key={item.id} className="rounded-2xl p-4 flex flex-col justify-between transition-colors duration-500"
                    style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: theme.ink }}>{item.name}</h3>
                      <p className="text-xs mt-1" style={{ color: theme.muted }}>{item.cal} cal · P{item.p} C{item.c} F{item.f}</p>
                    </div>
                    <button onClick={() => addItem(item)} className="mt-3 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-medium transition-transform active:scale-95"
                      style={{ backgroundColor: theme.primary, color: theme.surface }}>
                      <Plus size={14} /> Add to loadout
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl p-5 h-fit sticky top-6 transition-colors duration-500" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
          <h2 className="font-display text-lg mb-4 flex items-center gap-2" style={{ color: theme.ink }}>
            <Sparkles size={18} color={theme.accent} /> Today's growth
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-6">
            <PlantMeter pct={(totals.cal / targets.calories) * 100} label="Cal" color={theme.accent} ink={theme.ink} muted={theme.muted} />
            <PlantMeter pct={(totals.p / targets.protein) * 100} label="Protein" color={theme.primary} ink={theme.ink} muted={theme.muted} />
            <PlantMeter pct={(totals.c / targets.carbs) * 100} label="Carbs" color="#B98D5E" ink={theme.ink} muted={theme.muted} />
            <PlantMeter pct={(totals.f / targets.fat) * 100} label="Fat" color="#E8B4A0" ink={theme.ink} muted={theme.muted} />
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
          <div className="mt-5 pt-4 flex items-center gap-2 text-xs transition-colors duration-500" style={{ borderTop: `1px solid ${theme.border}`, color: theme.muted }}>
            <Flame size={14} color={theme.accent} />
            {totals.cal} / {targets.calories} cal today
          </div>
        </aside>
      </main>
    </div>
  );
}

// ---------- Top-level state machine ----------
export default function App() {
  const [screen, setScreen] = useState("loading"); // 'loading' | 'auth' | 'onboarding' | 'app'
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [profile, setProfile] = useState(null);
  const [goalKey, setGoalKey] = useState("bulk");
  const [isGuest, setIsGuest] = useState(false);

  // On mount, if we have a saved token, try to load the profile
  useEffect(() => {
    if (!token) { setScreen("auth"); return; }
    getProfile(token)
      .then((data) => {
        if (data.age == null) {
          setScreen("onboarding"); // logged in but never finished onboarding
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
        localStorage.removeItem("token");
        setToken(null);
        setScreen("auth");
      });
  }, [token]);

  const handleAuthed = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const handleSkip = () => {
    setIsGuest(true);
    setProfile(GENERIC_DEFAULT_PROFILE);
    setGoalKey("maintain");
    setScreen("app");
  };

  const handleOnboardingComplete = async ({ profile: p, goalKey: g }) => {
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
    setToken(null);
    setProfile(null);
    setIsGuest(false);
    setScreen("auth");
  };

  const handleEditProfile = () => {
    setScreen("onboarding");
  };

  if (screen === "loading") return null;
  if (screen === "auth") return <AuthScreen onAuthed={handleAuthed} onSkip={handleSkip} />;
  if (screen === "onboarding") return <Onboarding initial={{ profile, goalKey }} onComplete={handleOnboardingComplete} />;
  return <MacroApp profile={profile} goalKey={goalKey} onEditProfile={handleEditProfile} onLogout={handleLogout} isGuest={isGuest} />;
}
