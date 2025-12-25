// === LIB INDEX ===
// Re-exports all lib modules for convenient importing

// Core data
export { ARCHETYPES, BOUNDS, AGENTS } from './archetypes.js';

// Constants
export {
  STATUSES,
  STATUS_INFO,
  CHANNELS,
  HOUSES,
  ROLES,
  HOUSE_COLORS,
  STATUS_COLORS,
  CHANNEL_CROSSINGS,
  CHANNEL_COLORS
} from './constants.js';

// Spreads
export {
  DURABLE_SPREADS,
  RANDOM_SPREADS,
  MODE_HELPER_TEXT
} from './spreads.js';

// Voice/Stance system
export {
  VOICE_MODIFIERS,
  FOCUS_MODIFIERS,
  DENSITY_MODIFIERS,
  SCOPE_MODIFIERS,
  COMPLEXITY_OPTIONS,
  COMPLEXITY_MODIFIERS,
  SERIOUSNESS_MODIFIERS,
  DELIVERY_PRESETS,
  STANCE_PRESETS,
  VOICE_LETTER_TONE,
  buildStancePrompt
} from './voice.js';

// Prompts
export {
  BASE_SYSTEM,
  FORMAT_INSTRUCTIONS,
  EXPANSION_PROMPTS,
  SUGGESTIONS,
  LOADING_PHRASES
} from './prompts.js';

// Corrections
export {
  DIAGONAL_PAIRS,
  VERTICAL_PAIRS,
  REDUCTION_PAIRS,
  getArchetypeCorrection,
  getAssociatedCards,
  getBoundCorrection,
  getAgentCorrection,
  getComponent,
  getFullCorrection,
  getCorrectionText,
  getCorrectionTargetId
} from './corrections.js';

// Utilities
export {
  shuffleArray,
  generateSpread,
  encodeDraws,
  decodeDraws,
  sanitizeForAPI,
  formatDrawForAI,
  parseReadingResponse
} from './utils.js';

// Hotlinks
export {
  parseSimpleMarkdown,
  buildHotlinkTerms,
  HOTLINK_TERMS,
  SORTED_TERM_KEYS,
  HOTLINK_PATTERN,
  renderWithHotlinks
} from './hotlinks.js';
