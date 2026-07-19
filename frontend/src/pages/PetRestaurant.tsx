import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameApi, learningApi, PetData, GameStatsData } from '../services/api';

interface ReviewWord {
  id: number;
  english: string;
  chinese: string;
  phonetic: string;
}

type ViewState = 'menu' | 'playing' | 'result';

const PET_EMOJIS: Record<number, string> = {
  1: '🥚', 2: '🐣', 3: '🐥', 4: '🐦', 5: '🕊️',
  6: '🐤', 7: '🐱', 8: '🐶', 9: '🦊', 10: '🐯',
};

const getPetEmoji = (level: number): string => {
  const keys = Object.keys(PET_EMOJIS).map(Number).sort((a, b) => a - b);
  let emoji = '🐾';
  for (const k of keys) {
    if (level >= k) emoji = PET_EMOJIS[k];
  }
  return emoji;
};

const getHungerLevel = (food: number): { label: string; emoji: string; color: string } => {
  if (food <= 2) return { label: '饿扁了', emoji: '😫', color: 'text-red-500' };
  if (food <= 5) return { label: '有点饿', emoji: '😐', color: 'text-orange-500' };
  if (food <= 10) return { label: '饱饱的', emoji: '😊', color: 'text-green-500' };
  return { label: '吃撑了', emoji: '😋', color: 'text-purple-500' };
};

const FOOD_EMOJIS = ['🍎', '🍗', '🍰', '🍕', '🥩', '🍦', '🍩', '🍪'];

