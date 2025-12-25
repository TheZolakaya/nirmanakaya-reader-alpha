// === THREADED CARD COMPONENT ===
// Recursive component for nested thread cards with Reflect/Forge

import { STATUSES, STATUS_INFO, STATUS_COLORS } from '../../lib/constants.js';
import { getComponent } from '../../lib/corrections.js';
import { renderWithHotlinks } from '../../lib/hotlinks.js';

const ThreadedCard = ({
  threadItem,
  threadIndex,
  cardIndex,
  parentThreadPath = '', // e.g., "0.1.2" for nested threads
  showTraditional,
  threadOperations,
  setThreadOperations,
  threadContexts,
  setThreadContexts,
  threadLoading,
  onContinueThread,
  collapsedThreads,
  setCollapsedThreads,
  setSelectedInfo, // for hotlink popups
}) => {
  const isReflect = threadItem.operation === 'reflect';
  // Both Reflect and Forge draw new cards
  const threadTrans = getComponent(threadItem.draw.transient);
  const threadStat = STATUSES[threadItem.draw.status];
  const threadStatusPrefix = threadStat.prefix || 'Balanced';
  const operationLabel = isReflect ? 'Reflecting' : 'Forging';

  // Unique key for this thread node
  const threadKey = parentThreadPath ? `${parentThreadPath}.${threadIndex}` : `${cardIndex}:${threadIndex}`;
  const isCollapsed = collapsedThreads?.[threadKey] === true;
  const selectedOp = threadOperations?.[threadKey] || null;
  const contextText = threadContexts?.[threadKey] || '';
  const isLoading = threadLoading?.[threadKey] || false;

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setCollapsedThreads?.(prev => ({ ...prev, [threadKey]: !isCollapsed }));
  };

  const selectOperation = (op) => {
    setThreadOperations?.(prev => ({ ...prev, [threadKey]: op }));
  };

  const updateContext = (ctx) => {
    setThreadContexts?.(prev => ({ ...prev, [threadKey]: ctx }));
  };

  const handleContinue = () => {
    onContinueThread?.(cardIndex, threadKey, threadItem);
  };

  return (
    <div className="ml-4 border-l-2 border-zinc-700/50 pl-4">
      {/* Thread connector label with collapse toggle */}
      <div
        className={`text-xs mb-2 flex items-center gap-2 cursor-pointer ${isReflect ? 'text-sky-400' : 'text-orange-400'}`}
        onClick={toggleCollapse}
      >
        <span
          className={`transition-transform duration-200 ${isCollapsed ? 'text-red-500' : 'text-emerald-500'}`}
          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}
        >
          ▼
        </span>
        <span className="text-zinc-600">↳</span>
        <span>{operationLabel}{threadItem.context ? `: "${threadItem.context}"` : ''}</span>
      </div>

      {/* Nested card - collapsible */}
      {!isCollapsed && (
        <div className={`rounded-lg p-4 ${isReflect ? 'border border-sky-500/30 bg-sky-950/20' : 'border border-orange-500/30 bg-orange-950/20'}`}>
          {/* Card header - both Reflect and Forge draw new cards, with clickable terms */}
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
                {threadStatusPrefix}
              </span>
              {threadStatusPrefix && ' '}
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
          {showTraditional && (
            <div className="text-xs text-zinc-500 mb-2">{threadTrans.traditional}</div>
          )}

          {/* Interpretation with hotlinks */}
          <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap mb-4">
            {renderWithHotlinks(threadItem.interpretation, setSelectedInfo)}
          </div>

          {/* Nested Reflect/Forge buttons */}
          <div className="border-t border-zinc-700/30 pt-4">
            <div className="max-w-xs mx-auto">
              <div className="flex justify-center gap-3 mb-3">
                <button
                  onClick={(e) => { e.stopPropagation(); selectOperation('reflect'); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedOp === 'reflect'
                      ? 'bg-sky-900/60 text-sky-300 border-2 border-sky-500/60'
                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  Reflect
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); selectOperation('forge'); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedOp === 'forge'
                      ? 'bg-orange-900/60 text-orange-300 border-2 border-orange-500/60'
                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  Forge
                </button>
              </div>

              <textarea
                value={contextText}
                onChange={(e) => updateContext(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Add context (optional)..."
                rows={2}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors mb-3 resize-none"
              />

              <button
                onClick={(e) => { e.stopPropagation(); handleContinue(); }}
                disabled={!selectedOp || isLoading}
                className={`w-full px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                  selectedOp && !isLoading
                    ? 'bg-[#052e23] text-[#f59e0b] hover:bg-[#064e3b] border border-emerald-700/50'
                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
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

          {/* Recursive nested threads */}
          {threadItem.children && threadItem.children.length > 0 && (
            <div className="mt-4 space-y-3">
              {threadItem.children.map((childItem, childIndex) => (
                <ThreadedCard
                  key={childIndex}
                  threadItem={childItem}
                  threadIndex={childIndex}
                  cardIndex={cardIndex}
                  parentThreadPath={threadKey}
                  showTraditional={showTraditional}
                  threadOperations={threadOperations}
                  setThreadOperations={setThreadOperations}
                  threadContexts={threadContexts}
                  setThreadContexts={setThreadContexts}
                  threadLoading={threadLoading}
                  onContinueThread={onContinueThread}
                  collapsedThreads={collapsedThreads}
                  setCollapsedThreads={setCollapsedThreads}
                  setSelectedInfo={setSelectedInfo}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThreadedCard;
