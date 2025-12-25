// === READING SECTION COMPONENT ===
// Displays individual reading sections (summary, cards, letter) with expansions and threading

import { ARCHETYPES } from '../../lib/archetypes.js';
import { STATUSES, STATUS_INFO, STATUS_COLORS, CHANNELS, HOUSES, HOUSE_COLORS } from '../../lib/constants.js';
import { DURABLE_SPREADS } from '../../lib/spreads.js';
import { EXPANSION_PROMPTS } from '../../lib/prompts.js';
import { getComponent, getFullCorrection, getCorrectionText, getCorrectionTargetId } from '../../lib/corrections.js';
import { renderWithHotlinks } from '../../lib/hotlinks.js';
import ThreadedCard from './ThreadedCard.js';

const ReadingSection = ({
  type, // 'summary' | 'card' | 'letter'
  index, // card index (for card)
  content,
  draw, // the draw object (for card context)
  question, // the querent's question
  expansions,
  expanding,
  onExpand,
  showTraditional,
  spreadType,
  spreadKey,
  setSelectedInfo,
  onHeaderClick, // callback when header is clicked (for scroll navigation)
  correction, // nested correction object { content, cardIndex }
  isCollapsed, // whether section content is collapsed
  onToggleCollapse, // callback to toggle collapse
  isCorrectionCollapsed, // whether nested correction is collapsed
  onToggleCorrectionCollapse, // callback to toggle correction collapse
  // Thread props (Phase 2)
  threadData, // array of thread items for this card
  selectedOperation, // 'reflect' | 'forge' | null
  onOperationSelect, // callback to select operation
  operationContext, // context text for operation
  onContextChange, // callback for context change
  onContinue, // callback for Continue button
  threadLoading, // loading state for thread
  // Nested thread props (Phase 2 polish)
  threadOperations, // full map of thread operations
  setThreadOperations, // setter for thread operations
  threadContexts, // full map of thread contexts
  setThreadContexts, // setter for thread contexts
  threadLoadingMap, // full map of thread loading states
  onContinueThread, // callback for continuing any thread
  collapsedThreads, // map of collapsed thread states
  setCollapsedThreads, // setter for collapsed threads
}) => {
  const trans = draw ? getComponent(draw.transient) : null;
  const stat = draw ? STATUSES[draw.status] : null;
  const isDurable = spreadType === 'durable';
  const spreadConfig = isDurable ? DURABLE_SPREADS[spreadKey] : null;

  // Get position/frame label
  const posLabel = draw ? (isDurable
    ? spreadConfig?.frames[index]?.name
    : (draw.position !== null ? ARCHETYPES[draw.position]?.name : `Position ${index + 1}`)) : null;

  // Get house for coloring (for card/correction sections)
  const house = draw ? (isDurable
    ? spreadConfig?.frames[index]?.house
    : (draw.position !== null ? ARCHETYPES[draw.position]?.house : 'Gestalt')) : null;

  const houseColors = house ? HOUSE_COLORS[house] : null;

  // Helper to make terms clickable
  const ClickableTerm = ({ type: termType, id: termId, children, className = "" }) => (
    <span
      className={`cursor-pointer hover:underline decoration-dotted underline-offset-2 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        let data = null;
        if (termType === 'card') data = getComponent(termId);
        else if (termType === 'channel') data = CHANNELS[termId];
        else if (termType === 'status') data = STATUS_INFO[termId];
        else if (termType === 'house') data = HOUSES[termId];
        setSelectedInfo({ type: termType, id: termId, data });
      }}
    >
      {children}
    </span>
  );

  // Build section label with clickable terms
  const renderLabel = () => {
    if (type === 'summary') {
      return <span className="text-amber-300 font-medium">Overview</span>;
    } else if (type === 'card') {
      const statusPrefix = stat?.prefix || 'Balanced';
      return (
        <span className={houseColors?.text || 'text-zinc-300'}>
          <ClickableTerm type="status" id={draw.status} className={STATUS_COLORS[draw.status]?.split(' ')[0]}>
            {statusPrefix}
          </ClickableTerm>
          {' '}
          <ClickableTerm type="card" id={draw.transient}>{trans?.name}</ClickableTerm>
          {' in your '}
          <ClickableTerm type={isDurable ? "house" : "card"} id={isDurable ? house : draw.position}>
            {posLabel}
          </ClickableTerm>
        </span>
      );
    } else if (type === 'letter') {
      return <span className="text-zinc-400 italic">A Note for You</span>;
    }
    return null;
  };

  const sectionKey = type === 'summary' ? 'summary' : type === 'letter' ? 'letter' : `${type}:${index}`;
  const sectionExpansions = expansions[sectionKey] || {};
  const isExpanding = expanding?.section === sectionKey;

  // Determine section styling based on type
  const getSectionStyle = () => {
    if (type === 'summary') {
      return 'bg-gradient-to-br from-amber-950/40 to-amber-900/20 border-amber-500/50';
    } else if (type === 'letter') {
      return 'bg-violet-950/30 border-violet-500/50';
    } else if (houseColors) {
      return `${houseColors.bg} ${houseColors.border}`;
    }
    return 'bg-zinc-900/50 border-zinc-800/50';
  };

  const getBadgeStyle = () => {
    if (type === 'summary') return 'bg-amber-500/30 text-amber-300';
    if (type === 'letter') return 'bg-violet-500/30 text-violet-300';
    if (houseColors) return `${houseColors.bg} ${houseColors.text}`;
    return 'bg-zinc-800 text-zinc-400';
  };

  const getContentStyle = () => {
    if (type === 'letter') return 'text-violet-200/90 italic';
    if (type === 'summary') return 'text-amber-100/90';
    return 'text-zinc-300';
  };

  const getButtonStyle = (hasExpansion, isThisExpanding, isExpandingOther) => {
    return `text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
      hasExpansion
        ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
        : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
    } ${isExpandingOther ? 'opacity-50 cursor-not-allowed' : ''}`;
  };

  // Determine if this section is collapsible
  const isCollapsible = onToggleCollapse !== undefined;

  return (
    <div className={`rounded-xl border-2 p-4 mb-4 ${getSectionStyle()}`}>
      {/* Section Header */}
      <div
        className={`flex flex-col gap-1 ${!isCollapsed ? 'mb-3' : ''} ${isCollapsible ? 'cursor-pointer group' : ''}`}
        onClick={isCollapsible ? onToggleCollapse : undefined}
      >
        <div className="flex items-center gap-2">
          {/* Collapse chevron */}
          {isCollapsible && (
            <span className={`text-xs transition-transform duration-200 ${isCollapsed ? 'text-red-500' : 'text-emerald-500'}`} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${getBadgeStyle()}`}>
            {type === 'summary' ? 'Overview' : type === 'card' ? 'Reading' : 'Letter'}
          </span>
          <span className="text-sm font-medium">{renderLabel()}</span>
          {type === 'card' && onHeaderClick && (
            <span
              className="text-zinc-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-auto cursor-pointer hover:text-zinc-400"
              onClick={(e) => {
                e.stopPropagation();
                onHeaderClick();
              }}
            >↑ view card</span>
          )}
        </div>
        {type === 'card' && showTraditional && trans?.traditional && !isCollapsed && (
          <span className="text-xs text-zinc-500 ml-6">{trans.traditional}</span>
        )}
      </div>

      {/* Main Content - collapsible */}
      {!isCollapsed && (
        <div className={`leading-relaxed text-sm mb-4 whitespace-pre-wrap ${getContentStyle()}`}>
          {content}
        </div>
      )}

      {/* Expansion Buttons - only when not collapsed */}
      {!isCollapsed && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(EXPANSION_PROMPTS).map(([key, { label }]) => {
            const isThisExpanding = isExpanding && expanding?.type === key;
            const hasExpansion = !!sectionExpansions[key];
            const isExpandingOther = isExpanding && !isThisExpanding;

            return (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); onExpand(sectionKey, key); }}
                disabled={isExpanding}
                className={getButtonStyle(hasExpansion, isThisExpanding, isExpandingOther)}
              >
                {isThisExpanding && (
                  <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></span>
                )}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Reflect/Forge Operations for Overview and Letter sections - own row, centered */}
      {(type === 'summary' || type === 'letter') && onOperationSelect && !isCollapsed && (
        <div className="border-t border-zinc-700/50 mt-5 pt-5">
          {/* Collapsed state: show [▶ Reflect] [▶ Forge] on one line */}
          {!selectedOperation && (
            <div className="flex justify-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onOperationSelect('reflect'); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600 flex items-center gap-1.5"
              >
                <span className="text-[10px] text-red-500">▶</span> Reflect
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onOperationSelect('forge'); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600 flex items-center gap-1.5"
              >
                <span className="text-[10px] text-red-500">▶</span> Forge
              </button>
            </div>
          )}

          {/* Expanded state: show full panel with selected operation */}
          {selectedOperation && (
            <div className="max-w-xs mx-auto">
              <div className="flex justify-center gap-4 mb-4">
                <button
                  onClick={(e) => { e.stopPropagation(); onOperationSelect('reflect'); }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedOperation === 'reflect'
                      ? 'bg-sky-900/60 text-sky-300 border-2 border-sky-500/60'
                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  Reflect
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOperationSelect('forge'); }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedOperation === 'forge'
                      ? 'bg-orange-900/60 text-orange-300 border-2 border-orange-500/60'
                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  Forge
                </button>
              </div>

              {/* Context Input */}
              <div className="mb-4">
                <textarea
                  value={operationContext || ''}
                  onChange={(e) => onContextChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add context (optional)..."
                  rows={2}
                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                />
              </div>

              {/* Continue Button */}
              <div className="flex justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); onContinue(); }}
                  disabled={!selectedOperation || threadLoading}
                  className={`w-full px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    selectedOperation && !threadLoading
                      ? 'bg-[#052e23] text-[#f59e0b] hover:bg-[#064e3b] border border-emerald-700/50'
                      : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {threadLoading ? (
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

          {/* Thread Results for Summary/Letter */}
          {threadData && threadData.length > 0 && (
            <div className="mt-5 space-y-4">
              {threadData.map((threadItem, threadIndex) => {
                const isReflect = threadItem.operation === 'reflect';
                // Both Reflect and Forge draw new cards
                const threadTrans = getComponent(threadItem.draw.transient);
                const threadStat = STATUSES[threadItem.draw.status];
                const statusPrefix = threadStat.prefix || 'Balanced';
                return (
                  <div key={threadIndex} className={`rounded-lg p-4 ${isReflect ? 'border border-sky-500/30 bg-sky-950/20' : 'border border-orange-500/30 bg-orange-950/20'}`}>
                    {/* Header with operation type and user's input */}
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
                          setSelectedInfo?.({ type: 'status', id: threadItem.draw.status, data: STATUS_INFO[threadItem.draw.status] });
                        }}
                      >
                        {threadStat.name}
                      </span>
                      <span className="text-sm font-medium text-zinc-200">
                        <span
                          className="cursor-pointer hover:underline decoration-dotted underline-offset-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInfo?.({ type: 'status', id: threadItem.draw.status, data: STATUS_INFO[threadItem.draw.status] });
                          }}
                        >
                          {statusPrefix}
                        </span>
                        {statusPrefix && ' '}
                        <span
                          className="cursor-pointer hover:underline decoration-dotted underline-offset-2 text-amber-300/90"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInfo?.({ type: 'card', id: threadItem.draw.transient, data: getComponent(threadItem.draw.transient) });
                          }}
                        >
                          {threadTrans.name}
                        </span>
                      </span>
                    </div>
                    {showTraditional && threadTrans && (
                      <div className="text-xs text-zinc-500 mb-2">{threadTrans.traditional}</div>
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
      )}

      {/* Expansion Content - only when not collapsed */}
      {!isCollapsed && Object.entries(sectionExpansions).map(([expType, expContent]) => (
        <div key={expType} className="mt-4 pt-4 border-t border-zinc-700/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              {EXPANSION_PROMPTS[expType]?.label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onExpand(sectionKey, expType, true); }}
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

      {/* Nested Rebalancer (Correction) - only for card sections with corrections, and only when card is not collapsed */}
      {!isCollapsed && type === 'card' && correction && (() => {
        const fullCorr = getFullCorrection(draw.transient, draw.status);
        const corrText = getCorrectionText(fullCorr, trans, draw.status);
        const corrTargetId = getCorrectionTargetId(fullCorr, trans);
        const corrSectionKey = `correction:${index}`;
        const corrExpansions = expansions[corrSectionKey] || {};
        const isCorrExpanding = expanding?.section === corrSectionKey;
        const isCorrCollapsible = onToggleCorrectionCollapse !== undefined;

        return (
          <div className="mt-4 ml-4 rounded-lg border-2 border-emerald-500/50 bg-emerald-950/30 p-4">
            {/* Rebalancer Header - clickable for collapse */}
            <div
              className={`flex items-center gap-2 ${!isCorrectionCollapsed ? 'mb-3' : ''} ${isCorrCollapsible ? 'cursor-pointer' : ''}`}
              onClick={isCorrCollapsible ? (e) => { e.stopPropagation(); onToggleCorrectionCollapse(); } : undefined}
            >
              {/* Collapse chevron */}
              {isCorrCollapsible && (
                <span className={`text-xs transition-transform duration-200 ${isCorrectionCollapsed ? 'text-red-500' : 'text-emerald-500'}`} style={{ transform: isCorrectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300">
                Rebalancer
              </span>
              <span className="text-sm font-medium text-emerald-400">
                <span
                  className="cursor-pointer hover:underline decoration-dotted underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInfo({ type: 'card', id: draw.transient, data: trans });
                  }}
                >
                  {trans?.name}
                </span>
                {' → '}
                {corrTargetId !== null ? (
                  <span
                    className="cursor-pointer hover:underline decoration-dotted underline-offset-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const corrComponent = getComponent(corrTargetId);
                      setSelectedInfo({ type: 'card', id: corrTargetId, data: corrComponent });
                    }}
                  >
                    {corrText}
                  </span>
                ) : corrText}
              </span>
            </div>

            {/* Rebalancer Content - collapsible */}
            {!isCorrectionCollapsed && (
              <div className="leading-relaxed text-sm mb-4 whitespace-pre-wrap text-emerald-100/90">
                {correction.content}
              </div>
            )}

            {/* Rebalancer Expansion Buttons - only when not collapsed */}
            {!isCorrectionCollapsed && (
              <div className="flex gap-2 flex-wrap">
                {Object.entries(EXPANSION_PROMPTS).map(([key, { label }]) => {
                  const isThisExpanding = isCorrExpanding && expanding?.type === key;
                  const hasExpansion = !!corrExpansions[key];
                  const isExpandingOther = expanding && !isThisExpanding;

                  return (
                    <button
                      key={key}
                      onClick={(e) => { e.stopPropagation(); onExpand(corrSectionKey, key); }}
                      disabled={expanding}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        hasExpansion
                          ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
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
            )}

            {/* Rebalancer Expansion Content - only when not collapsed */}
            {!isCorrectionCollapsed && Object.entries(corrExpansions).map(([expType, expContent]) => (
              <div key={expType} className="mt-4 pt-4 border-t border-emerald-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    {EXPANSION_PROMPTS[expType]?.label}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onExpand(corrSectionKey, expType, true); }}
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
          </div>
        );
      })()}

      {/* Reflect/Forge Operations - Phase 2 (only for card sections, not collapsed) */}
      {!isCollapsed && type === 'card' && onOperationSelect && (
        <>
          {/* Separator */}
          <div className="border-t border-zinc-700/50 mt-5 pt-5">
            {/* Collapsed state: show [▶ Reflect] [▶ Forge] on one line */}
            {!selectedOperation && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onOperationSelect('reflect'); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600 flex items-center gap-1.5"
                >
                  <span className="text-[10px]">▶</span> Reflect
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOperationSelect('forge'); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600 flex items-center gap-1.5"
                >
                  <span className="text-[10px]">▶</span> Forge
                </button>
              </div>
            )}

            {/* Expanded state: show full panel with selected operation */}
            {selectedOperation && (
              <div className="max-w-xs mx-auto">
                <div className="flex justify-center gap-4 mb-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); onOperationSelect('reflect'); }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      selectedOperation === 'reflect'
                        ? 'bg-sky-900/60 text-sky-300 border-2 border-sky-500/60'
                        : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                    }`}
                  >
                    Reflect
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOperationSelect('forge'); }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      selectedOperation === 'forge'
                        ? 'bg-orange-900/60 text-orange-300 border-2 border-orange-500/60'
                        : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                    }`}
                  >
                    Forge
                  </button>
                </div>

                {/* Context Input */}
                <div className="mb-4">
                  <textarea
                    value={operationContext || ''}
                    onChange={(e) => onContextChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Add context (optional)..."
                    rows={2}
                    className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                  />
                </div>

                {/* Continue Button */}
                <div className="flex justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onContinue(); }}
                    disabled={!selectedOperation || threadLoading}
                    className={`w-full px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      selectedOperation && !threadLoading
                        ? 'bg-[#052e23] text-[#f59e0b] hover:bg-[#064e3b] border border-emerald-700/50'
                        : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    {threadLoading ? (
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
          </div>

          {/* Threaded Cards with recursive Reflect/Forge */}
          {threadData && threadData.length > 0 && (
            <div className="mt-5 space-y-4">
              {threadData.map((threadItem, threadIndex) => (
                <ThreadedCard
                  key={threadIndex}
                  threadItem={threadItem}
                  threadIndex={threadIndex}
                  cardIndex={index}
                  showTraditional={showTraditional}
                  threadOperations={threadOperations}
                  setThreadOperations={setThreadOperations}
                  threadContexts={threadContexts}
                  setThreadContexts={setThreadContexts}
                  threadLoading={threadLoadingMap}
                  onContinueThread={onContinueThread}
                  collapsedThreads={collapsedThreads}
                  setCollapsedThreads={setCollapsedThreads}
                  setSelectedInfo={setSelectedInfo}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReadingSection;
