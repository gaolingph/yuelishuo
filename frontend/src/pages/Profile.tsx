import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { statsApi, StatsOverview, Achievement, LearningCurve, CalendarDay } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [learningCurve, setLearningCurve] = useState<LearningCurve[]>([]);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'curve'>('stats');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    Promise.all([
      statsApi.overview(),
      statsApi.achievements(),
      statsApi.learningCurve(30),
      statsApi.calendar(year, month),
    ])
      .then(([statsRes, achRes, curveRes, calRes]) => {
        setStats(statsRes.data);
        setLearningCurve(curveRes.data || []);
        // Calendar API returns { year, month, days: CalendarDay[], total }
        const calData = calRes.data as any;
        setCalendar(Array.isArray(calData) ? calData : (calData?.days || []));
        // Map API achievements response to the expected shape
        const rawAch = achRes.data as any;
        if (Array.isArray(rawAch)) {
          setAchievements(rawAch.map((a: any) => ({
            id: a.key || a.id,
            name: a.name,
            description: a.description,
            icon: a.icon || '🏆',
            condition_type: a.condition_type || '',
            condition_value: a.condition_value || 0,
            earned: a.is_earned ?? a.earned ?? false,
            earned_at: a.earned_at,
          })));
        }
      })
      .catch((err) => { console.error('Profile: failed to load stats', err); })
      .finally(() => setLoading(false));
  }, [year, month]);

  const handleCheckin = async () => {
    try {
      const res = await statsApi.checkin();
      setCheckinDone(true);
      setCheckinMsg('🎉 签到成功！');
      // Refresh stats
      statsApi.overview().then((r) => setStats(r.data));
    } catch (err: any) {
      if (err.response?.status === 400) {
        setCheckinDone(true);
        setCheckinMsg('✅ 今日已签到');
      } else {
        setCheckinMsg('签到失败，请重试');
      }
    }
  };

  const handleCheckAchievements = async () => {
    try {
      const res = await statsApi.checkAchievements();
      const newAchievements = res.data?.new_achievements || [];
      if (newAchievements.length > 0) {
        setCheckinMsg(`🎊 获得 ${newAchievements.length} 个新成就！`);
      } else {
        setCheckinMsg('没有新成就');
      }
      // Refresh achievements (map API response shape)
      statsApi.achievements().then((r) => {
        const rawAch = r.data as any;
        if (Array.isArray(rawAch)) {
          setAchievements(rawAch.map((a: any) => ({
            id: a.key || a.id,
            name: a.name,
            description: a.description,
            icon: a.icon || '🏆',
            condition_type: a.condition_type || '',
            condition_value: a.condition_value || 0,
            earned: a.is_earned ?? a.earned ?? false,
            earned_at: a.earned_at,
          })));
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载中...</p>
      </div>
    );
  }

  const earnedAchievements = achievements.filter((a) => a.earned);
  const totalAchievements = achievements.length;
  const checkedInDays = calendar.filter((d) => d.checked_in).length;

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* User Info */}
      <div className="card !p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">
            {(user?.nickname || user?.username || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{user?.nickname || user?.username}</h1>
            <p className="text-sm text-gray-400">@{user?.username}</p>
          </div>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500">
            退出
          </button>
        </div>

        {/* Check-in */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              连续签到: <span className="font-bold text-primary-600">{stats?.streak_days || 0}</span> 天
            </p>
            <p className="text-xs text-gray-400">总签到: {checkedInDays} 天</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCheckAchievements}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full"
            >
              🏆 检查成就
            </button>
            <button
              onClick={handleCheckin}
              disabled={checkinDone}
              className="text-xs px-3 py-1.5 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-full disabled:opacity-50"
            >
              {checkinDone ? '已签到' : '📅 签到'}
            </button>
          </div>
        </div>
        {checkinMsg && (
          <p className="text-xs text-center mt-2 text-primary-600">{checkinMsg}</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="card !p-2.5 text-center">
          <p className="text-lg font-bold text-primary-600">{stats?.total_learned || 0}</p>
          <p className="text-xs text-gray-500">已学</p>
        </div>
        <div className="card !p-2.5 text-center">
          <p className="text-lg font-bold text-green-600">{stats?.total_mastered || 0}</p>
          <p className="text-xs text-gray-500">掌握</p>
        </div>
        <div className="card !p-2.5 text-center">
          <p className="text-lg font-bold text-amber-600">{stats?.streak_days || 0}</p>
          <p className="text-xs text-gray-500">连续</p>
        </div>
        <div className="card !p-2.5 text-center">
          <p className="text-lg font-bold text-accent-600">{stats?.accuracy || 0}%</p>
          <p className="text-xs text-gray-500">准确率</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'stats', label: '📊 学习统计' },
          { key: 'achievements', label: `🏆 成就 (${earnedAchievements.length}/${totalAchievements})` },
          { key: 'curve', label: '📈 学习曲线' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'stats' && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">📊 详细统计</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">总学习单词</span>
              <span className="font-semibold">{stats?.total_learned || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">已掌握单词</span>
              <span className="font-semibold">{stats?.total_mastered || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">待复习单词</span>
              <span className="font-semibold">{stats?.to_review || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">今日学习</span>
              <span className="font-semibold">{stats?.today_learned || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">今日复习</span>
              <span className="font-semibold">{stats?.today_review || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">学习总天数</span>
              <span className="font-semibold">{stats?.total_days || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">词库数量</span>
              <span className="font-semibold">{stats?.pack_count || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">总准确率</span>
              <span className="font-semibold">{stats?.accuracy || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="grid grid-cols-2 gap-2">
          {achievements.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-gray-500">
              暂无成就数据
            </div>
          ) : (
            achievements.map((ach) => (
              <div
                key={ach.id}
                className={`card !p-3 ${ach.earned ? '' : 'opacity-40'}`}
              >
                <div className="text-center">
                  <span className="text-2xl">{ach.icon || '🏆'}</span>
                  <h4 className="text-sm font-semibold text-gray-700 mt-1">{ach.name}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{ach.description}</p>
                  {ach.earned && ach.earned_at && (
                    <p className="text-xs text-primary-500 mt-1">
                      {new Date(ach.earned_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'curve' && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">📈 近30天学习曲线</h3>
          {learningCurve.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">暂无学习数据</p>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={learningCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="learned"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="学习"
                  />
                  <Line
                    type="monotone"
                    dataKey="reviewed"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    name="复习"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
