"use client";
import { useState, useRef, useEffect } from 'react';

// Import data and utilities from lib
import {
  // Core data
  ARCHETYPES,
  BOUNDS,
  AGENTS,
  // Constants
  STATUSES,
  STATUS_INFO,
  CHANNELS,
  HOUSES,
  ROLES,
  HOUSE_COLORS,
  STATUS_COLORS,
  CHANNEL_CROSSINGS,
  CHANNEL_COLORS,
  // Spreads
  DURABLE_SPREADS,
  RANDOM_SPREADS,
  MODE_HELPER_TEXT,
  // Voice/Stance
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
  buildStancePrompt,
  // Prompts
  BASE_SYSTEM,
  FORMAT_INSTRUCTIONS,
  EXPANSION_PROMPTS,
  SUGGESTIONS,
  LOADING_PHRASES,
  // Corrections
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
  getCorrectionTargetId,
  // Utilities
  shuffleArray,
  generateSpread,
  encodeDraws,
  decodeDraws,
  sanitizeForAPI,
  formatDrawForAI,
  parseReadingResponse
} from '../lib/index.js';

// Import renderWithHotlinks for reading text parsing
import { renderWithHotlinks } from '../lib/hotlinks.js';

// Import React components
import ClickableTermContext from '../components/shared/ClickableTermContext.js';
import InfoModal from '../components/shared/InfoModal.js';
import ThreadedCard from '../components/reader/ThreadedCard.js';
import ReadingSection from '../components/reader/ReadingSection.js';
import StanceSelector from '../components/reader/StanceSelector.js';
import IntroSection from '../components/reader/IntroSection.js';

// NOTE: All data constants have been extracted to /lib modules.
// See lib/archetypes.js, lib/constants.js, lib/spreads.js, lib/voice.js, lib/prompts.js, lib/corrections.js, lib/utils.js

