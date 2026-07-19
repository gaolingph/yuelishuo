import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameApi, GameStatsData } from '../services/api';

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

const StatCard: React.FC<{ icon: string; label: string; value: string | number; color: string; sub?: string }> = ({ icon, label, value, color, sub }) => (
  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-50 hover:shadow-md transition-shadow">
    <div className="flex items-start gap-3">
      <span className="text-3xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className={`text-2xl font-bold ${color} mt-0.5`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

const GameStats: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GameStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await gameApi.getGameStats();
        setStats(res.data);
      } catch {
        setError('加载统计数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin text-5xl mb-3">📊</div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="page-container max-w-lg mx-auto">
        <div className="text-center py-12">
          <span className="text-6xl">😿</span>
          <p className="text-gray-500 mt-2">{error || '暂无可用的统计数据'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 我的成就</h1>
        <p className="text-gray-500 text-sm mt-1">看看你的学习成果吧！</p>
      </div>

      {/* Pet Avatar & Level */}
      <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl shadow-md p-5 mb-4 text-center border border-primary-100">
        <div className="relative inline-block">
          <span className="text-7xl inline-block">{getPetEmoji(stats.pet_level)}</span>
          <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-white shadow-sm">
            Lv.{stats.pet_level}
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mt-1">
          {stats.pet_name} <span className="text-sm font-normal text-gray-400">Lv.{stats.pet_level}</span>
        </h2>
        <div className="flex justify-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1 bg-white/80 rounded-full px-3 py-1 text-xs text-orange-600">
            🍖 {stats.pet_food}
          </span>
          <span className="inline-flex items-center gap-1 bg-white/80 rounded-full px-3 py-1 text-xs text-blue-600">
            ⭐ {stats.total_stars} 星
          </span>
        </div>
        {/* Exp bar */}
        <div className="mt-3 max-w-xs mx-auto">
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>经验值</span>
            <span>{stats.pet_exp}/{stats.pet_level * 50}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.pet_exp / (stats.pet_level * 50)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          icon="📖"
          label="已学单词"
          value={stats.total_learned}
          color="text-blue-600"
        />
        <StatCard
          icon="📚"
          label="今日学习"
          value={stats.today_learned}
          color="text-green-600"
        />
        <StatCard
          icon="🔥"
          label="连续签到"
          value={`${stats.streak_days}天`}
          color="text-orange-600"
          sub="坚持下去！"
        />
        <StatCard
          icon="⭐"
          label="获得星星"
          value={stats.total_stars}
          color="text-yellow-600"
        />
      </div>

      {/* Achievement cards */}
      <div className="space-y-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <div>
                <p className="text-sm font-bold text-gray-700">故事阅读</p>
                <p className="text-xs text-gray-400">完成故事获得星星</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-purple-600">{stats.stories_completed}</p>
              <p className="text-[10px] text-gray-400">个故事</p>
            </div>
          </div>
          {stats.stories_completed > 0 && (
            <div className="mt-2 flex gap-1">
              {Array.from({ length: Math.min(stats.stories_completed, 10) }).map((_, i) => (
                <span key={i} className="text-lg">📖</span>
              ))}
              {stats.stories_completed > 10 && (
                <span className="text-sm text-gray-400">+{stats.stories_completed - 10}</span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <p className="text-sm font-bold text-gray-700">PK对战</p>
                <p className="text-xs text-gray-400">与同学切磋词艺</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-red-600">{stats.battles_fought}</p>
              <p className="text-[10px] text-gray-400">场战斗</p>
            </div>
          </div>
          {stats.battles_fought > 0 && (
            <div className="mt-2 flex gap-1">
              {Array.from({ length: Math.min(stats.battles_fought, 5) }).map((_, i) => (
                <span key={i} className="text-lg">⚔️</span>
              ))}
              {stats.battles_fought > 5 && (
                <span className="text-sm text-gray-400">+{stats.battles_fought - 5}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/restaurant')}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 transition-all active:scale-98 shadow-md"
        >
          🍽️ 去餐厅赚食物
        </button>
        <button
          onClick={() => navigate('/kid-home')}
          className="w-full py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
        >
          🏠 回到乐园
        </button>
      </div>
    </div>
  );
};

export default GameStats;
