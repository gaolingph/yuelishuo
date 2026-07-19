import React, { useEffect, useState } from 'react';
import { pkApi, statsApi } from '../services/api';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  nickname: string;
  score: number;
  total_learned: number;
  streak_days: number;
}

const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pk' | 'learning'>('pk');

  useEffect(() => {
    setLoading(true);
    const fetchData = tab === 'pk' ? pkApi.leaderboard() : statsApi.overview();

    // Simulate leaderboard data (the API may return different structures)
    // For now, use pk leaderboard as primary
    if (tab === 'pk') {
      pkApi.leaderboard()
        .then((res) => {
          // The leaderboard might be an array or different structure
          const data = Array.isArray(res.data) ? res.data : [];
          setLeaderboard(data as any);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      // Learning leaderboard - use a placeholder approach
      // The actual API should be implemented on the backend
      statsApi.overview()
        .then(() => {
          // We'll show a message for now
          setLeaderboard([]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const getMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="page-container max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">🏆 排行榜</h1>
      <p className="text-sm text-gray-500 mb-4">看看你和学霸们的差距</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('pk')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pk' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ⚔️ PK排行榜
        </button>
        <button
          onClick={() => setTab('learning')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'learning' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📚 学习排行榜
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-500 mt-2">加载中...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-6xl mb-4 block">🏆</span>
          <p className="text-gray-500">暂无排行数据，快去学习吧！</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Top 3 */}
          {leaderboard.slice(0, 3).map((entry, idx) => (
            <div
              key={entry.user_id || idx}
              className={`card !p-4 flex items-center gap-3 ${
                idx === 0 ? 'ring-2 ring-amber-300' : idx === 1 ? 'ring-2 ring-gray-300' : 'ring-2 ring-orange-200'
              }`}
            >
              <span className="text-2xl w-10 text-center">{getMedal(idx + 1)}</span>
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                {(entry.nickname || entry.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">
                  {entry.nickname || entry.username || '未知用户'}
                </p>
                <p className="text-xs text-gray-400">
                  已学 {entry.total_learned || 0} 词 · 连续 {entry.streak_days || 0} 天
                </p>
              </div>
              <span className="text-lg font-bold text-primary-600">{entry.score || 0}</span>
            </div>
          ))}

          {/* Rest */}
          {leaderboard.slice(3).map((entry, idx) => (
            <div key={entry.user_id || idx} className="card !p-3 flex items-center gap-3">
              <span className="text-sm w-8 text-center text-gray-400 font-mono">{getMedal(idx + 4)}</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold">
                {(entry.nickname || entry.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {entry.nickname || entry.username || '未知用户'}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-600">{entry.score || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
