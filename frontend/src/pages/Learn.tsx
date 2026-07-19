import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { learningApi, TodayTask, packsApi, WordPack } from '../services/api';
import WordCard from '../components/WordCard';

interface WordItem {
  id: number;
  english: string;
  chinese: string;
  phonetic: string;
  example_en: string;
  example_cn: string;
}

const Learn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const packId = searchParams.get('pack_id') ? Number(searchParams.get('pack_id')) : undefined;
  const packName = searchParams.get('name') ? decodeURIComponent(searchParams.get('name')!) : '';

  const [task, setTask] = useState<TodayTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<number>(packId || 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'review' | 'new'>('review');
  const [studying, setStudying] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Word bank state
  const [showAllWords, setShowAllWords] = useState(false);
  const [allWords, setAllWords] = useState<WordItem[]>([]);
  const [allWordsLoading, setAllWordsLoading] = useState(false);
  const [wordSearch, setWordSearch] = useState('');

  const words: WordItem[] = mode === 'review' ? (task?.to_review || []) : (task?.new_words || []);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await learningApi.today(packId);
      setTask(res.data);
      // If there are review words, start with review mode
      if (res.data.to_review?.length > 0) {
        setMode('review');
      } else if (res.data.new_words?.length > 0) {
        setMode('new');
      }
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    fetchTask();
    packsApi.list().then(res => setPacks(res.data)).catch(() => {});
  }, [fetchTask]);

  const handleStudy = async (wordId: number) => {
    setStudying(true);
    try {
      const res = await learningApi.study(wordId);
      if (res.data.message === 'success') {
        setMessage({ text: '✅ 已学习！', type: 'success' });
      } else if (res.data.message === 'already_learned') {
        setMessage({ text: 'ℹ️ 已经学过了', type: 'info' });
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.detail || '学习失败', type: 'error' });
    } finally {
      setStudying(false);
    }
  };

  const handleShowWordBank = useCallback(async () => {
    if (!packId) return;
    setAllWordsLoading(true);
    try {
      const res = await packsApi.words(packId);
      setAllWords(res.data);
      setShowAllWords(true);
    } catch (err) {
      setMessage({ text: '获取词库失败', type: 'error' });
    } finally {
      setAllWordsLoading(false);
    }
  }, [packId]);

  const handleNext = () => {
    setMessage(null);
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (mode === 'review' && (task?.new_words?.length || 0) > 0) {
      // Switch to new words
      setMode('new');
      setCurrentIndex(0);
    } else {
      // Done
      setMessage({ text: '🎉 当前任务已完成！', type: 'success' });
    }
  };

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载学习任务...</p>
      </div>
    );
  }

  if (!task || (words.length === 0)) {
    if (!packId) {
      // No pack selected — show inline selector
      return (
        <div className="page-container max-w-md mx-auto text-center py-12">
          <span className="text-6xl mb-4 block">📚</span>
          <h2 className="text-xl font-bold text-gray-700 mb-2">选择词库</h2>
          <p className="text-gray-500 text-sm mb-6">请先选择一个词库开始学习</p>
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
              if (pack) navigate(`/learn?pack_id=${pack.id}&name=${encodeURIComponent(pack.name)}`);
            }}
            disabled={!selectedPackId}
            className={`w-full py-3 rounded-xl text-white font-bold text-lg transition-all ${
              selectedPackId ? 'bg-primary-500 hover:bg-primary-600 active:scale-95' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            🚀 开始学习
          </button>
        </div>
      );
    }
    // pack_id set but no words
    return (
      <div className="page-container text-center py-16">
        <span className="text-6xl mb-4 block">🎉</span>
        <h2 className="text-xl font-bold text-gray-700">该词库暂无学习任务</h2>
        <p className="text-gray-500 mt-2 mb-6">{packName} 没有需要学习或复习的单词</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/packs')} className="btn-primary">切换词库</button>
          <button onClick={fetchTask} className="btn-secondary">刷新</button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  if (!currentWord) {
    return (
      <div className="page-container text-center py-16">
        <span className="text-6xl mb-4 block">🎉</span>
        <h2 className="text-xl font-bold text-gray-700">全部完成！</h2>
        <button onClick={fetchTask} className="btn-primary mt-4">
          继续学习
        </button>
      </div>
    );
  }

  // ── Word Bank View ──────────────────────────────────────────
  if (showAllWords) {
    const filteredWords = wordSearch
      ? allWords.filter(w =>
          w.english.toLowerCase().includes(wordSearch.toLowerCase()) ||
          w.chinese.includes(wordSearch)
        )
      : allWords;

    return (
      <div className="page-container max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">📖 词库 · {packName}</h1>
          <button
            onClick={() => { setShowAllWords(false); setWordSearch(''); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 返回学习
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={wordSearch}
          onChange={(e) => setWordSearch(e.target.value)}
          placeholder="🔍 搜索单词..."
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white mb-3"
        />

        {/* Loading */}
        {allWordsLoading && (
          <div className="text-center py-8">
            <div className="animate-spin text-4xl">⏳</div>
            <p className="text-gray-500 mt-2">加载词库...</p>
          </div>
        )}

        {/* Word count */}
        {!allWordsLoading && (
          <p className="text-xs text-gray-400 mb-2">
            共 {allWords.length} 词
            {wordSearch && <span> · 筛选出 {filteredWords.length} 词</span>}
          </p>
        )}

        {/* Word list */}
        {!allWordsLoading && (
          <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredWords.map((w, i) => (
              <div key={w.id} className="card flex items-center justify-between p-3">
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
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance(w.english);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.9;
                    speechSynthesis.speak(utterance);
                  }}
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
            {filteredWords.length === 0 && wordSearch && (
              <p className="text-center text-gray-400 py-8">没有找到匹配的单词</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold">
            {mode === 'review' ? '🔄 复习' : '📖 学习新词'}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <select
              value={packId || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                const pack = packs.find(p => p.id === id);
                if (pack) navigate(`/learn?pack_id=${id}&name=${encodeURIComponent(pack.name)}`);
              }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              {packs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">|</span>
            <button onClick={() => navigate('/packs')} className="text-xs text-primary-600 hover:underline">
              全部词库
            </button>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {packId && (
            <button
              onClick={handleShowWordBank}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
            >
              📖 词库
            </button>
          )}
          <button onClick={fetchTask} className="text-xs text-gray-500 hover:underline">
            刷新
          </button>
        </div>
      </div>
      {/* Progress */}
      <p className="text-sm text-gray-500 mb-2">
        {currentIndex + 1} / {words.length}
      </p>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
        />
      </div>

      {/* Word Card */}
      <WordCard
        english={currentWord.english}
        chinese={currentWord.chinese}
        phonetic={currentWord.phonetic}
        example_en={currentWord.example_en}
        example_cn={currentWord.example_cn}
      />

      {/* Message */}
      {message && (
        <div className={`mt-4 text-center text-sm px-4 py-2 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' :
          message.type === 'info' ? 'bg-blue-50 text-blue-700' :
          'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-6">
        {mode === 'new' && (
          <button
            onClick={() => handleStudy(currentWord.id)}
            disabled={studying}
            className="btn-primary flex-1"
          >
            {studying ? '学习中...' : '✅ 标记学习'}
          </button>
        )}
        <button onClick={handleNext} className={`${mode === 'new' ? 'btn-secondary' : 'btn-primary'} flex-1`}>
          {currentIndex < words.length - 1 ? '下一个 →' : mode === 'review' && (task?.new_words?.length || 0) > 0 ? '→ 学新词' : '✅ 完成'}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 text-sm text-gray-400 text-center">
        <span>待复习: {task?.stats?.review_count || 0} / </span>
        <span>新词: {task?.stats?.new_available || 0} / </span>
        <span>已学: {task?.stats?.total_learned || 0}</span>
      </div>

      {/* Batch learning link */}
      {packId && (
        <div className="mt-4">
          <button
            onClick={() => navigate(`/batch-learn?pack_id=${packId}&name=${encodeURIComponent(packName)}`)}
            className="w-full py-3 rounded-xl border-2 border-primary-200 bg-primary-50 text-primary-700 font-bold hover:bg-primary-100 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            🎧 批量跟读学习（每次5词·3轮跟读）
          </button>
        </div>
      )}
    </div>
  );
};

export default Learn;