// === MAIN COMPONENT ===
export default function NirmanakaReader() {
  const [question, setQuestion] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [spreadType, setSpreadType] = useState('random');
  const [spreadKey, setSpreadKey] = useState('three');
  const [stance, setStance] = useState({ complexity: 'guide', seriousness: 'earnest', voice: 'warm', focus: 'feel', density: 'clear', scope: 'connected' }); // Default: Kind
  const [showCustomize, setShowCustomize] = useState(false);
  const [draws, setDraws] = useState(null);
  const [parsedReading, setParsedReading] = useState(null);
  const [expansions, setExpansions] = useState({}); // {sectionKey: {unpack: '...', clarify: '...'}}
  const [expanding, setExpanding] = useState(null); // {section: 'card:1', type: 'unpack'}
  const [collapsedSections, setCollapsedSections] = useState({}); // {sectionKey: true/false} - tracks collapsed state

  // Toggle collapse state for a section
  // defaultCollapsed: true for sections that start collapsed, false for sections that start expanded
  const toggleCollapse = (sectionKey, defaultCollapsed = true) => {
    setCollapsedSections(prev => {
      // Determine current visual state based on the section's default
      const isCurrentlyCollapsed = defaultCollapsed
        ? prev[sectionKey] !== false  // default collapsed: undefined or true = collapsed
        : prev[sectionKey] === true;  // default expanded: only true = collapsed
      // Toggle to the opposite visual state
      return { ...prev, [sectionKey]: !isCurrentlyCollapsed };
    });
  };
  const [followUpMessages, setFollowUpMessages] = useState([]); // For general follow-ups after the reading
  const [followUpLoading, setFollowUpLoading] = useState(false); // Separate loading state for follow-ups
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTraditional, setShowTraditional] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSharedReading, setIsSharedReading] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState(null); // {type: 'card'|'channel'|'status'|'house', id: ..., data: ...}
  const [showMidReadingStance, setShowMidReadingStance] = useState(false);
  const [showFineTune, setShowFineTune] = useState(false);
  const [helpPopover, setHelpPopover] = useState(null); // 'dynamicLens' | 'fixedLayout' | 'stance' | null
  const [loadingPhrases, setLoadingPhrases] = useState([]);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [loadingPhraseVisible, setLoadingPhraseVisible] = useState(true);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [sparkPlaceholder, setSparkPlaceholder] = useState('');
  const [showLandingFineTune, setShowLandingFineTune] = useState(false);

  // Thread state for Reflect/Forge operations (Phase 2)
  const [threadData, setThreadData] = useState({}); // {cardIndex: [{draw, interpretation, operation, context, children}, ...]}
  const [threadOperations, setThreadOperations] = useState({}); // {key: 'reflect' | 'forge' | null} - key can be cardIndex or threadPath
  const [threadContexts, setThreadContexts] = useState({}); // {key: 'context text'}
  const [threadLoading, setThreadLoading] = useState({}); // {key: true/false}
  const [collapsedThreads, setCollapsedThreads] = useState({}); // {threadKey: true/false}

  const messagesEndRef = useRef(null);
  const hasAutoInterpreted = useRef(false);

  // Re-interpret with current stance (same draws)
  const reinterpret = async () => {
    if (!draws) return;
    await performReadingWithDraws(draws, question);
  };

  // Load preferences from localStorage on init (URL params override)
  useEffect(() => {
    // First, load saved preferences from localStorage
    try {
      const saved = localStorage.getItem('nirmanakaya_prefs');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (prefs.spreadType) setSpreadType(prefs.spreadType);
        if (prefs.spreadKey) setSpreadKey(prefs.spreadKey);
        if (prefs.stance) {
          // Ensure seriousness has a default if loading old prefs
          const loadedStance = { ...prefs.stance };
          if (!loadedStance.seriousness) loadedStance.seriousness = 'balanced';
          setStance(loadedStance);
        }
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }

    // Then, check for URL params (these override localStorage)
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('r');
    if (encoded && !hasAutoInterpreted.current) {
      const decoded = decodeDraws(encoded);
      if (decoded) {
        setDraws(decoded.draws);
        setSpreadType(decoded.spreadType);
        setSpreadKey(decoded.spreadKey);
        setStance(decoded.stance);
        if (decoded.question) {
          setQuestion(decoded.question);
          setIsSharedReading(true);
        }
      }
    }
  }, []);

  // Auto-save preferences to localStorage whenever they change
  useEffect(() => {
    const prefs = {
      spreadType,
      spreadKey,
      stance
    };
    try {
      localStorage.setItem('nirmanakaya_prefs', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save preferences:', e);
    }
  }, [spreadType, spreadKey, stance]);

  useEffect(() => {
    if (isSharedReading && draws && question && !hasAutoInterpreted.current) {
      hasAutoInterpreted.current = true;
      performReadingWithDraws(draws);
    }
  }, [isSharedReading, draws, question]);

  // Only scroll on new follow-up messages, NOT on initial reading load
  const prevFollowUpCount = useRef(0);
  useEffect(() => {
    if (followUpMessages.length > prevFollowUpCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevFollowUpCount.current = followUpMessages.length;
  }, [followUpMessages]);

  useEffect(() => {
    if (draws && question) {
      const encoded = encodeDraws(draws, spreadType, spreadKey, stance, question);
      setShareUrl(`${window.location.origin}${window.location.pathname}?r=${encoded}`);
    }
  }, [draws, spreadType, spreadKey, stance, question]);

  // Select random loading phrases when loading starts, cycle through only those 3
  useEffect(() => {
    if (!loading) return;

    // Pick 3 random unique phrases when loading starts
    const shuffled = [...LOADING_PHRASES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    setLoadingPhrases(selected);
    setLoadingPhraseIndex(0);
    setLoadingPhraseVisible(true);

    // Cycle through the 3 selected phrases
    const fadeInterval = setInterval(() => {
      setLoadingPhraseVisible(false);
      setTimeout(() => {
        setLoadingPhraseIndex(prev => (prev + 1) % 3);
        setLoadingPhraseVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(fadeInterval);
  }, [loading]);

  // Suggestion pills - random rotation every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex(Math.floor(Math.random() * SUGGESTIONS.length));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Warn before leaving if there's a reading
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (draws && parsedReading) {
        e.preventDefault();
        e.returnValue = "You'll lose your reading if you leave. Are you sure?";
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draws, parsedReading]);

  // Spark: show random suggestion as placeholder
  const handleSpark = () => {
    const randomSuggestion = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
    setSparkPlaceholder(randomSuggestion);
  };

  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(shareUrl); alert('Link copied!'); }
    catch { prompt('Copy this link:', shareUrl); }
  };

  const performReadingWithDraws = async (drawsToUse, questionToUse = question) => {
    setLoading(true); setError(''); setParsedReading(null); setExpansions({}); setFollowUpMessages([]);
    const drawText = formatDrawForAI(drawsToUse, spreadType, spreadKey, false); // Never send traditional names to API
    const spreadName = spreadType === 'durable' ? DURABLE_SPREADS[spreadKey].name : `${RANDOM_SPREADS[spreadKey].name} Emergent`;
    const safeQuestion = sanitizeForAPI(questionToUse);

    const stancePrompt = buildStancePrompt(stance.complexity, stance.voice, stance.focus, stance.density, stance.scope, stance.seriousness);
    const letterTone = VOICE_LETTER_TONE[stance.voice];
    const systemPrompt = `${BASE_SYSTEM}\n\n${stancePrompt}\n\n${FORMAT_INSTRUCTIONS}\n\nLetter tone for this stance: ${letterTone}`;
    const userMessage = `QUESTION: "${safeQuestion}"\n\nTHE DRAW (${spreadName}):\n\n${drawText}\n\nRespond using the exact section markers: [SUMMARY], [CARD:1], [CARD:2], etc., [CORRECTION:N] for each imbalanced card (where N matches the card number — use [CORRECTION:3] for Card 3, [CORRECTION:5] for Card 5, etc.), [LETTER]. Each marker on its own line.`;

    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: userMessage }], system: systemPrompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Parse the structured response
      const parsed = parseReadingResponse(data.reading, drawsToUse);
      setParsedReading(parsed);
    } catch (e) { setError(`Error: ${e.message}`); }
    setLoading(false);
  };

  const performReading = async () => {
    const actualQuestion = question.trim() || (spreadType === 'forge' ? 'Forging intention' : 'General reading');
    setQuestion(actualQuestion);
    const isDurable = spreadType === 'durable';
    const isForge = spreadType === 'forge';
    // Forge mode always draws 1 card
    const count = isForge ? 1 : (isDurable ? DURABLE_SPREADS[spreadKey].count : RANDOM_SPREADS[spreadKey].count);
    const newDraws = generateSpread(count, isDurable);
    setDraws(newDraws);
    await performReadingWithDraws(newDraws, actualQuestion);
  };

  // Generate a single random draw for thread continuation
  const generateSingleDraw = () => {
    const transientPool = shuffleArray([...Array(78).keys()]);
    const statusArr = new Uint32Array(1);
    crypto.getRandomValues(statusArr);
    return {
      position: Math.floor(Math.random() * 22), // Random position
      transient: transientPool[0],
      status: (statusArr[0] % 4) + 1
    };
  };

  // Continue a thread with Reflect or Forge operation
  // REFLECT = dialogue (no new card) - engage with user's inquiry/question
  // FORGE = sub-reading (new card) - interpret new card against user's assertion
  const continueThread = async (threadKey) => {
    const operation = threadOperations[threadKey];
    if (!operation) return;

    const userInput = sanitizeForAPI(threadContexts[threadKey] || '');
    if (!userInput.trim()) {
      setError('Please enter your thoughts before continuing.');
      return;
    }

    // Handle different section types
    const isSummary = threadKey === 'summary';
    const isLetter = threadKey === 'letter';
    const isPath = threadKey === 'path';
    const isSection = isSummary || isLetter || isPath;
    let parentContent, parentLabel;

    if (isSummary) {
      if (!parsedReading?.summary) return;
      parentContent = parsedReading.summary;
      parentLabel = 'Overview';
    } else if (isLetter) {
      if (!parsedReading?.letter) return;
      parentContent = parsedReading.letter;
      parentLabel = 'Letter';
    } else if (isPath) {
      if (!parsedReading?.rebalancerSummary) return;
      parentContent = parsedReading.rebalancerSummary;
      parentLabel = 'Path to Balance';
    } else {
      const parentDraw = draws[threadKey];
      const parentCard = parsedReading.cards.find(c => c.index === threadKey);
      if (!parentDraw || !parentCard) return;
      const parentTrans = getComponent(parentDraw.transient);
      const parentStat = STATUSES[parentDraw.status];
      const parentStatusPrefix = parentStat.prefix || 'Balanced';
      parentLabel = `${parentStatusPrefix} ${parentTrans.name}`;
      parentContent = parentCard.content;
    }

    setThreadLoading(prev => ({ ...prev, [threadKey]: true }));

    // Get Overview context (always include for grounding)
    const overviewContext = parsedReading?.summary || '';
    const safeQuestion = sanitizeForAPI(question);
    const stancePrompt = buildStancePrompt(stance.complexity, stance.voice, stance.focus, stance.density, stance.scope, stance.seriousness);

    let systemPrompt, userMessage;

    // BOTH operations draw a new card - the difference is the framing
    const newDraw = generateSingleDraw();
    const newTrans = getComponent(newDraw.transient);
    const newStat = STATUSES[newDraw.status];
    const newStatusPrefix = newStat.prefix || 'Balanced';
    const newCardName = `${newStatusPrefix} ${newTrans.name}`;

    if (operation === 'reflect') {
      // REFLECT: User is INQUIRING - architecture responds to their QUESTION with a new card
      systemPrompt = `${BASE_SYSTEM}

${stancePrompt}

OPERATION: REFLECT (Inquiry/Question)
The user is asking a question, exploring, or seeking clarity about this reading.
A new card has been drawn as the architecture's RESPONSE to their inquiry.

Your job:
- Acknowledge their question briefly
- Interpret the NEW CARD as the architecture's answer to what they asked
- This is a SUB-READING: the drawn card speaks directly to their inquiry
- Be specific about how the new card addresses their question
- The card IS the architecture speaking back to them

Output structure:
1. Brief acknowledgment of their question (1-2 sentences)
2. "The architecture responds with [Card Name]..."
3. How this card answers or illuminates their inquiry (2-3 paragraphs)`;

      userMessage = `ORIGINAL QUESTION: "${safeQuestion}"

READING OVERVIEW:
${overviewContext}

SECTION BEING DISCUSSED: ${parentLabel}
${parentContent}

USER'S INQUIRY/QUESTION:
"${userInput}"

NEW CARD DRAWN IN RESPONSE: ${newCardName}
Traditional: ${newTrans.traditional}
${newTrans.description}
${newTrans.extended || ''}

Interpret this new card as the architecture's response to their question.`;

    } else {
      // FORGE: User is ASSERTING - architecture responds to their DECLARATION with a new card
      systemPrompt = `${BASE_SYSTEM}

${stancePrompt}

OPERATION: FORGE (Create/Assert)
The user has declared an intention or direction. They're not asking — they're stating what they're going to do or create from this reading.

A new card has been drawn as the architecture's RESPONSE to their declaration.

Your job:
- Acknowledge their declared direction briefly
- Interpret the NEW CARD as the architecture's response to their assertion
- This is a SUB-READING: what does this new card reveal about the path they've declared?
- The new card might affirm, complicate, deepen, or redirect their stated intention
- Be specific about how the new card speaks to what they said they're doing

Output structure:
1. Brief acknowledgment of their direction (1-2 sentences)
2. The new card's message in context of their declaration (2-3 paragraphs)`;

      userMessage = `ORIGINAL QUESTION: "${safeQuestion}"

READING OVERVIEW:
${overviewContext}

SECTION THEY'RE FORGING FROM: ${parentLabel}
${parentContent}

USER'S DECLARATION/ASSERTION:
"${userInput}"

NEW CARD DRAWN IN RESPONSE: ${newCardName}
Traditional: ${newTrans.traditional}
${newTrans.description}
${newTrans.extended || ''}

Interpret this new card as the architecture's response to their declared direction.`;
    }

    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          system: systemPrompt
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Add to thread
      const newThreadItem = {
        draw: newDraw, // both reflect and forge draw a new card
        interpretation: data.reading,
        operation: operation,
        context: userInput
      };

      setThreadData(prev => ({
        ...prev,
        [threadKey]: [...(prev[threadKey] || []), newThreadItem]
      }));

      // Clear the operation selection for next continuation
      setThreadOperations(prev => ({ ...prev, [threadKey]: null }));
      setThreadContexts(prev => ({ ...prev, [threadKey]: '' }));

    } catch (e) {
      setError(`Thread error: ${e.message}`);
    }

    setThreadLoading(prev => ({ ...prev, [threadKey]: false }));
  };

  // Continue a nested thread (from within a threaded card)
  // BOTH operations draw a new card - difference is inquiry vs assertion framing
  const continueNestedThread = async (cardIndex, threadKey, parentThreadItem) => {
    const operation = threadOperations[threadKey];
    if (!operation) return;

    const userInput = sanitizeForAPI(threadContexts[threadKey] || '');
    if (!userInput.trim()) {
      setError('Please enter your thoughts before continuing.');
      return;
    }

    setThreadLoading(prev => ({ ...prev, [threadKey]: true }));

    // Get parent card context
    const parentTrans = parentThreadItem.draw ? getComponent(parentThreadItem.draw.transient) : null;
    const parentStat = parentThreadItem.draw ? STATUSES[parentThreadItem.draw.status] : null;
    const parentStatusPrefix = parentTrans ? (parentStat.prefix || 'Balanced') : '';
    const parentCardName = parentTrans ? `${parentStatusPrefix} ${parentTrans.name}` : 'Previous Response';

    // Get Overview context
    const overviewContext = parsedReading?.summary || '';
    const safeQuestion = sanitizeForAPI(question);
    const stancePrompt = buildStancePrompt(stance.complexity, stance.voice, stance.focus, stance.density, stance.scope, stance.seriousness);

    let systemPrompt, userMessage;

    // BOTH operations draw a new card - the difference is the framing
    const newDraw = generateSingleDraw();
    const newTrans = getComponent(newDraw.transient);
    const newStat = STATUSES[newDraw.status];
    const newStatusPrefix = newStat.prefix || 'Balanced';
    const newCardName = `${newStatusPrefix} ${newTrans.name}`;

    if (operation === 'reflect') {
      // REFLECT: User is INQUIRING - architecture responds to their QUESTION with a new card
      systemPrompt = `${BASE_SYSTEM}

${stancePrompt}

OPERATION: REFLECT (Inquiry/Question)
The user is asking a question about the reading. A new card has been drawn as the architecture's response to their inquiry.

Your job:
- Acknowledge their question briefly
- Interpret the NEW CARD as the architecture's answer to what they asked
- This is a SUB-READING: the drawn card speaks directly to their inquiry
- The card IS the architecture speaking back to them`;

      userMessage = `ORIGINAL QUESTION: "${safeQuestion}"

READING OVERVIEW:
${overviewContext}

CARD BEING DISCUSSED: ${parentCardName}
${parentThreadItem.interpretation}

USER'S INQUIRY/QUESTION:
"${userInput}"

NEW CARD DRAWN IN RESPONSE: ${newCardName}
Traditional: ${newTrans.traditional}
${newTrans.description}
${newTrans.extended || ''}

Interpret this new card as the architecture's response to their question.`;

    } else {
      // FORGE: User is ASSERTING - architecture responds to their DECLARATION with a new card
      systemPrompt = `${BASE_SYSTEM}

${stancePrompt}

OPERATION: FORGE (Create/Assert)
The user has declared an intention. A new card has been drawn as the architecture's response.

Your job:
- Acknowledge their declared direction briefly
- Interpret the NEW CARD as the architecture's response to their assertion
- This is a SUB-READING of the new card against their declared direction`;

      userMessage = `ORIGINAL QUESTION: "${safeQuestion}"

READING OVERVIEW:
${overviewContext}

CARD THEY'RE FORGING FROM: ${parentCardName}
${parentThreadItem.interpretation}

USER'S DECLARATION/ASSERTION:
"${userInput}"

NEW CARD DRAWN IN RESPONSE: ${newCardName}
Traditional: ${newTrans.traditional}
${newTrans.description}
${newTrans.extended || ''}

Interpret this new card as the architecture's response to their declared direction.`;
    }

    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          system: systemPrompt
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Create new thread item
      const newThreadItem = {
        draw: newDraw, // both reflect and forge draw a new card
        interpretation: data.reading,
        operation: operation,
        context: userInput,
        children: []
      };

      // Helper to add child to the right parent in the tree
      const addChildToThread = (threads, targetKey, newChild, currentPath = '') => {
        return threads.map((item, idx) => {
          const itemKey = currentPath ? `${currentPath}.${idx}` : `${cardIndex}:${idx}`;
          if (itemKey === threadKey) {
            return {
              ...item,
              children: [...(item.children || []), newChild]
            };
          }
          if (item.children && item.children.length > 0) {
            return {
              ...item,
              children: addChildToThread(item.children, targetKey, newChild, itemKey)
            };
          }
          return item;
        });
      };

      setThreadData(prev => ({
        ...prev,
        [cardIndex]: addChildToThread(prev[cardIndex] || [], threadKey, newThreadItem)
      }));

      // Clear the operation selection
      setThreadOperations(prev => ({ ...prev, [threadKey]: null }));
      setThreadContexts(prev => ({ ...prev, [threadKey]: '' }));

    } catch (e) {
      setError(`Thread error: ${e.message}`);
    }

    setThreadLoading(prev => ({ ...prev, [threadKey]: false }));
  };

  const handleExpand = async (sectionKey, expansionType, remove = false) => {
    // If removing, just clear that expansion
    if (remove) {
      setExpansions(prev => {
        const newExp = { ...prev };
        if (newExp[sectionKey]) {
          const { [expansionType]: _, ...rest } = newExp[sectionKey];
          newExp[sectionKey] = rest;
          if (Object.keys(rest).length === 0) delete newExp[sectionKey];
        }
        return newExp;
      });
      return;
    }
    
    // If already has this expansion, toggle it off
    if (expansions[sectionKey]?.[expansionType]) {
      handleExpand(sectionKey, expansionType, true);
      return;
    }
    
    // Otherwise, fetch the expansion
    setExpanding({ section: sectionKey, type: expansionType });
    
    // Build context for the expansion request
    const drawText = formatDrawForAI(draws, spreadType, spreadKey, false); // Never send traditional names to API
    let sectionContent = '';
    let sectionContext = '';
    
    if (sectionKey === 'summary') {
      sectionContent = parsedReading.summary;
      sectionContext = 'the summary of the reading';
    } else if (sectionKey === 'letter') {
      sectionContent = parsedReading.letter;
      sectionContext = 'the closing letter';
    } else if (sectionKey.startsWith('card:')) {
      const cardIndex = parseInt(sectionKey.split(':')[1]);
      const cardSection = parsedReading.cards.find(c => c.index === cardIndex);
      const draw = draws[cardIndex];
      const trans = getComponent(draw.transient);
      sectionContent = cardSection?.content || '';
      sectionContext = `the reading for ${trans.name} (Signature ${cardIndex + 1})`;
    } else if (sectionKey.startsWith('correction:')) {
      const cardIndex = parseInt(sectionKey.split(':')[1]);
      const corrSection = parsedReading.corrections.find(c => c.cardIndex === cardIndex);
      const draw = draws[cardIndex];
      const trans = getComponent(draw.transient);
      sectionContent = corrSection?.content || '';
      sectionContext = `the correction path for ${trans.name} (Signature ${cardIndex + 1})`;
    } else if (sectionKey === 'path') {
      sectionContent = parsedReading.rebalancerSummary;
      sectionContext = 'the Path to Balance section (synthesis of all corrections)';
    }

    // Custom prompts for Path section
    let expansionPrompt;
    if (sectionKey === 'path') {
      const pathPrompts = {
        unpack: "Expand on the Path to Balance with more detail. Go deeper on the synthesis of these corrections and what they're pointing to together.",
        clarify: "Restate the Path to Balance in simpler, everyday language. Plain words, short sentences — make it completely accessible.",
        architecture: "Explain the geometric relationships between the corrections. Why do these specific corrections work together? Show the structural logic.",
        example: "Give concrete real-world examples of how to apply this guidance. Specific scenarios someone might encounter — make it tangible."
      };
      expansionPrompt = pathPrompts[expansionType];
    } else {
      expansionPrompt = EXPANSION_PROMPTS[expansionType].prompt;
    }
    
    // Pass the original stance to expansion
    const stancePrompt = buildStancePrompt(stance.complexity, stance.voice, stance.focus, stance.density, stance.scope, stance.seriousness);
    const systemPrompt = `${BASE_SYSTEM}\n\n${stancePrompt}\n\nYou are expanding on a specific section of a reading. Keep the same tone as the original reading. Be concise but thorough. Always connect your expansion back to the querent's specific question.`;
    const userMessage = `QUERENT'S QUESTION: "${question}"

THE DRAW:
${drawText}

SECTION BEING EXPANDED (${sectionContext}):
${sectionContent}

EXPANSION REQUEST:
${expansionPrompt}

Respond directly with the expanded content. No section markers needed. Keep it focused on this specific section AND relevant to their question: "${question}"`;

    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: userMessage }], system: systemPrompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setExpansions(prev => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] || {}),
          [expansionType]: data.reading
        }
      }));
    } catch (e) { 
      setError(`Expansion error: ${e.message}`); 
    }
    setExpanding(null);
  };

  const sendFollowUp = async () => {
    if (!followUp.trim() || !draws) return;
    setFollowUpLoading(true); setError('');
    const drawText = formatDrawForAI(draws, spreadType, spreadKey, false); // Never send traditional names to API
    
    // Build context from parsed reading
    let readingContext = '';
    if (parsedReading) {
      readingContext = `PREVIOUS READING:\n\nSummary: ${parsedReading.summary}\n\n`;
      parsedReading.cards.forEach((card, i) => {
        readingContext += `Signature ${card.index + 1}: ${card.content}\n\n`;
      });
      parsedReading.corrections.forEach(corr => {
        readingContext += `Correction ${corr.cardIndex + 1}: ${corr.content}\n\n`;
      });
    }
    
    // Pass stance to follow-up
    const stancePrompt = buildStancePrompt(stance.complexity, stance.voice, stance.focus, stance.density, stance.scope, stance.seriousness);
    const systemPrompt = `${BASE_SYSTEM}\n\n${stancePrompt}\n\nYou are continuing a conversation about a reading. Answer their follow-up question directly, referencing the reading context as needed. No section markers — just respond naturally.`;
    
    const messages = [
      ...followUpMessages,
      { role: 'user', content: followUp }
    ];
    
    const contextMessage = `THE DRAW:\n${drawText}\n\n${readingContext}\n\nFOLLOW-UP QUESTION: ${followUp}`;
    
    try {
      const res = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [{ role: 'user', content: contextMessage }], 
          system: systemPrompt 
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFollowUpMessages([...messages, { role: 'assistant', content: data.reading }]);
      setFollowUp('');
    } catch (e) { setError(`Error: ${e.message}`); }
    setFollowUpLoading(false);
  };

  const resetReading = () => {
    setDraws(null); setParsedReading(null); setExpansions({}); setFollowUpMessages([]);
    setQuestion(''); setFollowUp(''); setError(''); setFollowUpLoading(false);
    setShareUrl(''); setIsSharedReading(false); setShowArchitecture(false);
    setShowMidReadingStance(false);
    // Clear thread state
    setThreadData({}); setThreadOperations({}); setThreadContexts({}); setThreadLoading({}); setCollapsedThreads({});
    hasAutoInterpreted.current = false;
    window.history.replaceState({}, '', window.location.pathname);
  };

  const getCardHouse = (draw, index) => {
    if (spreadType === 'durable') {
      return DURABLE_SPREADS[spreadKey].frames[index].house;
    } else if (draw.position !== null) {
      return ARCHETYPES[draw.position]?.house || 'Gestalt';
    }
    return 'Gestalt';
  };

  // === CARD DISPLAY (simplified, visual only) ===
  const CardDisplay = ({ draw, index }) => {
    const isDurable = spreadType === 'durable';
    const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : RANDOM_SPREADS[spreadKey];
    const trans = getComponent(draw.transient);
    const stat = STATUSES[draw.status];
    const transArchetype = trans.archetype !== undefined ? ARCHETYPES[trans.archetype] : null;
    const isMajor = trans.type === "Archetype";
    const correction = getFullCorrection(draw.transient, draw.status);
    const correctionText = getCorrectionText(correction, trans, draw.status);
    const correctionTargetId = getCorrectionTargetId(correction, trans);
    
    const house = getCardHouse(draw, index);
    const houseColors = HOUSE_COLORS[house];
    
    const contextLabel = isDurable ? spreadConfig.frames[index].name : (draw.position !== null ? ARCHETYPES[draw.position]?.name : 'Draw');
    const contextSub = isDurable ? null : (draw.position !== null ? `Position ${draw.position}` : null);
    
    // Helper to open card info
    const openCardInfo = (cardId) => {
      setSelectedInfo({ type: 'card', id: cardId, data: getComponent(cardId) });
    };
    
    // Helper to open status info
    const openStatusInfo = (statusId) => {
      setSelectedInfo({ type: 'status', id: statusId, data: STATUS_INFO[statusId] });
    };
    
    // Helper to open channel info
    const openChannelInfo = (channelName) => {
      setSelectedInfo({ type: 'channel', id: channelName, data: CHANNELS[channelName] });
    };
    
    // Helper to open house info
    const openHouseInfo = (houseName) => {
      setSelectedInfo({ type: 'house', id: houseName, data: HOUSES[houseName] });
    };
    
    // Scroll to content section
    const scrollToContent = () => {
      document.getElementById(`content-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
      <div 
        id={`card-${index}`}
        className={`rounded-xl border-2 p-4 ${houseColors.border} ${houseColors.bg} transition-all cursor-pointer hover:border-opacity-80 group`}
        onClick={scrollToContent}
      >
        <div className="mb-3 flex justify-between items-start">
          <span 
            className={`text-xs px-2 py-1 rounded-full cursor-pointer hover:opacity-80 ${STATUS_COLORS[draw.status]}`}
            onClick={(e) => { e.stopPropagation(); openStatusInfo(draw.status); }}
          >
            {stat.name}
          </span>
          <span className="text-zinc-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">↓ read</span>
        </div>

        <div className="mb-3">
          <div 
            className="text-xl text-zinc-100 font-semibold cursor-pointer hover:text-zinc-300 transition-colors"
            onClick={(e) => { e.stopPropagation(); openCardInfo(draw.transient); }}
            title="Click for details"
          >
            {trans.name}
            <span className="text-zinc-600 text-sm ml-1">ⓘ</span>
          </div>
          {isMajor && (
            <div className="mt-1">
              <span className="text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">Major</span>
            </div>
          )}
          {showTraditional && <div className="text-sm text-zinc-500 mt-1">{trans.traditional}</div>}
        </div>

        <div className="text-sm text-zinc-400 mb-3">
          in your <span 
            className={`font-medium cursor-pointer hover:underline decoration-dotted ${houseColors.text}`}
            onClick={(e) => { e.stopPropagation(); isDurable ? openHouseInfo(house) : openCardInfo(draw.position); }}
          >{contextLabel}</span>
          {contextSub && <span className="text-zinc-600 text-xs ml-1">({contextSub})</span>}
        </div>

        <div className="border-t border-zinc-700/30 pt-3 space-y-1">
          {trans.type === "Bound" && (
            <>
              <div className="text-sm">
                <span 
                  className={`cursor-pointer hover:underline decoration-dotted ${CHANNEL_COLORS[trans.channel]}`}
                  onClick={(e) => { e.stopPropagation(); openChannelInfo(trans.channel); }}
                >{trans.channel}</span>
                <span className="text-zinc-500"> Channel</span>
              </div>
              <div className="text-sm text-zinc-400">
                Expresses <span 
                  className="text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors"
                  onClick={(e) => { e.stopPropagation(); openCardInfo(trans.archetype); }}
                >{transArchetype?.name}</span>
              </div>
            </>
          )}
          {trans.type === "Agent" && (
            <>
              <div className="text-sm">
                <span className="text-zinc-300">{trans.role}</span>
                <span className="text-zinc-500"> of </span>
                <span 
                  className={`cursor-pointer hover:underline decoration-dotted ${CHANNEL_COLORS[trans.channel]}`}
                  onClick={(e) => { e.stopPropagation(); openChannelInfo(trans.channel); }}
                >{trans.channel}</span>
              </div>
              <div className="text-sm text-zinc-400">
                Embodies <span 
                  className="text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors"
                  onClick={(e) => { e.stopPropagation(); openCardInfo(trans.archetype); }}
                >{transArchetype?.name}</span>
              </div>
            </>
          )}
        </div>

        {correctionText && draw.status !== 1 && (
          <div className="border-t border-zinc-700/30 pt-3 mt-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Correction</div>
            <div className="text-sm text-zinc-300">
              → <span 
                className={correctionTargetId !== null ? "cursor-pointer hover:text-zinc-100 transition-colors" : ""}
                onClick={(e) => { e.stopPropagation(); correctionTargetId !== null && openCardInfo(correctionTargetId); }}
              >{correctionText}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get current stance label for display
  const getCurrentStanceLabel = () => {
    const preset = Object.entries(DELIVERY_PRESETS).find(([_, p]) =>
      p.complexity === stance.complexity &&
      p.voice === stance.voice && p.focus === stance.focus &&
      p.density === stance.density && p.scope === stance.scope
    );
    const complexityLabel = COMPLEXITY_OPTIONS[stance.complexity]?.label || stance.complexity;
    if (preset) return `${complexityLabel} • ${preset[1].name}`;
    return `${complexityLabel} • Custom`;
  };

  // Get current delivery preset (if any)
  const getCurrentDeliveryPreset = () => {
    return Object.entries(DELIVERY_PRESETS).find(([_, p]) =>
      p.complexity === stance.complexity &&
      p.seriousness === stance.seriousness &&
      p.voice === stance.voice && p.focus === stance.focus &&
      p.density === stance.density && p.scope === stance.scope
    );
  };

  // Apply a delivery preset
  const applyDeliveryPreset = (presetKey) => {
    const preset = DELIVERY_PRESETS[presetKey];
    if (preset) {
      setStance({
        complexity: preset.complexity,
        seriousness: preset.seriousness,
        voice: preset.voice,
        focus: preset.focus,
        density: preset.density,
        scope: preset.scope
      });
    }
  };

  // Navigation helpers for spectrum labels
  const spreadKeys = Object.keys(RANDOM_SPREADS);
  const stanceKeys = Object.keys(DELIVERY_PRESETS);

  const navigateSpread = (direction) => {
    if (spreadType !== 'random') return;
    const currentIndex = spreadKeys.indexOf(spreadKey);
    const newIndex = direction === 'left'
      ? Math.max(0, currentIndex - 1)
      : Math.min(spreadKeys.length - 1, currentIndex + 1);
    setSpreadKey(spreadKeys[newIndex]);
  };

  const navigateStance = (direction) => {
    const currentPreset = getCurrentDeliveryPreset();
    if (!currentPreset) return;
    const currentIndex = stanceKeys.indexOf(currentPreset[0]);
    const newIndex = direction === 'left'
      ? Math.max(0, currentIndex - 1)
      : Math.min(stanceKeys.length - 1, currentIndex + 1);
    applyDeliveryPreset(stanceKeys[newIndex]);
  };

  // Slugify text for filenames
  const slugify = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[\u2018\u2019\u201C\u201D]/g, '')  // Remove smart quotes
      .replace(/[\u2014\u2013]/g, '-')             // Em/en dash to hyphen
      .replace(/[^\w\s-]/g, '')                    // Remove special chars
      .replace(/\s+/g, '-')                        // Spaces to hyphens
      .replace(/-+/g, '-')                         // Collapse multiple hyphens
      .replace(/^-+|-+$/g, '')                     // Trim leading/trailing hyphens
      .substring(0, 40)                            // Limit to 40 chars
      .replace(/-+$/g, '');                        // Trim trailing hyphens again after truncation
  };

  // Generate smart export filename
  const generateExportFilename = (extension) => {
    const date = new Date().toISOString().split('T')[0];
    let slug = '';

    // Priority 1: Question if >10 chars
    if (question && question.trim().length > 10) {
      slug = slugify(question.trim());
    }
    // Priority 2: Summary/overview
    else if (parsedReading?.summary && parsedReading.summary.trim().length > 10) {
      slug = slugify(parsedReading.summary.trim());
    }
    // Priority 3: Fallback
    else {
      slug = 'reading';
    }

    return `nirmanakaya-${slug}-${date}.${extension}`;
  };

  // Export reading to markdown
  const exportToMarkdown = () => {
    if (!parsedReading || !draws) return;

    const spreadName = spreadType === 'durable'
      ? DURABLE_SPREADS[spreadKey]?.name
      : `${RANDOM_SPREADS[spreadKey]?.name} Emergent`;
    const isDurable = spreadType === 'durable';
    const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : null;

    let md = `# Nirmanakaya Reading\n\n`;
    md += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
    md += `## Question\n\n${question}\n\n`;
    md += `**Spread:** ${spreadName}  \n`;
    md += `**Stance:** ${getCurrentStanceLabel()}\n\n`;
    md += `---\n\n`;

    // Summary
    if (parsedReading.summary) {
      md += `## Summary\n\n${parsedReading.summary}\n\n`;
    }

    // Cards with corrections
    md += `## Signatures\n\n`;
    parsedReading.cards.forEach((card) => {
      const draw = draws[card.index];
      const trans = getComponent(draw.transient);
      const stat = STATUSES[draw.status];
      const correction = parsedReading.corrections.find(c => c.cardIndex === card.index);

      const context = isDurable && spreadConfig
        ? spreadConfig.frames[card.index]?.name
        : `Position ${card.index + 1}`;
      const statusPhrase = stat.prefix ? `${stat.prefix} ${trans.name}` : `Balanced ${trans.name}`;

      md += `### Signature ${card.index + 1} — ${context}\n\n`;
      md += `**${statusPhrase}** (${trans.traditional})  \n`;
      md += `*Status: ${stat.name}*\n\n`;

      // Architecture details
      if (trans.type === 'Archetype') {
        md += `> **House:** ${trans.house}`;
        if (trans.channel) md += ` | **Channel:** ${trans.channel}`;
        md += `\n\n`;
      } else if (trans.type === 'Bound') {
        const assocArchetype = ARCHETYPES[trans.archetype];
        md += `> **Channel:** ${trans.channel} | **Associated Archetype:** ${assocArchetype?.name} (${assocArchetype?.traditional})\n\n`;
      } else if (trans.type === 'Agent') {
        const assocArchetype = ARCHETYPES[trans.archetype];
        md += `> **Role:** ${trans.role} | **Channel:** ${trans.channel} | **Associated Archetype:** ${assocArchetype?.name} (${assocArchetype?.traditional})\n\n`;
      }

      md += `${card.content}\n\n`;

      if (correction) {
        const fullCorr = getFullCorrection(draw.transient, draw.status);
        const corrText = getCorrectionText(fullCorr, trans, draw.status);
        md += `#### Correction: ${corrText || 'See below'}\n\n`;
        md += `${correction.content}\n\n`;
      }
    });

    // Rebalancer Summary
    if (parsedReading.rebalancerSummary) {
      md += `---\n\n## ◈ Path to Balance\n\n${parsedReading.rebalancerSummary}\n\n`;
    }

    // Letter
    if (parsedReading.letter) {
      md += `---\n\n## Letter\n\n${parsedReading.letter}\n\n`;
    }

    md += `---\n\n*Generated by Nirmanakaya Consciousness Architecture Reader*\n`;

    // Download
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateExportFilename('md');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export reading to HTML
  const exportToHTML = () => {
    if (!parsedReading || !draws) return;

    const spreadName = spreadType === 'durable'
      ? `Reflect • ${DURABLE_SPREADS[spreadKey]?.name}`
      : `Discover • ${RANDOM_SPREADS[spreadKey]?.name}`;
    const isDurable = spreadType === 'durable';
    const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : null;

    const escapeHtml = (text) => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');

    let signaturesHtml = '';
    parsedReading.cards.forEach((card) => {
      const draw = draws[card.index];
      const trans = getComponent(draw.transient);
      const stat = STATUSES[draw.status];
      const correction = parsedReading.corrections.find(c => c.cardIndex === card.index);
      const context = isDurable && spreadConfig ? spreadConfig.frames[card.index]?.name : `Position ${card.index + 1}`;
      const statusPhrase = stat.prefix ? `${stat.prefix} ${trans.name}` : `Balanced ${trans.name}`;

      let archDetails = '';
      if (trans.type === 'Archetype') {
        archDetails = `<div class="arch-details">House: ${trans.house}${trans.channel ? ` • Channel: ${trans.channel}` : ''}</div>`;
      } else if (trans.type === 'Bound') {
        const assoc = ARCHETYPES[trans.archetype];
        archDetails = `<div class="arch-details">Channel: ${trans.channel} • Associated: ${assoc?.name}</div>`;
      } else if (trans.type === 'Agent') {
        const assoc = ARCHETYPES[trans.archetype];
        archDetails = `<div class="arch-details">Role: ${trans.role} • Channel: ${trans.channel} • Associated: ${assoc?.name}</div>`;
      }

      let correctionHtml = '';
      if (correction) {
        const fullCorr = getFullCorrection(draw.transient, draw.status);
        const corrText = getCorrectionText(fullCorr, trans, draw.status);
        correctionHtml = `
          <div class="rebalancer">
            <span class="rebalancer-badge">Rebalancer</span>
            <div class="rebalancer-header">${trans.name} → ${corrText || ''}</div>
            <div class="rebalancer-content">${escapeHtml(correction.content)}</div>
          </div>`;
      }

      // Render thread items recursively
      const renderThreadItem = (item, depth = 0) => {
        const itemTrans = getComponent(item.draw.transient);
        const itemStat = STATUSES[item.draw.status];
        const itemStatusPrefix = itemStat.prefix || 'Balanced';
        const opLabel = item.operation === 'reflect' ? 'Reflecting' : 'Forging';
        const opClass = item.operation === 'reflect' ? 'thread-reflect' : 'thread-forge';

        let childrenHtml = '';
        if (item.children && item.children.length > 0) {
          childrenHtml = item.children.map(child => renderThreadItem(child, depth + 1)).join('');
        }

        return `
          <div class="thread-item ${opClass}">
            <div class="thread-label">↳ ${opLabel}${item.context ? `: "${escapeHtml(item.context)}"` : ''}</div>
            <div class="thread-card">
              <div class="thread-header">
                <span class="signature-status status-${itemStat.name.toLowerCase().replace(' ', '-')}">${itemStat.name}</span>
                <span class="thread-name">${itemStatusPrefix} ${itemTrans.name}</span>
              </div>
              <div class="thread-content">${escapeHtml(item.interpretation)}</div>
            </div>
            ${childrenHtml}
          </div>`;
      };

      let threadsHtml = '';
      const cardThreads = threadData[card.index] || [];
      if (cardThreads.length > 0) {
        threadsHtml = `<div class="threads">${cardThreads.map(t => renderThreadItem(t)).join('')}</div>`;
      }

      signaturesHtml += `
        <div class="signature">
          <div class="signature-header">
            <div>
              <span class="signature-badge">Reading</span>
              <span class="signature-title">Signature ${card.index + 1} — ${context}</span>
            </div>
            <span class="signature-status status-${stat.name.toLowerCase().replace(' ', '-')}">${stat.name}</span>
          </div>
          <div class="signature-name">${statusPhrase}</div>
          ${archDetails}
          <div class="signature-content">${escapeHtml(card.content)}</div>
          ${correctionHtml}
          ${threadsHtml}
        </div>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nirmanakaya Reading - ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #18181b; color: #e4e4e7; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { font-weight: 200; letter-spacing: 0.2em; text-align: center; margin-bottom: 0.5rem; color: #fafafa; }
    .subtitle { text-align: center; color: #52525b; font-size: 0.75rem; margin-bottom: 2rem; }
    .meta { text-align: center; color: #71717a; font-size: 0.875rem; margin-bottom: 2rem; }
    .question-box { background: #27272a; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 2rem; }
    .question-label { color: #71717a; font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
    .question-text { color: #d4d4d8; }
    .section { margin-bottom: 2rem; }
    .section-title { color: #71717a; font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; border-bottom: 1px solid #3f3f46; padding-bottom: 0.5rem; }
    .summary-box { background: linear-gradient(to bottom right, rgba(69, 26, 3, 0.4), rgba(120, 53, 15, 0.2)); border: 2px solid rgba(245, 158, 11, 0.5); border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1rem; }
    .summary-badge { display: inline-block; background: rgba(245, 158, 11, 0.3); color: #f59e0b; font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 1rem; margin-bottom: 0.75rem; }
    .summary { color: #fef3c7; }
    .signature { background: rgba(8, 51, 68, 0.3); border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1rem; border: 2px solid rgba(6, 182, 212, 0.5); }
    .signature-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .signature-badge { display: inline-block; background: rgba(8, 51, 68, 0.5); color: #22d3ee; font-size: 0.625rem; padding: 0.2rem 0.5rem; border-radius: 1rem; margin-right: 0.5rem; vertical-align: middle; }
    .signature-title { color: #fafafa; font-weight: 500; }
    .signature-status { font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 1rem; }
    .status-balanced { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .status-too-much { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .status-too-little { background: rgba(14, 165, 233, 0.2); color: #38bdf8; }
    .status-unacknowledged { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
    .signature-name { color: #22d3ee; margin-bottom: 0.5rem; }
    .traditional { color: #71717a; }
    .arch-details { color: #a1a1aa; font-size: 0.75rem; margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(39, 39, 42, 0.5); border-radius: 0.5rem; }
    .signature-content { color: #d4d4d8; font-size: 0.875rem; line-height: 1.6; }
    .rebalancer { margin-top: 1rem; padding: 1rem; background: rgba(2, 44, 34, 0.3); border: 2px solid rgba(16, 185, 129, 0.5); border-radius: 0.5rem; margin-left: 1rem; }
    .rebalancer-badge { display: inline-block; background: rgba(16, 185, 129, 0.3); color: #6ee7b7; font-size: 0.625rem; padding: 0.2rem 0.5rem; border-radius: 1rem; margin-bottom: 0.5rem; }
    .rebalancer-header { color: #34d399; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
    .rebalancer-content { color: #a7f3d0; font-size: 0.875rem; line-height: 1.6; }
    .path-box { background: linear-gradient(to bottom right, rgba(6, 78, 59, 0.3), rgba(16, 185, 129, 0.15)); border: 2px solid rgba(16, 185, 129, 0.6); border-radius: 0.75rem; padding: 1.5rem; }
    .path-badge { display: inline-block; color: #34d399; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem; letter-spacing: 0.05em; }
    .path-content { color: #d4d4d8; line-height: 1.6; white-space: pre-wrap; }
    .letter-box { background: rgba(46, 16, 101, 0.3); border: 2px solid rgba(139, 92, 246, 0.5); border-radius: 0.75rem; padding: 1.5rem; }
    .letter-badge { display: inline-block; background: rgba(139, 92, 246, 0.3); color: #c4b5fd; font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 1rem; margin-bottom: 0.75rem; }
    .letter { color: #ddd6fe; font-style: italic; line-height: 1.6; }
    .footer { text-align: center; color: #3f3f46; font-size: 0.625rem; margin-top: 3rem; letter-spacing: 0.1em; }
    .threads { margin-top: 1rem; }
    .thread-item { margin-left: 1rem; border-left: 2px solid #3f3f46; padding-left: 1rem; margin-top: 0.75rem; }
    .thread-label { font-size: 0.75rem; margin-bottom: 0.5rem; }
    .thread-reflect .thread-label { color: #38bdf8; }
    .thread-forge .thread-label { color: #fb923c; }
    .thread-card { padding: 1rem; border-radius: 0.5rem; }
    .thread-reflect .thread-card { background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); }
    .thread-forge .thread-card { background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); }
    .thread-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .thread-name { color: #e4e4e7; font-weight: 500; }
    .thread-content { color: #d4d4d8; font-size: 0.875rem; line-height: 1.6; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>NIRMANAKAYA</h1>
  <p class="subtitle">Consciousness Architecture Reader</p>
  <p class="meta">${spreadName} • ${getCurrentStanceLabel()} • ${new Date().toLocaleDateString()}</p>

  <div class="question-box">
    <div class="question-label">Your Question or Intention</div>
    <div class="question-text">${escapeHtml(question || 'General reading')}</div>
  </div>

  ${parsedReading.summary ? `
  <div class="section">
    <div class="summary-box">
      <span class="summary-badge">Overview</span>
      <div class="summary">${escapeHtml(parsedReading.summary)}</div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Signatures</div>
    ${signaturesHtml}
  </div>

  ${parsedReading.rebalancerSummary ? `
  <div class="section">
    <div class="path-box">
      <span class="path-badge">◈ Path to Balance</span>
      <div class="path-content">${escapeHtml(parsedReading.rebalancerSummary)}</div>
    </div>
  </div>` : ''}

  ${parsedReading.letter ? `
  <div class="section">
    <div class="letter-box">
      <span class="letter-badge">Letter</span>
      <div class="letter">${escapeHtml(parsedReading.letter)}</div>
    </div>
  </div>` : ''}

  <p class="footer">Generated by Nirmanakaya Consciousness Architecture Reader</p>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateExportFilename('html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 mobile-container">
        
        {/* Header */}
        <div className="text-center mb-4 md:mb-6 mobile-header relative">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-[20px] sm:text-2xl md:text-3xl font-extralight tracking-[0.2em] sm:tracking-[0.3em] mb-1 text-zinc-100">NIRMANAKAYA</h1>
            {!draws && (
              <button
                onClick={() => setHelpPopover(helpPopover === 'intro' ? null : 'intro')}
                className="w-6 h-6 sm:w-5 sm:h-5 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-xs flex items-center justify-center transition-all mb-1"
              >
                ?
              </button>
            )}
          </div>
          <p className="text-zinc-400 text-[11px] sm:text-xs tracking-wide">Consciousness Architecture Reader</p>
          <p className="text-zinc-500 text-[10px] mt-0.5">v0.32.3 alpha • Component Refactor</p>
          {helpPopover === 'intro' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-80 sm:w-96">
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
                <p className="text-zinc-300 text-sm leading-relaxed">
                  The Nirmanakaya is both mirror and forge. Bring a question or declare an intention —
                  the draw finds what's ready to be seen. Where you are, what's moving, what might need attention.
                </p>
                <button onClick={() => setHelpPopover(null)} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 w-full text-center">Got it</button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {!draws && (
          <>
            {/* Reading Configuration Box */}
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 sm:p-6 mb-6">
              {/* Spread Type Toggle */}
              <div className="flex justify-center mb-4 relative">
                <div className="inline-flex rounded-lg bg-zinc-900 p-1 mode-tabs-container">
                  <button onClick={() => { setSpreadType('durable'); setSpreadKey('arc'); }}
                    className={`mode-tab px-4 py-2 min-h-[44px] sm:min-h-0 rounded-md text-[15px] sm:text-sm font-medium sm:font-normal transition-all ${spreadType === 'durable' ? 'bg-[#2e1065] text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    Reflect
                  </button>
                  <button onClick={() => { setSpreadType('random'); setSpreadKey('three'); }}
                    className={`mode-tab px-4 py-2 min-h-[44px] sm:min-h-0 rounded-md text-[15px] sm:text-sm font-medium sm:font-normal transition-all ${spreadType === 'random' ? 'bg-[#2e1065] text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    Discover
                  </button>
                  <button onClick={() => { setSpreadType('forge'); setSpreadKey('one'); }}
                    className={`mode-tab px-4 py-2 min-h-[44px] sm:min-h-0 rounded-md text-[15px] sm:text-sm font-medium sm:font-normal transition-all ${spreadType === 'forge' ? 'bg-[#2e1065] text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    Forge
                  </button>
                </div>
                {/* Help icon positioned absolutely so it doesn't affect centering */}
                <button
                  onClick={() => setHelpPopover(helpPopover === 'spreadType' ? null : 'spreadType')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-5 sm:h-5 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-xs flex items-center justify-center transition-all"
                >
                  ?
                </button>
                {helpPopover === 'spreadType' && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-72 sm:w-80">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-zinc-200 font-medium">Reflect:</span>
                          <p className="text-zinc-400 text-xs mt-1">Structured mirror — examine specific areas. The energy is emergent, but it lands in life areas you choose.</p>
                        </div>
                        <div>
                          <span className="text-zinc-200 font-medium">Discover:</span>
                          <p className="text-zinc-400 text-xs mt-1">Open mirror — receive what shows up. Both the energy and where it's showing up emerge together.</p>
                        </div>
                        <div>
                          <span className="text-zinc-200 font-medium">Forge:</span>
                          <p className="text-zinc-400 text-xs mt-1">Active creation — declare an intention, draw one card, iterate through action.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setHelpPopover(null)}
                        className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 w-full text-center"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mode helper text */}
              <p className="text-center text-zinc-500 text-[12px] sm:text-xs mb-4">{MODE_HELPER_TEXT[spreadType]}</p>

              {/* Card Count Selector - fixed height to prevent layout shifts */}
              <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto card-count-selector h-[65px] sm:h-[45px]">
                {spreadType === 'forge' ? (
                  <div className="text-center text-zinc-400 text-[14px] sm:text-sm">
                    One card • Intention-first
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1.5 sm:gap-1.5 justify-center flex-wrap">
                      {spreadType === 'random' ? (
                        Object.entries(RANDOM_SPREADS).map(([key, value]) => (
                          <button key={key} onClick={() => setSpreadKey(key)}
                            className={`px-3 sm:px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-sm text-[14px] sm:text-sm font-medium sm:font-normal transition-all ${spreadKey === key ? 'bg-[#2e1065] text-amber-400' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'}`}>
                            {value.name}
                          </button>
                        ))
                      ) : (
                        Object.entries(DURABLE_SPREADS).map(([key, value]) => (
                          <button key={key} onClick={() => setSpreadKey(key)}
                            className={`px-3 sm:px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-sm text-[14px] sm:text-sm font-medium sm:font-normal transition-all ${spreadKey === key ? 'bg-[#2e1065] text-amber-400' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700'}`}>
                            {value.name}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Spectrum/description area - compact, close to buttons */}
              <div className="h-[20px] mb-3 mt-1 flex items-center justify-center">
                {spreadType === 'random' ? (
                  <div className="flex justify-between w-full max-w-xs text-[10px] sm:text-[9px] text-zinc-500">
                    <button
                      onClick={() => navigateSpread('left')}
                      className="hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      ← Focused
                    </button>
                    <button
                      onClick={() => navigateSpread('right')}
                      className="hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      Expansive →
                    </button>
                  </div>
                ) : spreadType === 'durable' && DURABLE_SPREADS[spreadKey] ? (
                  <p className="text-center text-zinc-500 text-[12px] sm:text-xs">{DURABLE_SPREADS[spreadKey].description}</p>
                ) : null}
              </div>

              {/* Stance Selector - same width as card count for alignment */}
              <div className="w-full max-w-lg mx-auto relative">
                <div className="relative flex items-center justify-center mb-3">
                  <span className="text-[12px] sm:text-xs text-zinc-400">Style</span>
                  <button
                    onClick={() => setHelpPopover(helpPopover === 'stanceLabel' ? null : 'stanceLabel')}
                    className="absolute right-0 w-7 h-7 sm:w-4 sm:h-4 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-xs sm:text-[10px] flex items-center justify-center transition-all"
                  >
                    ?
                  </button>
                </div>
                {helpPopover === 'stanceLabel' && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 w-72">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
                      <p className="text-zinc-400 text-xs leading-relaxed">
                        Stances shape how the reading speaks to you — from quick and direct to deep and expansive.
                      </p>
                      <button
                        onClick={() => setHelpPopover(null)}
                        className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 w-full text-center"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center stance-selector-mobile">
                  {/* All 5 stance presets on one row */}
                  <div className="flex gap-0.5 sm:gap-1.5 justify-center w-full px-0.5 sm:px-0">
                    {Object.entries(DELIVERY_PRESETS).map(([key, preset]) => {
                      const isActive = getCurrentDeliveryPreset()?.[0] === key;
                      // Shorter names for mobile
                      const mobileNames = { direct: "Direct", kind: "Kind", playful: "Playful", wise: "Wise", oracle: "Oracle" };
                      return (
                        <button
                          key={key}
                          onClick={() => applyDeliveryPreset(key)}
                          className={`flex-1 px-0.5 sm:px-2 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-sm text-[13px] sm:text-[11px] font-medium sm:font-normal transition-all text-center overflow-hidden ${
                            isActive
                              ? 'bg-[#2e1065] text-amber-400'
                              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700'
                          }`}
                        >
                          <span className="sm:hidden">{mobileNames[key]}</span>
                          <span className="hidden sm:inline">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Current stance selection descriptor */}
                  <div className="text-center text-[12px] sm:text-[10px] text-zinc-500 mt-1">
                    {getCurrentDeliveryPreset()?.[1]?.descriptor || 'Custom'}
                  </div>
                  {/* Config toggle - centered */}
                  <div className="flex justify-center w-full text-[11px] sm:text-[10px] text-zinc-400 mt-0.5">
                    <button
                      onClick={() => setShowLandingFineTune(!showLandingFineTune)}
                      className="hover:text-zinc-200 active:text-zinc-200 transition-colors flex items-center gap-0.5 py-2 sm:py-0 whitespace-nowrap"
                    >
                      <span>{showLandingFineTune ? '▾' : '▸'}</span>
                      <span>Config</span>
                    </button>
                  </div>
                </div>

                {/* Fine-tune panel */}
                {showLandingFineTune && (
                  <div className="mt-3 bg-zinc-900/50 rounded-xl p-3 sm:p-4 border border-zinc-800/50">
                    {/* Complexity Selector */}
                    <div className="mb-4">
                      <div className="text-xs text-zinc-500 mb-2 text-center">Speak to me like...</div>
                      {/* All 5 voice options on one row */}
                      <div className="flex gap-1 sm:gap-2 justify-center w-full px-1 sm:px-0">
                        {Object.entries(COMPLEXITY_OPTIONS).map(([key, opt]) => (
                            <button
                              key={key}
                              onClick={() => setStance({ ...stance, complexity: key })}
                              className={`flex-1 px-0.5 sm:px-2 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-sm text-[8px] sm:text-xs transition-all whitespace-nowrap text-center ${
                                stance.complexity === key
                                  ? 'bg-zinc-600 text-zinc-100 border border-zinc-500'
                                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 active:bg-zinc-700 border border-zinc-700/50'
                              }`}
                            >
                              {opt.label}
                            </button>
                        ))}
                      </div>
                      {/* Current voice selection descriptor */}
                      <div className="text-center text-[9px] sm:text-[10px] text-zinc-600 mt-1.5">
                        {COMPLEXITY_OPTIONS[stance.complexity]?.descriptor || ''}
                      </div>
                    </div>

                    {/* Seriousness/Tone Selector */}
                    <div className="mb-4">
                      <div className="text-xs text-zinc-500 mb-2 text-center">Tone</div>
                      <div className="flex gap-1 sm:gap-2 justify-center w-full px-1 sm:px-0">
                        {Object.entries(SERIOUSNESS_MODIFIERS).map(([key]) => (
                          <button
                            key={key}
                            onClick={() => setStance({ ...stance, seriousness: key })}
                            className={`flex-1 px-0.5 sm:px-2 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-sm text-[8px] sm:text-xs transition-all whitespace-nowrap text-center capitalize ${
                              stance.seriousness === key
                                ? 'bg-zinc-600 text-zinc-100 border border-zinc-500'
                                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 active:bg-zinc-700 border border-zinc-700/50'
                            }`}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stance Grid - only the 4x4 grid */}
                    <StanceSelector
                      stance={stance}
                      setStance={setStance}
                      showCustomize={true}
                      setShowCustomize={() => {}}
                      gridOnly={true}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Question Input Section */}
            <div className="relative mb-3 mt-4">
              {/* Prompt suggestions ABOVE the input - subtle inspiration */}
              <div className={`mb-2 transition-all duration-300 ${question.trim() ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={handleSpark}
                    className="w-6 h-6 rounded bg-[#2e1065] text-amber-400 hover:bg-[#3b1f6e] flex items-center justify-center text-[11px]"
                    title="Show a random suggestion"
                  >
                    ✨
                  </button>
                  {[0, 1].map((offset) => {
                    const idx = (suggestionIndex + offset) % SUGGESTIONS.length;
                    const suggestion = SUGGESTIONS[idx];
                    return (
                      <button
                        key={`${idx}-${suggestion.slice(0, 10)}`}
                        onClick={() => setQuestion(suggestion)}
                        className="text-[11px] sm:text-xs px-2 py-1 text-zinc-500 hover:text-zinc-300 truncate max-w-[150px] sm:max-w-[180px] transition-opacity duration-300"
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => { setQuestion(e.target.value); setSparkPlaceholder(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !loading && (e.preventDefault(), performReading())}
                  placeholder={sparkPlaceholder || (
                    spreadType === 'forge'
                      ? "What are you forging? Declare your intention..."
                      : spreadType === 'durable'
                        ? "What area of life are you examining?"
                        : "Name your question or declare your intent..."
                  )}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 pr-10 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none transition-colors text-[16px] sm:text-base min-h-[100px] sm:min-h-0"
                  rows={3}
                />
                <button
                  onClick={() => setHelpPopover(helpPopover === 'input' ? null : 'input')}
                  className="absolute top-3 right-3 w-6 h-6 sm:w-5 sm:h-5 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-[10px] flex items-center justify-center transition-all"
                >
                  ?
                </button>
              </div>
              {helpPopover === 'input' && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-72">
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
                    <p className="text-zinc-300 text-xs leading-relaxed">
                      Ask about anything — relationships, work, decisions, direction. Use a verb or question. The more specific you are, the more specific the reading will be.
                    </p>
                    <button
                      onClick={() => setHelpPopover(null)}
                      className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 w-full text-center"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}

              {/* Action button below input */}
              <div className="mt-3">
                <button
                  onClick={performReading}
                  disabled={loading}
                  className="w-full sm:w-auto sm:mx-auto sm:block px-8 py-3 min-h-[48px] bg-[#052e23] hover:bg-[#064e3b] disabled:bg-zinc-900 disabled:text-zinc-700 rounded-xl transition-all text-base text-[#f59e0b] font-medium border border-emerald-700/50"
                >
                  {loading ? 'Drawing...' : (spreadType === 'forge' ? 'Forge →' : spreadType === 'durable' ? 'Reflect →' : 'Discover →')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Loading */}
        {loading && !expanding && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-zinc-800 rounded-full"></div>
              <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-zinc-400 rounded-full animate-spin"></div>
            </div>
            <p
              className="mt-6 text-zinc-500 text-sm text-center max-w-xs transition-opacity duration-300"
              style={{ opacity: loadingPhraseVisible ? 1 : 0 }}
            >
              {loadingPhrases[loadingPhraseIndex] || ''}
            </p>
          </div>
        )}

        {/* Error */}
        {error && <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 my-4 text-red-400 text-sm">{error}</div>}

        {/* Signatures Display */}
        {draws && !loading && (() => {
          // Signatures default to EXPANDED (only true = collapsed)
          const isSignaturesCollapsed = collapsedSections['signatures'] === true;

          return (
            <div className="mb-6">
              {/* Metadata line ABOVE buttons */}
              <div className="text-center mb-3">
                <span className="text-xs text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                  {spreadType === 'durable' ? `Reflect • ${DURABLE_SPREADS[spreadKey]?.name}` : `Discover • ${RANDOM_SPREADS[spreadKey]?.name}`} • {getCurrentStanceLabel()}
                </span>
              </div>
              {/* Action buttons row */}
              <div className="flex justify-center gap-2 items-center relative mb-4">
                {parsedReading && !loading && (
                  <button onClick={exportToHTML} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded bg-zinc-800/50">Export</button>
                )}
                <button onClick={() => setShowTraditional(!showTraditional)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded bg-zinc-800/50">{showTraditional ? 'Hide Traditional' : 'Traditional'}</button>
                <button onClick={() => setShowArchitecture(!showArchitecture)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded bg-zinc-800/50">{showArchitecture ? 'Hide Architecture' : 'Architecture'}</button>
                <button onClick={resetReading} className="text-xs text-[#f59e0b] hover:text-yellow-300 transition-colors px-2 py-1 rounded bg-[#052e23] hover:bg-[#064e3b] border border-emerald-700/50">New</button>
                <button
                  onClick={() => setHelpPopover(helpPopover === 'actions' ? null : 'actions')}
                  className="w-4 h-4 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-[10px] flex items-center justify-center transition-all"
                >
                  ?
                </button>
                {helpPopover === 'actions' && (
                  <div className="absolute top-full right-0 mt-2 z-50 w-64">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-xl text-xs">
                      <div className="space-y-1.5 text-zinc-400">
                        <p><span className="text-zinc-200">Export</span> — Download as HTML file</p>
                        <p><span className="text-zinc-200">Traditional</span> — Toggle traditional tarot names</p>
                        <p><span className="text-zinc-200">Architecture</span> — Show architectural details</p>
                        <p><span className="text-zinc-200">New</span> — Start a fresh reading</p>
                      </div>
                      <button onClick={() => setHelpPopover(null)} className="mt-2 text-zinc-500 hover:text-zinc-300 w-full text-center">Got it</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Signatures Section */}
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden">
                {/* Signatures Header - clickable */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => toggleCollapse('signatures', false)}
                >
                  <span className={`text-xs transition-transform duration-200 ${isSignaturesCollapsed ? 'text-red-500' : 'text-emerald-500'}`} style={{ transform: isSignaturesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                    ▼
                  </span>
                  <span className="text-sm font-medium text-zinc-400">
                    Signatures ({draws.length} {draws.length === 1 ? 'card' : 'cards'})
                  </span>
                </div>

                {/* Signatures Grid - collapsible */}
                {!isSignaturesCollapsed && (
                  <div className="p-4 pt-0">
                    <div className={`grid gap-4 ${
                      draws.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                      draws.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                      draws.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                      'grid-cols-1 sm:grid-cols-3 lg:grid-cols-5'
                    }`}>
                      {draws.map((draw, i) => <CardDisplay key={i} draw={draw} index={i} />)}
                    </div>
                  </div>
                )}
              </div>

            {/* Architecture Panel */}
            {showArchitecture && (
              <div className="mt-6 bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Architecture Details</div>
                
                <div className="space-y-4 mb-6">
                  {draws.map((draw, i) => {
                    const isDurable = spreadType === 'durable';
                    const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : RANDOM_SPREADS[spreadKey];
                    const trans = getComponent(draw.transient);
                    const stat = STATUSES[draw.status];
                    const pos = draw.position !== null ? ARCHETYPES[draw.position] : null;
                    const transArchetype = trans.archetype !== undefined ? ARCHETYPES[trans.archetype] : null;
                    const correction = getFullCorrection(draw.transient, draw.status);
                    const label = isDurable ? spreadConfig.frames[i].name : (pos?.name || 'Draw');
                    
                    return (
                      <div key={i} className="bg-zinc-800/30 rounded-lg p-3 text-sm">
                        <div className="text-zinc-300 font-medium mb-2">{label}</div>
                        
                        {pos && (
                          <div className="text-zinc-500 mb-2">
                            <span className="text-zinc-400">Position {draw.position}:</span> {pos.name} ({pos.traditional})
                            <br />
                            <span className="text-zinc-600">House: {pos.house} | Function: {pos.function}</span>
                          </div>
                        )}
                        
                        <div className="text-zinc-500 mb-2">
                          <span className="text-zinc-400">Transient:</span> {trans.name} ({trans.traditional})
                          {trans.type === "Bound" && (
                            <>
                              <br />
                              <span className="text-zinc-600">
                                {trans.channel} Channel | Number {trans.number} ({trans.number <= 5 ? 'Inner' : 'Outer'} Bound)
                                <br />
                                Associated Archetype: {transArchetype?.name} (Position {trans.archetype})
                              </span>
                            </>
                          )}
                          {trans.type === "Agent" && (
                            <>
                              <br />
                              <span className="text-zinc-600">
                                {trans.role} of {trans.channel}
                                <br />
                                Embodies: {transArchetype?.name} (Position {trans.archetype})
                              </span>
                            </>
                          )}
                          {trans.type === "Archetype" && (
                            <>
                              <br />
                              <span className="text-amber-400/70">Major Archetype as Transient — amplified significance</span>
                            </>
                          )}
                        </div>
                        
                        <div className="text-zinc-500">
                          <span className="text-zinc-400">Status:</span> {stat.name} ({stat.orientation})
                          {correction && draw.status !== 1 && (
                            <div className="mt-1 pl-3 border-l-2 border-zinc-700 text-zinc-600">
                              {trans.type === "Archetype" && (
                                <>
                                  {draw.status === 2 && <div>Diagonal correction: {draw.transient} ↔ {DIAGONAL_PAIRS[draw.transient]} (sum {draw.transient + DIAGONAL_PAIRS[draw.transient]}) → {ARCHETYPES[DIAGONAL_PAIRS[draw.transient]]?.name}</div>}
                                  {draw.status === 3 && <div>Vertical correction: {draw.transient} ↔ {VERTICAL_PAIRS[draw.transient]} (sum 20) → {ARCHETYPES[VERTICAL_PAIRS[draw.transient]]?.name}</div>}
                                  {draw.status === 4 && correction.targets && (
                                    <div>Reduction pair (digit sum {getDigitSum(draw.transient)}): {correction.targets.map(t => `${ARCHETYPES[t]?.name} (${t})`).join(', ')}</div>
                                  )}
                                </>
                              )}
                              {trans.type === "Bound" && correction.targetBound && (
                                <>
                                  <div>Number mirror: {correction.numberMirror} (11 - {trans.number} = {11 - trans.number})</div>
                                  <div>Channel cross ({stat.name}): {correction.channelCross}</div>
                                  <div>Target: {correction.targetBound.name} ({correction.targetBound.traditional})</div>
                                </>
                              )}
                              {trans.type === "Agent" && correction.target !== undefined && (
                                <>
                                  <div>Agent corrects through embodied Archetype ({transArchetype?.name}, position {trans.archetype})</div>
                                  {draw.status === 2 && <div>Diagonal: {trans.archetype} ↔ {DIAGONAL_PAIRS[trans.archetype]} → {ARCHETYPES[correction.target]?.name}</div>}
                                  {draw.status === 3 && <div>Vertical: {trans.archetype} ↔ {VERTICAL_PAIRS[trans.archetype]} → {ARCHETYPES[correction.target]?.name}</div>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {draws.length > 1 && (
                  <div className="border-t border-zinc-800/50 pt-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Relationships</div>
                    <div className="text-sm text-zinc-600 space-y-1">
                      {(() => {
                        const relationships = [];
                        const isDurable = spreadType === 'durable';
                        const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : null;
                        
                        const houseGroups = {};
                        draws.forEach((draw, i) => {
                          const house = isDurable ? spreadConfig.frames[i].house : (draw.position !== null ? ARCHETYPES[draw.position]?.house : null);
                          if (house) {
                            if (!houseGroups[house]) houseGroups[house] = [];
                            const label = isDurable ? spreadConfig.frames[i].name : ARCHETYPES[draw.position]?.name;
                            houseGroups[house].push(label);
                          }
                        });
                        Object.entries(houseGroups).forEach(([house, cards]) => {
                          if (cards.length > 1) {
                            relationships.push(`${house} House: ${cards.join(' & ')} share domain`);
                          }
                        });
                        
                        const channelGroups = {};
                        draws.forEach((draw, i) => {
                          const trans = getComponent(draw.transient);
                          if (trans.channel) {
                            if (!channelGroups[trans.channel]) channelGroups[trans.channel] = [];
                            const label = isDurable ? spreadConfig?.frames[i].name : (draw.position !== null ? ARCHETYPES[draw.position]?.name : `Signature ${i+1}`);
                            channelGroups[trans.channel].push({ label, trans: trans.name });
                          }
                        });
                        Object.entries(channelGroups).forEach(([channel, items]) => {
                          if (items.length > 1) {
                            relationships.push(`${channel} Channel: ${items.map(it => it.trans).join(' & ')} resonate`);
                          }
                        });
                        
                        draws.forEach((draw, i) => {
                          const correction = getFullCorrection(draw.transient, draw.status);
                          if (correction) {
                            const corrTarget = correction.target !== undefined ? correction.target : 
                                             correction.targetBound?.archetype;
                            if (corrTarget !== undefined) {
                              draws.forEach((otherDraw, j) => {
                                if (i !== j) {
                                  const otherTrans = getComponent(otherDraw.transient);
                                  if (otherDraw.transient === corrTarget || otherTrans.archetype === corrTarget) {
                                    const label1 = isDurable ? spreadConfig?.frames[i].name : ARCHETYPES[draw.position]?.name;
                                    const label2 = isDurable ? spreadConfig?.frames[j].name : ARCHETYPES[otherDraw.position]?.name;
                                    relationships.push(`${label1} correction points toward ${label2}`);
                                  }
                                }
                              });
                            }
                          }
                        });
                        
                        return relationships.length > 0 ? 
                          relationships.map((r, i) => <div key={i}>• {r}</div>) : 
                          <div className="text-zinc-700">No direct structural relationships detected</div>;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {/* Parsed Reading Sections */}
        {parsedReading && !loading && (
          <div className="space-y-2">
                        
            {/* Your Question */}
            <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 mx-8">
              <div className="text-[10px] text-zinc-500 tracking-wider mb-2">Your question or intention</div>
              <div className="text-zinc-300 text-sm">{question}</div>
            </div>
            
            {/* Summary Section - expanded by default, collapsible */}
            {parsedReading.summary && (() => {
              const isSummaryCollapsed = collapsedSections['summary'] === true; // expanded by default
              return (
                <ReadingSection
                  type="summary"
                  content={parsedReading.summary}
                  question={question}
                  expansions={expansions}
                  expanding={expanding}
                  onExpand={handleExpand}
                  showTraditional={showTraditional}
                  spreadType={spreadType}
                  spreadKey={spreadKey}
                  setSelectedInfo={setSelectedInfo}
                  isCollapsed={isSummaryCollapsed}
                  onToggleCollapse={() => toggleCollapse('summary', false)}
                  selectedOperation={threadOperations['summary'] || null}
                  onOperationSelect={(op) => setThreadOperations(prev => ({ ...prev, summary: op }))}
                  operationContext={threadContexts['summary'] || ''}
                  onContextChange={(ctx) => setThreadContexts(prev => ({ ...prev, summary: ctx }))}
                  onContinue={() => continueThread('summary')}
                  threadLoading={threadLoading['summary'] || false}
                  threadData={threadData['summary'] || []}
                />
              );
            })()}
            
            {/* Signature Sections with nested Rebalancers - collapsed by default */}
            {parsedReading.cards.map((card) => {
              const correction = parsedReading.corrections.find(c => c.cardIndex === card.index);
              const cardSectionKey = `card:${card.index}`;
              const corrSectionKey = `correction:${card.index}`;
              // Default: cards collapsed, corrections collapsed
              const isCardCollapsed = collapsedSections[cardSectionKey] !== false; // true by default
              const isCorrCollapsed = collapsedSections[corrSectionKey] !== false; // true by default
              return (
                <div key={`card-group-${card.index}`} id={`content-${card.index}`}>
                  <ReadingSection
                    type="card"
                    index={card.index}
                    content={card.content}
                    draw={draws[card.index]}
                    question={question}
                    expansions={expansions}
                    expanding={expanding}
                    onExpand={handleExpand}
                    showTraditional={showTraditional}
                    spreadType={spreadType}
                    spreadKey={spreadKey}
                    setSelectedInfo={setSelectedInfo}
                    onHeaderClick={() => {
                      // Expand signatures section if collapsed
                      if (collapsedSections['signatures'] === true) {
                        setCollapsedSections(prev => ({ ...prev, signatures: false }));
                      }
                      // Scroll to the card
                      setTimeout(() => {
                        document.getElementById(`card-${card.index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 50);
                    }}
                    correction={correction}
                    isCollapsed={isCardCollapsed}
                    onToggleCollapse={() => toggleCollapse(cardSectionKey, true)}
                    isCorrectionCollapsed={isCorrCollapsed}
                    onToggleCorrectionCollapse={() => toggleCollapse(corrSectionKey, true)}
                    // Thread props (Phase 2)
                    threadData={threadData[card.index] || []}
                    selectedOperation={threadOperations[card.index] || null}
                    onOperationSelect={(op) => setThreadOperations(prev => ({ ...prev, [card.index]: op }))}
                    operationContext={threadContexts[card.index] || ''}
                    onContextChange={(ctx) => setThreadContexts(prev => ({ ...prev, [card.index]: ctx }))}
                    onContinue={() => continueThread(card.index)}
                    threadLoading={threadLoading[card.index] || false}
                    // Nested thread props (Phase 2 polish)
                    threadOperations={threadOperations}
                    setThreadOperations={setThreadOperations}
                    threadContexts={threadContexts}
                    setThreadContexts={setThreadContexts}
                    threadLoadingMap={threadLoading}
                    onContinueThread={continueNestedThread}
                    collapsedThreads={collapsedThreads}
                    setCollapsedThreads={setCollapsedThreads}
                  />
                </div>
              );
            })}

            {/* Rebalancer Summary - Only when 2+ imbalanced, collapsed by default */}
            {parsedReading.rebalancerSummary && (() => {
              const pathExpansions = expansions['path'] || {};
              const isPathExpanding = expanding?.section === 'path';
              const isPathCollapsed = collapsedSections['path'] !== false; // true by default

              return (
                <div className="mb-6 rounded-xl border-2 border-emerald-500/60 overflow-hidden" style={{background: 'linear-gradient(to bottom right, rgba(6, 78, 59, 0.3), rgba(16, 185, 129, 0.15))'}}>
                  <div className="p-5">
                    {/* Path Header - clickable for collapse */}
                    <div
                      className={`flex items-center gap-3 cursor-pointer ${!isPathCollapsed ? 'mb-4' : ''}`}
                      onClick={() => toggleCollapse('path', true)}
                    >
                      <span className={`text-xs transition-transform duration-200 ${isPathCollapsed ? 'text-red-500' : 'text-emerald-500'}`} style={{ transform: isPathCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                        ▼
                      </span>
                      <span className="text-lg">◈</span>
                      <span className="text-sm font-medium text-emerald-400 uppercase tracking-wider">Path to Balance</span>
                    </div>

                    {/* Path Content - collapsible */}
                    {!isPathCollapsed && (
                      <>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm mb-4">
                          {parsedReading.rebalancerSummary}
                        </div>

                        {/* Path Expansion Buttons */}
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(EXPANSION_PROMPTS).map(([key, { label }]) => {
                            const isThisExpanding = isPathExpanding && expanding?.type === key;
                            const hasExpansion = !!pathExpansions[key];
                            const isExpandingOther = expanding && !isThisExpanding;

                            return (
                              <button
                                key={key}
                                onClick={(e) => { e.stopPropagation(); handleExpand('path', key); }}
                                disabled={expanding}
                                className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                  hasExpansion
                                    ? 'bg-emerald-800/50 text-emerald-200 border border-emerald-600/50'
                                    : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                } ${isExpandingOther ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {isThisExpanding && (
                                  <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></span>
                                )}
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Path Expansion Content */}
                        {Object.entries(pathExpansions).map(([expType, expContent]) => (
                          <div key={expType} className="mt-4 pt-4 border-t border-emerald-700/50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs uppercase tracking-wider text-emerald-500/70">
                                {EXPANSION_PROMPTS[expType]?.label}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpand('path', expType, true); }}
                                className="text-xs text-zinc-600 hover:text-zinc-400"
                              >
                                ×
                              </button>
                            </div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-400">
                              {expContent}
                            </div>
                          </div>
                        ))}

                        {/* Path Reflect/Forge Operations */}
                        <div className="border-t border-emerald-700/50 mt-5 pt-5">
                          {/* Collapsed state: show [▶ Reflect] [▶ Forge] on one line */}
                          {!threadOperations['path'] && (
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); setThreadOperations(prev => ({ ...prev, path: 'reflect' })); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600 flex items-center gap-1.5"
                              >
                                <span className="text-[10px] text-red-500">▶</span> Reflect
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setThreadOperations(prev => ({ ...prev, path: 'forge' })); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600 flex items-center gap-1.5"
                              >
                                <span className="text-[10px] text-red-500">▶</span> Forge
                              </button>
                            </div>
                          )}

                          {/* Expanded state: show full panel with selected operation */}
                          {threadOperations['path'] && (
                            <div className="max-w-xs mx-auto">
                              <div className="flex justify-center gap-4 mb-4">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setThreadOperations(prev => ({ ...prev, path: 'reflect' })); }}
                                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    threadOperations['path'] === 'reflect'
                                      ? 'bg-sky-900/60 text-sky-300 border-2 border-sky-500/60'
                                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                                  }`}
                                >
                                  <span className="text-[10px] text-green-500">▶</span> Reflect
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setThreadOperations(prev => ({ ...prev, path: 'forge' })); }}
                                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    threadOperations['path'] === 'forge'
                                      ? 'bg-orange-900/60 text-orange-300 border-2 border-orange-500/60'
                                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                                  }`}
                                >
                                  <span className="text-[10px] text-green-500">▶</span> Forge
                                </button>
                              </div>

                              {/* Context Input */}
                              <div className="mb-4">
                                <textarea
                                  value={threadContexts['path'] || ''}
                                  onChange={(e) => setThreadContexts(prev => ({ ...prev, path: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Add context (optional)..."
                                  rows={2}
                                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                                />
                              </div>

                              {/* Continue Button */}
                              <div className="flex justify-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); continueThread('path'); }}
                                  disabled={!threadOperations['path'] || threadLoading['path']}
                                  className={`w-full px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                    threadOperations['path'] && !threadLoading['path']
                                      ? 'bg-[#052e23] text-[#f59e0b] hover:bg-[#064e3b] border border-emerald-700/50'
                                      : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                                  }`}
                                >
                                  {threadLoading['path'] ? (
                                    <>
                                      <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></span>
                                      Drawing...
                                    </>
                                  ) : (
                                    'Continue'
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Thread Results for Path */}
                          {threadData['path'] && threadData['path'].length > 0 && (
                            <div className="mt-5 space-y-4">
                              {threadData['path'].map((threadItem, threadIndex) => {
                                const isReflect = threadItem.operation === 'reflect';
                                // Both Reflect and Forge draw new cards
                                const trans = getComponent(threadItem.draw.transient);
                                const stat = STATUSES[threadItem.draw.status];
                                const statusPrefix = stat.prefix || 'Balanced';
                                return (
                                  <div key={threadIndex} className={`rounded-lg p-4 ${isReflect ? 'border border-sky-500/30 bg-sky-950/20' : 'border border-orange-500/30 bg-orange-950/20'}`}>
                                    {/* Header with operation type */}
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${isReflect ? 'bg-sky-500/20 text-sky-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                        {isReflect ? '↩ Reflect' : '⚡ Forge'}
                                      </span>
                                    </div>
                                    {/* User's input quote */}
                                    {threadItem.context && (
                                      <div className={`text-xs italic mb-3 pl-3 border-l-2 ${isReflect ? 'border-sky-500/50 text-sky-300/70' : 'border-orange-500/50 text-orange-300/70'}`}>
                                        "{threadItem.context}"
                                      </div>
                                    )}
                                    {/* Card info - both Reflect and Forge draw cards, with clickable terms */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer hover:ring-1 hover:ring-white/30 ${STATUS_COLORS[threadItem.draw.status]}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedInfo({ type: 'status', id: threadItem.draw.status, data: STATUS_INFO[threadItem.draw.status] });
                                        }}
                                      >
                                        {stat.name}
                                      </span>
                                      <span className="text-sm font-medium text-zinc-200">
                                        <span
                                          className="cursor-pointer hover:underline decoration-dotted underline-offset-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedInfo({ type: 'status', id: threadItem.draw.status, data: STATUS_INFO[threadItem.draw.status] });
                                          }}
                                        >
                                          {statusPrefix}
                                        </span>
                                        {statusPrefix && ' '}
                                        <span
                                          className="cursor-pointer hover:underline decoration-dotted underline-offset-2 text-amber-300/90"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedInfo({ type: 'card', id: threadItem.draw.transient, data: getComponent(threadItem.draw.transient) });
                                          }}
                                        >
                                          {trans.name}
                                        </span>
                                      </span>
                                    </div>
                                    {showTraditional && trans && (
                                      <div className="text-xs text-zinc-500 mb-2">{trans.traditional}</div>
                                    )}
                                    {/* Response with hotlinks */}
                                    <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                                      {renderWithHotlinks(threadItem.interpretation, setSelectedInfo)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Letter Section - expanded by default, collapsible */}
            {parsedReading.letter && (() => {
              const isLetterCollapsed = collapsedSections['letter'] === true; // expanded by default
              return (
                <ReadingSection
                  type="letter"
                  content={parsedReading.letter}
                  question={question}
                  expansions={expansions}
                  expanding={expanding}
                  onExpand={handleExpand}
                  showTraditional={showTraditional}
                  spreadType={spreadType}
                  spreadKey={spreadKey}
                  setSelectedInfo={setSelectedInfo}
                  isCollapsed={isLetterCollapsed}
                  onToggleCollapse={() => toggleCollapse('letter', false)}
                  selectedOperation={threadOperations['letter'] || null}
                  onOperationSelect={(op) => setThreadOperations(prev => ({ ...prev, letter: op }))}
                  operationContext={threadContexts['letter'] || ''}
                  onContextChange={(ctx) => setThreadContexts(prev => ({ ...prev, letter: ctx }))}
                  onContinue={() => continueThread('letter')}
                  threadLoading={threadLoading['letter'] || false}
                  threadData={threadData['letter'] || []}
                />
              );
            })()}
            
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Follow-up Messages */}
        {followUpMessages.length > 0 && (
          <div className="space-y-4 mt-6">
            {followUpMessages.map((msg, i) => (
              <div key={i} className={`rounded-xl p-4 ${msg.role === 'user' ? 'bg-zinc-800/50 ml-8' : 'bg-zinc-900/50 border border-zinc-800/50'}`}>
                {msg.role === 'user' && <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Follow-up</div>}
                <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</div>
              </div>
            ))}
          </div>
        )}

        {/* Follow-up Input */}
        {parsedReading && !loading && (
          <div className="mt-6 pt-4 border-t border-zinc-800/50 relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-zinc-500 tracking-wider">Continue the conversation</span>
              <button
                onClick={() => setHelpPopover(helpPopover === 'followup' ? null : 'followup')}
                className="w-4 h-4 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-[10px] flex items-center justify-center transition-all"
              >
                ?
              </button>
              {helpPopover === 'followup' && (
                <div className="absolute top-8 left-0 z-50 w-72">
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-xl">
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      Ask anything — dig deeper, challenge it, ask about a specific part, or take the conversation wherever you need.
                    </p>
                    <button onClick={() => setHelpPopover(null)} className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 w-full text-center">Got it</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <input type="text" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !followUpLoading && sendFollowUp()}
                placeholder={followUpLoading ? "Thinking..." : "Ask a follow-up question..."}
                disabled={followUpLoading}
                className="flex-1 min-w-0 bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors text-sm disabled:opacity-50" />
              <button onClick={sendFollowUp} disabled={followUpLoading || !followUp.trim()}
                className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 border border-zinc-600 px-6 py-3 rounded-xl transition-all flex items-center justify-center min-w-[52px] text-zinc-200">
                {followUpLoading ? (
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin"></div>
                ) : '→'}
              </button>
            </div>
          </div>
        )}

        {/* Adjust Stance - at the bottom */}
        {parsedReading && !loading && (
          <div className="mt-6 relative">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMidReadingStance(!showMidReadingStance)}
                className={`flex-1 text-left px-4 py-3 rounded-xl transition-all ${
                  showMidReadingStance
                    ? 'bg-zinc-800/50 border border-zinc-700/50'
                    : 'bg-zinc-900/30 border border-zinc-800/30 hover:bg-zinc-900/50 hover:border-zinc-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-zinc-300">
                      {showMidReadingStance ? '▾' : '▸'} Adjust Stance
                    </span>
                    <span className="text-xs text-zinc-600 ml-2">
                      {getCurrentDeliveryPreset()?.[1]?.name || 'Custom'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {showMidReadingStance ? 'collapse' : 'change depth & style'}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setHelpPopover(helpPopover === 'stance' ? null : 'stance')}
                className="w-6 h-6 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-xs flex items-center justify-center transition-all flex-shrink-0"
              >
                ?
              </button>
            </div>
            {helpPopover === 'stance' && (
              <div className="absolute top-full right-0 mt-2 z-50 w-72">
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Stances shape how the reading speaks to you — from quick and direct to deep and expansive. Use Config to customize voice, focus, density, scope, and tone.
                  </p>
                  <button
                    onClick={() => setHelpPopover(null)}
                    className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 w-full text-center"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

            {showMidReadingStance && (
              <div className="mt-3 bg-zinc-900/30 rounded-xl border border-zinc-800/30 p-4">
                {/* Delivery Presets Row */}
                <div className="mb-4 w-full max-w-lg mx-auto">
                  <div className="flex flex-col items-center">
                    {/* All 5 stance buttons on one row - no wrap */}
                    <div className="flex gap-1.5 justify-center flex-nowrap">
                      {Object.entries(DELIVERY_PRESETS).map(([key, preset]) => {
                        const isActive = getCurrentDeliveryPreset()?.[0] === key;
                        return (
                          <button
                            key={key}
                            onClick={() => applyDeliveryPreset(key)}
                            className={`px-2 py-1.5 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                              isActive
                                ? 'bg-[#2e1065] text-amber-400'
                                : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                    {/* Config toggle - centered */}
                    <div className="flex justify-center w-full text-[10px] text-zinc-500 mt-1.5">
                      <button
                        onClick={() => setShowFineTune(!showFineTune)}
                        className="hover:text-zinc-300 transition-colors flex items-center gap-1"
                      >
                        <span>{showFineTune ? '▾' : '▸'}</span>
                        <span>Config</span>
                      </button>
                    </div>
                  </div>
                </div>

                {showFineTune && (
                    <div className="mt-3 space-y-3">
                      {/* Complexity Selector - centered */}
                      <div className="text-center">
                        <div className="text-[10px] text-zinc-500 mb-2">Speak to me like...</div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {Object.entries(COMPLEXITY_OPTIONS).map(([key, opt]) => (
                            <button
                              key={key}
                              onClick={() => setStance({ ...stance, complexity: key })}
                              className={`px-2 py-1 rounded text-xs transition-all ${
                                stance.complexity === key
                                  ? 'bg-zinc-700 text-zinc-100'
                                  : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Seriousness/Tone Selector */}
                      <div className="text-center">
                        <div className="text-[10px] text-zinc-500 mb-2">Tone</div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {Object.entries(SERIOUSNESS_MODIFIERS).map(([key]) => (
                            <button
                              key={key}
                              onClick={() => setStance({ ...stance, seriousness: key })}
                              className={`px-2 py-1 rounded text-xs transition-all capitalize ${
                                stance.seriousness === key
                                  ? 'bg-zinc-700 text-zinc-100'
                                  : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stance Grid */}
                      <StanceSelector
                        stance={stance}
                        setStance={setStance}
                        showCustomize={true}
                        setShowCustomize={() => {}}
                        compact={true}
                      />
                    </div>
                )}

                {/* Re-interpret Button */}
                <div className="mt-4 pt-3 border-t border-zinc-800/50">
                  <button
                    onClick={reinterpret}
                    className="w-full bg-[#052e23] hover:bg-[#064e3b] text-[#f59e0b] py-2 rounded-lg text-sm transition-colors border border-emerald-700/50"
                  >
                    Re-interpret with new settings
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-zinc-800 text-[10px] mt-8 tracking-wider">The structure is the authority. Encounter precedes understanding.</p>
      </div>

      {/* Info Modal */}
      <InfoModal info={selectedInfo} onClose={() => setSelectedInfo(null)} setSelectedInfo={setSelectedInfo} />
    </div>
  );
}
