// === STANCE SELECTOR COMPONENT ===
// UI for selecting and customizing reading stance/voice

import { STANCE_PRESETS } from '../../lib/voice.js';

const StanceSelector = ({ stance, setStance, showCustomize, setShowCustomize, compact = false, onReinterpret = null, gridOnly = false }) => {
  const applyPreset = (presetKey) => {
    const preset = STANCE_PRESETS[presetKey];
    setStance({
      ...stance, // Preserve complexity
      voice: preset.voice,
      focus: preset.focus,
      density: preset.density,
      scope: preset.scope
    });
  };

  const currentPreset = Object.entries(STANCE_PRESETS).find(([_, p]) =>
    p.voice === stance.voice && p.focus === stance.focus &&
    p.density === stance.density && p.scope === stance.scope
  );

  const DimensionRow = ({ label, dimension, options }) => (
    <div className="mb-2 sm:mb-2">
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] sm:grid-cols-[4rem_6rem_6rem_6rem_6rem] gap-1 sm:gap-2 items-center">
        <span className="text-[11px] sm:text-xs text-amber-600/80 font-medium">{label}</span>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => setStance({ ...stance, [dimension]: opt })}
            className={`py-2 sm:py-1.5 px-1 sm:px-0 rounded-sm text-[11px] sm:text-xs transition-all text-center min-h-[36px] sm:min-h-0 ${
              stance[dimension] === opt
                ? 'bg-zinc-700 text-white border border-zinc-500'
                : 'bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700'
            }`}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  // Stance dimension descriptions for display
  const DIMENSION_DESCRIPTIONS = {
    voice: { wonder: "Open & curious", warm: "Caring & relational", direct: "Precise & clear", grounded: "Solid & practical" },
    focus: { do: "Action-oriented", feel: "Emotionally attuned", see: "Insight-focused", build: "Structure-focused" },
    density: { luminous: "Layered & evocative", rich: "Full & expansive", clear: "Accessible & flowing", essential: "Minimal & bare" },
    scope: { resonant: "Widest patterns", patterned: "Recurring dynamics", connected: "Relational web", here: "Immediate focus" }
  };

  const getCurrentDescription = () => {
    return `${DIMENSION_DESCRIPTIONS.voice[stance.voice]} • ${DIMENSION_DESCRIPTIONS.focus[stance.focus]} • ${DIMENSION_DESCRIPTIONS.density[stance.density]} • ${DIMENSION_DESCRIPTIONS.scope[stance.scope]}`;
  };

  // Grid-only mode for landing page fine-tune (just the 4x4 grid)
  if (gridOnly) {
    return (
      <div className="space-y-2 max-w-xl mx-auto">
        <DimensionRow label="Voice" dimension="voice" options={['wonder', 'warm', 'direct', 'grounded']} />
        <DimensionRow label="Focus" dimension="focus" options={['do', 'feel', 'see', 'build']} />
        <DimensionRow label="Density" dimension="density" options={['luminous', 'rich', 'clear', 'essential']} />
        <DimensionRow label="Scope" dimension="scope" options={['resonant', 'patterned', 'connected', 'here']} />
      </div>
    );
  }

  // Compact mode for mid-reading stance changes
  if (compact) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50 mb-4 max-w-2xl mx-auto">
        {/* Current stance display */}
        <div className="mb-4 pb-3 border-b border-zinc-800/50 max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-300 font-medium">
              {currentPreset ? currentPreset[1].name : "Custom Stance"}
            </span>
            <div className="flex gap-2">
              {onReinterpret && (
                <button
                  onClick={onReinterpret}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-900/50 text-amber-400 hover:bg-amber-900/70 transition-all font-medium"
                >
                  Re-interpret ↻
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">{getCurrentDescription()}</p>
        </div>

        {/* Inline dimension controls */}
        <div className="space-y-2 max-w-xl mx-auto">
          <DimensionRow label="Voice" dimension="voice" options={['wonder', 'warm', 'direct', 'grounded']} />
          <DimensionRow label="Focus" dimension="focus" options={['do', 'feel', 'see', 'build']} />
          <DimensionRow label="Density" dimension="density" options={['luminous', 'rich', 'clear', 'essential']} />
          <DimensionRow label="Scope" dimension="scope" options={['resonant', 'patterned', 'connected', 'here']} />
        </div>
      </div>
    );
  }

  // Full mode for pre-reading selection
  return (
    <div className="flex flex-col items-center stance-selector-mobile">
      {/* Preset selector - single row with equal width buttons */}
      <div className="flex gap-0.5 sm:gap-1.5 justify-center w-full px-0.5 sm:px-0">
        {Object.entries(STANCE_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            title={preset.description}
            className={`flex-1 px-0.5 sm:px-2 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-sm text-[13px] sm:text-[11px] font-medium sm:font-normal transition-all text-center overflow-hidden ${
              currentPreset?.[0] === key
                ? 'bg-[#2e1065] text-amber-400'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700'
            }`}
          >
            <span className="sm:hidden">{preset.name}</span>
            <span className="hidden sm:inline">{preset.name}</span>
          </button>
        ))}
      </div>

      {/* Custom label */}
      <div className="text-center text-[12px] sm:text-[10px] text-zinc-500 mt-1">
        {currentPreset ? currentPreset[1].name : 'Custom'}
      </div>

      {/* Config toggle */}
      <div className="flex justify-center w-full text-[11px] sm:text-[10px] text-zinc-400 mt-0.5">
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className="hover:text-zinc-200 active:text-zinc-200 transition-colors flex items-center gap-0.5 py-2 sm:py-0 whitespace-nowrap"
        >
          <span>{showCustomize ? '▾' : '▸'}</span>
          <span>Config</span>
        </button>
      </div>

      {/* Custom sliders */}
      {showCustomize && (
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50 max-w-xl mx-auto mt-3 w-full">
          <DimensionRow label="Voice" dimension="voice" options={['wonder', 'warm', 'direct', 'grounded']} />
          <DimensionRow label="Focus" dimension="focus" options={['do', 'feel', 'see', 'build']} />
          <DimensionRow label="Density" dimension="density" options={['luminous', 'rich', 'clear', 'essential']} />
          <DimensionRow label="Scope" dimension="scope" options={['resonant', 'patterned', 'connected', 'here']} />
        </div>
      )}
    </div>
  );
};

export default StanceSelector;
