import { useState, useEffect } from 'react';

const TextSizeSlider = () => {
  const [scale, setScale] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('nirmanakaya-text-scale');
    if (saved) {
      const value = parseFloat(saved);
      setScale(value);
      document.documentElement.style.setProperty('--text-scale', value);
    }
  }, []);

  // Update CSS variable and save to localStorage
  const handleChange = (e) => {
    const value = parseFloat(e.target.value);
    setScale(value);
    document.documentElement.style.setProperty('--text-scale', value);
    localStorage.setItem('nirmanakaya-text-scale', value);
  };

  // Reset to default
  const handleReset = () => {
    setScale(1);
    document.documentElement.style.setProperty('--text-scale', 1);
    localStorage.removeItem('nirmanakaya-text-scale');
  };

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-zinc-800/50"
        title="Adjust text size"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
      </button>

      {/* Slider Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-50 min-w-[200px]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Text Size</span>
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">A</span>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={scale}
              onChange={handleChange}
              className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-amber-500
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <span className="text-lg text-zinc-500">A</span>
          </div>

          <div className="text-center mt-2 text-xs text-zinc-600">
            {Math.round(scale * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default TextSizeSlider;
