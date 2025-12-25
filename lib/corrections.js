// === CORRECTION LOGIC ===
// CANONICAL CORRECTION LOOKUP TABLES
// Source: The_New_Nirmanakaya_Card_Table_With_Balancing.xlsx
// DO NOT USE FORMULAS - these are authoritative lookup values

import { ARCHETYPES, BOUNDS, AGENTS } from './archetypes.js';
import { CHANNEL_CROSSINGS } from './constants.js';

// DIAGONAL_PAIRS (Too Much correction)
export const DIAGONAL_PAIRS = {
  0: 19,   // Potential → Actualization
  1: 20,   // Will → Awareness
  2: 17,   // Wisdom → Inspiration
  3: 18,   // Nurturing → Imagination
  4: 15,   // Order → Abstraction
  5: 16,   // Culture → Breakthrough
  6: 13,   // Compassion → Change
  7: 14,   // Drive → Balance
  8: 11,   // Fortitude → Equity
  9: 12,   // Discipline → Sacrifice
  10: 1,   // Cycles (Portal) → Will
  11: 8,   // Equity → Fortitude
  12: 9,   // Sacrifice → Discipline
  13: 6,   // Change → Compassion
  14: 7,   // Balance → Drive
  15: 4,   // Abstraction → Order
  16: 5,   // Breakthrough → Culture
  17: 2,   // Inspiration → Wisdom
  18: 3,   // Imagination → Nurturing
  19: 0,   // Actualization → Potential
  20: 1,   // Awareness → Will
  21: 0    // Wholeness (Portal) → Potential
};

// VERTICAL_PAIRS (Too Little correction)
export const VERTICAL_PAIRS = {
  0: 20,   // Potential → Awareness
  1: 19,   // Will → Actualization
  2: 18,   // Wisdom → Imagination
  3: 17,   // Nurturing → Inspiration
  4: 16,   // Order → Breakthrough
  5: 15,   // Culture → Abstraction
  6: 14,   // Compassion → Balance
  7: 13,   // Drive → Change
  8: 12,   // Fortitude → Sacrifice
  9: 11,   // Discipline → Equity
  10: 19,  // Cycles (Portal) → Actualization
  11: 9,   // Equity → Discipline
  12: 8,   // Sacrifice → Fortitude
  13: 7,   // Change → Drive
  14: 6,   // Balance → Compassion
  15: 5,   // Abstraction → Culture
  16: 4,   // Breakthrough → Order
  17: 3,   // Inspiration → Nurturing
  18: 2,   // Imagination → Wisdom
  19: 1,   // Actualization → Will
  20: 0,   // Awareness → Potential
  21: 20   // Wholeness (Portal) → Awareness
};

// REDUCTION_PAIRS (Unacknowledged correction)
// null means no reduction pair exists for that position
export const REDUCTION_PAIRS = {
  0: null,  // Potential - no reduction
  1: null,  // Will - no reduction
  2: 11,    // Wisdom → Equity
  3: 12,    // Nurturing → Sacrifice
  4: 13,    // Order → Change
  5: 14,    // Culture → Balance
  6: 15,    // Compassion → Abstraction
  7: 16,    // Drive → Breakthrough
  8: 17,    // Fortitude → Inspiration
  9: 18,    // Discipline → Imagination
  10: null, // Cycles (Portal) - no reduction
  11: 2,    // Equity → Wisdom
  12: 3,    // Sacrifice → Nurturing
  13: 4,    // Change → Order
  14: 5,    // Balance → Culture
  15: 6,    // Abstraction → Compassion
  16: 7,    // Breakthrough → Drive
  17: 8,    // Inspiration → Fortitude
  18: 9,    // Imagination → Discipline
  19: null, // Actualization - no reduction
  20: null, // Awareness - no reduction
  21: null  // Wholeness (Portal) - no reduction
};

