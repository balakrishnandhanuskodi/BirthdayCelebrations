/**
 * Question bank for the "Pick a Friend" Q&A: Pune vs Chennai vs Bengaluru.
 * Edit freely. `options` become tap-to-answer buttons for Charuta (optional).
 * Guests who type their own question on the join page are asked theirs instead.
 */
export interface PartyQuestion {
  q: string;
  options: string[];
}

export const QUESTIONS: PartyQuestion[] = [
  { q: "☕ Masala chai or filter coffee?", options: ["Masala chai", "Filter coffee"] },
  { q: "🍛 Misal pav, ven pongal or masala dosa: pick ONE breakfast forever!", options: ["Misal pav", "Ven pongal", "Masala dosa"] },
  { q: "🍪 Chitale bakarwadi or Chennai murukku?", options: ["Bakarwadi", "Murukku"] },
  { q: "🌊 Marina Beach sunset or Pune monsoon at Sinhagad?", options: ["Marina sunset", "Sinhagad monsoon"] },
  { q: "🌳 A walk in Cubbon Park or shopping on FC Road?", options: ["Cubbon Park", "FC Road"] },
  { q: "🚗 Which traffic is worse: Silk Board junction or Pune's signal jumpers?", options: ["Silk Board", "Pune signals"] },
  { q: "🏏 CSK, RCB or Mumbai Indians: who are you cheering for?", options: ["CSK", "RCB", "MI"] },
  { q: "🎬 A Rajinikanth punch dialogue or a Marathi natak?", options: ["Rajini dialogue", "Marathi natak"] },
  { q: "🥘 Vada pav, idli-vada or Bengaluru benne dosa?", options: ["Vada pav", "Idli-vada", "Benne dosa"] },
  { q: "🌡️ Chennai heat, Pune rain or Bengaluru's 'always 24°C'?", options: ["Chennai heat", "Pune rain", "Bengaluru 24°C"] },
  { q: "🍬 Mysore pak or Pune's mastani?", options: ["Mysore pak", "Mastani"] },
  { q: "🛺 Auto in Chennai, auto in Bengaluru or auto in Pune: who charges the most 'extra'?", options: ["Chennai", "Bengaluru", "Pune"] },
  { q: "🎶 December Margazhi music season or Pune's Sawai Gandharva festival?", options: ["Margazhi season", "Sawai Gandharva"] },
  { q: "🍺 Bengaluru brewery night or a Pune Koregaon Park evening?", options: ["Bengaluru brewery", "Koregaon Park"] },
  { q: "🏰 Shaniwar Wada, Mysore Palace or Kapaleeshwarar Temple: where would you take a visitor first?", options: ["Shaniwar Wada", "Mysore Palace", "Kapaleeshwarar"] },
  { q: "🍚 Sambar rice or varan bhaat?", options: ["Sambar rice", "Varan bhaat"] },
  { q: "🧁 Chennai's Grand Sweets or Pune's Kayani Bakery Shrewsbury biscuits?", options: ["Grand Sweets", "Kayani biscuits"] },
  { q: "🌄 Nandi Hills sunrise or Lonavala weekend?", options: ["Nandi Hills", "Lonavala"] },
  { q: "🗣️ 'Machaan', 'Macha' or 'Bhau': which one do you say the most?", options: ["Machaan", "Macha", "Bhau"] },
  { q: "🍲 Bisi bele bath or Puneri misal: which is spicier in your memory?", options: ["Bisi bele bath", "Puneri misal"] },
  { q: "🛍️ T. Nagar shopping chaos or Commercial Street chaos?", options: ["T. Nagar", "Commercial Street"] },
  { q: "📱 If you had to live in one city forever: Pune, Chennai or Bengaluru?", options: ["Pune", "Chennai", "Bengaluru"] },
  { q: "🍦 Corner House Death by Chocolate or Pune's Kayani mawa cake?", options: ["Death by Chocolate", "Mawa cake"] },
  { q: "🎉 Ganpati festival in Pune or Pongal in Chennai?", options: ["Ganpati in Pune", "Pongal in Chennai"] },
  { q: "🚇 Namma Metro, Chennai Metro or Pune Metro: which have you actually ridden?", options: ["Namma Metro", "Chennai Metro", "Pune Metro"] },
  { q: "🥥 Tender coconut on Marina or sugarcane juice on JM Road?", options: ["Tender coconut", "Sugarcane juice"] },
  { q: "😴 Sunday plan: Chennai beach morning, Bengaluru brunch or Pune Sinhagad trek?", options: ["Beach morning", "Bengaluru brunch", "Sinhagad trek"] },
  { q: "🎂 What's the best birthday memory you have with this friend?", options: [] },
];

/** Used for any of the moderator's 5 challenges left blank. */
export const DEFAULT_ACTS = [
  "🎤 Sing two lines of your favourite song!",
  "💃 Show us your best dance move for 10 seconds!",
  "🗣️ Say 'Happy birthday to me' in Marathi, Tamil and Kannada!",
  "🤪 Make the funniest face you can, and hold it for 5 seconds!",
  "🌟 Tell everyone your one big wish for this year!",
];
