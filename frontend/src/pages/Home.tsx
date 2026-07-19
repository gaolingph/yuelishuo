import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { statsApi, StatsOverview, CapabilitiesResponse } from '../services/api';
import ProgressBar from '../components/ProgressBar';
import RadarChart from '../components/RadarChart';
import { aiApi, SmartReviewResponse } from '../services/aiApi';

const Home: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [smartReview, setSmartReview] = useState<SmartReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        statsApi.overview(),
        statsApi.capabilities(),
      ])
        .then(([statsRes, capRes]) => {
          setStats(statsRes.data);
          setCapabilities(capRes.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  // Load AI smart review (don't block main UI)
  useEffect(() => {
    if (isAuthenticated) {
      setReviewLoading(true);
      aiApi.smartReview({})
        .then(res => setSmartReview(res.data))
        .catch(() => {})
        .finally(() => setReviewLoading(false));
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#DCF1D5] via-[#EEF8EA] to-white">
        {/* Decorative blobs */}
        <div className="absolute top-[-100px] right-[-80px] w-80 h-80 rounded-full bg-[#46D1B2]/20 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-100px] w-96 h-96 rounded-full bg-[#1FA576]/10 blur-3xl" />
        <div className="absolute top-[40%] left-[5%] w-40 h-40 rounded-full bg-[#FC9530]/10 blur-2xl" />

        <div className="page-container relative z-10">
          <div className="text-center py-16">
            {/* Brand logo area */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white/80 backdrop-blur rounded-3xl shadow-lg shadow-[#1FA576]/10">
                <svg width="80" height="80" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 20C16 17.7909 17.7909 16 20 16H52C54.2091 16 56 17.7909 56 20V56C56 58.2091 54.2091 60 52 60H20C17.7909 60 16 58.2091 16 56V20Z" fill="#DCF1D5" stroke="#1FA576" strokeWidth="2"/>
                  <path d="M36 16V60" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="22" y1="26" x2="32" y2="26" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="22" y1="34" x2="32" y2="34" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="22" y1="42" x2="32" y2="42" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="40" y1="26" x2="50" y2="26" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="40" y1="34" x2="50" y2="34" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M36 8L38.5 14.5H45.5L40 18.5L42 25L36 21L30 25L32 18.5L26.5 14.5H33.5L36 8Z" fill="#FC9530" stroke="#FC9530" strokeWidth="1" strokeLinejoin="round"/>
                  <circle cx="52" cy="50" r="6" fill="#46D1B2" opacity="0.3"/>
                  <text x="50" y="53" fontSize="8" fill="white" fontWeight="bold" textAnchor="middle">♪</text>
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-[#1D4431] mb-2">乐说邦英语</h1>
            <p className="text-[#1FA576] mb-8 max-w-md mx-auto font-medium">
              基于艾宾浩斯遗忘曲线与SM-2算法的智能单词记忆系统，助你高效掌握英语词汇
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/login" className="bg-[#1FA576] hover:bg-[#16845e] text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg shadow-[#1FA576]/25 hover:shadow-xl hover:shadow-[#1FA576]/30 active:scale-[0.98]">登录</Link>
              <Link to="/register" className="bg-white hover:bg-gray-50 text-[#1D4431] font-bold py-3 px-8 rounded-xl border border-[#DCF1D5] transition-all duration-200 active:scale-[0.98]">注册</Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto">
              <div className="bg-white/90 backdrop-blur rounded-2xl p-6 text-center shadow-lg shadow-[#1FA576]/5 border border-[#DCF1D5]/50">
                <span className="text-4xl block mb-3">📚</span>
                <h3 className="font-bold text-[#1D4431]">分级词库</h3>
                <p className="text-sm text-gray-500 mt-1">小学到托福，11个级别循序渐进</p>
              </div>
              <div className="bg-white/90 backdrop-blur rounded-2xl p-6 text-center shadow-lg shadow-[#1FA576]/5 border border-[#DCF1D5]/50">
                <span className="text-4xl block mb-3">🧠</span>
                <h3 className="font-bold text-[#1D4431]">SM-2算法</h3>
                <p className="text-sm text-gray-500 mt-1">智能间隔重复，科学高效记忆</p>
              </div>
              <div className="bg-white/90 backdrop-blur rounded-2xl p-6 text-center shadow-lg shadow-[#1FA576]/5 border border-[#DCF1D5]/50">
                <span className="text-4xl block mb-3">🎮</span>
                <h3 className="font-bold text-[#1D4431]">游戏化学习</h3>
                <p className="text-sm text-gray-500 mt-1">PK对战、成就系统、排行榜</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载中...</p>
      </div>
    );
  }

  const quickActions = [
    { to: '/learn', label: '学习新词', icon: '📖', color: 'bg-blue-500' },
    { to: '/review', label: '待复习', icon: '🔄', color: 'bg-amber-500', badge: stats?.to_review },
    { to: '/auto-review', label: '自我复习', icon: '🎯', color: 'bg-teal-500' },
    { to: '/batch-learn', label: '跟读学习', icon: '🎯', color: 'bg-rose-500' },
    { to: '/practice', label: '练习模式', icon: '✍️', color: 'bg-green-500' },
    { to: '/vocab-test', label: '词汇测试', icon: '📝', color: 'bg-indigo-500' },
    { to: '/pk', label: 'PK对战', icon: '⚔️', color: 'bg-purple-500' },
    { to: '/ai-chat', label: 'AI助手', icon: '🤖', color: 'bg-gradient-to-r from-primary-400 to-primary-600' },
  ];

  return (
    <div className="page-container">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          你好，{user?.nickname || user?.username} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">今天也要加油学习哦！</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card text-center !p-4">
          <p className="text-2xl font-bold text-primary-600">{stats?.total_learned || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">已学单词</p>
        </div>
        <div className="card text-center !p-4">
          <p className="text-2xl font-bold text-green-600">{stats?.total_mastered || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">已掌握</p>
        </div>
        <div className="card text-center !p-4">
          <p className="text-2xl font-bold text-amber-600">{stats?.to_review || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">待复习</p>
        </div>
        <div className="card text-center !p-4">
          <p className="text-2xl font-bold text-accent-600">{stats?.streak_days || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">连续天数</p>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="font-semibold text-gray-700 mb-3">快速开始</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="card !p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow relative"
          >
            <span className={`w-10 h-10 rounded-full ${action.color} flex items-center justify-center text-white text-lg`}>
              {action.icon}
            </span>
            <span className="text-sm font-medium text-gray-700">{action.label}</span>
            {action.badge !== undefined && action.badge > 0 && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {action.badge > 99 ? '99+' : action.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Today's Progress */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-3">今日进度</h2>
        <div className="space-y-3">
          <ProgressBar
            value={stats?.today_learned || 0}
            max={Math.max(stats?.today_learned || 10, 10)}
            label="今日学习"
            color="primary"
          />
          <ProgressBar
            value={stats?.today_review || 0}
            max={Math.max(stats?.today_review || 10, 10)}
            label="今日复习"
            color="accent"
          />
        </div>

        <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">
          <span>📊 总学习天数: {stats?.total_days || 0}</span>
          <span>🎯 准确率: {stats?.accuracy || 0}%</span>
        </div>
      </div>

      {/* AI Smart Review Recommendation */}
      {smartReview && (
        <div className="card mt-6 !bg-gradient-to-r !from-primary-50/80 !to-amber-50/80 border border-primary-100">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">🤖</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-700 text-sm">AI 智能复习建议</h2>
                <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full">今日推送</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{smartReview.reason}</p>
              <div className="flex items-center gap-2 mt-2">
                <Link
                  to="/review"
                  className="text-xs px-3 py-1 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors"
                >
                  去复习 →
                </Link>
                {smartReview.focus_area && (
                  <span className="text-xs text-gray-400">
                    重点: {smartReview.focus_area} ({smartReview.count}词)
                  </span>
                )}
              </div>
              {/* Tip */}
              {smartReview.tip && (
                <p className="text-xs text-gray-400 mt-2 bg-white/60 rounded-lg px-2 py-1">
                  💡 {smartReview.tip}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Quick Chat trigger card */}
      <div className="card mt-3 !p-3 !bg-white border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all cursor-pointer"
           onClick={() => {
             const btn = document.querySelector('[aria-label="AI 助手"]') as HTMLButtonElement;
             if (btn) btn.click();
           }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-base shadow-sm">
            💬
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">有问题？问问 AI 学习助手</p>
            <p className="text-xs text-gray-400">单词讲解、语法问题、学习建议...</p>
          </div>
          <span className="text-xs text-primary-500 font-medium">提问 →</span>
        </div>
      </div>

      {/* Six-dimension Radar Chart */}
      {capabilities && capabilities.dimensions && capabilities.dimensions.some(d => d.total_attempts > 0) && (
        <div className="card mt-6">
          <h2 className="font-semibold text-gray-700 mb-3">六维能力雷达</h2>
          <div className="flex justify-center">
            <RadarChart data={capabilities.dimensions} size={260} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 pt-3 border-t border-gray-100">
            {capabilities.dimensions.map((dim) => (
              <div key={dim.key} className="text-center">
                <p className="text-xs text-gray-500">{dim.name}</p>
                <p className="text-lg font-bold text-primary-600">{dim.score.toFixed(0)}<span className="text-xs text-gray-400">%</span></p>
                <p className="text-[10px] text-gray-400">{dim.total_attempts}次</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
