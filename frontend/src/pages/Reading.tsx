import React, { useEffect, useState } from 'react';
import { readingApi, ReadingPassageListItem, ReadingPassageData, LearnedVocabItem } from '../services/api';
import { speak } from '../utils/speech';

type ViewState = 'list' | 'reading' | 'quiz' | 'result';

const PACK_NAMES: Record<string, string> = {
  primary_basic: '小学基础',
  primary_advanced: '小学进阶',
  primary_waiyan_basic: '外研3起基础',
  primary_waiyan_advanced: '外研3起进阶',
};

const Reading: React.FC = () => {
  const [view, setView] = useState<ViewState>('list');
  const [passages, setPassages] = useState<ReadingPassageListItem[]>([]);
  const [stats, setStats] = useState<{ total_passages: number; completed_passages: number; average_score: number; total_words_covered: number } | null>(null);
  const [currentPassage, setCurrentPassage] = useState<ReadingPassageData | null>(null);
  const [learnedVocab, setLearnedVocab] = useState<LearnedVocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPassage, setLoadingPassage] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correct_count: number; total: number; score: number; message: string } | null>(null);
  const [error, setError] = useState('');

  const loadPassages = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await readingApi.listPassages();
      setPassages(res.data.passages);
      setStats({
        total_passages: res.data.total_passages,
        completed_passages: res.data.completed_passages,
        average_score: res.data.average_score,
        total_words_covered: res.data.total_words_covered,
      });
    } catch {
      setError('无法加载阅读列表');
      setPassages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPassages();
  }, []);

  const startReading = async (passageId: number) => {
    setLoadingPassage(true);
    setError('');
    try {
      const [passageRes, vocabRes] = await Promise.all([
        readingApi.getPassage(passageId),
        readingApi.getPassageLearnedVocab(passageId),
      ]);
      setCurrentPassage(passageRes.data);
      setLearnedVocab(vocabRes.data.vocabulary);
      setSelectedAnswers(new Array(passageRes.data.questions.length).fill(-1));
      setResult(null);
      setView('reading');
    } catch {
      setError('无法加载阅读内容');
    } finally {
      setLoadingPassage(false);
    }
  };

  const handleStartQuiz = () => {
    setView('quiz');
  };

  const handleSelectAnswer = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = answerIndex;
      return next;
    });
  };

  const handleSubmitQuiz = async () => {
    if (!currentPassage) return;
    try {
      const res = await readingApi.completePassage(currentPassage.id, selectedAnswers);
      setResult({
        correct_count: res.data.correct_count,
        total: res.data.total_questions,
        score: res.data.score,
        message: res.data.message,
      });
      setView('result');
      loadPassages();
    } catch {
      setError('提交失败，请重试');
    }
  };

  const backToList = () => {
    setView('list');
    setCurrentPassage(null);
    setSelectedAnswers([]);
    setResult(null);
  };

  // Group passages by pack_id
  const groupedPassages = passages.reduce<Record<number, ReadingPassageListItem[]>>((acc, p) => {
    if (!acc[p.pack_id]) acc[p.pack_id] = [];
    acc[p.pack_id].push(p);
    return acc;
  }, {});

  // Count completed per pack
  const packCompletion = (items: ReadingPassageListItem[]) => {
    const total = items.length;
    const done = items.filter((i) => i.progress?.is_completed).length;
    return { total, done };
  };

  const allAnswersSelected = selectedAnswers.every((a) => a >= 0);
  const learnedCount = learnedVocab.filter((v) => v.is_learned).length;

  // ====== List View ======
  if (view === 'list') {
    return (
      <div className="page-container max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📖 词汇阅读</h1>
          <p className="text-gray-500 text-sm mt-1">阅读基于已学词汇生成的篇章，巩固理解</p>
        </div>

        {/* Overall stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-600">{stats.completed_passages}/{stats.total_passages}</p>
              <p className="text-xs text-gray-500 mt-0.5">已完成篇章</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-green-600">{stats.average_score}分</p>
              <p className="text-xs text-gray-500 mt-0.5">平均得分</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{stats.total_words_covered}</p>
              <p className="text-xs text-gray-500 mt-0.5">覆盖词汇</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-2">📖</div>
            <p className="text-gray-400">加载阅读列表...</p>
          </div>
        ) : passages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <span className="text-5xl mb-4 block">📚</span>
            <p className="text-gray-500">暂无阅读篇章</p>
            <p className="text-gray-400 text-sm mt-1">继续学习单词，更多阅读将解锁</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPassages).map(([packIdStr, items]) => {
              const packId = Number(packIdStr);
              const comp = packCompletion(items);
              const packName = PACK_NAMES[items[0]?.level] || `词库 #${packId}`;
              return (
                <div key={packId}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-gray-700">
                      {packName}
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        {comp.done}/{comp.total} 完成
                      </span>
                    </h2>
                    {comp.done > 0 && comp.done === comp.total && (
                      <span className="text-xs text-green-600 font-semibold">✅ 已完成</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {items.map((p) => {
                      const isCompleted = p.progress?.is_completed;
                      const score = p.progress?.score;
                      return (
                        <button
                          key={p.id}
                          onClick={() => startReading(p.id)}
                          disabled={loadingPassage}
                          className={`w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-all active:scale-[0.98] border-l-4 ${
                            isCompleted ? 'border-green-400' : 'border-primary-400'
                          } disabled:opacity-60`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-bold text-gray-800">{p.title}</h3>
                              <p className="text-xs text-gray-400 mt-0.5">
                                📝 {p.word_count} 词
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCompleted && score !== undefined && (
                                <span className={`text-sm font-bold ${
                                  score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'
                                }`}>
                                  {score}分
                                </span>
                              )}
                              <span className="text-2xl">{isCompleted ? '✅' : '📖'}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (loadingPassage) {
    return (
      <div className="page-container max-w-3xl mx-auto text-center py-16">
        <div className="animate-spin text-4xl mb-2">📖</div>
        <p className="text-gray-400">加载阅读内容...</p>
      </div>
    );
  }

  if (!currentPassage) {
    return (
      <div className="page-container max-w-3xl mx-auto text-center py-16">
        <p className="text-gray-500">无法加载阅读内容</p>
        <button onClick={backToList} className="btn-primary mt-4">返回列表</button>
      </div>
    );
  }

  // ====== Reading View ======
  if (view === 'reading') {
    return (
      <div className="page-container max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={backToList} className="text-gray-400 hover:text-gray-600 transition-colors">
              ← 返回列表
            </button>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {PACK_NAMES[currentPassage.level] || currentPassage.level}
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">{currentPassage.title}</h2>
          <p className="text-xs text-gray-400 mb-4">📝 {currentPassage.word_count} 词</p>

          {/* Passage text */}
          <div className="bg-gray-50 rounded-xl p-5 mb-4 leading-relaxed text-gray-700 text-base whitespace-pre-line">
            {currentPassage.text}
          </div>

          {/* Read aloud button */}
          <button
            onClick={() => speak(currentPassage.text)}
            className="w-full mb-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all active:scale-[0.98]"
          >
            🔊 朗读文章
          </button>

          {/* Vocabulary section */}
          {currentPassage.vocabulary && currentPassage.vocabulary.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 text-sm mb-2">
                📝 本课词汇
                <span className="text-xs text-gray-400 ml-2">
                  ({learnedCount}/{currentPassage.vocabulary.length} 已学)
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentPassage.vocabulary.map((v, i) => {
                  const lv = learnedVocab.find((lv) => lv.word === v.word);
                  const isLearned = lv?.is_learned ?? false;
                  return (
                    <span
                      key={i}
                      className={`px-3 py-1 rounded-full text-sm cursor-pointer transition-colors border ${
                        isLearned
                          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                      }`}
                      onClick={() => speak(v.word)}
                      title={`${v.chinese} [${v.phonetic || ''}]`}
                    >
                      {v.word}
                      {isLearned && <span className="ml-1 text-xs">✓</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={backToList}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              📚 返回列表
            </button>
            {currentPassage.questions && currentPassage.questions.length > 0 && (
              <button
                onClick={handleStartQuiz}
                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 transition-all active:scale-[0.98]"
              >
                📝 开始答题 ({currentPassage.questions.length}题)
              </button>
            )}
            {(!currentPassage.questions || currentPassage.questions.length === 0) && (
              <button
                onClick={handleSubmitQuiz}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all active:scale-[0.98]"
              >
                ✅ 完成阅读
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====== Quiz View ======
  if (view === 'quiz') {
    return (
      <div className="page-container max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setView('reading')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← 返回阅读
            </button>
            <span className="text-sm text-gray-400">
              答题 {selectedAnswers.filter((a) => a >= 0).length}/{currentPassage.questions.length}
            </span>
          </div>

          <h2 className="text-lg font-bold text-gray-800 mb-1">{currentPassage.title}</h2>
          <p className="text-xs text-gray-400 mb-4">阅读理解题 — 根据文章内容选择正确答案</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">{error}</div>
          )}

          <div className="space-y-6">
            {currentPassage.questions.map((q, qi) => (
              <div key={qi} className="bg-blue-50 rounded-xl p-4">
                <p className="text-blue-800 font-bold mb-3">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((option, oi) => (
                    <button
                      key={oi}
                      onClick={() => handleSelectAnswer(qi, oi)}
                      className={`w-full p-3 rounded-xl text-left font-medium transition-all border-2 ${
                        selectedAnswers[qi] === oi
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-100 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}. {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmitQuiz}
            disabled={!allAnswersSelected}
            className={`w-full mt-6 py-3 rounded-xl font-bold transition-all ${
              allAnswersSelected
                ? 'bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {allAnswersSelected ? '✅ 提交答案' : `请回答所有题目 (${selectedAnswers.filter((a) => a >= 0).length}/${currentPassage.questions.length})`}
          </button>
        </div>
      </div>
    );
  }

  // ====== Result View ======
  if (view === 'result' && result) {
    return (
      <div className="page-container max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 text-center">
          <div className="text-6xl mb-4">{result.score >= 80 ? '🎉' : result.score >= 60 ? '💪' : '📖'}</div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {result.score >= 80 ? '太棒了！' : result.score >= 60 ? '继续加油！' : '再试一次！'}
          </h2>
          <p className="text-gray-500 mb-4">{result.message}</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📝 得分</span>
              <span className={`font-bold text-lg ${
                result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-amber-600' : 'text-red-500'
              }`}>
                {result.score} 分
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">✅ 正确</span>
              <span className="font-bold text-green-600">{result.correct_count}/{result.total}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={backToList}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              📚 返回列表
            </button>
            {result.score < 80 && (
              <button
                onClick={() => setView('reading')}
                className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 transition-all"
              >
                📖 重新阅读
              </button>
            )}
            {result.score < 80 && (
              <button
                onClick={() => {
                  setView('quiz');
                  setResult(null);
                  setSelectedAnswers(new Array(currentPassage.questions.length).fill(-1));
                }}
                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 transition-all"
              >
                🔄 重新答题
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Reading;