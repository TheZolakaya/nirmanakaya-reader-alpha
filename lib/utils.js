// === UTILITY FUNCTIONS ===
// Drawing, encoding/decoding, formatting utilities

import { ARCHETYPES } from './archetypes.js';
import { STATUSES } from './constants.js';
import { DURABLE_SPREADS, RANDOM_SPREADS } from './spreads.js';
import { STANCE_PRESETS } from './voice.js';
import { getComponent, getFullCorrection, getCorrectionText } from './corrections.js';

export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateSpread(count, isDurable = false) {
  const positionPool = isDurable ? [] : shuffleArray([...Array(22).keys()]);
  const transientPool = shuffleArray([...Array(78).keys()]);

  return Array.from({ length: count }, (_, i) => {
    const statusArr = new Uint32Array(1);
    crypto.getRandomValues(statusArr);
    return {
      position: isDurable ? null : positionPool[i],
      transient: transientPool[i],
      status: (statusArr[0] % 4) + 1
    };
  });
}

export function encodeDraws(draws, spreadType, spreadKey, stance, question) {
  // Use encodeURIComponent to handle Unicode characters before btoa
  const jsonStr = JSON.stringify({ d: draws, t: spreadType, k: spreadKey, s: stance, q: question });
  return btoa(unescape(encodeURIComponent(jsonStr)));
}

export function decodeDraws(encoded) {
  try {
    // Use decodeURIComponent to handle Unicode characters after atob
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    // Handle legacy persona format
    if (data.p && !data.s) {
      // Convert old persona to closest new preset
      const legacyMap = {
        seeker: 'kind',
        practitioner: 'direct',
        philosopher: 'wise',
        direct: 'direct',
        // Also map old preset names to new ones
        quickTake: 'direct',
        gentleGuide: 'kind',
        clearView: 'direct',
        deepDive: 'wise',
        fullTransmission: 'oracle'
      };
      const preset = STANCE_PRESETS[legacyMap[data.p] || 'kind'];
      return {
        draws: data.d,
        spreadType: data.t,
        spreadKey: data.k,
        stance: { seriousness: preset.seriousness, voice: preset.voice, focus: preset.focus, density: preset.density, scope: preset.scope },
        question: data.q
      };
    }
    // Ensure seriousness has a default if loading old stance without it
    const stance = data.s || {};
    if (!stance.seriousness) stance.seriousness = 'balanced';
    return { draws: data.d, spreadType: data.t, spreadKey: data.k, stance, question: data.q };
  } catch { return null; }
}

// Sanitize text for API calls - handles special characters that can cause issues
export function sanitizeForAPI(text) {
  if (!text) return text;
  return text
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes to straight
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes to straight
    .replace(/\u2014/g, '--')         // Em dash to double hyphen
    .replace(/\u2013/g, '-')          // En dash to single hyphen
    .replace(/\u2026/g, '...')        // Ellipsis to three dots
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
}

export function formatDrawForAI(draws, spreadType, spreadKey, showTraditional) {
  const isDurable = spreadType === 'durable';
  const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : RANDOM_SPREADS[spreadKey];

  return draws.map((draw, i) => {
    const trans = getComponent(draw.transient);
    const stat = STATUSES[draw.status];
    const correction = getFullCorrection(draw.transient, draw.status);
    const correctionText = getCorrectionText(correction, trans, draw.status);
    const transArchetype = trans.archetype !== undefined ? ARCHETYPES[trans.archetype] : null;

    let context = isDurable
      ? `${spreadConfig.frames[i].name} (${spreadConfig.frames[i].meaning})`
      : (draw.position !== null ? `Position ${draw.position} ${ARCHETYPES[draw.position]?.name}` : 'Draw');

    let transInfo = trans.name;
    // Traditional names removed from API calls - showTraditional only affects UI display
    if (trans.type === "Archetype") transInfo += ` — Major Archetype`;
    else if (trans.type === "Bound") transInfo += ` — ${trans.channel} Channel, expresses ${transArchetype?.name}`;
    else if (trans.type === "Agent") transInfo += ` — ${trans.role} of ${trans.channel}, embodies ${transArchetype?.name}`;

    const statusPhrase = stat.prefix ? `${stat.prefix} ${trans.name}` : `Balanced ${trans.name}`;

    return `**Signature ${i + 1} — ${context}**: ${statusPhrase}
Transient: ${transInfo}
Status: ${stat.name} — ${stat.desc}
${correctionText ? `Correction: ${correctionText}. IMPORTANT: Use this exact correction, do not calculate different numbers.` : 'No correction needed (Balanced)'}`;
  }).join('\n\n');
}

// === RESPONSE PARSING ===
export function parseReadingResponse(responseText, draws) {
  const sections = {
    summary: null,
    cards: [],
    corrections: [],
    rebalancerSummary: null,
    letter: null
  };

  // Extract summary
  const summaryMatch = responseText.match(/\[SUMMARY\]\s*([\s\S]*?)(?=\[CARD:|$)/);
  if (summaryMatch) {
    sections.summary = summaryMatch[1].trim();
  }

  // Extract card sections
  draws.forEach((_, i) => {
    const cardNum = i + 1;
    const cardRegex = new RegExp(`\\[CARD:${cardNum}\\]\\s*([\\s\\S]*?)(?=\\[CARD:|\\[CORRECTION:|\\[PATH\\]|\\[LETTER\\]|$)`);
    const cardMatch = responseText.match(cardRegex);
    if (cardMatch) {
      sections.cards.push({
        index: i,
        content: cardMatch[1].trim()
      });
    }
  });

  // Extract correction sections
  draws.forEach((draw, i) => {
    if (draw.status !== 1) { // Only for imbalanced cards
      const corrNum = i + 1;
      const corrRegex = new RegExp(`\\[CORRECTION:${corrNum}\\]\\s*([\\s\\S]*?)(?=\\[CORRECTION:|\\[PATH\\]|\\[LETTER\\]|$)`);
      const corrMatch = responseText.match(corrRegex);
      if (corrMatch) {
        sections.corrections.push({
          cardIndex: i,
          content: corrMatch[1].trim()
        });
      }
    }
  });

  // Extract path to balance section (only when 2+ imbalanced)
  const rebalancerMatch = responseText.match(/\[PATH\]\s*([\s\S]*?)(?=\[LETTER\]|$)/);
  if (rebalancerMatch) {
    sections.rebalancerSummary = rebalancerMatch[1].trim();
  }

  // Extract letter section
  const letterMatch = responseText.match(/\[LETTER\]\s*([\s\S]*?)$/);
  if (letterMatch) {
    sections.letter = letterMatch[1].trim();
  }

  return sections;
}
