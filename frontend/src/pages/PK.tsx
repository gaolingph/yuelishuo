import React, { useEffect, useState, useCallback } from 'react';
import { pkApi, pkApi as pkApiService } from '../services/api';

interface PKWord {
  id: number;
  word_id: number;
  english: string;
  chinese: string;
  options?: string[];
  correct_index?: number;
}

interface PKHistoryItem {
  id: number;
  opponent_name: string;
  score: number;
  opponent_score: number;
  is_win: boolean | null;
  played_at: string;
}

const PK: React.FC = () => {
  const [tab, setTab] = useState<'start' | 'playing' | 'result' | 'history'>('start');
  const [pkId, setPkId] = useState<number | null>(null);
  const [words, setWords] = useState<PKWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [history, setHistory] = useState<PKHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; correct: number } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctAnswer: string } | null>(null);

  useEffect(() => {
    if (tab === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
    if (timeLeft === 0 && tab === 'playing') {
      finishPK();
    }
  }, [timeLeft, tab]);

  const startPK = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pkApi.start();
      const data = res.data;
      setPkId(data.pk_id);
      setWords(data.words || []);
      setCurrentIndex(0);
      setScore(0);
      setTimeLeft(data.time_limit || 30);
      setFeedback(null);
      setSelectedAnswer(null);
      setTab('playing');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const finishPK = async () => {
    if (!pkId) return;
    try {
      const total = words.length;
      const correct = score;
      const res = await pkApi.finish({ pk_id: pkId, score, total, correct });
      setResult({ score, total, correct });
      setTab('result');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnswer = (option: string, idx: number) => {
    if (feedback || !words[currentIndex]) return;

    const q = words[currentIndex];
    const isCorrect = q.correct_index === idx;
    setSelectedAnswer(option);
    setFeedback({ correct: isCorrect, correctAnswer: q.options?.[q.correct_index || 0] || q.chinese });

    if (isCorrect) {
      setScore((s) => s + 10);
    }

    setTimeout(() => {
      if (currentIndex < words.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setFeedback(null);
        setSelectedAnswer(null);
      } else {
        finishPK();
      }
    }, 1500);
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await pkApiService.history();
      setHistory(res.data || []);
      setTab('history');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (tab === 'start' || tab === 'history') {
    return (
      <div className="page-container max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">⚔️ PK对战</h1>
          <button
            onClick={() => setTab(tab === 'history' ? 'start' : 'history')}
            className="text-sm text-primary-600 hover:underline"
          >
            {tab === 'history' ? '返回' : '对战记录'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">和过去的自己比赛，挑战词汇极限</p>

        {tab === 'history' ? (
          <>
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin text-4xl">⏳</div>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl mb-4 block">⚔️</span>
                <p className="text-gray-500">暂无对战记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h, idx) => (
                  <div key={h.id || idx} className="card !p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={h.is_win ? 'text-green-500' : h.is_win === false ? 'text-red-500' : 'text-gray-400'}>
                          {h.is_win ? '🏆 胜' : h.is_win === false ? '💔 负' : '🤝 平'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {h.opponent_name || '系统'} ({h.score}:{h.opponent_score})
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(h.played_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card text-center !p-8">
            <span className="text-6xl mb-4 block">⚔️</span>
            <h2 className="text-xl font-bold text-gray-700 mb-2">准备好挑战了吗？</h2>
            <p className="text-gray-500 text-sm mb-6">
              限时30秒，每答对一题得10分，看看你能拿多少分！
            </p>
            <button onClick={startPK} disabled={loading} className="btn-accent text-lg px-8">
              {loading ? '准备中...' : '开始对战'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'result' && result) {
    const accuracy = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    return (
      <div className="page-container max-w-lg mx-auto text-center py-16">
        <span className="text-6xl mb-4 block">
          {accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪'}
        </span>
        <h2 className="text-xl font-bold text-gray-700">对战结束！</h2>
        <p className="text-gray-500 mt-1">你的成绩</p>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="card !p-3">
            <p className="text-2xl font-bold text-primary-600">{result.score}</p>
            <p className="text-xs text-gray-500">得分</p>
          </div>
          <div className="card !p-3">
            <p className="text-2xl font-bold text-green-600">{result.correct}/{result.total}</p>
            <p className="text-xs text-gray-500">正确</p>
          </div>
          <div className="card !p-3">
            <p className="text-2xl font-bold text-amber-600">{accuracy}%</p>
            <p className="text-xs text-gray-500">正确率</p>
          </div>
        </div>

        <div className="flex gap-3 justify-center mt-6">
          <button onClick={startPK} className="btn-primary">
            再来一次
          </button>
          <button onClick={() => setTab('start')} className="btn-secondary">
            返回
          </button>
        </div>
      </div>
    );
  }

  // Playing
  const currentWord = words[currentIndex];
  if (!currentWord) {
    return (
      <div className="page-container text-center py-16">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">⚔️ PK对战</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-primary-600">🏆 {score}分</span>
          <span className={`text-sm font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
            ⏱ {timeLeft}s
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-purple-500'}`}
          style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="card !p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">{currentWord.english}</h2>
          <p className="text-gray-400 text-sm mt-1">选择中文释义</p>
        </div>

        <div className="mt-5 space-y-2">
          {currentWord.options?.map((opt: string, idx: number) => {
            let btnClass = 'w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors';
            if (feedback) {
              if (idx === currentWord.correct_index) {
                btnClass = 'w-full text-left px-4 py-3 rounded-lg border-2 border-green-500 bg-green-50 text-green-800';
              } else if (selectedAnswer === opt && !feedback.correct) {
                btnClass = 'w-full text-left px-4 py-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-800';
              } else {
                btnClass = 'w-full text-left px-4 py-3 rounded-lg border border-gray-200 opacity-50';
              }
            }
            return (
              <button
                key={idx}
                onClick={() => handleAnswer(opt, idx)}
                className={btnClass}
                disabled={!!feedback}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Timer bar */}
        <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              timeLeft <= 10 ? 'bg-red-500' : timeLeft <= 20 ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default PK;
