import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { parentApi, ChildStats, CalendarDayInfo, WrongBookItem, ChildAchievement, CapabilitiesResponse } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RadarChart from '../../components/RadarChart';

const TAB_KEYS = ['curve', 'calendar', 'wrongbook', 'achievements', 'capability'] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, string> = {
  curve: '学习曲线',
  calendar: '签到日历',
  wrongbook: '错题本',
  achievements: '成就',
  capability: '能力雷达',
};

const practiceTypeLabels: Record<string, string> = {
  choice: '选择题',
  spelling: '拼写题',
  listening: '听力题',
  chinese_to_english: '中译英',
  speaking: '口语练习',
};

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

function getMonthDays(year: number, month: number): { date: Date; day: number; isCurrent: boolean }[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells: { date: Date; day: number; isCurrent: boolean }[] = [];

  // Padding days from previous month
  for (let i = 0; i < startPad; i++) {
    cells.push({ date: new Date(year, month - 1, -startPad + i + 1), day: 0, isCurrent: false });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ date: new Date(year, month - 1, d), day: d, isCurrent: true });
  }

  // Padding to fill last row
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month, cells.length % 7), day: 0, isCurrent: false });
  }

  return cells;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ChildReport: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('curve');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ChildStats | null>(null);

  // Curve
  const [curveData, setCurveData] = useState<{ date: string; learned: number; reviewed: number }[]>([]);
  const [curveLoading, setCurveLoading] = useState(false);

  // Calendar
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calendarDays, setCalendarDays] = useState<CalendarDayInfo[]>([]);
  const [calendarTotal, setCalendarTotal] = useState(0);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Wrong book
  const [wrongBook, setWrongBook] = useState<WrongBookItem[]>([]);
  const [wrongBookLoading, setWrongBookLoading] = useState(false);

  // Achievements
  const [achievements, setAchievements] = useState<ChildAchievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);

  // Capabilities
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    parentApi.childStats(Number(studentId))
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => {
    if (activeTab !== 'curve' || !studentId) return;
    setCurveLoading(true);
    parentApi.childCurve(Number(studentId), { days: 30 })
      .then((res) => setCurveData(res.data || []))
      .catch(() => {})
      .finally(() => setCurveLoading(false));
  }, [activeTab, studentId]);

  useEffect(() => {
    if (activeTab !== 'calendar' || !studentId) return;
    setCalendarLoading(true);
    parentApi.childCalendar(Number(studentId), { year: calYear, month: calMonth })
      .then((res) => {
        const data = res.data;
        setCalendarDays(data.days || []);
        setCalendarTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
  }, [activeTab, studentId, calYear, calMonth]);

  useEffect(() => {
    if (activeTab !== 'wrongbook' || !studentId) return;
    setWrongBookLoading(true);
    parentApi.childWrongBook(Number(studentId))
      .then((res) => setWrongBook(res.data || []))
      .catch(() => {})
      .finally(() => setWrongBookLoading(false));
  }, [activeTab, studentId]);

  useEffect(() => {
    if (activeTab !== 'achievements' || !studentId) return;
    setAchievementsLoading(true);
    parentApi.childAchievements(Number(studentId))
      .then((res) => setAchievements(res.data || []))
      .catch(() => {})
      .finally(() => setAchievementsLoading(false));
  }, [activeTab, studentId]);

  useEffect(() => {
    if (activeTab !== 'capability' || !studentId) return;
    setCapabilitiesLoading(true);
    parentApi.childCapabilities(Number(studentId))
      .then((res) => setCapabilities(res.data))
      .catch(() => {})
      .finally(() => setCapabilitiesLoading(false));
  }, [activeTab, studentId]);

  const goToPrevMonth = () => {
    if (calMonth === 1) {
      setCalYear((y) => y - 1);
      setCalMonth(12);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (calMonth === 12) {
      setCalYear((y) => y + 1);
      setCalMonth(1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const dayInfoMap = new Map(calendarDays.map((d) => [d.date, d]));

  const maxCurveValue = Math.max(
    1,
    ...curveData.flatMap((d) => [d.learned, d.reviewed])
  );

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载中...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page-container text-center py-16">
        <span className="text-5xl mb-4 block">😵</span>
        <p className="text-gray-500">无法加载学生数据</p>
        <Link to="/parent" className="btn-primary mt-4 inline-block">返回</Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Back button */}
      <Link
        to="/parent"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <span>←</span>
        <span>返回家长面板</span>
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{stats.nickname || stats.username}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-primary-600">{stats.total_learned}</p>
            <p className="text-xs text-gray-500 mt-0.5">已学单词</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-green-600">{stats.total_mastered}</p>
            <p className="text-xs text-gray-500 mt-0.5">已掌握</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-amber-600">{stats.to_review}</p>
            <p className="text-xs text-gray-500 mt-0.5">待复习</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-red-500">{stats.today_learned}</p>
            <p className="text-xs text-gray-500 mt-0.5">今日学习</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-accent-600">{stats.today_review}</p>
            <p className="text-xs text-gray-500 mt-0.5">今日复习</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-purple-600">{stats.streak_days}</p>
            <p className="text-xs text-gray-500 mt-0.5">连续天数</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-blue-600">{stats.total_days}</p>
            <p className="text-xs text-gray-500 mt-0.5">总学习天数</p>
          </div>
          <div className="card text-center !p-3">
            <p className="text-xl font-bold text-gray-800">{stats.accuracy}%</p>
            <p className="text-xs text-gray-500 mt-0.5">准确率</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Tab: 学习曲线 */}
      {activeTab === 'curve' && (
        <div>
          {curveLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-3xl">⏳</div>
              <p className="text-gray-500 mt-2">加载学习曲线...</p>
            </div>
          ) : curveData.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">📈</span>
              <p className="text-gray-500">暂无学习数据</p>
            </div>
          ) : (
            <div className="card !p-4 overflow-x-auto">
              <div className="flex items-end gap-1" style={{ minWidth: curveData.length * 28 }}>
                {curveData.map((item) => {
                  const learnedH = maxCurveValue > 0 ? (item.learned / maxCurveValue) * 120 : 0;
                  const reviewedH = maxCurveValue > 0 ? (item.reviewed / maxCurveValue) * 120 : 0;
                  const label = item.date.slice(5);
                  return (
                    <div key={item.date} className="flex flex-col items-center gap-0.5" style={{ width: 24 }}>
                      <div className="flex flex-col-reverse items-center" style={{ height: 130 }}>
                        <div
                          className="w-4 rounded-t bg-primary-400 transition-all"
                          style={{ height: `${Math.max(learnedH, 2)}px` }}
                          title={`学习: ${item.learned}`}
                        />
                        <div
                          className="w-4 rounded-t bg-accent-400 transition-all"
                          style={{ height: `${Math.max(reviewedH, 2)}px` }}
                          title={`复习: ${item.reviewed}`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-primary-400" />
                  学习
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-accent-400" />
                  复习
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: 签到日历 */}
      {activeTab === 'calendar' && (
        <div>
          {calendarLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-3xl">⏳</div>
              <p className="text-gray-500 mt-2">加载签到日历...</p>
            </div>
          ) : (
            <div className="card !p-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevMonth}
                  className="text-gray-400 hover:text-gray-600 text-lg px-2"
                >
                  ‹
                </button>
                <span className="font-semibold text-gray-700">
                  {calYear}年{calMonth}月
                </span>
                <button
                  onClick={goToNextMonth}
                  className="text-gray-400 hover:text-gray-600 text-lg px-2"
                >
                  ›
                </button>
              </div>

              <div className="text-center text-sm text-gray-500 mb-3">
                本月签到 <span className="font-semibold text-primary-600">{calendarTotal}</span> 天
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-2">
                {WEEK_DAYS.map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 text-center gap-1">
                {getMonthDays(calYear, calMonth).map((cell, idx) => {
                  const dateStr = cell.isCurrent ? formatDate(cell.date) : '';
                  const info = dateStr ? dayInfoMap.get(dateStr) : undefined;
                  const isToday = formatDate(new Date()) === dateStr;

                  return (
                    <div
                      key={idx}
                      className={`rounded-lg p-1.5 min-h-[48px] flex flex-col items-center justify-center ${
                        !cell.isCurrent ? 'opacity-20' : ''
                      } ${isToday ? 'ring-2 ring-primary-300' : ''} ${
                        info?.checked_in ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      {cell.isCurrent && (
                        <>
                          <span className="text-xs font-medium text-gray-700">{cell.day}</span>
                          {info?.checked_in && (
                            <span className="text-[10px] text-green-600 mt-0.5">✓</span>
                          )}
                          {info && info.count > 0 && (
                            <span className="text-[9px] text-gray-400">{info.count}</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: 错题本 */}
      {activeTab === 'wrongbook' && (
        <div>
          {wrongBookLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-3xl">⏳</div>
              <p className="text-gray-500 mt-2">加载错题本...</p>
            </div>
          ) : wrongBook.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">🎉</span>
              <p className="text-gray-500">错题本空空如也</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2 pr-2">单词</th>
                    <th className="text-left py-2 px-2">释义</th>
                    <th className="text-center py-2 px-2">错误次数</th>
                    <th className="text-center py-2 px-2">题型</th>
                    <th className="text-right py-2 pl-2">最后错误</th>
                  </tr>
                </thead>
                <tbody>
                  {wrongBook.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-2 font-medium text-gray-800">
                        {item.word.english}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500">
                        {item.word.chinese}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-red-500 font-semibold">{item.wrong_count}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-gray-500">
                        {practiceTypeLabels[item.practice_type] || item.practice_type}
                      </td>
                      <td className="py-2.5 pl-2 text-right text-gray-400 text-xs">
                        {item.last_wrong_at ? new Date(item.last_wrong_at).toLocaleDateString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: 成就 */}
      {activeTab === 'achievements' && (
        <div>
          {achievementsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-3xl">⏳</div>
              <p className="text-gray-500 mt-2">加载成就...</p>
            </div>
          ) : achievements.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">🏆</span>
              <p className="text-gray-500">暂无成就数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {achievements.map((ach) => (
                <div
                  key={ach.key}
                  className={`card !p-4 text-center transition-all ${
                    ach.is_earned ? '' : 'opacity-50 grayscale'
                  }`}
                >
                  <div className="relative inline-flex">
                    <span className="text-3xl">🏅</span>
                    {ach.is_earned && (
                      <span className="absolute -top-1 -right-1 text-green-500 text-sm">✓</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-gray-800 mt-2">{ach.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{ach.description}</p>
                  {ach.earned_at && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(ach.earned_at).toLocaleDateString('zh-CN')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: 能力雷达 */}
      {activeTab === 'capability' && (
        <div>
          {capabilitiesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-3xl">⏳</div>
              <p className="text-gray-500 mt-2">加载能力数据...</p>
            </div>
          ) : !capabilities || capabilities.dimensions.every(d => d.total_attempts === 0) ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">📡</span>
              <p className="text-gray-500">暂无能力数据，快去练习吧</p>
            </div>
          ) : (
            <div className="card !p-4">
              <div className="flex justify-center">
                <RadarChart data={capabilities.dimensions} size={260} />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-6 pt-4 border-t border-gray-100">
                {capabilities.dimensions.map((dim) => (
                  <div key={dim.key} className="text-center">
                    <p className="text-xs text-gray-500">{dim.name}</p>
                    <p className="text-xl font-bold text-primary-600">
                      {dim.score.toFixed(0)}<span className="text-xs text-gray-400">%</span>
                    </p>
                    <p className="text-[10px] text-gray-400">
                      正确 {dim.correct_attempts}/{dim.total_attempts} 次
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChildReport;
