import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api, { learningApi } from '../services/api';
import { speak } from '../utils/speech';

/* ───────── types ───────── */

interface WordItem {
  id: number;
  english: string;
  chinese: string;
  phonetic: string;
  example_en: string;
  example_cn: string;
}

type ReviewMode = 'manual' | 'quick';
type QuickPhase = 'prompt' | 'reveal';

const QUICK_DELAY = 4000; // 4 seconds per word

/* ───────── component ───────── */

const Review: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const packId = searchParams.get('pack_id') ? Number(searchParams.get('pack_id')) : undefined;

  /* ── state ── */

  // Data
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ReviewMode>('manual');

  // Review progress
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, reviewed: 0, correct: 0, incorrect: 0 });
  const [completed, setCompleted] = useState(false);

  // Daily cap
  const [dailyRemaining, setDailyRemaining] = useState(300);
  const [dailyLimit, setDailyLimit] = useState(300);

  // Quick mode
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUICK_DELAY / 1000);
  const [quickPhase, setQuickPhase] = useState<QuickPhase>('prompt');
  const [lastKnown, setLastKnown] = useState<boolean | null>(null);

  // Manual quality labels
  const qualityLabels = [
    { label: '完全忘记', desc: '一点印象都没有', color: 'bg-red-100 hover:bg-red-200 text-red-700' },
    { label: '很模糊', desc: '好像见过', color: 'bg-orange-100 hover:bg-orange-200 text-orange-700' },
    { label: '有点印象', desc: '需要提示', color: 'bg-amber-100 hover:bg-amber-200 text-amber-700' },
    { label: '想起来了', desc: '能回忆大半', color: 'bg-lime-100 hover:bg-lime-200 text-lime-700' },
    { label: '比较熟悉', desc: '基本记住了', color: 'bg-green-100 hover:bg-green-200 text-green-700' },
    { label: '非常熟悉', desc: '完全掌握', color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' },
  ];

  /* ── fetch ── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setCompleted(false);
    setCurrentIndex(0);
    setShowAnswer(false);
    setStats({ total: 0, reviewed: 0, correct: 0, incorrect: 0 });
    setQuickPhase('prompt');
    try {
      const [reviewRes, countRes] = await Promise.all([
        learningApi.reviewList(packId),
        api
          .get('/learning/today-review-count')
          .then((r) => r.data)
          .catch(() => ({ count: 0, limit: 300, remaining: 300 })),
      ]);
      const wordList = reviewRes.data || [];
      setWords(wordList);
      setStats((s) => ({ ...s, total: wordList.length }));
      setDailyRemaining(countRes.remaining ?? 300);
      setDailyLimit(countRes.limit ?? 300);
      if (countRes.remaining <= 0 && wordList.length > 0) {
        // Daily cap hit — still show but with warning
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── quick mode timer ── */

  useEffect(() => {
    if (mode !== 'quick' || completed || !words[currentIndex] || quickPhase !== 'prompt') {
      return;
    }

    // Play audio for current word
    speak(words[currentIndex].english, 0.85);

    // Reset countdown
    setTimeLeft(QUICK_DELAY / 1000);

    // Auto-timeout: count as "不知道" after 4 seconds
    timerRef.current = setTimeout(() => {
      handleQuickReview(false);
    }, QUICK_DELAY);

    // 1-second countdown tick
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, completed, currentIndex, quickPhase, words]);

  /* ── manual review submit ── */

  const handleManualReview = async (quality: number) => {
    const word = words[currentIndex];
    if (!word || submitting) return;

    setSubmitting(true);
    try {
      await learningApi.review(word.id, quality);
      const isCorrect = quality >= 3;
      setStats((s) => ({
        ...s,
        reviewed: s.reviewed + 1,
        correct: s.correct + (isCorrect ? 1 : 0),
        incorrect: s.incorrect + (isCorrect ? 0 : 1),
      }));

      if (currentIndex < words.length - 1) {
        setCurrentIndex((i) => i + 1);
        setShowAnswer(false);
      } else {
        setCompleted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── quick review ── */

  const handleQuickReview = useCallback(
    async (known: boolean) => {
      const word = words[currentIndex];
      if (!word || submitting) return;

      // Stop timers
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);

      setLastKnown(known);
      setQuickPhase('reveal');

      // Submit review
      setSubmitting(true);
      try {
        await learningApi.review(word.id, known ? 4 : 0);
        setStats((s) => ({
          ...s,
          reviewed: s.reviewed + 1,
          correct: s.correct + (known ? 1 : 0),
          incorrect: s.incorrect + (known ? 0 : 1),
        }));
      } catch (err) {
        console.error(err);
      } finally {
        setSubmitting(false);
      }

      // Show meaning for 600ms then advance
      setTimeout(() => {
        if (currentIndex < words.length - 1) {
          setCurrentIndex((i) => i + 1);
          setQuickPhase('prompt');
          setLastKnown(null);
        } else {
          setCompleted(true);
        }
      }, 600);
    },
    [currentIndex, words, submitting],
  );

  /* ── helpers ── */

  const currentWord = words[currentIndex];
  const dailyPct = Math.min(100, Math.round(((dailyLimit - dailyRemaining) / dailyLimit) * 100));

  /* ════════════════ RENDER ════════════════ */

  /* ── loading ── */

  if (loading) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin text-5xl mb-4">⏳</div>
        <p className="text-gray-500">加载复习列表...</p>
      </div>
    );
  }

  /* ── completed ── */

  if (completed) {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;
    return (
      <div className="page-container max-w-lg mx-auto text-center py-12 px-4">
        <span className="text-7xl block mb-4">🎉</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">复习完成！</h2>
        <p className="text-gray-500 mb-6">
          {mode === 'quick' ? '快速复习' : '手动复习'} · 共 {stats.reviewed} 词
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-primary-600">{stats.reviewed}</p>
            <p className="text-xs text-gray-400 mt-1">总复习</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-green-600">{stats.correct}</p>
            <p className="text-xs text-gray-400 mt-1">正确</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-amber-600">{accuracy}%</p>
            <p className="text-xs text-gray-400 mt-1">正确率</p>
          </div>
        </div>

        {/* Daily remaining */}
        {dailyRemaining > 0 && (
          <p className="text-sm text-gray-400 mb-6">
            今日还可复习 <span className="font-semibold text-primary-600">{dailyRemaining}</span> 词
          </p>
        )}
        {dailyRemaining <= 0 && (
          <p className="text-sm text-amber-500 mb-6">今日复习已达上限，明天再来吧！</p>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={fetchData} className="btn-primary">
            🔄 再来一轮
          </button>
          <button onClick={() => navigate('/packs')} className="btn-secondary">
            📚 切换词库
          </button>
        </div>
      </div>
    );
  }

  /* ── empty ── */

  if (words.length === 0) {
    return (
      <div className="page-container max-w-lg mx-auto text-center py-16 px-4">
        <span className="text-7xl block mb-4">✅</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">没有需要复习的单词</h2>
        <p className="text-gray-500 mb-6">太棒了，继续保持！</p>
        <div className="flex gap-3 justify-center">
          <button onClick={fetchData} className="btn-secondary">
            🔄 刷新
          </button>
          <button onClick={() => navigate('/packs')} className="btn-primary">
            📖 学习新词
          </button>
        </div>
      </div>
    );
  }

  /* ── daily cap reached ── */

  if (dailyRemaining <= 0) {
    return (
      <div className="page-container max-w-lg mx-auto text-center py-16 px-4">
        <span className="text-7xl block mb-4">⏰</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">今日复习已达上限</h2>
        <p className="text-gray-500 mb-6">
          每日最多复习 {dailyLimit} 词，明天再来吧！
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/packs')} className="btn-primary">
            📖 学习新词
          </button>
          <button onClick={() => navigate('/practice?packId=' + (packId || ''))} className="btn-secondary">
            🏰 去闯关
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════ main review ══════════════ */

  return (
    <div className="page-container max-w-lg mx-auto py-6 px-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">🔄 智能复习</h1>
          <p className="text-sm text-gray-500">
            {currentIndex + 1} / {words.length} · {mode === 'manual' ? '手动评分' : '快速识别'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-0.5">
          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            手动
          </button>
          <button
            onClick={() => {
              setMode('quick');
              setQuickPhase('prompt');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'quick' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            快速
          </button>
        </div>
      </div>

      {/* ── Daily cap bar ── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-400 transition-all duration-500"
            style={{ width: `${dailyPct}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          今日 <span className="font-semibold text-primary-600">{dailyRemaining}</span>/{dailyLimit}
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
        />
      </div>

      {/* ════ Manual Mode ════ */}
      {mode === 'manual' && currentWord && (
        <>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 text-center">
            {!showAnswer ? (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentWord.english}</h2>
                {currentWord.phonetic && (
                  <p className="text-gray-400 text-base">/{currentWord.phonetic}/</p>
                )}
                <button
                  onClick={() => {
                    setShowAnswer(true);
                    speak(currentWord.english, 0.85);
                  }}
                  className="mt-8 px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
                >
                  👀 查看释义
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-primary-600 mb-2">{currentWord.chinese}</h2>
                <p className="text-lg text-gray-700 font-semibold">{currentWord.english}</p>
                {currentWord.phonetic && (
                  <p className="text-gray-400 text-sm">/{currentWord.phonetic}/</p>
                )}
                {currentWord.example_en && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left">
                    <p className="text-sm text-gray-600">{currentWord.example_en}</p>
                    <p className="text-xs text-gray-400 mt-1">{currentWord.example_cn}</p>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-6 mb-3">你记住了吗？请评分：</p>
                <div className="grid grid-cols-3 gap-2">
                  {qualityLabels.map((ql, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleManualReview(idx)}
                      disabled={submitting}
                      className={`${ql.color} rounded-xl p-3 text-center transition-all active:scale-95 disabled:opacity-50`}
                    >
                      <div className="font-semibold text-sm">{ql.label}</div>
                      <div className="text-xs opacity-75 mt-0.5">{ql.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 text-sm text-gray-400 text-center flex justify-center gap-4">
            <span>✓ 正确: {stats.correct}</span>
            <span>✗ 错误: {stats.incorrect}</span>
          </div>
        </>
      )}

      {/* ════ Quick Mode ════ */}
      {mode === 'quick' && currentWord && (
        <>
          {quickPhase === 'prompt' && (
            <div className="text-center">
              {/* Countdown ring */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="5"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={2 * Math.PI * 30 * (1 - timeLeft / (QUICK_DELAY / 1000))}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-700">
                  {Math.ceil(timeLeft)}
                </span>
              </div>

              {/* Word display */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 mb-6">
                <h2 className="text-4xl font-bold text-gray-800 mb-2">{currentWord.english}</h2>
                {currentWord.phonetic && (
                  <p className="text-gray-400 text-lg">/{currentWord.phonetic}/</p>
                )}
                <p className="text-xs text-gray-400 mt-4">自动播放中 · 4秒后自动标记为不认识</p>
              </div>

              {/* 知道 / 不知道 buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => handleQuickReview(false)}
                  disabled={submitting}
                  className="flex-1 py-5 rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 font-bold text-lg hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  ❌ 不知道
                </button>
                <button
                  onClick={() => handleQuickReview(true)}
                  disabled={submitting}
                  className="flex-1 py-5 rounded-2xl border-2 border-green-200 bg-green-50 text-green-600 font-bold text-lg hover:bg-green-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  ✅ 知道
                </button>
              </div>
            </div>
          )}

          {quickPhase === 'reveal' && (
              <div className="text-center animate-fade-in">
              <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-10 mb-6">
                <div className={`inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full text-sm font-semibold ${
                  lastKnown ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {lastKnown ? '✅ 认识' : '❌ 不认识'}
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentWord.english}</h2>
                <p className="text-xl text-gray-600">{currentWord.chinese}</p>
                {currentWord.phonetic && (
                  <p className="text-sm text-gray-400 mt-1">/{currentWord.phonetic}/</p>
                )}
              </div>
              <p className="text-sm text-gray-400">准备下一个单词...</p>
            </div>
          )}

          {/* Stats */}
          <div className="mt-4 text-sm text-gray-400 text-center flex justify-center gap-4">
            <span>✓ 正确: {stats.correct}</span>
            <span>✗ 错误: {stats.incorrect}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default Review;
