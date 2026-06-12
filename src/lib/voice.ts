/* ───────────────────────────── THE VOICE ─────────────────────────────────
   Last Call has a mouth on it. Funny, Chicago-coded, punches UP at prices, at
   Malört, and at the user's own choices — never at strangers, never mean, no
   slurs, nothing targeting people. Destructive/confirmation flows stay
   straight-faced (see `plain` helpers — voice never wraps a delete).

   Everything here is DETERMINISTIC and seeded by the calendar day, so the app
   reads the same all Wednesday and changes its tune by Thursday. No
   Math.random — a day seed picks the line, the index varies it within a day. */

/** Day seed: YYYYMMDD as an int. Stable for a whole local day. */
export function daySeed(now: Date): number {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

/** Deterministic pick from a list given a seed + an extra salt (e.g. row idx). */
function pick<T>(list: readonly T[], seed: number, salt = 0): T {
  if (list.length === 0) throw new Error("voice: empty list");
  const i = Math.abs(Math.floor(seed + salt * 2654435761)) % list.length;
  return list[i];
}

/* ───────────────────────────── copy banks ───────────────────────────────── */

const EMPTY_NO_LIVE = [
  "Nothing live right now. The city is telling you to eat something.",
  "No deals on the clock. Even Malört is taking a breather.",
  "Dead air. Either it's 9 AM or you have impossible standards.",
  "Zero live pours. Respectfully, touch some grass until 4.",
] as const;

const EMPTY_FILTERED = [
  "Nothing matches. You filtered the whole city into a corner.",
  "No hits. Loosen a chip — you're being picky for a Tuesday.",
  "Empty. That filter combo is a personality, not a search.",
] as const;

const EMPTY_SAVED = [
  "No saved deals yet. Tap the heart on a pour you'd defend in court.",
  "Nothing starred. Commitment issues are a Chicago tradition, but still.",
] as const;

const ERROR_LINES = [
  "The map fell off a barstool. Retrying.",
  "Something spilled on the server. Mopping it up.",
  "We lost the deals behind the bar. One sec.",
] as const;

const LOADING_LINES = [
  "Counting the cheap pours…",
  "Checking who's still pouring…",
  "Sweeping the ring for live deals…",
  "Asking around for the good stuff…",
] as const;

const PLANNER_INTROS = [
  "A night, engineered. Walk these in order, thank us later.",
  "Three stops, minimal walking, maximal damage avoided.",
  "Here's the run. Bring someone who owes you a round.",
] as const;

/** Loading-state Chicago lore — all factual, no copyrighted text. */
const LORE = [
  "Old Style was brewed in Wisconsin but Chicago adopted it like a stray.",
  "Malört was named for its maker, Carl Jeppson, who sold it as 'medicinal' through Prohibition.",
  "Chicago is one of the few cities with a 4 AM liquor license — and 5 AM on Saturdays.",
  "The Malört face is real: the brand once ran ads quoting drinkers' disgust verbatim.",
  "Wrigley Field didn't have lights until 1988 — the last MLB park to add them.",
  "An 'Old Style and a shot' is the unofficial Chicago handshake. The shot is usually Malört.",
  "Jeppson's Malört is a 'bäsk' — a Swedish wormwood liqueur most of the world skipped.",
  "The Green Mill kept pouring through Prohibition; Al Capone had a favorite booth.",
] as const;

/** Roast lines for the planner output when there's no AI key. Punch at the PLAN. */
const CANNED_ROASTS = [
  "Three bars within a 12-minute walk? Bold of you to assume you'll make it past the second.",
  "This itinerary screams 'I have brunch plans I'm about to ruin.'",
  "Solid plan. Aggressive value. Your liver has filed a formal complaint.",
  "You optimized for cheap over good and honestly? Respect. Chicago raised you right.",
  "Starting at a happy hour that ends in 20 minutes is a speedrun, not a night out.",
] as const;

/** Wheel of Poor Decisions dares — generic, never names a person. */
const DARES = [
  "Order the Old Style and a Malört. Don't make a face. (You'll make a face.)",
  "Tip in full eye contact. Ask the bartender what they'd actually drink.",
  "First round's on whoever checks their phone first. Phones down.",
  "Order the house special you can't pronounce. Commit to the bit.",
  "Find the oldest thing on the wall and ask its story.",
] as const;

/* ───────────────────────────── public API ───────────────────────────────── */

export const voice = {
  emptyNoLive: (now: Date) => pick(EMPTY_NO_LIVE, daySeed(now)),
  emptyFiltered: (now: Date) => pick(EMPTY_FILTERED, daySeed(now)),
  emptySaved: (now: Date) => pick(EMPTY_SAVED, daySeed(now)),
  error: (now: Date) => pick(ERROR_LINES, daySeed(now)),
  loading: (now: Date, salt = 0) => pick(LOADING_LINES, daySeed(now), salt),
  plannerIntro: (now: Date) => pick(PLANNER_INTROS, daySeed(now)),
  lore: (now: Date, salt = 0) => pick(LORE, daySeed(now), salt),
  cannedRoast: (now: Date, salt = 0) => pick(CANNED_ROASTS, daySeed(now), salt),
  dare: (now: Date, salt = 0) => pick(DARES, daySeed(now), salt),
} as const;

/** Voice rules, embedded verbatim in the Roast My Plan prompt (Phase E). */
export const VOICE_RULES =
  "You are the voice of Last Call, a Chicago dive-bar app. Be funny and " +
  "Chicago-coded. Punch UP at prices, at Malört, and at the user's own " +
  "choices. NEVER punch at strangers or any person. No slurs, nothing cruel, " +
  "nothing targeting people. Two sentences max. Roast the PLAN, not anyone.";
