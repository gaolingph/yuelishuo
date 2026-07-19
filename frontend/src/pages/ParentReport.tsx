import React, { useEffect, useState } from 'react';
import { parentApi, ChildInfo, gameApi, DailyReportData } from '../services/api';

const ParentReport: React.FC = () => {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const res = await parentApi.children();
        setChildren(res.data);
        if (res.data.length > 0) {
          setSelectedStudentId(res.data[0].user_id);
        }
      } catch {
        setError('无法获取孩子列表');
      } finally {
        setLoadingChildren(false);
      }
    };
    loadChildren();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    const loadReport = async () => {
      setLoadingReport(true);
      setError('');
      try {
        const res = await gameApi.getDailyReport(selectedStudentId);
        setReport(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || '获取报告失败');
        setReport(null);
      } finally {
        setLoadingReport(false);
      }
    };
    loadReport();
  }, [selectedStudentId]);

  if (loadingChildren) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin text-4xl">📊</div>
          <p className="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="page-container text-center py-16">
        <span className="text-6xl mb-4 block">👶</span>
        <h2 className="text-xl font-bold text-gray-700">暂无关联孩子</h2>
        <p className="text-gray-500 mt-2">请联系管理员绑定孩子账号</p>
      </div>
    );
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 学习进步日报</h1>
        <p className="text-gray-500 text-sm mt-1">每日学习报告，轻松了解孩子进步</p>
      </div>

      {/* Student selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {children.map((child) => (
          <button
            key={child.user_id}
            onClick={() => setSelectedStudentId(child.user_id)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              selectedStudentId === child.user_id
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
            }`}
          >
            {child.nickname || child.username}
          </button>
        ))}
      </div>

      {loadingReport ? (
        <div className="text-center py-12">
          <div className="animate-spin text-3xl mb-2">📊</div>
          <p className="text-gray-400">生成报告中...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : report ? (
        <div className="space-y-4">
          {/* Report date */}
          <div className="text-center text-sm text-gray-400">
            {report.date} · {report.nickname}
          </div>

          {/* Natural Language Report */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💌</span>
              <h2 className="font-bold text-blue-800">成长寄语</h2>
            </div>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
              {report.report_text}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs">累计学习</div>
              <div className="text-2xl font-bold text-gray-800">{report.total_learned}</div>
              <div className="text-xs text-gray-400">单词</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs">今日学习</div>
              <div className="text-2xl font-bold text-green-600">{report.today_learned}</div>
              <div className="text-xs text-gray-400">新词</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs">今日复习</div>
              <div className="text-2xl font-bold text-blue-600">{report.today_reviewed}</div>
              <div className="text-xs text-gray-400">单词</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs">已掌握</div>
              <div className="text-2xl font-bold text-purple-600">{report.mastered}</div>
              <div className="text-xs text-gray-400">单词</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs">待复习</div>
              <div className="text-2xl font-bold text-orange-600">{report.to_review}</div>
              <div className="text-xs text-gray-400">单词</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs">正确率</div>
              <div className="text-2xl font-bold text-green-600">{Math.round(report.accuracy)}%</div>
              <div className="text-xs text-gray-400">练习统计</div>
            </div>
          </div>

          {/* Reading progress */}
          {(report.reading_passages_completed ?? 0) > 0 ? (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-700 text-sm mb-2">📖 阅读进展</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-primary-600">{report.reading_passages_completed}</div>
                  <div className="text-xs text-gray-500">已完成阅读</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{Math.round(report.reading_average_score)}分</div>
                  <div className="text-xs text-gray-500">阅读平均得分</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{report.reading_words_covered}</div>
                  <div className="text-xs text-gray-500">覆盖词汇量</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-bold">📖 阅读功能</p>
              <p className="text-xs mt-1">学习单词后试试词汇阅读功能，巩固理解！前往「词库 → 阅读」页面开始。</p>
            </div>
          )}

          {/* Additional stats */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-700 text-sm mb-2">📊 详细数据</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">连续学习天数</span>
                <span className="font-bold text-green-600">{report.streak_days} 天</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">今日练习次数</span>
                <span className="font-bold">{report.practice_count} 次</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700">
            <p className="font-bold">💡 家长建议</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              <li>• 每天学习15分钟，效果最好</li>
              <li>• 鼓励孩子复习已学单词，巩固记忆</li>
              <li>• 和孩子一起读故事，增加学习趣味</li>
              <li>• 正向鼓励比批评更有效！</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          选择孩子查看今日报告
        </div>
      )}
    </div>
  );
};

export default ParentReport;
