"use client";

import { useAccessibilityStore, FontSize } from '@/stores/accessibilityStore';
import { Eye, Type } from 'lucide-react';
import { useEffect } from 'react';

const fontSizeOptions: { value: FontSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: '90% - Compact text size' },
  { value: 'medium', label: 'Medium', description: '100% - Default text size' },
  { value: 'large', label: 'Large', description: '115% - Comfortable reading' },
  { value: 'xlarge', label: 'Extra Large', description: '130% - Maximum readability' },
];

export function AccessibilitySettings() {
  const { fontSize, setFontSize } = useAccessibilityStore();

  // Apply font size on component mount (in case localStorage value exists)
  useEffect(() => {
    const store = useAccessibilityStore.getState();
    const scale = store.getFontScale();
    document.documentElement.style.fontSize = `${scale}%`;
  }, []);

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
  };

  return (
    <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
      {/* Section Header */}
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Eye className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Accessibility</h2>
          <p className="text-sm text-gray-400">
            Customize your viewing experience
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Font Size Control */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-gray-400" />
            <h3 className="text-base font-semibold text-white">Text Size</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Choose the text size that's most comfortable for you. This will affect all text across the platform.
          </p>

          {/* Font Size Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fontSizeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleFontSizeChange(option.value)}
                className={`
                  relative p-4 rounded-xl border-2 text-left transition-all
                  ${
                    fontSize === option.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  }
                `}
              >
                {/* Selected indicator */}
                {fontSize === option.value && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                )}

                {/* Option content */}
                <div className="pr-8">
                  <div
                    className={`font-semibold mb-1 ${
                      fontSize === option.value ? 'text-blue-400' : 'text-white'
                    }`}
                    style={{
                      fontSize:
                        option.value === 'small'
                          ? '0.9em'
                          : option.value === 'medium'
                          ? '1em'
                          : option.value === 'large'
                          ? '1.15em'
                          : '1.3em',
                    }}
                  >
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-400">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Preview Text */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">Preview:</p>
            <p className="text-white mb-2">
              The quick brown fox jumps over the lazy dog.
            </p>
            <p className="text-sm text-gray-400">
              This is how text will appear across the platform with your selected size.
            </p>
          </div>

          {/* Info note */}
          <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <svg
              className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="text-sm text-blue-300">
              <strong>Tip:</strong> Your text size preference is saved automatically and will be applied across all pages.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
