import React, { useState, useCallback, useRef, useEffect } from 'react';
import { practiceApi, packsApi, WordPack } from '../services/api';
import { speak } from '../utils/speech';

type PracticeMode = 'choice' | 'spelling' | 'listening' | 'chinese_to_english' | 'speaking' | null;

// Speech recognition helper
const createSpeechRecognizer = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognizer = new SpeechRecognition();
  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.lang = 'en-US';
  return recognizer;
};

const Practice: React.FC = () => {
  const [mode, setMode] = useState<PracticeMode>(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; correctAnswer: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0, incorrect: 0 });
  const [completed, setCompleted] = useState(false);
  const [packId, setPackId] = useState<number | undefined>(undefined);
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);

  // Speaking state
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [speakingInput, setSpeakingInput] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  const question = questions[currentIndex] as any;
  const isChoice = mode === 'choice' || mode === 'listening' || mode === 'chinese_to_english';

  // Check speech recognition support
  useEffect(() => {
    setSpeechSupported(!!createSpeechRecognizer());
  }, []);

  // Fetch available word packs
  useEffect(() => {
    setPacksLoading(true);
    packsApi.list()
      .then(res => {
        setPacks(res.data);
        if (res.data.length > 0) {
          setPackId(res.data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setPacksLoading(false));
  }, []);

  const startPractice = useCallback(async (selectedMode: PracticeMode) => {
    if (!selectedMode) return;
    setLoading(true);
    setMode(selectedMode);
    setCurrentIndex(0);
    setCompleted(false);
    setStats({ total: 0, correct: 0, incorrect: 0 });
    setFeedback(null);
    setSelectedAnswer(null);
    setSpellingInput('');
    setRecognizedText('');
    setSpeakingInput('');

    try {
      let res;
      switch (selectedMode) {
        case 'choice':
          res = await practiceApi.choice(packId, 10);
          break;
        case 'spelling':
          res = await practiceApi.spelling(packId, 10);
          break;
        case 'listening':
          res = await practiceApi.listening(packId, 10);
          break;
        case 'chinese_to_english':
          res = await practiceApi.chineseToEnglish(packId, 10);
          break;
        case 'speaking':
          res = await practiceApi.speaking(packId, 10);
          break;
      }
      setQuestions(res?.data || []);
      setStats((s) => ({ ...s, total: res?.data?.length || 0 }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  const handleChoiceAnswer = async (option: string, index: number) => {
    if (feedback) return;
    setSelectedAnswer(option);

    const isCorrect = question.correct_index === index;
    setFeedback({ correct: isCorrect, correctAnswer: question.options[question.correct_index] });

    try {
      await practiceApi.submit({
        word_id: question.word_id,
        is_correct: isCorrect,
        practice_type: mode || 'choice',
      });
    } catch (err) { /* ignore */ }

    setStats((s) => ({
      ...s,
      correct: s.correct + (isCorrect ? 1 : 0),
      incorrect: s.incorrect + (isCorrect ? 0 : 1),
    }));
  };

  const handleSpellingSubmit = async () => {
    if (feedback || !spellingInput.trim()) return;

    try {
      const res = await practiceApi.submit({
        word_id: question.word_id,
        user_answer: spellingInput.trim(),
        practice_type: 'spelling',
      });

      const isCorrect = res.data.is_correct;
      const correctAnswer = res.data.correct_answer;
      setFeedback({ correct: isCorrect, correctAnswer });

      setStats((s) => ({
        ...s,
        correct: s.correct + (isCorrect ? 1 : 0),
        incorrect: s.incorrect + (isCorrect ? 0 : 1),
      }));
    } catch (err) { /* ignore */ }
  };

  // ========== Speaking ==========
  const startRecording = useCallback(() => {
    if (!speechSupported || feedback) return;

    const recognizer = createSpeechRecognizer();
    if (!recognizer) {
      setSpeechSupported(false);
      return;
    }

    recognitionRef.current = recognizer;
    setRecognizedText('');
    setIsRecording(true);

    recognizer.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const finalText = transcript.trim().toLowerCase();
          setRecognizedText(finalText);
          setSpeakingInput(finalText);
        }
      }
    };

    recognizer.onerror = () => {
      setIsRecording(false);
    };

    recognizer.onend = () => {
      setIsRecording(false);
    };

    recognizer.start();
  }, [speechSupported, feedback]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handleSpeakingSubmit = async () => {
    if (feedback) return;
    const answer = speakingInput.trim() || recognizedText.trim();
    if (!answer) return;

    try {
      const res = await practiceApi.submit({
        word_id: question.word_id,
        user_answer: answer,
        practice_type: 'speaking',
      });

      const isCorrect = res.data.is_correct;
      const correctAnswer = res.data.correct_answer;
      setFeedback({ correct: isCorrect, correctAnswer });

      setStats((s) => ({
        ...s,
        correct: s.correct + (isCorrect ? 1 : 0),
        incorrect: s.incorrect + (isCorrect ? 0 : 1),
      }));
    } catch (err) { /* ignore */ }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback(null);
      setSelectedAnswer(null);
      setSpellingInput('');
      setRecognizedText('');
      setSpeakingInput('');
    } else {
      setCompleted(true);
    }
  };

  if (!mode) {
    return (
      <div className="page-container max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-2">✍️ 练习模式</h1>
        <p className="text-gray-500 text-sm mb-4">选择一种练习方式，巩固你的词汇</p>

        {/* Pack selector */}
        <div className="mb-5">
          <label className="text-sm font-medium text-gray-600 block mb-1">选择词库</label>
          {packsLoading ? (
            <div className="text-sm text-gray-400">加载词库中...</div>
          ) : (
            <select
              value={packId ?? ''}
              onChange={(e) => setPackId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">全部词库</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.word_count}词)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => startPractice('choice')}
            className="card w-full text-left !p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">📝</span>
              <div>
                <h3 className="font-semibold text-gray-800">选择题</h3>
                <p className="text-sm text-gray-500">看英文选中文</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => startPractice('spelling')}
            className="card w-full text-left !p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">⌨️</span>
              <div>
                <h3 className="font-semibold text-gray-800">拼写题</h3>
                <p className="text-sm text-gray-500">看中文拼写英文</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => startPractice('listening')}
            className="card w-full text-left !p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎧</span>
              <div>
                <h3 className="font-semibold text-gray-800">听力题</h3>
                <p className="text-sm text-gray-500">听发音选中文</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => startPractice('chinese_to_english')}
            className="card w-full text-left !p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h3 className="font-semibold text-gray-800">中译英</h3>
                <p className="text-sm text-gray-500">看中文选英文</p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-3">
          <button
            onClick={() => startPractice('speaking')}
            className="card w-full text-left !p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎤</span>
              <div>
                <h3 className="font-semibold text-gray-800">口语练习</h3>
                <p className="text-sm text-gray-500">看中文开口说英文，AI语音识别</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载题目...</p>
      </div>
    );
  }

  if (completed) {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="page-container max-w-lg mx-auto text-center py-16">
        <span className="text-6xl mb-4 block">🎉</span>
        <h2 className="text-xl font-bold text-gray-700">练习完成！</h2>
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="card !p-3">
            <p className="text-xl font-bold text-primary-600">{stats.total}</p>
            <p className="text-xs text-gray-500">总题数</p>
          </div>
          <div className="card !p-3">
            <p className="text-xl font-bold text-green-600">{stats.correct}</p>
            <p className="text-xs text-gray-500">正确</p>
          </div>
          <div className="card !p-3">
            <p className="text-xl font-bold text-amber-600">{accuracy}%</p>
            <p className="text-xs text-gray-500">正确率</p>
          </div>
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => startPractice(mode)} className="btn-primary">
            再来一轮
          </button>
          <button onClick={() => setMode(null)} className="btn-secondary">
            返回选择
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="page-container text-center py-16">
        <p className="text-gray-500">暂无题目</p>
        <button onClick={() => setMode(null)} className="btn-secondary mt-4">
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMode(null)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-bold">
            {mode === 'choice' ? '📝 选择题' : mode === 'spelling' ? '⌨️ 拼写题' : mode === 'listening' ? '🎧 听力题' : mode === 'chinese_to_english' ? '🔄 中译英' : '🎤 口语练习'}
          </h1>
        </div>
        <span className="text-sm text-gray-400">{currentIndex + 1}/{questions.length}</span>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="card !p-6">
        {mode === 'choice' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">{question.english}</h2>
            {question.phonetic && <p className="text-gray-400 text-sm mt-1">{question.phonetic}</p>}
          </div>
        )}

        {mode === 'spelling' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-600">{question.chinese}</h2>
            <p className="text-gray-400 text-sm mt-1">{question.phonetic}</p>
            <p className="text-gray-400 text-xs mt-2">单词长度: {question.word_length} 个字母</p>
            <p className="text-gray-300 text-sm mt-1">提示: {question.hint}</p>
          </div>
        )}

        {mode === 'listening' && (
          <div className="text-center">
            <button
              onClick={() => speak(question.english)}
              className="w-16 h-16 rounded-full bg-primary-100 hover:bg-primary-200 flex items-center justify-center mx-auto mb-3"
            >
              <span className="text-3xl">🔊</span>
            </button>
            <p className="text-sm text-gray-400">点击播放发音</p>
          </div>
        )}

        {mode === 'chinese_to_english' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-600">{question.chinese}</h2>
            {question.phonetic && <p className="text-gray-400 text-sm mt-1">/{question.phonetic}/</p>}
          </div>
        )}

        {mode === 'speaking' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-600">{question.chinese}</h2>
            <p className="text-gray-400 text-sm mt-1">/{question.phonetic}/</p>

            {/* Play pronunciation button */}
            <button
              onClick={() => speak(question.english)}
              className="w-12 h-12 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center mx-auto mt-3 mb-4"
              title="听发音"
            >
              <span className="text-2xl">🔊</span>
            </button>

            {/* Speech recognition button */}
            {speechSupported && !feedback && (
              <div className="mb-4">
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all ${
                    isRecording
                      ? 'bg-red-500 scale-110 shadow-lg shadow-red-200'
                      : 'bg-primary-500 hover:bg-primary-600 shadow-md'
                  }`}
                >
                  <span className="text-4xl">🎤</span>
                </button>
                <p className="text-sm text-gray-400 mt-2">
                  {isRecording ? '松手识别' : '按住说话'}
                </p>
              </div>
            )}

            {!speechSupported && !feedback && (
              <p className="text-xs text-amber-500 mb-2">
                语音识别不可用，请手动输入
              </p>
            )}

            {/* Recognized text display */}
            {recognizedText && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-3">
                <p className="text-sm text-blue-700">识别结果: <strong>{recognizedText}</strong></p>
              </div>
            )}

            {/* Fallback text input */}
            {!feedback && (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={speakingInput}
                  onChange={(e) => setSpeakingInput(e.target.value)}
                  placeholder={recognizedText || "输入或说出英文单词..."}
                  className="input-field text-center text-lg flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSpeakingSubmit()}
                  autoFocus={!speechSupported}
                />
                <button
                  onClick={handleSpeakingSubmit}
                  disabled={!speakingInput.trim() && !recognizedText.trim()}
                  className="btn-primary whitespace-nowrap"
                >
                  检查
                </button>
              </div>
            )}
          </div>
        )}

        {/* Options or Input */}
        {isChoice && (
          <div className="mt-5 space-y-2">
            {question.options?.map((opt: string, idx: number) => {
              let btnClass = 'w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors';
              if (feedback) {
                if (idx === question.correct_index) {
                  btnClass = 'w-full text-left px-4 py-3 rounded-lg border-2 border-green-500 bg-green-50 text-green-800';
                } else if (selectedAnswer === opt && !feedback.correct) {
                  btnClass = 'w-full text-left px-4 py-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-800';
                } else {
                  btnClass = 'w-full text-left px-4 py-3 rounded-lg border border-gray-200 opacity-50';
                }
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleChoiceAnswer(opt, idx)}
                  className={btnClass}
                  disabled={!!feedback}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {mode === 'spelling' && (
          <div className="mt-5">
            <input
              type="text"
              value={spellingInput}
              onChange={(e) => setSpellingInput(e.target.value)}
              placeholder="输入英文单词..."
              className="input-field text-center text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleSpellingSubmit()}
              disabled={!!feedback}
              autoFocus
            />
            {!feedback && (
              <button
                onClick={handleSpellingSubmit}
                disabled={!spellingInput.trim()}
                className="btn-primary w-full mt-3"
              >
                提交
              </button>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`mt-4 text-center text-sm px-4 py-3 rounded-lg ${
            feedback.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {feedback.correct ? '✅ 正确！' : `❌ 正确答案: ${feedback.correctAnswer}`}
          </div>
        )}

        {/* Next button */}
        {feedback && (
          <button onClick={handleNext} className="btn-primary w-full mt-4">
            {currentIndex < questions.length - 1 ? '下一题 →' : '查看结果'}
          </button>
        )}
      </div>

      {/* Mini stats */}
      <div className="mt-3 text-sm text-gray-400 text-center">
        <span>✓ {stats.correct} / </span>
        <span>✗ {stats.incorrect} / </span>
        <span>剩余 {questions.length - currentIndex - 1}</span>
      </div>
    </div>
  );
};

export default Practice;
