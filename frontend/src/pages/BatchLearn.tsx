import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { learningApi, packsApi, WordPack } from '../services/api';
import { speakWithCallback, speak } from '../utils/speech';

interface WordItem {
  id: number;
  pack_id: number;
  english: string;
  chinese: string;
  phonetic: string;
  example_en: string;
  example_cn: string;
}

type BatchPhase = 'overview' | 'reading' | 'recall' | 'complete';

const BATCH_SIZE = 5;
const ROUND_TOTAL = 3;

const ROUND_LABELS = ['听音识义', '看词跟读', '快速反应'];

const BatchLearn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const packId = searchParams.get('pack_id') ? Number(searchParams.get('pack_id')) : undefined;
  const packName = searchParams.get('name') ? decodeURIComponent(searchParams.get('name')!) : '';

  const [phase, setPhase] = useState<BatchPhase>('overview');
  const [words, setWords] = useState<WordItem[]>([]);
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<number>(packId || 0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Reading state
  const [wordIndex, setWordIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  // Recall state
  const [recallIndex, setRecallIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Word bank state
  const [showWordBank, setShowWordBank] = useState(false);
  const [allPackWords, setAllPackWords] = useState<WordItem[]>([]);
  const [wordBankLoading, setWordBankLoading] = useState(false);
  const [wordBankSearch, setWordBankSearch] = useState('');

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  const fetchBatch = useCallback(async (pid: number) => {
    setLoading(true);
    try {
      const res = await learningApi.batchNew(pid, BATCH_SIZE);
      const data = res.data;
      if (data.words.length === 0) {
        setMessage({ text: '🎉 该词库所有单词已学习完毕！', type: 'success' });
      }
      setWords(data.words);
      setPhase('overview');
      setWordIndex(0);
      setRound(0);
      setRecallIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.detail || '获取单词失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (packId) {
      fetchBatch(packId);
    }
    packsApi.list().then(res => setPacks(res.data)).catch(() => {});
  }, [packId, fetchBatch]);

  // ── Print helper ──────────────────────────────────────────────
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const wordRows = words.map(
      (w, i) => `
        <tr>
          <td style="padding:10px;border:1px solid #ccc;text-align:center;font-weight:bold;">${i + 1}</td>
          <td style="padding:10px;border:1px solid #ccc;font-size:16px;">${w.english}</td>
          <td style="padding:10px;border:1px solid #ccc;color:#666;">/${w.phonetic}/</td>
          <td style="padding:10px;border:1px solid #ccc;">${w.chinese}</td>
        </tr>`
    ).join('');

    printWindow.document.write(`
      <html>
      <head>
        <title>${packName || '词条打印'} - 乐说邦</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; }
          h1 { font-size: 22px; color: #333; text-align: center; margin-bottom: 5px; }
          .sub { text-align: center; color: #999; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f0f0f0; padding: 10px; border: 1px solid #ccc; font-size: 14px; }
          td { padding: 8px 10px; border: 1px solid #ddd; font-size: 14px; }
          .footer { text-align: center; margin-top: 20px; color: #aaa; font-size: 12px; }
          @media print {
            body { padding: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>📖 ${packName || '单词表'}</h1>
        <p class="sub">共 ${words.length} 词 · 乐说邦英语</p>
        <table>
          <thead><tr><th>序号</th><th>英文</th><th>音标</th><th>中文</th></tr></thead>
          <tbody>${wordRows}</tbody>
        </table>
        <p class="footer">打印时间: ${new Date().toLocaleString('zh-CN')}</p>
        <script>window.print();window.close();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── Word bank (full pack word list) ──────────────────────────
  const handleOpenWordBank = async () => {
    if (!packId) return;
    setWordBankLoading(true);
    try {
      const res = await packsApi.words(packId);
      setAllPackWords(res.data);
      setShowWordBank(true);
    } catch {
      setMessage({ text: '获取词库失败', type: 'error' });
    } finally {
      setWordBankLoading(false);
    }
  };

  // ── Start reading ────────────────────────────────────────────
  const startReading = () => {
    setPhase('reading');
    setWordIndex(0);
    setRound(0);
    // Auto-play first word
    setTimeout(() => playCurrentWord(0, 0), 300);
  };

  // ── Speech playback ──────────────────────────────────────────
  const playCurrentWord = useCallback((wi: number, r: number) => {
    if (wi >= words.length || r >= ROUND_TOTAL) return;
    const word = words[wi];
    if (!word) return;

    setSpeaking(true);
    const rate = r === 0 ? 0.8 : r === 1 ? 0.85 : 0.9;
    speakWithCallback(word.english, rate, () => {
      setSpeaking(false);
    });
  }, [words]);

  // Auto-play when wordIndex or round changes during reading
  useEffect(() => {
    if (phase === 'reading' && !speaking) {
      if (wordIndex < words.length && round < ROUND_TOTAL) {
        playCurrentWord(wordIndex, round);
      }
    }
  }, [phase, wordIndex, round, speaking, playCurrentWord]);

  // ── Reading: "我会了" handler ─────────────────────────────────
  const handleGotIt = () => {
    if (speaking) return; // Wait for audio to finish

    const nextRound = round + 1;
    if (nextRound < ROUND_TOTAL) {
      setRound(nextRound);
    } else {
      // Move to next word
      const nextWord = wordIndex + 1;
      if (nextWord < words.length) {
        setWordIndex(nextWord);
        setRound(0);
      } else {
        // All words done — move to recall
        setPhase('recall');
        setRecallIndex(0);
        setFlipped(false);
      }
    }
  };

  // ── Recall: flip card ────────────────────────────────────────
  const handleRecallFlip = () => {
    setFlipped(!flipped);
  };

  const handleRecallNext = () => {
    setFlipped(false);
    if (recallIndex < words.length - 1) {
      setRecallIndex(recallIndex + 1);
    } else {
      // All recalled — move to complete
      setPhase('complete');
    }
  };

  // ── Batch study (mark all as learned) ────────────────────────
  const handleCompleteStudy = async () => {
    setSaving(true);
    try {
      const wordIds = words.map(w => w.id);
      const res = await learningApi.batchStudy(wordIds);
      if (res.data.message === 'success') {
        setMessage({ text: `✅ 成功学习 ${res.data.studied_count} 个单词！`, type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.detail || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleNextBatch = () => {
    if (!packId) return;
    fetchBatch(packId);
  };

  // ── Pack selector (when no pack_id) ──────────────────────────
  if (!packId) {
    return (
      <div className="page-container max-w-md mx-auto text-center py-12">
        <span className="text-6xl mb-4 block">🎧</span>
        <h2 className="text-xl font-bold text-gray-700 mb-2">批量跟读学习</h2>
        <p className="text-gray-500 text-sm mb-6">选择词库，每次 5 个单词通过 3 轮跟读快速记忆</p>
        <select
          value={selectedPackId || ''}
          onChange={(e) => setSelectedPackId(Number(e.target.value))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 mb-4"
        >
          <option value="" disabled>-- 请选择词库 --</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}（{p.word_count}词）</option>
          ))}
        </select>
        <button
          onClick={() => {
            const pack = packs.find(p => p.id === selectedPackId);
            if (pack) navigate(`/batch-learn?pack_id=${pack.id}&name=${encodeURIComponent(pack.name)}`);
          }}
          disabled={!selectedPackId}
          className={`w-full py-3 rounded-xl text-white font-bold text-lg transition-all ${
            selectedPackId ? 'bg-primary-500 hover:bg-primary-600 active:scale-95' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          🚀 开始跟读学习
        </button>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">获取单词...</p>
      </div>
    );
  }

  // No words left
  if (words.length === 0) {
    return (
      <div className="page-container text-center py-16">
        <span className="text-6xl mb-4 block">🎉</span>
        <h2 className="text-xl font-bold text-gray-700">全部学完！</h2>
        <p className="text-gray-500 mt-2 mb-6">{packName} 所有单词已完成学习</p>
        <div className="flex gap-3 justify-center">
          <button onClick={handleNextBatch} className="btn-primary">🔄 刷新</button>
          <button onClick={() => navigate('/packs')} className="btn-secondary">切换词库</button>
        </div>
      </div>
    );
  }

  // ── PHASE: Overview ──────────────────────────────────────────
  if (phase === 'overview') {
    return (
      <div className="page-container max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">📖 {packName}</h1>
          <select
            value={packId || ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              const pack = packs.find(p => p.id === id);
              if (pack) navigate(`/batch-learn?pack_id=${id}&name=${encodeURIComponent(pack.name)}`);
            }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
          >
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <p className="text-gray-500 text-sm mb-4">
          本批共 <strong className="text-primary-600">{words.length}</strong> 个单词，通过 3 轮跟读快速记忆
        </p>

        {/* Word list cards */}
        <div className="space-y-2 mb-6" ref={printRef}>
          {words.map((w, i) => (
            <div key={w.id} className="card flex items-center justify-between p-4">
              <div>
                <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                <span className="font-semibold text-gray-800">{w.english}</span>
                {w.phonetic && <span className="text-gray-400 text-sm ml-2">/{w.phonetic}/</span>}
                <span className="text-gray-500 ml-2">— {w.chinese}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); speak(w.english); }}
                className="p-2 rounded-full hover:bg-primary-50 text-primary-500 transition-colors"
                title="点击发音"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={startReading} className="btn-primary flex-1 py-4 text-lg font-bold">
            🎧 开始跟读学习
          </button>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            🖨️ 打印词条
          </button>
          <button onClick={handleOpenWordBank} className="btn-secondary flex items-center gap-2">
            📖 查看词库
          </button>
        </div>

        {message && (
          <div className={`mt-4 text-center text-sm px-4 py-2 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700' :
            message.type === 'info' ? 'bg-blue-50 text-blue-700' :
            'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  // ── PHASE: Reading (3 rounds per word) ───────────────────────
  if (phase === 'reading') {
    const word = words[wordIndex];
    if (!word) return null;

    const totalSteps = words.length * ROUND_TOTAL;
    const currentStep = wordIndex * ROUND_TOTAL + round + 1;
    const progressPct = (currentStep / totalSteps) * 100;

    // Content varies by round
    const showChinese = round === 0; // Round 1 shows Chinese, Rounds 2-3 don't
    const showPhonetic = round < 2; // Rounds 1-2 show phonetic

    return (
      <div className="page-container max-w-lg mx-auto text-center">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Progress text */}
        <p className="text-sm text-gray-500 mb-6">
          单词 <strong className="text-primary-600">{wordIndex + 1}</strong>/{words.length}
          &nbsp;·&nbsp; 第 <strong className="text-primary-600">{round + 1}</strong>/{ROUND_TOTAL} 轮 · {ROUND_LABELS[round]}
        </p>

        {/* Word display */}
        <div className="card p-8 mb-6">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">{word.english}</h2>
          {showPhonetic && word.phonetic && (
            <p className="text-gray-400 text-sm mb-2">/{word.phonetic}/</p>
          )}
          {showChinese && (
            <p className="text-2xl text-primary-600 font-semibold mt-4">{word.chinese}</p>
          )}
        </div>

        {/* Speaking indicator */}
        {speaking && (
          <div className="flex items-center justify-center gap-2 mb-4 text-primary-500">
            <div className="animate-bounce">🔊</div>
            <span className="text-sm">播放中...</span>
          </div>
        )}

        {/* Word indicator dots */}
        <div className="flex justify-center gap-2 mb-6">
          {words.map((w, i) => (
            <div
              key={w.id}
              className={`w-3 h-3 rounded-full transition-all ${
                i < wordIndex ? 'bg-green-500' :
                i === wordIndex ? 'bg-primary-500 scale-125' :
                'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* "我会了" button */}
        <button
          onClick={handleGotIt}
          disabled={speaking}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg transition-all ${
            speaking
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 active:scale-95'
          }`}
        >
          {speaking ? '🔊 听读中...' : round < 2 ? '✅ 我会了，继续' : '✅ 这个词记住了！'}
        </button>

        {/* Skip hint */}
        {!speaking && (
          <p className="text-xs text-gray-400 mt-2">跟读后点击按钮进入下一步</p>
        )}

        {/* Replay button */}
        {!speaking && (
          <button
            onClick={() => playCurrentWord(wordIndex, round)}
            className="mt-3 text-sm text-primary-500 hover:text-primary-600 underline"
          >
            🔄 再听一遍
          </button>
        )}
      </div>
    );
  }

  // ── PHASE: Recall Check ──────────────────────────────────────
  if (phase === 'recall') {
    const word = words[recallIndex];
    if (!word) return null;

    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <p className="text-sm text-gray-500 mb-4">
          快速检查 · {recallIndex + 1}/{words.length}
        </p>

        <div className="flex justify-center gap-2 mb-6">
          {words.map((w, i) => (
            <div
              key={w.id}
              className={`w-3 h-3 rounded-full ${
                i < recallIndex ? 'bg-green-500' :
                i === recallIndex ? 'bg-primary-500 scale-125' :
                'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Flip card */}
        <div
          className="card-flip w-full max-w-md mx-auto cursor-pointer min-h-[200px]"
          onClick={!flipped ? handleRecallFlip : undefined}
        >
          <div
            className="relative w-full min-h-[200px] flex items-center justify-center"
            style={{ perspective: '1000px' }}
          >
            <div
              className="w-full transition-all duration-500"
              style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d' }}
            >
              {!flipped ? (
                <div className="card flex flex-col items-center justify-center p-8">
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">{word.english}</h2>
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(word.english); }}
                    className="p-2 rounded-full hover:bg-primary-50 text-primary-500 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                  <p className="text-gray-400 text-sm mt-4">点击卡片查看中文释义</p>
                </div>
              ) : (
                <div
                  className="card flex flex-col items-center justify-center p-8"
                  style={{ transform: 'rotateY(180deg)' }}
                  onClick={() => setFlipped(false)}
                >
                  <h2 className="text-3xl font-bold text-primary-600 mb-2">{word.chinese}</h2>
                  <p className="text-lg text-gray-600">{word.english}</p>
                  {word.phonetic && <p className="text-gray-400 text-sm mt-1">/{word.phonetic}/</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleRecallFlip}
            className="btn-secondary flex-1"
          >
            {flipped ? '🔄 看英文' : '👀 看答案'}
          </button>
          <button onClick={handleRecallNext} className="btn-primary flex-1">
            {recallIndex < words.length - 1 ? '下一个 →' : '✅ 完成检查'}
          </button>
        </div>
      </div>
    );
  }

  // ── PHASE: Complete ──────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">跟读完成！</h2>
        <p className="text-gray-500 mb-6">
          你已经完成了 {words.length} 个单词的 3 轮跟读学习
        </p>

        {/* Summary cards */}
        <div className="space-y-2 mb-6 text-left">
          {words.map((w, i) => (
            <div key={w.id} className="card flex items-center justify-between p-3">
              <div>
                <span className="font-semibold text-gray-800">{w.english}</span>
                <span className="text-gray-400 text-sm ml-2">/{w.phonetic}/</span>
                <span className="text-gray-500 ml-2">— {w.chinese}</span>
              </div>
              <span className="text-green-500">✅</span>
            </div>
          ))}
        </div>

        {message && (
          <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700' :
            message.type === 'info' ? 'bg-blue-50 text-blue-700' :
            'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCompleteStudy}
            disabled={saving}
            className={`btn-primary flex-1 py-4 text-lg font-bold ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? '⏳ 保存中...' : '📝 标记为已学'}
          </button>
          <button onClick={() => navigate('/learn?pack_id=' + packId + '&name=' + encodeURIComponent(packName))} className="btn-secondary">
            去练习
          </button>
        </div>

        <div className="flex gap-3 mt-3">
          <button onClick={handleNextBatch} className="flex-1 py-3 rounded-xl border-2 border-primary-300 text-primary-600 font-bold hover:bg-primary-50 transition-all">
            📚 继续下一批
          </button>
          <button onClick={() => navigate('/')} className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-all">
            🏠 返回首页
          </button>
        </div>
      </div>
    );
  }

  // ── Word Bank Modal ──────────────────────────────────────────
  if (showWordBank) {
    const filtered = wordBankSearch
      ? allPackWords.filter(w =>
          w.english.toLowerCase().includes(wordBankSearch.toLowerCase()) ||
          w.chinese.includes(wordBankSearch)
        )
      : allPackWords;

    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-lg font-bold">📖 词库 · {packName}</h2>
            <button
              onClick={() => { setShowWordBank(false); setWordBankSearch(''); }}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3 shrink-0">
            <input
              type="text"
              value={wordBankSearch}
              onChange={(e) => setWordBankSearch(e.target.value)}
              placeholder="🔍 搜索单词..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white"
            />
          </div>

          {/* Loading */}
          {wordBankLoading && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin text-3xl mb-2">⏳</div>
                <p className="text-sm text-gray-400">加载词库...</p>
              </div>
            </div>
          )}

          {/* Word count */}
          {!wordBankLoading && (
            <p className="text-xs text-gray-400 px-5 mb-2">
              共 {allPackWords.length} 词
              {wordBankSearch && <span> · 筛选 {filtered.length} 词</span>}
            </p>
          )}

          {/* Word list */}
          {!wordBankLoading && (
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1">
              {filtered.map((w, i) => (
                <div key={w.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                      <span className="font-semibold text-gray-800">{w.english}</span>
                      {w.phonetic && (
                        <span className="text-xs text-gray-400">/{w.phonetic}/</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 ml-7">{w.chinese}</p>
                  </div>
                  <button
                    onClick={() => speak(w.english)}
                    className="p-2 rounded-full hover:bg-primary-50 text-primary-500 transition-colors shrink-0"
                    title="点击发音"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                </div>
              ))}
              {filtered.length === 0 && wordBankSearch && (
                <p className="text-center text-gray-400 py-8">没有找到匹配的单词</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default BatchLearn;
