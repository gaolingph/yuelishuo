/**
 * AIReport — Enhanced report display component.
 *
 * Shows a beautifully styled report card with optional AI analysis.
 * Used in VocabTest to show AI-enhanced test reports.
 */

import React, { useState } from 'react';
import { aiApi, EnhanceReportResponse, ParentReportResponse } from '../services/aiApi';

interface AIReportProps {
  /** The raw test data to enhance */
  testData?: {
    score: number;
    total: number;
    percentage: number;
    level_key: string;
    level_label: string;
    estimated_vocab: number;
    recommendation: string;
    details: { word_id: number; english: string; is_correct: boolean }[];
  };
  /** Or a direct parent report */
  parentReport?: ParentReportResponse;
  /** Student nickname for personalization */
  studentName?: string;
  /** Hide the AI enhance button (auto-enhance in parent report mode) */
  hideAction?: boolean;
}

const getLevelColor = (levelKey: string): string => {
  const map: Record<string, string> = {
    preschool: '#F59E0B',
    primary_low: '#10B981',
    primary_mid: '#3B82F6',
    primary_high: '#8B5CF6',
    secondary: '#EC4899',
    high_school: '#EF4444',
    college: '#6366F1',
    toefl: '#14B8A6',
  };
  return map[levelKey] || '#6B7280';
};