// Simple lookup-based correction - NO FORMULAS
export function getArchetypeCorrection(transientPosition, status) {
  if (status === 1) return null; // Balanced - no correction needed

  if (status === 2) {
    // Too Much → Diagonal partner
    const target = DIAGONAL_PAIRS[transientPosition];
    return target !== undefined ? { type: "diagonal", target } : null;
  }

  if (status === 3) {
    // Too Little → Vertical partner
    const target = VERTICAL_PAIRS[transientPosition];
    return target !== undefined ? { type: "vertical", target } : null;
  }

  if (status === 4) {
    // Unacknowledged → Reduction pair
    const target = REDUCTION_PAIRS[transientPosition];
    return target !== null ? { type: "reduction", target } : null;
  }

  return null;
}

// Get all Bounds and Agents that express/embody a given Archetype
export function getAssociatedCards(archetypeId) {
  const bounds = Object.entries(BOUNDS)
    .filter(([_, b]) => b.archetype === archetypeId)
    .map(([id, b]) => ({ id: parseInt(id), ...b, type: 'Bound' }));
  const agents = Object.entries(AGENTS)
    .filter(([_, a]) => a.archetype === archetypeId)
    .map(([id, a]) => ({ id: parseInt(id), ...a, type: 'Agent' }));
  return { bounds, agents };
}

export function getBoundCorrection(bound, status) {
  if (status === 1) return null;
  const targetChannel = CHANNEL_CROSSINGS[status]?.[bound.channel];
  const targetNumber = 11 - bound.number;
  if (!targetChannel) return null;
  const targetBound = Object.entries(BOUNDS).find(([id, b]) => b.channel === targetChannel && b.number === targetNumber);
  if (!targetBound) return null;
  return {
    type: status === 2 ? "diagonal" : status === 3 ? "vertical" : "reduction",
    targetId: parseInt(targetBound[0]),
    targetBound: targetBound[1],
    numberMirror: `${bound.number}→${targetNumber}`,
    channelCross: `${bound.channel}→${targetChannel}`
  };
}

export function getAgentCorrection(agent, status) {
  return getArchetypeCorrection(agent.archetype, status);
}

export function getComponent(id) {
  if (id < 22) return { ...ARCHETYPES[id], type: "Archetype", id };
  if (id < 62) return { ...BOUNDS[id], type: "Bound", id };
  return { ...AGENTS[id], type: "Agent", id };
}

export function getFullCorrection(transientId, status) {
  const trans = getComponent(transientId);
  if (trans.type === "Archetype") return getArchetypeCorrection(transientId, status);
  if (trans.type === "Bound") return getBoundCorrection(trans, status);
  if (trans.type === "Agent") return getAgentCorrection(trans, status);
  return null;
}

export function getCorrectionText(correction, trans, status) {
  if (!correction) return null;
  const correctionType = status === 2 ? "DIAGONAL" : status === 3 ? "VERTICAL" : status === 4 ? "REDUCTION" : null;

  if (trans.type === "Bound" && correction.targetBound) {
    const targetBound = correction.targetBound;
    return `${targetBound.name} via ${correctionType} duality`;
  }

  if (correction.target !== undefined) {
    const targetArchetype = ARCHETYPES[correction.target];
    if (targetArchetype) {
      return `Position ${correction.target} ${targetArchetype.name} via ${correctionType} duality`;
    }
  }

  if (correction.targets) {
    return correction.targets.map(t => {
      const arch = ARCHETYPES[t];
      return arch ? `Position ${t} ${arch.name}` : null;
    }).filter(Boolean).join(", ");
  }
  return null;
}

export function getCorrectionTargetId(correction, trans) {
  if (!correction) return null;
  if (trans.type === "Bound" && correction.targetId !== undefined) return correction.targetId;
  if (correction.target !== undefined) return correction.target;
  if (correction.targets && correction.targets.length > 0) return correction.targets[0];
  return null;
}
