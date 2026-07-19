/**
 * AutoReview — 4-second auto-review mode for self-review at home.
 *
 * Each learned word is displayed for 4 seconds with a countdown timer.
 * If the child knows it, no action is needed — it auto-advances.
 * If the child doesn't know it, tap "不会" to mark it for re-study.
 * After all words, a summary shows known vs unknown, with re-study option.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { learningApi } from '../services/api';
import { speak } from '../utils/speech';

interface ReviewWord {
  id: number;
  pack_id: number;
  english: string;
  chinese: string;
  phonetic: string;
  example_en: string;
  example_cn: string;
}

type ReviewPhase = 'loading' | 'reviewing' | 'done';

const REVIEW_DELAY = 4000; // 4 seconds per word

const AutoReview: React.FC = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<ReviewPhase>('loading');
  const [allWords, setAllWords] = useState<ReviewWord[]>([]);
  const [unknownIds, setUnknownIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [studying, setStudying] = useState(false);
  const [studyDone, setStudyDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentWord = allWords[currentIndex];

  // ── Fetch all learned words ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      learningApi.mastered(),
      learningApi.reviewList(),
    ])
      .then(([masteredRes, reviewRes]) => {
        if (cancelled) return;
        const mastered = (masteredRes.data || []) as ReviewWord[];
        const review = (reviewRes.data || []) as ReviewWord[];

        // Deduplicate by word id
        const seen = new Set<number>();
        const combined: ReviewWord[] = [];
        [...review, ...mastered].forEach((w) => {
          if (!seen.has(w.id)) {
            seen.add(w.id);
            combined.push(w);
          }
        });

        if (combined.length === 0) {
          setPhase('done');
        } else {
          setAllWords(combined);
          setPhase('reviewing');
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('done');
      });

    return () => { cancelled = true; };
  }, []);

  // ── Start/restart countdown when currentIndex changes ──────────
  const startCountdown = useCallback(() => {
	    setCountdown(4);

    // Clear any existing timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    // Countdown ticker every 200ms for smooth visual
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((REVIEW_DELAY - elapsed) / 1000));
      setCountdown(remaining);
    }, 100);

	    // Auto-advance after 4 seconds
    autoAdvanceRef.current = setTimeout(() => {
      advanceWord(false); // mark as known
    }, REVIEW_DELAY);
  }, [currentIndex, allWords.length]);

  useEffect(() => {
    if (phase === 'reviewing' && currentWord) {
      startCountdown();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [phase, currentIndex, currentWord, startCountdown]);

  // ── Advance to next word ───────────────────────────────────────
  const advanceWord = (isUnknown: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    const newUnknown = isUnknown ? [...unknownIds, currentWord.id] : unknownIds;
    setUnknownIds(newUnknown);

    const nextIdx = currentIndex + 1;
    if (nextIdx >= allWords.length) {
      // all done
      setPhase('done');
    } else {
      setCurrentIndex(nextIdx);
    }
  };

  // ── Mark as unknown ────────────────────────────────────────────
  const handleDontKnow = () => {
    advanceWord(true);
  };

  // ── Re-study unknown words ─────────────────────────────────────
  const handleReStudy = async () => {
    if (unknownIds.length === 0 || studying) return;
    setStudying(true);
    try {
      await learningApi.batchStudy(unknownIds);
      setStudyDone(true);
    } catch {
      // ignore
    } finally {
      setStudying(false);
    }
  };

  // ── Speak current word ─────────────────────────────────────────
  const handleSpeak = () => {
    if (currentWord) speak(currentWord.english);
  };

  // ── Render: Loading ────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="page-container text-center py-20">
        <div className="animate-spin text-5xl mb-4">⏳</div>
        <p className="text-gray-500">加载已学单词...</p>
      </div>
    );
  }

  // ── Render: Done / No words ────────────────────────────────────
  if (phase === 'done') {
    const knownCount = allWords.length - unknownIds.length;
    return (
      <div className="page-container max-w-lg mx-auto text-center py-12">
        {allWords.length === 0 ? (
          <>
            <span className="text-6xl block mb-4">📭</span>
            <h2 className="text-xl font-bold text-gray-700 mb-2">暂无已学单词</h2>
            <p className="text-gray-500 text-sm mb-6">先去学习一些新单词吧！</p>
            <button onClick={() => navigate('/learn')} className="btn-primary">
              📖 去学习
            </button>
          </>
        ) : (
          <>
            <span className="text-6xl block mb-4">🎉</span>
            <h2 className="text-xl font-bold text-gray-700 mb-2">自我复习完成！</h2>

            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="card !p-4">
                <p className="text-2xl font-bold text-green-600">{knownCount}</p>
                <p className="text-xs text-gray-500">已掌握</p>
              </div>
              <div className="card !p-4">
                <p className="text-2xl font-bold text-red-500">{unknownIds.length}</p>
                <p className="text-xs text-gray-500">需要复习</p>
              </div>
            </div>

            {/* Word list */}
            {allWords.length > 0 && (
              <div className="text-left max-h-60 overflow-y-auto mb-6 border border-gray-100 rounded-xl">
                {allWords.map((w, i) => {
                  const isUnknown = unknownIds.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0 ${
                        isUnknown ? 'bg-red-50' : 'bg-green-50/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-300 w-5 shrink-0">{i + 1}</span>
                        <span className={`text-sm font-medium ${isUnknown ? 'text-red-700' : 'text-green-700'}`}>
                          {w.english}
                        </span>
                        <span className="text-xs text-gray-400">{w.chinese}</span>
                      </div>
                      <span className="text-xs shrink-0">{isUnknown ? '❌' : '✅'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              {unknownIds.length > 0 && !studyDone && (
                <button
                  onClick={handleReStudy}
                  disabled={studying}
                  className="btn-primary flex items-center gap-2"
                >
                  {studying ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      添加中...
                    </>
                  ) : (
                    <>📚 重新学习 {unknownIds.length} 个不会的单词</>
                  )}
                </button>
              )}
              {studyDone && (
                <div className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                  ✅ 已添加到学习列表，快去学习吧！
                </div>
              )}
              <button onClick={() => navigate('/')} className="btn-secondary">
                返回首页
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Render: Reviewing ──────────────────────────────────────────
  if (!currentWord) return null;

  return (
    <div className="page-container max-w-lg mx-auto text-center py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-bold text-gray-700">🔄 自我复习</h1>
        <span className="text-sm text-gray-400">
          {currentIndex + 1} / {allWords.length}
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-6">
        每个单词显示4秒，认识请等待，不认识请点"不会"
      </p>

      {/* Countdown circle */}
      <div className="relative w-28 h-28 mx-auto mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={countdown <= 1 ? '#EF4444' : '#10B981'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(countdown / 4) * 326.73} 326.73`}
            className="transition-all duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-4xl font-extrabold ${countdown <= 1 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
            {countdown}
          </span>
        </div>
      </div>

      {/* Word card */}
      <div className="card !p-8 mb-6" onClick={handleSpeak}>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentWord.english}</h2>
        {currentWord.phonetic && (
          <p className="text-base text-gray-400 mb-3">/{currentWord.phonetic}/</p>
        )}
        <p className="text-xl text-gray-600">{currentWord.chinese}</p>

        {/* Example sentence */}
        {(currentWord.example_en || currentWord.example_cn) && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            {currentWord.example_en && (
              <p className="text-sm text-gray-500 italic">{currentWord.example_en}</p>
            )}
            {currentWord.example_cn && (
              <p className="text-xs text-gray-400 mt-1">{currentWord.example_cn}</p>
            )}
          </div>
        )}
      </div>

      {/* "Don't know" button */}
      <button
        onClick={handleDontKnow}
        className="w-full py-4 bg-red-500 hover:bg-red-600 text-white text-lg font-bold rounded-2xl transition-all active:scale-[0.97] shadow-lg shadow-red-200"
      >
        ❌ 不会
      </button>

      <p className="text-xs text-gray-400 mt-3">
        ⏱️ 等待 {countdown} 秒自动进入下一词
      </p>
    </div>
  );
};

export default AutoReview;
