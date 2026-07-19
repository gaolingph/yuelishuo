import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { teacherApi, TeacherStudentDetail } from '../../services/api';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const dimensionNames: Record<string, string> = {
  listening: '听力',
  discrimination: '辨音',
  writing: '拼写',
  reading: '阅读',
  speaking: '口语',
  usage: '运用',
};

const StudentDetail: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TeacherStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    teacherApi
      .getStudentDetail(Number(studentId))
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.detail || err?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error || '无法加载学生数据'}
        </div>
        <button
          onClick={() => navigate('/teacher')}
          className="text-indigo-600 hover:text-indigo-800 text-sm"
        >
          ← 返回课堂管理
        </button>
      </div>
    );
  }

  const maxWeekCount = Math.max(1, ...data.weekly_curve.map((d) => d.count));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/teacher')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <span>←</span>
        <span>返回课堂管理</span>
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
            {data.nickname.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.nickname}</h1>
            <p className="text-sm text-gray-500">@{data.username}</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-indigo-600">{data.total_learned}</p>
            <p className="text-xs text-gray-500">已学单词</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{data.mastered}</p>
            <p className="text-xs text-gray-500">已掌握</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{data.to_review}</p>
            <p className="text-xs text-gray-500">待复习</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-600">{data.streak_days}</p>
            <p className="text-xs text-gray-500">连续🔥</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{data.today_learned}</p>
            <p className="text-xs text-gray-500">今日学习</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{data.wrong_count}</p>
            <p className="text-xs text-gray-500">错题数</p>
          </div>
          <div className="bg-teal-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-teal-600">{data.week_new_words}</p>
            <p className="text-xs text-gray-500">本周新词</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{data.today_review}</p>
            <p className="text-xs text-gray-500">今日复习</p>
          </div>
        </div>
      </div>

      {/* Memory Scan visualization */}
      {data.memory_scan && data.memory_scan.total_words > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">🧠 记忆扫描</h2>
          <div className="flex items-center gap-8">
            {/* Donut mini */}
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3"
                />
                {(() => {
                  const total = data.memory_scan.total_words;
                  const g = data.memory_scan.green_count / total;
                  const y = data.memory_scan.yellow_count / total;
                  const r = data.memory_scan.red_count / total;
                  let offset = 0;
                  const arcs: React.ReactNode[] = [];
                  if (g > 0) {
                    const len = g * 100;
                    arcs.push(
                      <path
                        key="g"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="3"
                        strokeDasharray={`${len} ${100 - len}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += len;
                  }
                  if (y > 0) {
                    const len = y * 100;
                    arcs.push(
                      <path
                        key="y"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#EAB308"
                        strokeWidth="3"
                        strokeDasharray={`${len} ${100 - len}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += len;
                  }
                  if (r > 0) {
                    const len = r * 100;
                    arcs.push(
                      <path
                        key="r"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="3"
                        strokeDasharray={`${len} ${100 - len}`}
                        strokeDashoffset={-offset}
                      />
                    );
                  }
                  return arcs;
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700">{data.memory_scan.total_words}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span>已掌握: <strong>{data.memory_scan.green_count}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span>模糊: <strong>{data.memory_scan.yellow_count}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span>不会: <strong>{data.memory_scan.red_count}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly curve */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">📊 近7天学习曲线</h2>
        {data.weekly_curve.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无数据</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-3 min-w-[400px]">
              {data.weekly_curve.map((day) => {
                const h = maxWeekCount > 0 ? (day.count / maxWeekCount) * 160 : 0;
                const dayOfWeek = new Date(day.date).getDay();
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500 font-medium">{day.count}</span>
                    <div
                      className="w-full max-w-[32px] bg-indigo-400 rounded-t transition-all"
                      style={{ height: `${Math.max(h, 2)}px` }}
                    />
                    <span className="text-[10px] text-gray-400">{WEEK_LABELS[dayOfWeek]}</span>
                    <span className="text-[9px] text-gray-300">{day.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Capability radar (as bars) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">🎯 六维能力</h2>
        {Object.keys(data.capabilities).length === 0 ? (
          <p className="text-gray-400 text-sm">暂无能力数据</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(data.capabilities).map(([key, cap]) => {
              const score = cap.score || 0;
              const color =
                score >= 80
                  ? 'bg-green-400'
                  : score >= 60
                  ? 'bg-yellow-400'
                  : 'bg-red-400';
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {dimensionNames[key] || key}
                    </span>
                    <span className="text-xs text-gray-400">
                      {cap.correct_attempts}/{cap.total_attempts}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${color}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{score.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetail;
