// === HOTLINK UTILITIES ===
// Parsing and rendering of clickable term links in reading text

import { ARCHETYPES, BOUNDS, AGENTS } from './archetypes.js';
import { CHANNELS, HOUSES, ROLES, STATUS_INFO } from './constants.js';
import { getComponent } from './corrections.js';

// === SIMPLE MARKDOWN PARSER ===
// Parses **bold** and *italic* text
export const parseSimpleMarkdown = (text) => {
  if (!text) return text;

  const parts = [];
  let key = 0;

  // Pattern to match **bold** or *italic*
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add formatted text
    if (match[2]) {
      // Bold: **text**
      parts.push(<strong key={key++} className="font-semibold text-zinc-100">{match[2]}</strong>);
    } else if (match[3]) {
      // Italic: *text*
      parts.push(<em key={key++} className="italic">{match[3]}</em>);
    }

    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Build hotlink term lookup maps
export const buildHotlinkTerms = () => {
  const terms = {};

  // Archetype names (0-21)
  Object.entries(ARCHETYPES).forEach(([id, arch]) => {
    terms[arch.name] = { type: 'card', id: parseInt(id) };
  });

  // Bound names (22-61)
  Object.entries(BOUNDS).forEach(([id, bound]) => {
    terms[bound.name] = { type: 'card', id: parseInt(id) };
  });

  // Agent names (62-77) - match full name and just the role portion
  Object.entries(AGENTS).forEach(([id, agent]) => {
    terms[agent.name] = { type: 'card', id: parseInt(id) };
  });

  // House names
  Object.keys(HOUSES).forEach(house => {
    terms[house] = { type: 'house', id: house };
  });

  // Channel names
  Object.keys(CHANNELS).forEach(channel => {
    terms[channel] = { type: 'channel', id: channel };
  });

  // Status terms
  terms['Balanced'] = { type: 'status', id: 1 };
  terms['Too Much'] = { type: 'status', id: 2 };
  terms['Too Little'] = { type: 'status', id: 3 };
  terms['Unacknowledged'] = { type: 'status', id: 4 };

  // Role names
  Object.keys(ROLES).forEach(role => {
    terms[role] = { type: 'role', id: role };
  });

  return terms;
};

export const HOTLINK_TERMS = buildHotlinkTerms();

// Sort terms by length (longest first) to match "Too Much" before "Much"
export const SORTED_TERM_KEYS = Object.keys(HOTLINK_TERMS).sort((a, b) => b.length - a.length);

// Create regex pattern for all terms (word boundaries, case insensitive for flexibility)
export const HOTLINK_PATTERN = new RegExp(
  `\\b(${SORTED_TERM_KEYS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'g'
);

// Render text with clickable hotlinks for invariant terms
// Returns JSX with ClickableTerm components for matched terms
export const renderWithHotlinks = (text, setSelectedInfo) => {
  if (!text || !setSelectedInfo) return parseSimpleMarkdown(text);

  // Helper to create clickable term
  const ClickableTerm = ({ type, id, children }) => (
    <span
      className="cursor-pointer hover:underline decoration-dotted underline-offset-2 text-amber-300/90"
      onClick={(e) => {
        e.stopPropagation();
        let data = null;
        if (type === 'card') data = getComponent(id);
        else if (type === 'channel') data = CHANNELS[id];
        else if (type === 'status') data = STATUS_INFO[id];
        else if (type === 'house') data = HOUSES[id];
        else if (type === 'role') data = ROLES[id];
        setSelectedInfo({ type, id, data });
      }}
    >
      {children}
    </span>
  );

  const result = [];
  let key = 0;

  // First, handle markdown formatting, then add hotlinks to each segment
  const markdownParts = [];
  const markdownPattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastMarkdownIndex = 0;
  let markdownMatch;

  while ((markdownMatch = markdownPattern.exec(text)) !== null) {
    if (markdownMatch.index > lastMarkdownIndex) {
      markdownParts.push({ text: text.slice(lastMarkdownIndex, markdownMatch.index), format: null });
    }
    if (markdownMatch[2]) {
      markdownParts.push({ text: markdownMatch[2], format: 'bold' });
    } else if (markdownMatch[3]) {
      markdownParts.push({ text: markdownMatch[3], format: 'italic' });
    }
    lastMarkdownIndex = markdownPattern.lastIndex;
  }
  if (lastMarkdownIndex < text.length) {
    markdownParts.push({ text: text.slice(lastMarkdownIndex), format: null });
  }
  if (markdownParts.length === 0) {
    markdownParts.push({ text, format: null });
  }

  // Now process each markdown part for hotlinks
  markdownParts.forEach((part, partIndex) => {
    const partText = part.text;
    const hotlinkParts = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    HOTLINK_PATTERN.lastIndex = 0;

    while ((match = HOTLINK_PATTERN.exec(partText)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        hotlinkParts.push({ text: partText.slice(lastIndex, match.index), isLink: false });
      }

      // Add the matched term as a link
      const termInfo = HOTLINK_TERMS[match[1]];
      if (termInfo) {
        hotlinkParts.push({ text: match[1], isLink: true, type: termInfo.type, id: termInfo.id });
      } else {
        hotlinkParts.push({ text: match[1], isLink: false });
      }

      lastIndex = HOTLINK_PATTERN.lastIndex;
    }

    // Add remaining text
    if (lastIndex < partText.length) {
      hotlinkParts.push({ text: partText.slice(lastIndex), isLink: false });
    }

    // If no hotlinks found, just use original text
    if (hotlinkParts.length === 0) {
      hotlinkParts.push({ text: partText, isLink: false });
    }

    // Build the JSX for this markdown part
    const partElements = hotlinkParts.map((hp, hpIndex) => {
      if (hp.isLink) {
        return <ClickableTerm key={`${partIndex}-${hpIndex}`} type={hp.type} id={hp.id}>{hp.text}</ClickableTerm>;
      }
      return hp.text;
    });

    // Wrap in formatting if needed
    if (part.format === 'bold') {
      result.push(<strong key={key++} className="font-semibold text-zinc-100">{partElements}</strong>);
    } else if (part.format === 'italic') {
      result.push(<em key={key++} className="italic">{partElements}</em>);
    } else {
      // For plain text, add elements directly (might be array or single element)
      partElements.forEach(el => result.push(el));
    }
  });

  return result.length > 0 ? result : text;
};
