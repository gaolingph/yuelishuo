import React, { useState } from 'react';
import { speak } from '../utils/speech';

interface WordCardProps {
  english: string;
  chinese: string;
  phonetic?: string;
  example_en?: string;
  example_cn?: string;
  onFlip?: () => void;
  showFront?: boolean;
  showExample?: boolean;
}

const WordCard: React.FC<WordCardProps> = ({
  english,
  chinese,
  phonetic,
  example_en,
  example_cn,
  onFlip,
  showFront = true,
  showExample = true,
}) => {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    setFlipped(!flipped);
    onFlip?.();
  };

  return (
    <div className="card-flip w-full max-w-md mx-auto cursor-pointer" onClick={!flipped ? handleFlip : undefined}>
      <div
        className={`card-flip-inner relative w-full min-h-[240px] ${flipped ? 'flipped' : ''}`}
        style={{ transition: 'transform 0.6s', transformStyle: 'preserve-3d' }}
      >
        {/* Front — English side */}
        <div
          className="card-flip-front card flex flex-col items-center justify-center gap-4"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">{english}</h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(english);
              }}
              className="p-2 rounded-full hover:bg-primary-50 text-primary-500 transition-colors"
              title="点击发音"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>
          {phonetic && <p className="text-gray-400 text-sm">{phonetic}</p>}
          <p className="text-gray-500 text-sm mt-2">点击卡片查看中文释义</p>
          <p className="text-gray-300 text-xs">Tap to reveal</p>
        </div>

        {/* Back — Chinese side */}
        <div
          className="card-flip-back card flex flex-col items-center justify-center gap-3"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          onClick={() => setFlipped(false)}
        >
          <h2 className="text-3xl font-bold text-primary-600">{chinese}</h2>
          <p className="text-lg text-gray-600">{english}</p>
          {phonetic && <p className="text-gray-400 text-sm">{phonetic}</p>}
          {showExample && example_en && (
            <div className="mt-3 pt-3 border-t border-gray-100 w-full text-center">
              <p className="text-sm text-gray-500 italic">{example_en}</p>
              <p className="text-sm text-gray-400 mt-1">{example_cn}</p>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              speak(english);
            }}
            className="mt-2 text-primary-500 hover:text-primary-600 text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            点击发音
          </button>
        </div>
      </div>
    </div>
  );
};

export default WordCard;
