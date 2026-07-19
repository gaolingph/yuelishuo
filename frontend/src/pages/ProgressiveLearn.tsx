import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { learningApi, packsApi, WordPack } from '../services/api';
import { speak } from '../utils/speech';

/* ───────── types ───────── */

interface WordItem {
  id: number;
  pack_id: number;
  english: string;
  chinese: string;
  phonetic: string;
  example_en: string;
  example_cn: string;
}

type Layer = 'recognition' | 'sound-shape' | 'spelling' | 'context';

const LAYER_ORDER: Layer[] = ['recognition', 'sound-shape', 'spelling', 'context'];
const LAYER_LABEL: Record<Layer, string> = {
  recognition: '认读',
  'sound-shape': '音形对应',
  spelling: '拼写',
  context: '语境语义',
};
const LAYER_ICON: Record<Layer, string> = {
  recognition: '👁️',
  'sound-shape': '🔊',
  spelling: '✍️',
  context: '🧩',
};

type Phase = 'loading' | 'overview' | 'ready' | 'learning' | 'batch-complete' | 'all-done';

const BATCH_SIZE = 5;

/* ───────── component ───────── */

const ProgressiveLearn: React.FC = () => {
  const { packId: packIdParam } = useParams<{ packId: string }>();
  const navigate = useNavigate();
  const packId = parseInt(packIdParam || '0');

  /* ── state ── */

  const [phase, setPhase] = useState<Phase>('loading');
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [packName, setPackName] = useState('');
  const [words, setWords] = useState<WordItem[]>([]);           // current batch
  const [allPackWords, setAllPackWords] = useState<WordItem[]>([]); // for distractors

  // learning position
  const [wordIndex, setWordIndex] = useState(0);
  const [layerIndex, setLayerIndex] = useState(0);

  // results tracking
  const [layerResults, setLayerResults] = useState<{ wordId: number; layer: Layer; correct: boolean }[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [studying, setStudying] = useState(false);

  // L1 auto-advance timer
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showingCorrect, setShowingCorrect] = useState(false);

  // L3 input
  const [spellingValue, setSpellingValue] = useState('');
  const [spellingResult, setSpellingResult] = useState<'correct' | 'wrong' | null>(null);

  // current layer distractor options
  const [options, setOptions] = useState<WordItem[]>([]);

  /* ── derived ── */

  const currentWord: WordItem | undefined = words[wordIndex];
  const currentLayer: Layer = LAYER_ORDER[layerIndex];

  /* ── data fetching ── */

  const fetchBatch = useCallback(async (pid: number) => {
    try {
      setPhase('loading');
      const [batchRes, wordsRes] = await Promise.all([
        learningApi.batchNew(pid, BATCH_SIZE),
        packsApi.words(pid),
      ]);
      const batchData = batchRes.data;
      const allWordsData: WordItem[] = wordsRes.data;

      setAllPackWords(allWordsData);

      if (!batchData.words || batchData.words.length === 0) {
        setWords([]);
        setPhase('all-done');
        return;
      }
      setWords(batchData.words);
      setWordIndex(0);
      setLayerIndex(0);
      setLayerResults([]);
      setCorrectCount(0);
      setPhase('overview');
    } catch (err: any) {
      console.error('Failed to fetch batch:', err);
      setPhase('all-done');
    }
  }, []);

  useEffect(() => {
    packsApi.list().then((res) => setPacks(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (packId) {
      const p = packs.find((x) => x.id === packId);
      if (p) setPackName(p.name);
      fetchBatch(packId);
    }
  }, [packId, packs, fetchBatch]);

  /* ── distractor helpers ── */

  const getDistractors = useCallback(
    (word: WordItem, count = 3): WordItem[] => {
      const pool = allPackWords.length > 0 ? allPackWords : words;
      const others = pool.filter((w) => w.id !== word.id);
      // Shuffle && pick
      const shuffled = [...others].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    },
    [allPackWords, words],
  );

  /* ── layer entry side effects ── */

  useEffect(() => {
    if (phase !== 'learning' || !currentWord) return;
    setShowingCorrect(false);
    setSpellingValue('');
    setSpellingResult(null);

    if (currentLayer === 'recognition') {
      // Play pronunciation
      speak(currentWord.english, 0.85);
      // Start 3-second auto-advance
      autoAdvanceRef.current = setTimeout(() => {
        completeLayer(true);
      }, 3000);
    }

    if (currentLayer === 'sound-shape') {
      speak(currentWord.english, 0.85);
      const wrong = getDistractors(currentWord, 3);
      // Options: correct word + 3 distractors, shuffled
      const opts = [currentWord, ...wrong].sort(() => Math.random() - 0.5);
      setOptions(opts);
    }

    if (currentLayer === 'context') {
      const wrong = getDistractors(currentWord, 3);
      const opts = [currentWord, ...wrong].sort(() => Math.random() - 0.5);
      setOptions(opts);
    }

    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wordIndex, layerIndex]);

  /* ── layer completion logic ── */

  const completeLayer = useCallback(
    (correct: boolean) => {
      if (!currentWord) return;
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

      const newResults = [
        ...layerResults,
        { wordId: currentWord.id, layer: currentLayer, correct },
      ];
      setLayerResults(newResults);
      if (correct) setCorrectCount((c) => c + 1);

      setShowingCorrect(true);

      // Small delay, then advance
      setTimeout(() => {
        if (layerIndex < 3) {
          // Next layer for same word
          setLayerIndex((i) => i + 1);
        } else {
          // Word complete — call study API, move to next word
          setStudying(true);
          learningApi
            .study(currentWord.id)
            .catch(() => {})
            .finally(() => {
              setStudying(false);
              if (wordIndex < words.length - 1) {
                setWordIndex((i) => i + 1);
                setLayerIndex(0);
              } else {
                // Batch complete
                setPhase('batch-complete');
              }
            });
        }
      }, 600);
    },
    [currentWord, currentLayer, layerIndex, layerResults, wordIndex, words.length],
  );

  /* ── L3 spelling submit ── */

  const handleSpellingSubmit = useCallback(() => {
    if (!currentWord || spellingResult) return;
    const correct =
      spellingValue.trim().toLowerCase() === currentWord.english.trim().toLowerCase();
    setSpellingResult(correct ? 'correct' : 'wrong');
    setTimeout(() => completeLayer(correct), 800);
  }, [currentWord, spellingValue, spellingResult, completeLayer]);

  /* ── L2 / L4 selection ── */

  const handleSelect = useCallback(
    (word: WordItem) => {
      if (showingCorrect || !currentWord) return;
      const correct = word.id === currentWord.id;
      completeLayer(correct);
    },
    [showingCorrect, currentWord, completeLayer],
  );

  /* ── start learning ── */

  const handleStart = () => setPhase('learning');

  /* ── next batch ── */

  const handleNextBatch = () => {
    if (packId) fetchBatch(packId);
  };

  /* ── L1 quick skip ── */
  const handleIKnow = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    completeLayer(true);
  };

  /* ── L2 replay ── */
  const handleReplay = () => {
    if (currentWord) speak(currentWord.english, 0.85);
  };

  /* ── pack selector ── */
  const handlePackChange = (id: number) => {
    navigate(`/progressive-learn/${id}`);
  };

  /* ══════════════════ RENDER ══════════════════ */

  /* ── loading ── */
  if (phase === 'loading') {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin text-5xl mb-4">⏳</div>
        <p className="text-gray-500">加载学习内容...</p>
      </div>
    );
  }

  /* ── all done ── */
  if (phase === 'all-done') {
    return (
      <div className="page-container max-w-md mx-auto text-center py-16">
        <span className="text-7xl block mb-4">🎉</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">全部单词已学习</h2>
        <p className="text-gray-500 mb-6">
          {packName ? `「${packName}」中所有单词已完成学习` : '当前词库已没有新单词'}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/packs')} className="btn-primary">
            📚 切换词库
          </button>
          <button onClick={() => navigate('/review')} className="btn-secondary">
            🔄 去复习
          </button>
        </div>
      </div>
    );
  }

  /* ── overview ── */
  if (phase === 'overview') {
    return (
      <div className="page-container max-w-lg mx-auto py-8 px-4">
        {/* Back + pack selector */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="text-sm text-blue-500 hover:text-blue-600">
            ← 返回
          </button>
          <select
            value={packId || ''}
            onChange={(e) => handlePackChange(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.word_count}词）
              </option>
            ))}
          </select>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-6xl block mb-3">📖</span>
          <h1 className="text-2xl font-bold text-gray-800">生词记忆</h1>
          <p className="text-gray-500 mt-1">四层递进，彻底掌握每一个单词</p>
        </div>

        {/* Layer overview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <h3 className="font-semibold text-gray-700 mb-4">学习流程：</h3>
          <div className="grid grid-cols-2 gap-3">
            {LAYER_ORDER.map((l, i) => (
              <div key={l} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-2xl">{LAYER_ICON[l]}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    L{i + 1} {LAYER_LABEL[l]}
                  </p>
                  <p className="text-xs text-gray-400">
                    {i === 0
                      ? '看词听音·初识印象'
                      : i === 1
                        ? '听音辨形·建立联系'
                        : i === 2
                          ? '看义拼写·强化输出'
                          : '语境填空·活学活用'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Words preview */}
        {words.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
            <h3 className="font-semibold text-gray-700 mb-3">
              本批单词（{words.length}词）
            </h3>
            <div className="space-y-2">
              {words.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-300 w-5 text-right">{i + 1}</span>
                  <span className="font-semibold text-gray-800 flex-1">{w.english}</span>
                  <span className="text-sm text-gray-400">{w.chinese}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary-200 active:scale-[0.98] transition-all"
        >
          🚀 开始学习
        </button>
      </div>
    );
  }

  /* ── batch-complete ── */
  if (phase === 'batch-complete') {
    const l1 = layerResults.filter((r) => r.layer === 'recognition');
    const l2 = layerResults.filter((r) => r.layer === 'sound-shape');
    const l3 = layerResults.filter((r) => r.layer === 'spelling');
    const l4 = layerResults.filter((r) => r.layer === 'context');
    const pct = (arr: typeof l1) =>
      arr.length > 0 ? Math.round((arr.filter((r) => r.correct).length / arr.length) * 100) : 0;

    return (
      <div className="page-container max-w-lg mx-auto py-8 px-4 text-center">
        <span className="text-7xl block mb-3">🎉</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">本批学习完成！</h2>
        <p className="text-gray-500 mb-6">共学习 {words.length} 个单词</p>

        {/* Per-layer stats */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 text-left">
          <h3 className="font-semibold text-gray-700 mb-4">📊 学习报告</h3>
          <div className="space-y-3">
            {(
              [
                { key: 'recognition', label: '认读', data: l1 },
                { key: 'sound-shape', label: '音形对应', data: l2 },
                { key: 'spelling', label: '拼写', data: l3 },
                { key: 'context', label: '语境语义', data: l4 },
              ] as const
            ).map(({ label, data }) => (
              <div key={label} className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 w-20">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      pct(data) >= 80 ? 'bg-green-400' : pct(data) >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${pct(data)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 w-12 text-right">
                  {pct(data)}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">总体正确率</span>
            <span className="font-bold text-primary-600">
              {words.length > 0
                ? Math.round((correctCount / (words.length * 4)) * 100)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleNextBatch} className="btn-primary flex-1">
            📖 继续下一批
          </button>
          <button onClick={() => navigate('/practice?mode=choice&packId=' + packId)} className="btn-secondary flex-1">
            🏰 去闯关
          </button>
        </div>
        <button
          onClick={() => navigate('/review')}
          className="mt-3 w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all"
        >
          🔄 去智能复习
        </button>
      </div>
    );
  }

  /* ── learning ── */
  if (!currentWord) return null;

  const totalSteps = words.length * 4;
  const currentStep = wordIndex * 4 + layerIndex;
  const progressPct = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="page-container max-w-lg mx-auto py-6 px-4">
      {/* ── Header progress info ── */}

      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-500">
          第 {wordIndex + 1}/{words.length} 词
        </span>
        <span className="text-sm text-gray-400">
          <span className="font-medium text-primary-600">L{layerIndex + 1}</span>{' '}
          {LAYER_LABEL[currentLayer]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Word dots */}
      <div className="flex gap-1.5 mb-6">
        {words.map((w, i) => (
          <div
            key={w.id}
            className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
              i < wordIndex ? 'bg-green-400' : i === wordIndex ? 'bg-primary-400' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* ════════ L1: Recognition ════════ */}
      {currentLayer === 'recognition' && (
        <div className="text-center">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 mb-6">
            {/* Layer label */}
            <span className="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              L1 认读 · 看词听音
            </span>

            {/* English word */}
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{currentWord.english}</h1>

            {/* Phonetic */}
            {currentWord.phonetic && (
              <p className="text-lg text-gray-400 mb-4">/{currentWord.phonetic}/</p>
            )}

            {/* Chinese meaning */}
            <p className="text-xl text-gray-600 mb-6">{currentWord.chinese}</p>

            {/* Auto-progress indicator */}
            <div className="w-16 h-1 bg-gray-100 mx-auto rounded-full overflow-hidden mb-6">
              <div className="h-full bg-primary-400 rounded-full animate-progress-shrink origin-left" />
            </div>
            <p className="text-xs text-gray-400 mb-4" suppressHydrationWarning>
              播放中 · {Math.ceil((autoAdvanceRef.current ? 3 : 0) / 1)}秒后自动进入下一层
            </p>
          </div>

          <button
            onClick={handleIKnow}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold text-lg rounded-xl shadow-lg active:scale-[0.98] transition-all"
          >
            👌 我知道了
          </button>
        </div>
      )}

      {/* ════════ L2: Sound-Shape ════════ */}
      {currentLayer === 'sound-shape' && (
        <div className="text-center">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 mb-6">
            <span className="inline-block bg-green-100 text-green-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              L2 音形对应 · 听音辨形
            </span>

            {/* Audio area */}
            <div className="mb-8">
              <button
                onClick={handleReplay}
                className="w-20 h-20 mx-auto rounded-full bg-green-50 hover:bg-green-100 border-2 border-green-200 flex items-center justify-center text-4xl transition-all active:scale-90"
              >
                🔊
              </button>
              <p className="text-sm text-gray-400 mt-2">点击播放</p>
            </div>

            <p className="text-gray-600 font-medium mb-4">选择你听到的单词</p>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-3">
              {options.map((opt) => {
                const isCorrectOpt = opt.id === currentWord.id;
                let btnClass =
                  'w-full py-4 rounded-2xl border-2 font-semibold text-lg transition-all active:scale-95 ';
                if (showingCorrect) {
                  btnClass += isCorrectOpt
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-400 opacity-60';
                } else {
                  btnClass += 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50';
                }
                return (
                  <button
                    key={opt.id}
                    className={btnClass}
                    onClick={() => handleSelect(opt)}
                    disabled={showingCorrect}
                  >
                    {opt.english}
                  </button>
                );
              })}
            </div>

            {showingCorrect && (
              <p className="mt-4 text-green-600 font-semibold">
                ✓ {currentWord.english} = {currentWord.chinese}
              </p>
            )}
          </div>

          {!showingCorrect && (
            <button
              onClick={handleReplay}
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-semibold hover:bg-gray-50 transition-all"
            >
              🔄 再听一遍
            </button>
          )}
        </div>
      )}

      {/* ════════ L3: Spelling ════════ */}
      {currentLayer === 'spelling' && (
        <div className="text-center">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 mb-6">
            <span className="inline-block bg-yellow-100 text-yellow-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              L3 拼写 · 看义拼词
            </span>

            {/* Chinese meaning prompt */}
            <p className="text-2xl text-gray-700 font-bold mb-2">{currentWord.chinese}</p>
            {currentWord.phonetic && (
              <p className="text-sm text-gray-400 mb-6">音标 /{currentWord.phonetic}/</p>
            )}

            {/* Hint */}
            <div className="flex items-center justify-center gap-1 mb-6">
              {currentWord.english.split('').map((ch, i) => (
                <span
                  key={i}
                  className={`w-7 h-8 flex items-center justify-center border-b-2 text-lg font-bold ${
                    spellingResult === 'correct'
                      ? 'border-green-400 text-green-600'
                      : spellingResult === 'wrong'
                        ? 'border-red-400 text-red-500'
                        : 'border-gray-300 text-gray-800'
                  }`}
                >
                  {spellingResult
                    ? ch
                    : spellingValue[i] || ''}
                </span>
              ))}
            </div>

            {/* Input */}
            {!spellingResult && (
              <input
                type="text"
                value={spellingValue}
                onChange={(e) => setSpellingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSpellingSubmit();
                }}
                placeholder="输入英文单词..."
                autoFocus
                className="w-full px-5 py-4 text-center text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 bg-gray-50 focus:bg-white transition-all"
              />
            )}

            {spellingResult === 'correct' && (
              <p className="mt-4 text-green-600 font-bold text-lg">✅ 拼写正确！</p>
            )}
            {spellingResult === 'wrong' && (
              <p className="mt-4 text-red-500 font-bold text-lg">
                ❌ 正确答案：{currentWord.english}
              </p>
            )}
          </div>

          {spellingResult ? null : (
            <button
              onClick={handleSpellingSubmit}
              disabled={!spellingValue.trim()}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] ${
                spellingValue.trim()
                  ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              ✅ 确认
            </button>
          )}
        </div>
      )}

      {/* ════════ L4: Context ════════ */}
      {currentLayer === 'context' && (
        <div className="text-center">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-8 mb-6">
            <span className="inline-block bg-purple-100 text-purple-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              L4 语境语义 · 选词填空
            </span>

            {/* Sentence with blank */}
            <div className="bg-purple-50 rounded-2xl p-5 mb-6 min-h-[80px] flex items-center justify-center">
              <p className="text-lg text-gray-700 leading-relaxed">
                {currentWord.example_en
                  ? (() => {
                      const word = currentWord.english;
                      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                      return currentWord.example_en.replace(re, '______');
                    })()
                  : `______ 的英文是什么？`}
              </p>
            </div>

            {currentWord.example_cn && (
              <p className="text-sm text-gray-400 mb-4">{currentWord.example_cn}</p>
            )}

            <p className="text-gray-600 font-medium mb-4">选择正确的单词填入空白</p>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-3">
              {options.map((opt) => {
                const isCorrectOpt = opt.id === currentWord.id;
                let btnClass =
                  'w-full py-4 rounded-2xl border-2 font-semibold text-lg transition-all active:scale-95 ';
                if (showingCorrect) {
                  btnClass += isCorrectOpt
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-400 opacity-60';
                } else {
                  btnClass += 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50';
                }
                return (
                  <button
                    key={opt.id}
                    className={btnClass}
                    onClick={() => handleSelect(opt)}
                    disabled={showingCorrect}
                  >
                    {opt.english}
                  </button>
                );
              })}
            </div>

            {showingCorrect && (
              <p className="mt-4 text-green-600 font-semibold">
                ✓ {currentWord.english} — {currentWord.chinese}
              </p>
            )}
          </div>

          {!showingCorrect && (
            <p className="text-xs text-gray-400">
              选择一个单词填入句子空白处
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressiveLearn;
