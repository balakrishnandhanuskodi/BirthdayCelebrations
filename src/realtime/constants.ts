export const CHEER_LINES = [
  "Come on Charuta! You can do it!",
  "One more surprise awaits!",
  "Your friends are cheering for you!",
  "Keep going, Birthday Girl!",
  "Jump, jump, jump!",
  "Best birthday quest ever!",
];

const LOOKS = [
  { bg: "linear-gradient(145deg,#5d5fda,#20184f)", shirt: "#ff745f" },
  { bg: "linear-gradient(145deg,#ef6aa5,#5a1f53)", shirt: "#ffc63f" },
  { bg: "linear-gradient(145deg,#21a6a1,#123f4c)", shirt: "#5f7bea" },
  { bg: "linear-gradient(145deg,#f0813c,#5b2a17)", shirt: "#9f67d9" },
  { bg: "linear-gradient(145deg,#7658d6,#2a1c5e)", shirt: "#43b784" },
  { bg: "linear-gradient(145deg,#e85d75,#4f1830)", shirt: "#35b6d6" },
  { bg: "linear-gradient(145deg,#3d8bd9,#152a55)", shirt: "#f2a541" },
  { bg: "linear-gradient(145deg,#2fb980,#11402f)", shirt: "#ff6f91" },
];
const SKINS = ["#d59d7a", "#b96f4d", "#9a5c3c", "#e3aa83", "#bd7959", "#c88a65", "#a8694a"];
const STYLES = ["short", "long", "curly", "bun"] as const;

/** Deterministic avatar look per person (used when their camera is off). */
export function lookFor(id: string, isCharuta = false) {
  if (isCharuta) return { bg: "linear-gradient(135deg,#8066dd,#f084ae)", skin: "#b87350", hair: "#352343", shirt: "#f04f87", hairStyle: "long" as const };
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const l = LOOKS[h % LOOKS.length];
  return { ...l, skin: SKINS[(h >> 3) % SKINS.length], hair: "#2a1a22", hairStyle: STYLES[(h >> 5) % STYLES.length] };
}
