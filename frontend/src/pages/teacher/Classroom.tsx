import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  teacherApi,
  TeacherStudentItem,
  TeacherClassOverview,
  TeacherClassToday,
  TeacherAlert,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const Classroom: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<TeacherClassOverview | null>(null);
  const [students, setStudents] = useState<TeacherStudentItem[]>([]);
  const [classToday, setClassToday] = useState<TeacherClassToday | null>(null);
  const [alerts, setAlerts] = useState<TeacherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'nickname' | 'total_learned' | 'mastered' | 'wrong_count' | 'streak_days'>('nickname');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [overviewRes, studentsRes, todayRes, alertsRes] = await Promise.all([
          teacherApi.getClassOverview(),
          teacherApi.listStudents(),
          teacherApi.getClassToday(),
          teacherApi.getAlerts(),
        ]);
        setOverview(overviewRes.data);
        setStudents(studentsRes.data);
        setClassToday(todayRes.data);
        setAlerts(alertsRes.data);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      </div>
    );
  }

  const sortedStudents = [...students]
    .filter(
      (s) =>
        s.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.username.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortKey === 'nickname') return a.nickname.localeCompare(b.nickname);
      return (b[sortKey] as number) - (a[sortKey] as number);
    });

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const memoryScanBar = (scan: TeacherStudentItem['memory_scan']) => {
    if (!scan || scan.total_words === 0) return null;
    const green = (scan.green_count / scan.total_words) * 100;
    const yellow = (scan.yellow_count / scan.total_words) * 100;
    const red = (scan.red_count / scan.total_words) * 100;
    return (
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 w-24">
        {green > 0 && <div style={{ width: `${green}%` }} className="bg-green-400" />}
        {yellow > 0 && <div style={{ width: `${yellow}%` }} className="bg-yellow-400" />}
        {red > 0 && <div style={{ width: `${red}%` }} className="bg-red-400" />}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          👨‍🏫 教师课堂管理
        </h1>
        <p className="mt-1 text-gray-500">
          {user?.nickname || user?.username}，欢迎回来
        </p>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <span className="font-semibold text-red-800">
              {alerts.filter((a) => a.priority === 'high').length} 个高危预警
            </span>
            <span className="text-red-600">·</span>
            <span className="text-red-700">
              共 {alerts.length} 名学生需要关注
            </span>
          </div>
        </div>
      )}

      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: '学生总数', value: overview.total_students, color: 'bg-indigo-500', icon: '👥' },
            { label: '今日活跃', value: overview.active_today, color: 'bg-green-500', icon: '✅' },
            { label: '总学习量', value: overview.total_learned, color: 'bg-blue-500', icon: '📖' },
            { label: '已掌握', value: overview.total_mastered, color: 'bg-purple-500', icon: '🏆' },
            { label: '平均掌握率', value: `${overview.avg_accuracy}%`, color: 'bg-teal-500', icon: '📊' },
            { label: '需要关注', value: overview.struggling_count, color: 'bg-red-500', icon: '⚠️' },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{card.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's Activity */}
      {classToday && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">✅ 今日活跃学生</h2>
            {classToday.active_students.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无活跃记录</p>
            ) : (
              <div className="space-y-2">
                {classToday.active_students.slice(0, 8).map((s) => (
                  <div
                    key={s.user_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      to={`/teacher/students/${s.user_id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {s.nickname}
                    </Link>
                    <span className="text-gray-500">{s.today_count} 词</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">⚠️ 近期未学习</h2>
            {classToday.inactive_students.length === 0 ? (
              <p className="text-gray-400 text-sm">所有学生近期都有学习</p>
            ) : (
              <div className="space-y-2">
                {classToday.inactive_students.slice(0, 8).map((s) => (
                  <div
                    key={s.user_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      to={`/teacher/students/${s.user_id}`}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      {s.nickname}
                    </Link>
                    <span className="text-gray-500">{s.last_active ? s.last_active.slice(0, 10) : '从未学习'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">🔔 异常预警</h2>
            <span className="text-xs text-gray-400">点击学生查看详细报告</span>
          </div>
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => (
              <div
                key={alert.user_id}
                className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/teacher/students/${alert.user_id}`)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{alert.nickname}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      priorityColors[alert.priority] || priorityColors.low
                    }`}
                  >
                    {alert.priority === 'high' ? '高危' : alert.priority === 'medium' ? '中危' : '低危'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {alert.alerts.map((a, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        a.type === 'high_wrongs'
                          ? 'bg-red-50 text-red-700'
                          : a.type === 'inactive'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      {a.detail}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-gray-900">📋 班级花名册</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索学生..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="nickname">姓名</option>
              <option value="total_learned">学习量</option>
              <option value="mastered">掌握数</option>
              <option value="wrong_count">错题数</option>
              <option value="streak_days">连续天数</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">学习</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">掌握</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">待复习</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">今日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">连续</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">错题</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">记忆扫描</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    暂无学生数据
                  </td>
                </tr>
              ) : (
                sortedStudents.map((s) => (
                  <tr
                    key={s.user_id}
                    className="hover:bg-indigo-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/teacher/students/${s.user_id}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{s.nickname}</span>
                      <span className="text-xs text-gray-400 ml-1">({s.username})</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{s.total_learned}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{s.mastered}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{s.to_review}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{s.today_learned}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        🔥 {s.streak_days}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span
                        className={`font-medium ${
                          s.wrong_count >= 10 ? 'text-red-600' : 'text-gray-600'
                        }`}
                      >
                        {s.wrong_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.memory_scan ? (
                        <div className="flex items-center gap-2">
                          {memoryScanBar(s.memory_scan)}
                          <span className="text-xs text-gray-400">
                            {s.memory_scan.green_count}/{s.memory_scan.yellow_count}/{s.memory_scan.red_count}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">未扫描</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
          共 {sortedStudents.length} 名学生
        </div>
      </div>
    </div>
  );
};

export default Classroom;