const AIReport: React.FC<AIReportProps> = ({
  testData,
  parentReport,
  studentName = '学员',
  hideAction = false,
}) => {
  const [enhancedReport, setEnhancedReport] = useState<EnhanceReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnhance = async () => {
    if (!testData || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await aiApi.enhanceReport({
        score: testData.score,
        total: testData.total,
        vocab_level: testData.level_key,
        estimated_vocab: testData.estimated_vocab,
      });
      setEnhancedReport(res.data);
    } catch {
      // If DeepSeek API fails, generate local analysis from test data
      setEnhancedReport(generateLocalAnalysis(testData));
    } finally {
      setLoading(false);
    }
  };

  /**
   * generateLocalAnalysis — fallback when DeepSeek API is unavailable.
   * Produces a meaningful analysis from test data alone.
   */
  const generateLocalAnalysis = (data: NonNullable<AIReportProps['testData']>): EnhanceReportResponse => {
    const { score, total, percentage, level_key, level_label, estimated_vocab, details } = data;
    const wrongDetails = details?.filter(d => !d.is_correct) || [];
    const correctDetails = details?.filter(d => d.is_correct) || [];
    const wrongCount = wrongDetails.length;
    const correctCount = correctDetails.length;

    // Grade
    let grade: string;
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 40) grade = 'D';
    else grade = 'E';

    // Summary
    let summary: string;
    if (percentage >= 80) {
      summary = `太棒了！你在${total}道词汇测试中答对了${score}道，正确率高达${percentage.toFixed(0)}%。当前词汇水平为「${level_label}」，预估词汇量约${estimated_vocab}词，基础非常扎实！继续保持良好的学习习惯，向更高水平迈进！`;
    } else if (percentage >= 60) {
      summary = `不错的成绩！你在${total}道词汇测试中答对了${score}道，正确率${percentage.toFixed(0)}%。当前词汇水平为「${level_label}」，预估词汇量约${estimated_vocab}词。还有一些词汇需要加强，建议每天坚持学习新词并复习巩固。`;
    } else if (percentage >= 40) {
      summary = `仍需努力！你在${total}道词汇测试中答对了${score}道，正确率${percentage.toFixed(0)}%。当前词汇水平为「${level_label}」，预估词汇量约${estimated_vocab}词。建议回顾错题，针对薄弱环节多加练习，打好基础。`;
    } else {
      summary = `需要更多练习！你在${total}道词汇测试中答对了${score}道，正确率${percentage.toFixed(0)}%。当前词汇水平为「${level_label}」，预估词汇量约${estimated_vocab}词。建议从基础词汇开始，循序渐进地学习，定期复习已学内容。`;
    }

    // Strengths
    const strengths: string[] = [];
    if (correctCount > 0) {
      const topCorrect = correctDetails.slice(0, 3).map(d => d.english);
      strengths.push(`掌握较好的词汇: ${topCorrect.join('、')}`);
    }
    if (percentage >= 60) {
      strengths.push(`词汇量预估达到${estimated_vocab}词，具备一定的阅读基础`);
    }
    if (percentage >= 80) {
      strengths.push('答题准确率高，词汇掌握扎实');
    } else if (percentage >= 40) {
      strengths.push('有基础词汇积累，继续加强可快速提升');
    } else {
      strengths.push('学习态度积极，坚持练习会有显著进步');
    }
    if (correctCount > wrongCount && wrongCount > 0) {
      strengths.push('正确题目多于错误题目，整体掌握情况良好');
    }

    // Weaknesses
    const weaknesses: string[] = [];
    if (wrongCount > 0) {
      const topWrong = wrongDetails.slice(0, 3).map(d => d.english);
      weaknesses.push(`需要加强的词汇: ${topWrong.join('、')}`);
    }
    if (percentage < 60) {
      weaknesses.push('基础词汇掌握不够牢固，建议从低级别词汇开始复习');
    }
    if (percentage < 80 && percentage >= 60) {
      weaknesses.push('部分中高级词汇掌握不牢，建议加强练习');
    }
    if (wrongCount > correctCount) {
      weaknesses.push('错误率高于正确率，需要系统性回顾和复习');
    }
    if (weaknesses.length === 0 && wrongCount > 0) {
      weaknesses.push(`仍有${wrongCount}道题需要回顾，建议反复练习加深记忆`);
    }
    if (weaknesses.length === 0) {
      weaknesses.push('继续保持，尝试挑战更高难度的词汇');
    }

    // Recommendation
    const recs: string[] = [];
    recs.push(`每日学习 ${Math.max(5, 15 - Math.floor(percentage / 10))} 个新词`);
    recs.push('使用间隔重复法（SM-2）定期复习已学词汇');
    if (wrongCount > 0) {
      recs.push(`重点复习 ${wrongCount} 道错题中的生词，确保彻底掌握`);
      recs.push('将错题加入收藏本，每周回顾一次');
    }
    if (percentage < 60) {
      recs.push('建议从启蒙/初级词库重新学习，打好基础');
    } else if (percentage < 80) {
      recs.push('尝试阅读英文短文，在语境中加深词汇理解');
    } else {
      recs.push('挑战更高级别的词库，扩大词汇量');
    }
    const recommendation = recs.join('；') + '。';

    // Appeal (encouragement)
    let appeal: string;
    if (percentage >= 90) appeal = '你是词汇小达人！继续保持，挑战更高难度吧！🚀';
    else if (percentage >= 70) appeal = '非常棒！你的词汇量在稳步增长，继续加油！💪';
    else if (percentage >= 50) appeal = '不错的开始！每天进步一点点，很快就能掌握更多词汇！🌟';
    else appeal = '别灰心！学习是一个循序渐进的过程，坚持就是胜利！🌈';

    // Next level
    const levelProgression: Record<string, string> = {
      preschool: '小学初级 (小学1-2年级)',
      primary_low: '小学中级 (小学3-4年级)',
      primary_mid: '小学高级 (小学5-6年级)',
      primary_high: '初中基础 (初一)',
      secondary: '初中进阶 (初二、初三)',
      high_school: '高中水平',
      college: '大学水平 (四级)',
      toefl: '托福水平 (高阶)',
    };
    const levels = Object.keys(levelProgression);
    const currentIdx = levels.indexOf(level_key);
    let nextLevel: string;
    if (currentIdx >= 0 && currentIdx < levels.length - 1) {
      const nextKey = levels[currentIdx + 1];
      nextLevel = `冲刺 ${levelProgression[nextKey] || nextKey}，预计还需学习 300-500 个新词`;
    } else if (currentIdx === levels.length - 1) {
      nextLevel = '你已达到最高等级，继续保持！可以尝试阅读英文原版书籍';
    } else {
      nextLevel = '继续学习，向更高水平迈进！';
    }

    return {
      summary,
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 4),
      recommendation,
      grade,
      appeal,
      next_level: nextLevel,
    };
  };

  // Parent report mode
  if (parentReport) {
    const s = parentReport.stats;
    return (
      <div className="card mb-4 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <h3 className="font-bold text-white text-sm">AI 成长日报</h3>
              <p className="text-[11px] text-white/70">{parentReport.child_name} · {parentReport.date}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-primary-50 rounded-xl p-2">
              <p className="text-lg font-bold text-primary-600">{s.today_learned}</p>
              <p className="text-[10px] text-gray-500">今日学习</p>
            </div>
            <div className="text-center bg-green-50 rounded-xl p-2">
              <p className="text-lg font-bold text-green-600">{s.total_learned}</p>
              <p className="text-[10px] text-gray-500">累计单词</p>
            </div>
            <div className="text-center bg-amber-50 rounded-xl p-2">
              <p className="text-lg font-bold text-amber-600">{s.mastered}</p>
              <p className="text-[10px] text-gray-500">已掌握</p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>准确率</span>
              <span>{s.accuracy.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-primary-400 to-primary-500 transition-all duration-500"
                style={{ width: `${s.accuracy}%` }}
              />
            </div>
          </div>

          {/* Streak & review */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>🔥 连续 {s.streak_days} 天</span>
            <span>📝 待复习 {s.to_review} 词</span>
          </div>

          {/* Teacher tip */}
          <div className="bg-gradient-to-r from-primary-50 to-amber-50 border border-primary-100 rounded-xl p-3">
            <div className="flex gap-2">
              <span className="text-base">🤖</span>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">AI 成长寄语</p>
                <p className="text-sm text-gray-700 leading-relaxed">{parentReport.encouragement}</p>
              </div>
            </div>
          </div>

          {/* Next milestone */}
          {parentReport.next_milestone && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              🎯 下一个里程碑: {parentReport.next_milestone}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard test report with AI enhancement
  if (!testData) return null;

  return (
    <div className="card mb-4 overflow-hidden">
      {/* Score header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800">测试报告</h3>
          <p className="text-xs text-gray-400">
            {testData.total}题 · {testData.percentage.toFixed(0)}% 正确率
          </p>
        </div>
        <div className="text-center">
          <p
            className={`text-2xl font-extrabold ${
              testData.percentage >= 80 ? 'text-green-600' :
              testData.percentage >= 60 ? 'text-amber-600' :
              'text-red-500'
            }`}
          >
            {testData.score}/{testData.total}
          </p>
        </div>
      </div>

      {/* Level badge */}
      <div className="px-4 py-2 bg-gray-50 flex items-center gap-3">
        <span
          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: getLevelColor(testData.level_key) }}
        >
          {testData.level_label}
        </span>
        <span className="text-sm text-gray-600">
          预估词汇量: <strong>{testData.estimated_vocab}</strong>
        </span>
      </div>

      {/* Recommendation */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-1">📌 学习建议</p>
        <p className="text-sm text-gray-700">{testData.recommendation}</p>
      </div>

      {/* AI Enhance Button */}
      {!hideAction && !enhancedReport && (
        <div className="px-4 py-3">
          <button
            onClick={handleEnhance}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI分析中...
              </>
            ) : (
              <>
                <span>🤖</span>
                AI 智能分析报告
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Enhanced report */}
      {enhancedReport && (
        <div className="border-t border-gray-100">
          {/* AI Grade */}
          <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">AI 综合评级</span>
              <span className="text-lg font-bold text-primary-600">{enhancedReport.grade}</span>
            </div>
          </div>

          {/* Summary */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex gap-2">
              <span>📊</span>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">AI 分析摘要</p>
                <p className="text-sm text-gray-700">{enhancedReport.summary}</p>
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-4 py-3 bg-green-50/50">
              <p className="text-xs text-gray-400 mb-1">✅ 优势</p>
              <ul className="text-sm text-gray-700 space-y-0.5 list-disc list-inside">
                {enhancedReport.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="px-4 py-3 bg-orange-50/50">
              <p className="text-xs text-gray-400 mb-1">🔍 待加强</p>
              <ul className="text-sm text-gray-700 space-y-0.5 list-disc list-inside">
                {enhancedReport.weaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendation */}
          <div className="px-4 py-3 bg-primary-50/50">
            <div className="flex gap-2">
              <span>🎯</span>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">AI 学习建议</p>
                <p className="text-sm text-gray-700">{enhancedReport.recommendation}</p>
              </div>
            </div>
          </div>

          {/* Next level target */}
          {enhancedReport.next_level && (
            <div className="px-4 py-3 bg-amber-50/50">
              <div className="flex gap-2">
                <span>🚀</span>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">下一等级目标</p>
                  <p className="text-sm text-gray-700">{enhancedReport.next_level}</p>
                </div>
              </div>
            </div>
          )}

          {/* Encouragement */}
          {enhancedReport.appeal && (
            <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-green-50 rounded-b-xl">
              <div className="flex gap-2">
                <span>💪</span>
                <p className="text-sm text-gray-700">{enhancedReport.appeal}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIReport;
