// === SPREAD DEFINITIONS ===
// Durable spreads (fixed positions) and random spreads

export const DURABLE_SPREADS = {
  arc: {
    name: "Arc",
    count: 3,
    frames: [
      { name: "Situation", house: "Mind", meaning: "what is" },
      { name: "Movement", house: "Spirit", meaning: "what's in motion" },
      { name: "Integration", house: "Gestalt", meaning: "what completes" }
    ],
    description: "Situation → Movement → Integration"
  },
  quadraverse: {
    name: "Quadraverse",
    count: 4,
    frames: [
      { name: "Spirit", house: "Spirit", meaning: "inner knowing" },
      { name: "Mind", house: "Mind", meaning: "pattern and structure" },
      { name: "Emotion", house: "Emotion", meaning: "feeling and drive" },
      { name: "Body", house: "Body", meaning: "form and practice" }
    ],
    description: "The four aspects of self"
  },
  fiveHouse: {
    name: "Five Houses",
    count: 5,
    frames: [
      { name: "Gestalt", house: "Gestalt", meaning: "the integrative whole" },
      { name: "Spirit", house: "Spirit", meaning: "inner knowing" },
      { name: "Mind", house: "Mind", meaning: "pattern and structure" },
      { name: "Emotion", house: "Emotion", meaning: "feeling and drive" },
      { name: "Body", house: "Body", meaning: "form and practice" }
    ],
    description: "Your five domains of experience"
  }
};

export const RANDOM_SPREADS = {
  one: { name: "One", count: 1 },
  two: { name: "Two", count: 2 },
  three: { name: "Three", count: 3 },
  four: { name: "Four", count: 4 },
  five: { name: "Five", count: 5 }
};

// Mode helper text
export const MODE_HELPER_TEXT = {
  durable: "Mirror what's present — see your patterns clearly",
  random: "Reveal signatures — engage with what's active now",
  forge: "Work with intention — shape what's emerging"
};
