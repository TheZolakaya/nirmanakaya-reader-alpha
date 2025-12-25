// === STANCE SELECTOR COMPONENT ===
// UI for selecting and customizing reading stance/voice

import { useState } from 'react';
import { STANCE_PRESETS } from '../../lib/voice.js';

const StanceSelector = ({ stance, setStance, showCustomize, setShowCustomize, compact = false, onReinterpret = null, gridOnly = false }) => {
  const [showStanceHelp, setShowStanceHelp] = useState(false);

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
    <div className="mb-6 relative">
      {/* Header with help */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-zinc-500 text-xs tracking-wide">How should this land?</span>
        <button
          onClick={() => setShowStanceHelp(!showStanceHelp)}
          className="w-4 h-4 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/30 hover:text-[#f59e0b] text-[10px] flex items-center justify-center transition-all"
        >
          ?
        </button>
      </div>

      {showStanceHelp && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-72 sm:w-80">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
            <p className="text-zinc-400 text-xs leading-relaxed">
              Stance shapes the voice and depth of your reading — from quick and direct to layered and contemplative. The structure stays the same; the delivery adapts to you.
            </p>
            <button
              onClick={() => setShowStanceHelp(false)}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 w-full text-center"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Preset selector */}
      <div className="flex gap-2 mb-3 justify-center flex-wrap">
        {Object.entries(STANCE_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            title={preset.description}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              currentPreset?.[0] === key
                ? 'bg-zinc-700 text-zinc-100 border border-zinc-500'
                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Customize toggle */}
      <div className="flex justify-center mb-3">
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {showCustomize ? '▾ Hide customization' : '▸ Customize delivery'}
        </button>
      </div>

      {/* Custom sliders */}
      {showCustomize && (
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50 max-w-xl mx-auto">
          <DimensionRow label="Voice" dimension="voice" options={['wonder', 'warm', 'direct', 'grounded']} />
          <DimensionRow label="Focus" dimension="focus" options={['do', 'feel', 'see', 'build']} />
          <DimensionRow label="Density" dimension="density" options={['luminous', 'rich', 'clear', 'essential']} />
          <DimensionRow label="Scope" dimension="scope" options={['resonant', 'patterned', 'connected', 'here']} />

          {!currentPreset && (
            <p className="text-xs text-zinc-600 mt-3 text-center">Custom stance</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StanceSelector;
