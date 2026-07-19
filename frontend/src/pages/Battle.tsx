import React, { useEffect, useState, useRef, useCallback } from 'react';
import { gameApi, BattleWord, BattleResultData } from '../services/api';
import { speak } from '../utils/speech';

type BattleState = 'start' | 'playing' | 'result';

const TIMER_SECONDS = 8;
const TOTAL_QUESTIONS = 10;

const Battle: React.FC = () => {
  const [state, setState] = useState<BattleState>('start');
  const [words, setWords] = useState<BattleWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<BattleResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentWord = words[currentIndex];

  const startGame = async () => {
    setLoading(true);
    try {
      const res = await gameApi.getBattleWords(TOTAL_QUESTIONS);
      setWords(res.data);
      setCurrentIndex(0);
      setScore(0);
      setCorrectCount(0);
      setCombo(0);
      setMaxCombo(0);
      setSelectedOption(null);
      setIsCorrect(null);
      setResult(null);
      setState('playing');
      setTimeLeft(TIMER_SECONDS);
    } catch (err) {
      console.error('Failed to start battle', err);
    } finally {
      setLoading(false);
    }
  };

  const advanceWord = useCallback(() => {
    if (currentIndex + 1 >= words.length) {
      // Game over
      endGame();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setTimeLeft(TIMER_SECONDS);
    }
  }, [currentIndex, words.length]);

  const endGame = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('result');
    try {
      const res = await gameApi.submitBattleResult({
        score,
        total_questions: TOTAL_QUESTIONS,
        correct_answers: correctCount,
        max_combo: maxCombo,
      });
      setResult(res.data);
    } catch {
      // Result display even without server confirmation
    }
  }, [score, correctCount, maxCombo]);

  // Timer effect
  useEffect(() => {
    if (state !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Time's up - answer wrong
          setCombo(0);
          advanceWord();
          return TIMER_SECONDS;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state, advanceWord, currentIndex]);

  // Speak the word when it changes
  useEffect(() => {
    if (currentWord) {
      speak(currentWord.english);
    }
  }, [currentIndex, currentWord]);

  const handleOptionSelect = (optionIndex: number) => {
    if (selectedOption !== null || !currentWord) return;

    const correct = optionIndex === currentWord.correct_index;
    setSelectedOption(optionIndex);
    setIsCorrect(correct);

    // Update combo
    if (correct) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);
      setCorrectCount((c) => c + 1);
      setScore((s) => s + 1);
    } else {
      setCombo(0);
    }

    // Advance after a short delay
    setTimeout(() => {
      advanceWord();
    }, correct ? 800 : 1500);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin text-4xl">⚔️</div>
          <p className="text-gray-500 mt-2">准备战斗...</p>
        </div>
      </div>
    );
  }

  // Start screen
  if (state === 'start') {
    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">单词大乱斗</h1>
          <p className="text-gray-500 mb-4">限时配对挑战，看看谁更快！</p>

          <div className="bg-orange-50 rounded-xl p-4 mb-6 text-left text-sm text-orange-700 space-y-2">
            <p>🎯 规则说明：</p>
            <ul className="space-y-1">
              <li>• 共 {TOTAL_QUESTIONS} 题，每题{TIMER_SECONDS}秒</li>
              <li>• 选出正确的释义配对</li>
              <li>• 连续答对可获得连击加分</li>
              <li>• 答错连击归零</li>
              <li>• 🏆 连击 ≥ 5 额外加分！</li>
            </ul>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all active:scale-[0.98] shadow-lg"
          >
            🎮 开始挑战
          </button>
        </div>
      </div>
    );
  }

  // Playing screen
  if (state === 'playing' && currentWord) {
    const timerPercent = (timeLeft / TIMER_SECONDS) * 100;
    const timerColor = timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 5 ? 'bg-yellow-500' : 'bg-green-500';

    return (
      <div className="page-container max-w-lg mx-auto">
        {/* Top bar: progress + combo */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-500">
            第 {currentIndex + 1} / {TOTAL_QUESTIONS}
          </div>
          {combo >= 3 && (
            <div className="text-orange-500 font-bold text-sm animate-pulse">
              🔥 连击 {combo}x
            </div>
          )}
          <div className="text-sm font-bold text-gray-700">
            ⭐ {score}
          </div>
        </div>

        {/* Timer bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>

        {/* Word card */}
        <div className="bg-white rounded-2xl shadow-md p-8 text-center mb-4">
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {currentWord.english}
          </div>
          <button
            onClick={() => speak(currentWord.english)}
            className="text-blue-500 hover:text-blue-600 text-sm"
          >
            🔊 点击发音
          </button>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2">
          {currentWord.options.map((option, i) => {
            let btnClass = 'bg-white border-2 border-gray-100 hover:border-primary-300 text-gray-800';
            if (selectedOption !== null) {
              if (i === currentWord.correct_index) {
                btnClass = 'bg-green-50 border-2 border-green-400 text-green-700';
              } else if (i === selectedOption && !isCorrect) {
                btnClass = 'bg-red-50 border-2 border-red-400 text-red-700';
              } else {
                btnClass = 'bg-gray-50 border-2 border-gray-100 text-gray-400';
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleOptionSelect(i)}
                disabled={selectedOption !== null}
                className={`p-4 rounded-xl font-medium text-sm transition-all active:scale-[0.97] ${btnClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Result screen
  if (state === 'result') {
    const percent = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
    const grade = percent >= 90 ? '🏆' : percent >= 70 ? '🎉' : percent >= 50 ? '💪' : '📚';

    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <div className="text-6xl mb-4">{grade}</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {percent >= 70 ? '太棒了！' : percent >= 50 ? '继续加油！' : '多多练习！'}
          </h1>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">正确率</span>
              <span className="font-bold">{correctCount}/{TOTAL_QUESTIONS} ({percent}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">最高连击</span>
              <span className="font-bold text-orange-600">{maxCombo}x</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">最终得分</span>
              <span className="font-bold text-yellow-600">{score}</span>
            </div>
            {result && (
              <>
                <div className="border-t border-gray-200 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">⭐ 获得星星</span>
                  <span className="font-bold text-yellow-600">+{result.stars_earned}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">🍖 获得食物</span>
                  <span className="font-bold text-orange-600">+{result.food_earned}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{result.message}</p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={startGame}
              className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 transition-all active:scale-[0.98]"
            >
              🔄 再来一局
            </button>
            <button
              onClick={() => setState('start')}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              🏠 返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Battle;