const PetRestaurant: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('menu');
  const [pet, setPet] = useState<PetData | null>(null);
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quality, setQuality] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalReviewed, setTotalReviewed] = useState(0);
  const [totalFood, setTotalFood] = useState(0);
  const [foodAnimations, setFoodAnimations] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [petRes, reviewRes] = await Promise.all([
        gameApi.getPet(),
        learningApi.reviewList().catch(() => ({ data: [] })),
      ]);
      setPet(petRes.data);
      setWords(reviewRes.data || []);
    } catch {
      setMessage('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerFoodAnimation = useCallback(() => {
    const id = Date.now();
    const emoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
    const x = Math.random() * 60 + 20;
    setFoodAnimations((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFoodAnimations((prev) => prev.filter((a) => a.id !== id));
    }, 1200);
  }, []);

  const handleQuality = async (q: number) => {
    if (submitting || !pet || !words[currentIndex]) return;
    setQuality(q);
    setShowAnswer(true);
    setSubmitting(true);

    try {
      const res = await learningApi.review(words[currentIndex].id, q);
      const foodEarned = res.data.food_earned || 0;
      setTotalReviewed((prev) => prev + 1);
      if (q >= 3) {
        setCorrectCount((prev) => prev + 1);
      }
      if (foodEarned > 0) {
        setTotalFood((prev) => prev + foodEarned);
        setPet((prev) => prev ? { ...prev, food: prev.food + foodEarned } : prev);
        for (let i = 0; i < foodEarned; i++) {
          setTimeout(() => triggerFoodAnimation(), i * 300);
        }
      }
    } catch {
      // review failed silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setQuality(null);
    setShowAnswer(false);
    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setView('result');
    }
  };

  const handleStart = () => {
    if (words.length === 0) {
      setMessage('暂无待复习的单词，先去学习新词吧！');
      return;
    }
    setCurrentIndex(0);
    setCorrectCount(0);
    setTotalReviewed(0);
    setTotalFood(0);
    setQuality(null);
    setShowAnswer(false);
    setFoodAnimations([]);
    setView('playing');
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin text-5xl mb-3">🍽️</div>
          <p className="text-gray-500">餐厅准备中...</p>
        </div>
      </div>
    );
  }

  const hunger = pet ? getHungerLevel(pet.food) : { label: '未知', emoji: '🤔', color: 'text-gray-400' };

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* Food rain animations */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {foodAnimations.map((anim) => (
          <div
            key={anim.id}
            className="absolute text-3xl animate-bounce"
            style={{
              left: `${anim.x}%`,
              top: '-5%',
              animation: 'foodFall 1.2s ease-out forwards',
            }}
          >
            {anim.emoji}
          </div>
        ))}
      </div>

      {/* ==================== MENU VIEW ==================== */}
      {view === 'menu' && (
        <>
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">🏪 宠物餐厅</h1>
            <p className="text-gray-500 text-sm mt-1">复习单词赚取食物，喂饱你的小宠物！</p>
          </div>

          {/* Pet & hunger display */}
          {pet && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-md p-6 mb-4 text-center relative overflow-hidden border border-amber-200">
              <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-r from-amber-100 to-orange-100" />
              <div className="relative">
                {/* Pet */}
                <span className="text-6xl inline-block mt-2">{getPetEmoji(pet.level)}</span>
                <h2 className="text-lg font-bold text-gray-800 mt-1">
                  {pet.name} <span className="text-sm font-normal text-gray-500">Lv.{pet.level}</span>
                </h2>

                {/* Hunger status */}
                <div className="inline-flex items-center gap-2 mt-2 bg-white/80 rounded-full px-4 py-1.5">
                  <span className={`text-xl ${hunger.color}`}>{hunger.emoji}</span>
                  <span className={`text-sm font-bold ${hunger.color}`}>{hunger.label}</span>
                </div>

                {/* Food bar */}
                <div className="mt-4 max-w-xs mx-auto">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>🍖 食物储量</span>
                    <span>{pet.food}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (pet.food / 20) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                  <span>📝 待复习: <strong>{words.length}</strong></span>
                  <span>⭐ 已学: <strong>{pet.level * 50 + pet.exp}词</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Restaurant theme cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center border border-green-100">
              <span className="text-3xl">🍽️</span>
              <p className="font-bold text-green-700 text-sm mt-1">今日菜单</p>
              <p className="text-xs text-gray-500">{words.length} 道单词料理</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center border border-amber-100">
              <span className="text-3xl">👨‍🍳</span>
              <p className="font-bold text-amber-700 text-sm mt-1">大厨评分</p>
              <p className="text-xs text-gray-500">回忆准确度 0-5</p>
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={words.length === 0}
            className={`w-full py-4 rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-95 ${
              words.length > 0
                ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white hover:from-orange-500 hover:to-amber-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {words.length > 0 ? `🍽️ 开始用餐 (${words.length}道菜)` : '🍽️ 暂无菜品'}
          </button>

          {message && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 text-sm text-center">
              {message}
            </div>
          )}

          {/* Tips */}
          <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-yellow-700">
            <p className="font-bold">💡 用餐规则</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              <li>• 每个单词根据记忆质量获得 0-3 🍖 食物</li>
              <li>• <strong>评分 3</strong> = 想起来了 +1 份食物</li>
              <li>• <strong>评分 4</strong> = 比较熟练 +2 份食物</li>
              <li>• <strong>评分 5</strong> = 完全掌握 +3 份食物</li>
              <li>• 评分 0-2 表示还没记住，不奖励食物</li>
            </ul>
          </div>
        </>
      )}

      {/* ==================== PLAYING VIEW ==================== */}
      {view === 'playing' && words[currentIndex] && (
        <div>
          {/* Progress header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setView('menu')} className="text-gray-400 hover:text-gray-600">
              ← 返回
            </button>
            <div className="text-sm text-gray-500">
              <span className="font-bold text-orange-500">{currentIndex + 1}</span> / {words.length}
            </div>
            <div className="flex items-center gap-1 text-sm text-orange-600">
              <span>🍖</span>
              <span className="font-bold">{pet?.food || 0}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
            />
          </div>

          {/* Restaurant plate content */}
          <div className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-md p-6 mb-4 border border-orange-100">
            {/* Plate decoration */}
            <div className="text-center mb-4">
              <span className="text-4xl">🍽️</span>
              <div className="text-xs text-gray-400 mt-1">第 {currentIndex + 1} 道菜</div>
            </div>

            {/* Word display */}
            <div className="text-center mb-6">
              <p className="text-3xl font-bold text-gray-800 mb-1">{words[currentIndex].english}</p>
              {words[currentIndex].phonetic && (
                <p className="text-sm text-gray-400">{words[currentIndex].phonetic}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">这个词的意思是？</p>
            </div>

            {/* Quality buttons (self-assessment) */}
            {!showAnswer ? (
              <div>
                <p className="text-sm text-center text-gray-500 mb-3">你的记忆程度？</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '忘了', emoji: '😵', val: 0 },
                    { label: '模糊', emoji: '🤔', val: 1 },
                    { label: '有点印象', emoji: '🧐', val: 2 },
                    { label: '想起来了', emoji: '😊', val: 3 },
                    { label: '很熟悉', emoji: '😄', val: 4 },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => handleQuality(btn.val)}
                      disabled={submitting}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white border border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-all active:scale-90"
                    >
                      <span className="text-2xl">{btn.emoji}</span>
                      <span className="text-[10px] text-gray-500">{btn.label}</span>
                      <span className="text-xs font-bold text-orange-500">{btn.val}</span>
                    </button>
                  ))}
                </div>
                {/* Show perfect button separately */}
                <button
                  onClick={() => handleQuality(5)}
                  disabled={submitting}
                  className="w-full mt-3 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 transition-all active:scale-95 shadow-md"
                >
                  ⭐ 满分 (5) - 脱口而出！
                </button>
              </div>
            ) : (
              /* Answer result */
              <div className="text-center">
                <div className="text-5xl mb-3">
                  {quality !== null && quality >= 3 ? '🎉' : '💪'}
                </div>
                <p className="text-lg font-bold text-gray-700 mb-2">
                  {words[currentIndex].chinese}
                </p>
                {quality !== null && (
                  <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3
                    ${quality >= 4 ? 'bg-green-100 text-green-700' : quality >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {quality >= 5 ? '⭐ 完美记忆！+3🍖' :
                     quality >= 4 ? '👍 很熟练！+2🍖' :
                     quality >= 3 ? '👌 想起来了！+1🍖' :
                     '😅 没想起来，下次加油'}
                  </div>
                )}

                {/* Show example if available */}
                {words[currentIndex].phonetic && (
                  <p className="text-xs text-gray-400 mt-1">音标: {words[currentIndex].phonetic}</p>
                )}

                <button
                  onClick={handleNext}
                  className="w-full mt-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 transition-all active:scale-95"
                >
                  {currentIndex < words.length - 1 ? '🍽️ 下一道菜 →' : '🏁 用餐完毕！'}
                </button>
              </div>
            )}
          </div>

          {/* Stats mini */}
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <span>✅ {correctCount}</span>
            <span>🍖 +{totalFood}</span>
          </div>
        </div>
      )}

      {/* ==================== RESULT VIEW ==================== */}
      {view === 'result' && (
        <div>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">🍽️ 用餐完毕！</h1>
            <p className="text-gray-500 text-sm mt-1">来看看这顿饭的成果吧~</p>
          </div>

          {/* Pet happy reaction */}
          {pet && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-md p-6 text-center border border-amber-200 mb-4">
              <span className="text-7xl inline-block animate-bounce">{getPetEmoji(pet.level)}</span>
              <h2 className="text-xl font-bold text-gray-800 mt-2">{pet.name}</h2>
              <p className="text-sm text-gray-500">
                {totalFood > 0
                  ? `🍖 吃到了 ${totalFood} 份食物，好开心！`
                  : '虽然没有吃到食物，但学习就是最好的成长！💪'}
              </p>
            </div>
          )}

          {/* Result cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <span className="text-3xl">📝</span>
              <p className="text-2xl font-bold text-gray-800 mt-1">{totalReviewed}</p>
              <p className="text-xs text-gray-500">复习单词</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <span className="text-3xl">✅</span>
              <p className="text-2xl font-bold text-green-600 mt-1">{correctCount}</p>
              <p className="text-xs text-gray-500">正确回忆</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <span className="text-3xl">🍖</span>
              <p className="text-2xl font-bold text-orange-600 mt-1">{totalFood}</p>
              <p className="text-xs text-gray-500">获得食物</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <span className="text-3xl">🎯</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500">准确率</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleStart}
              className="w-full py-4 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 transition-all active:scale-95 shadow-lg"
            >
              🍽️ 再来一餐
            </button>
            <button
              onClick={() => navigate('/kid-home')}
              className="w-full py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              🏠 回到乐园
            </button>
          </div>
        </div>
      )}

      {/* CSS for food fall animation */}
      <style>{`
        @keyframes foodFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PetRestaurant;
