import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gameApi, PetData, FeedPetData } from '../services/api';
import { aiApi } from '../services/aiApi';

const PET_EMOJIS: Record<number, string> = {
  1: '🥚',
  2: '🐣',
  3: '🐥',
  4: '🐦',
  5: '🕊️',
  6: '🐤',
  7: '🐱',
  8: '🐶',
  9: '🦊',
  10: '🐯',
};

const getPetEmoji = (level: number): string => {
  const keys = Object.keys(PET_EMOJIS).map(Number).sort((a, b) => a - b);
  let emoji = '🐾';
  for (const k of keys) {
    if (level >= k) emoji = PET_EMOJIS[k];
  }
  return emoji;
};

const KidHome: React.FC = () => {
  const [pet, setPet] = useState<PetData | null>(null);
  const [feedResult, setFeedResult] = useState<FeedPetData | null>(null);
  const [foodMsg, setFoodMsg] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState(false);

  // AI Pet Coach
  const [coachTip, setCoachTip] = useState<string>('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

  const loadPet = async () => {
    try {
      const res = await gameApi.getPet();
      setPet(res.data);
    } catch {
      // Pet will be auto-created by backend
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPet();
  }, []);

  const handleFeed = async () => {
    if (!pet || pet.food < 1) return;
    setFeeding(true);
    try {
      const res = await gameApi.feedPet();
      setFeedResult(res.data);
      setPet(res.data.pet);
      // Clear level-up message after 3s
      setTimeout(() => setFeedResult(null), 3000);
    } catch (err: any) {
      setFoodMsg(err.response?.data?.detail || '喂养失败');
    } finally {
      setFeeding(false);
    }
  };

  const loadCoachTip = async () => {
    setCoachLoading(true);
    try {
      const res = await aiApi.coachTip({ child_id: 0 });
      setCoachTip(res.data.tip);
    } catch {
      setCoachTip('继续加油学习，宠物在等你喂食哦！🐾');
    } finally {
      setCoachLoading(false);
    }
  };

  const handleCoachToggle = () => {
    if (!showCoach) {
      loadCoachTip();
    }
    setShowCoach(!showCoach);
  };

  const handleEarnFood = async () => {
    try {
      const res = await gameApi.earnFood();
      setPet((prev) => prev ? { ...prev, food: res.data.total_food } : prev);
      setFoodMsg(res.data.message);
      setTimeout(() => setFoodMsg(''), 3000);
    } catch {
      setFoodMsg('今日已领取过食物奖励');
      setTimeout(() => setFoodMsg(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin text-4xl">🐾</div>
      </div>
    );
  }

  const expPercent = pet ? Math.min(100, Math.round((pet.exp / pet.exp_to_next) * 100)) : 0;

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🎮 我的学习乐园</h1>
        <p className="text-gray-500 text-sm mt-1">学习就能养宠物，一起快乐成长！</p>
      </div>

      {/* Pet Card */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-4 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-b-3xl" />

        {/* Pet emoji */}
        <div className="relative mt-2">
          <span className="text-7xl inline-block animate-bounce">{pet ? getPetEmoji(pet.level) : '🥚'}</span>
        </div>

        {/* Pet name + level */}
        <h2 className="text-xl font-bold text-gray-800 mt-2">
          {pet?.name || '小乐'}
          <span className="ml-2 text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
            Lv.{pet?.level || 1}
          </span>
        </h2>
        <p className="text-gray-400 text-xs mt-0.5">我的学习小伙伴</p>

        {/* Exp bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>成长值</span>
            <span>{pet?.exp || 0} / {pet?.exp_to_next || 50}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${expPercent}%` }}
            />
          </div>
        </div>

        {/* Food count */}
        <div className="flex items-center justify-center gap-1 mt-3 text-sm text-orange-600">
          <span>🍖</span>
          <span className="font-bold">{pet?.food || 0}</span>
          <span className="text-gray-400">份食物</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4 justify-center">
          <button
            onClick={handleFeed}
            disabled={feeding || !pet || pet.food < 1}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              pet && pet.food >= 1
                ? 'bg-orange-400 text-white hover:bg-orange-500 active:scale-95'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {feeding ? '🍖 喂养中...' : '🍖 喂食'}
          </button>
          <button
            onClick={handleEarnFood}
            className="px-5 py-2 rounded-full text-sm font-bold bg-blue-100 text-blue-600 hover:bg-blue-200 active:scale-95 transition-all"
          >
            🎁 领食物
          </button>
        </div>

        {/* Feedback messages */}
        {feedResult && feedResult.leveled_up && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm font-bold animate-pulse">
            🎉 升级了！宠物达到 Lv.{feedResult.pet.level}！
          </div>
        )}
        {feedResult && !feedResult.leveled_up && (
          <div className="mt-3 text-green-600 text-sm">{feedResult.message}</div>
        )}
        {foodMsg && (
          <div className="mt-3 text-blue-600 text-sm">{foodMsg}</div>
        )}
      </div>

      {/* AI Pet Coach */}
      <div className="mb-4">
        <button
          onClick={handleCoachToggle}
          className="w-full bg-gradient-to-r from-primary-50 to-amber-50 border border-primary-100 rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-lg shadow-sm">
            🤖
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-gray-700">AI 宠物教练</p>
            <p className="text-xs text-gray-400">点击获取学习鼓励和建议</p>
          </div>
          <span className={`text-primary-500 transition-transform ${showCoach ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {showCoach && (
          <div className="mt-2 bg-white border border-gray-100 rounded-xl p-3 animate-slide-up">
            {coachLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                教练正在思考...
              </div>
            ) : (
              <div className="flex gap-2">
                <span className="text-base">🐯</span>
                <div>
                  <p className="text-xs text-primary-500 font-medium mb-0.5">宠物教练 · 小乐</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{coachTip}</p>
                </div>
              </div>
            )}
            <button
              onClick={loadCoachTip}
              disabled={coachLoading}
              className="mt-2 text-xs text-gray-400 hover:text-primary-500 transition-colors"
            >
              🔄 换一条
            </button>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/batch-learn"
          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95 ring-2 ring-rose-200"
        >
          <span className="text-3xl">🎧</span>
          <p className="font-bold text-gray-700 mt-1 text-sm">跟读学习</p>
          <p className="text-xs text-gray-400">5词3轮快速记忆</p>
        </Link>

        <Link
          to="/story"
          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-3xl">📖</span>
          <p className="font-bold text-gray-700 mt-1 text-sm">故事探险</p>
          <p className="text-xs text-gray-400">读故事学生词</p>
        </Link>

        <Link
          to="/battle"
          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-3xl">⚔️</span>
          <p className="font-bold text-gray-700 mt-1 text-sm">单词大乱斗</p>
          <p className="text-xs text-gray-400">限时配对挑战</p>
        </Link>

        <Link
          to="/restaurant"
          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-3xl">🍽️</span>
          <p className="font-bold text-gray-700 mt-1 text-sm">宠物餐厅</p>
          <p className="text-xs text-gray-400">复习赚食物</p>
        </Link>

        <Link
          to="/game-stats"
          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-3xl">📊</span>
          <p className="font-bold text-gray-700 mt-1 text-sm">我的成就</p>
          <p className="text-xs text-gray-400">查看学习数据</p>
        </Link>

        <Link
          to="/packs"
          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-3xl">📚</span>
          <p className="font-bold text-gray-700 mt-1 text-sm">学习新词</p>
          <p className="text-xs text-gray-400">选择词库掌握更多单词</p>
        </Link>

	        <Link
	          to="/review"
	          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
	        >
	          <span className="text-3xl">🔄</span>
	          <p className="font-bold text-gray-700 mt-1 text-sm">复习巩固</p>
	          <p className="text-xs text-gray-400">喂宠物赚食物</p>
	        </Link>

	        <Link
	          to="/garden"
	          className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
	        >
	          <span className="text-3xl">🌻</span>
	          <p className="font-bold text-gray-700 mt-1 text-sm">单词花园</p>
	          <p className="text-xs text-gray-400">看看你的词花海</p>
	        </Link>
	      </div>

      {/* Tips */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
        <p className="font-bold">💡 小贴士</p>
        <ul className="mt-1 space-y-0.5 text-xs">
          <li>• 复习单词可以赚🍖食物，喂宠物让它成长！</li>
          <li>• 故事探险完成挑战获得⭐星星奖励！</li>
          <li>• 单词大乱斗连续答对有连击加分！</li>
        </ul>
      </div>
    </div>
  );
};

export default KidHome;
