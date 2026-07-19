import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { vocabTestApi, VocabTestQuestion, VocabTestReport, VocabTestHistoryItem } from '../services/api';
import AIReport from '../components/AIReport';

type Phase = 'welcome' | 'quiz' | 'report';

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'from-gray-400 to-gray-500',
  elementary: 'from-green-400 to-emerald-500',
  intermediate: 'from-blue-400 to-indigo-500',
  advanced: 'from-orange-400 to-amber-500',
  proficient: 'from-purple-400 to-pink-500',
};

const LEVEL_BG: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-700 border-gray-200',
  elementary: 'bg-green-50 text-green-700 border-green-200',
  intermediate: 'bg-blue-50 text-blue-700 border-blue-200',
  advanced: 'bg-orange-50 text-orange-700 border-orange-200',
  proficient: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function VocabTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quiz state
  const [testId, setTestId] = useState('');
  const [questions, setQuestions] = useState<VocabTestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedOption, setSelectedOption] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  // Report state
  const [report, setReport] = useState<VocabTestReport | null>(null);

  // History
  const [history, setHistory] = useState<VocabTestHistoryItem[]>([]);

  // Load history on welcome
  useEffect(() => {
    if (phase === 'welcome') {
      vocabTestApi.history(5).then(res => setHistory(res.data)).catch(() => {});
    }
  }, [phase]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await vocabTestApi.start();
      const data = res.data;
      setTestId(data.test_id);
      setQuestions(data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setSelectedOption('');
      setShowFeedback(false);
      setPhase('quiz');
    } catch (e: any) {
      setError('获取测试题失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectOption = (option: string) => {
    if (showFeedback) return; // Already answered
    setSelectedOption(option);
    setShowFeedback(true);
    setAnswers(prev => ({ ...prev, [questions[currentIndex].word_id]: option }));

    // Auto-advance after 1.2s on last question? No — let user click next.
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption('');
      setShowFeedback(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      const prevWordId = questions[currentIndex - 1].word_id;
      setSelectedOption(answers[prevWordId] || '');
      setShowFeedback(true);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const answerList = Object.entries(answers).map(([wordId, selected]) => ({
        word_id: Number(wordId),
        selected,
      }));
      const res = await vocabTestApi.submit({ test_id: testId, answers: answerList });
      setReport(res.data);
      setPhase('report');
    } catch (e: any) {
      setError('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setPhase('welcome');
    setReport(null);
    setQuestions([]);
    setAnswers({});
  };

  // ── Welcome Phase ──────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="page-container max-w-lg mx-auto">
        <div className="text-center space-y-6">
          {/* Header */}
          <div className="text-6xl mb-2">📝</div>
          <h1 className="text-2xl font-bold text-gray-800">词汇量测试</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            通过 <strong className="text-primary-600">15 道选择题</strong>快速评估你的词汇水平。
            题目涵盖小学、初中、高中、大学四级及高阶词汇。
          </p>

          {/* Info cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card !p-3">
              <p className="text-lg font-bold text-primary-600">15</p>
              <p className="text-xs text-gray-500">总题数</p>
            </div>
            <div className="card !p-3">
              <p className="text-lg font-bold text-accent-500">≈5</p>
              <p className="text-xs text-gray-500">分钟</p>
            </div>
            <div className="card !p-3">
              <p className="text-lg font-bold text-indigo-500">5</p>
              <p className="text-xs text-gray-500">难度等级</p>
            </div>
          </div>

          {/* Start button */}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleStart}
            disabled={loading}
            className="btn-primary !px-10 !py-3 text-lg w-full"
          >
            {loading ? '⏳ 准备中...' : '🚀 开始测试'}
          </button>

          <p className="text-xs text-gray-400">
            请确保你有大约5分钟的不间断时间来完成测试
          </p>

          {/* History */}
          {history.length > 0 && (
            <div className="mt-6 text-left">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">📊 历史记录</h3>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="card !p-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{h.level_label?.split(' ')[0] || '📝'}</span>
                      <div>
                        <p className="font-medium text-gray-700">{h.level_label || h.level}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(h.taken_at).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-600">{h.score}/{h.total}</p>
                      <p className="text-xs text-gray-400">估计 {h.estimated_vocab} 词</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Back link */}
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 返回首页
          </button>
        </div>
      </div>
    );
  }

  // ── Quiz Phase ─────────────────────────────────────────────────
  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === questions.length - 1;
  const allAnswered = answeredCount === questions.length;

  if (phase === 'quiz') {
    return (
      <div className="page-container max-w-lg mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleRestart}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ✕ 退出
          </button>
          <span className="text-sm font-medium text-gray-500">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-sm text-gray-400">
            ✅ {answeredCount}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Level tag */}
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${LEVEL_BG[currentQ.level] || 'bg-gray-100'}`}>
          {currentQ.level_name}
        </span>

        {/* Word display */}
        <div className="text-center my-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentQ.english}</h2>
          {currentQ.phonetic && (
            <p className="text-lg text-gray-400">{currentQ.phonetic}</p>
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          {currentQ.options.map((option, idx) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = showFeedback && option === currentQ.options.find(
              (_, i) => i === currentQ.options.indexOf(option)
            );
            // We don't know which is correct on the frontend until feedback? No, we don't store correct_answer on frontend.
            // The backend stores the correct answer. But in the submit process, we send and get back which were correct.
            // For immediate feedback, we need the correct answer. Let me adjust — we only show if user got it right/wrong after clicking.

            // Actually, looking at the flow: user clicks an option, we mark it selected, then show "正确！" or "错误"
            // But we don't know which is correct on the frontend... unless we send the answer to backend immediately.
            // Alternative: show selection without correctness feedback, then on submit show full results.

            // Better approach: just highlight the selected option, no correct/wrong feedback during the test.
            // The full results come in the report phase.
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(option)}
                disabled={showFeedback}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                    : showFeedback
                    ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-default'
                    : 'border-gray-100 bg-white text-gray-700 hover:border-primary-200 hover:bg-primary-50/50'
                }`}
              >
                <span className="inline-block w-6 h-6 rounded-full border border-current text-center leading-6 text-sm mr-3 flex-shrink-0">
                  {['A', 'B', 'C', 'D'][idx]}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-500 text-center mb-3">{error}</p>}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentIndex > 0 && (
            <button onClick={handlePrev} className="btn-secondary flex-1">
              ← 上一题
            </button>
          )}
          {!isLast ? (
            <button
              onClick={handleNext}
              disabled={!answers[currentQ.word_id]}
              className={`flex-1 ${answers[currentQ.word_id] ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'} py-3 rounded-lg font-medium`}
            >
              下一题 →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || loading}
              className={`flex-1 ${allAnswered && !loading ? 'btn-accent' : 'bg-gray-100 text-gray-400 cursor-not-allowed'} py-3 rounded-lg font-medium`}
            >
              {loading ? '⏳ 提交中...' : '📊 查看报告'}
            </button>
          )}
        </div>

        {/* Hint */}
        {!answers[currentQ.word_id] && (
          <p className="text-center text-xs text-gray-400 mt-4">选择一个选项后继续</p>
        )}
      </div>
    );
  }

  // ── Report Phase ───────────────────────────────────────────────
  if (phase === 'report' && report) {
    return (
      <div className="page-container max-w-lg mx-auto">
        <div className="text-center space-y-6">
          {/* Score circle */}
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg">
            <div>
              <p className="text-4xl font-bold">{report.score}</p>
              <p className="text-sm opacity-80">/ {report.total}</p>
            </div>
          </div>

          {/* Percentage */}
          <p className="text-lg text-gray-500">
            正确率 <span className="font-bold text-gray-800">{report.percentage}%</span>
          </p>

          {/* Level badge */}
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r ${LEVEL_COLORS[report.level_key] || 'from-gray-400 to-gray-500'} text-white font-bold text-lg shadow`}>
            <span>{report.level_label}</span>
          </div>

          {/* Estimated vocab */}
          <div className="card !p-4 flex items-center justify-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <p className="text-sm text-gray-500">估计词汇量</p>
              <p className="text-xl font-bold text-gray-800">
                约 <span className="text-primary-600">{report.estimated_vocab.toLocaleString()}</span> 词
              </p>
            </div>
          </div>

          {/* Level breakdown */}
          <div className="card !p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 text-left">📊 各等级正确率</h3>
            <div className="space-y-2">
              {Object.entries(report.level_breakdown).map(([levelKey, data]) => {
                const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                const levelNames: Record<string, string> = {
                  primary: '小学', junior: '初中', senior: '高中',
                  cet4: '大学四级', advanced: '高阶',
                };
                return (
                  <div key={levelKey} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-600 text-xs">{levelNames[levelKey] || levelKey}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-gray-500">
                      {data.correct}/{data.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendation */}
          <div className="card !p-4 !bg-gradient-to-r !from-primary-50 !to-emerald-50 border-primary-100">
            <h3 className="font-semibold text-gray-700 mb-2">💡 学习建议</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {report.recommendation}
            </p>
          </div>

          {/* AI Enhanced Report */}
          <AIReport
            testData={{
              score: report.score,
              total: report.total,
              percentage: report.percentage,
              level_key: report.level_key,
              level_label: report.level_label,
              estimated_vocab: report.estimated_vocab,
              recommendation: report.recommendation,
              details: report.details,
            }}
          />

          {/* Action buttons */}
          <div className="space-y-3">
            <button onClick={handleRestart} className="btn-primary w-full !py-3">
              🔄 重新测试
            </button>
            <button onClick={() => navigate('/')} className="btn-secondary w-full !py-3">
              🏠 返回首页
            </button>
            <button
              onClick={() => {
                // Copy report summary as text for sharing
                const text = `📝 词汇量测试结果\n\n得分: ${report.score}/${report.total} (${report.percentage}%)\n等级: ${report.level_label}\n估计词汇量: ${report.estimated_vocab.toLocaleString()} 词\n\n💡 学习建议: ${report.recommendation}`;
                navigator.clipboard.writeText(text).then(() => {
                  alert('测试结果已复制到剪贴板，可以分享给家长了！');
                }).catch(() => {
                  // Fallback
                  const el = document.createElement('textarea');
                  el.value = text;
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand('copy');
                  document.body.removeChild(el);
                  alert('测试结果已复制到剪贴板！');
                });
              }}
              className="text-sm text-primary-600 hover:text-primary-700 underline"
            >
              📋 复制结果分享给家长
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="page-container text-center py-20">
      <p className="text-gray-400">加载中...</p>
    </div>
  );
}
