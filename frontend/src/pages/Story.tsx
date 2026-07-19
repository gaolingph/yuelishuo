import React, { useEffect, useState } from 'react';
import { gameApi, StoryListItem, StoryData } from '../services/api';
import { speak } from '../utils/speech';

type ViewState = 'list' | 'reading' | 'question' | 'result';

const LEVEL_NAMES: Record<string, string> = {
  L1: '⭐ 入门级',
  L2: '⭐⭐ 进阶级',
  L3: '⭐⭐⭐ 挑战级',
};

const LEVEL_COLORS: Record<string, string> = {
  L1: 'bg-green-100 text-green-700 border-green-200',
  L2: 'bg-blue-100 text-blue-700 border-blue-200',
  L3: 'bg-purple-100 text-purple-700 border-purple-200',
};

const Story: React.FC = () => {
  const [level, setLevel] = useState<string>('L1');
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [currentStory, setCurrentStory] = useState<StoryData | null>(null);
  const [view, setView] = useState<ViewState>('list');
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; stars: number; words_added: number; message: string } | null>(null);

  const loadStories = async (lvl: string) => {
    setLoading(true);
    try {
      const res = await gameApi.listStories(lvl);
      setStories(res.data);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStories(level);
  }, [level]);

  const startStory = async (storyId: number) => {
    try {
      const res = await gameApi.getStory(storyId);
      setCurrentStory(res.data);
      setView('reading');
      setSelectedAnswer(null);
      setResult(null);
    } catch (err) {
      console.error('Failed to load story', err);
    }
  };

  const handleReadComplete = () => {
    if (currentStory?.question) {
      setView('question');
    } else {
      finishStory(-1);
    }
  };

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null || !currentStory) return;
    finishStory(selectedAnswer);
  };

  const finishStory = async (answerIndex: number) => {
    if (!currentStory) return;
    try {
      const correct = currentStory.question
        ? answerIndex === currentStory.question.correct_index
        : true;
      const res = await gameApi.completeStory(currentStory.id, {
        correct,
        answer_index: answerIndex,
      });
      setResult({
        correct,
        stars: res.data.stars_earned,
        words_added: res.data.words_added,
        message: res.data.message,
      });
      setView('result');
      // Refresh stories list to update completion status
      loadStories(level);
    } catch (err) {
      console.error('Failed to complete story', err);
    }
  };

  const handleSpeak = (text: string) => {
    speak(text);
  };

  const backToList = () => {
    setView('list');
    setCurrentStory(null);
    setSelectedAnswer(null);
    setResult(null);
  };

  // Story list view
  if (view === 'list') {
    return (
      <div className="page-container max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📖 故事探险</h1>
          <p className="text-gray-500 text-sm mt-1">读故事，学单词，做阅读理解！</p>
        </div>

        {/* Level tabs */}
        <div className="flex gap-2 mb-4 justify-center">
          {Object.entries(LEVEL_NAMES).map(([key, name]) => (
            <button
              key={key}
              onClick={() => setLevel(key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                level === key
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Story list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-2">📖</div>
            <p className="text-gray-400">加载故事中...</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <span className="text-4xl">📚</span>
            <p className="text-gray-500 mt-2">该级别暂无故事</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((story) => (
              <button
                key={story.id}
                onClick={() => startStory(story.id)}
                className={`w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-all active:scale-[0.98] border-l-4 ${
                  story.completed ? 'border-green-400' : 'border-primary-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800">{story.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{LEVEL_NAMES[story.level]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {story.completed && (
                      <span className="text-green-500 font-bold text-sm">
                        ⭐ {story.stars_earned}
                      </span>
                    )}
                    <span className="text-2xl">{story.completed ? '✅' : '🔒'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {view === 'list' && currentStory && (
          <div className="text-center mt-4">
            <button
              onClick={backToList}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 返回列表
            </button>
          </div>
        )}
      </div>
    );
  }

  // Reading view
  if (view === 'reading' && currentStory) {
    return (
      <div className="page-container max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={backToList} className="text-gray-400 hover:text-gray-600">
              ← 返回
            </button>
            <span className={`text-xs px-2 py-1 rounded-full border ${LEVEL_COLORS[currentStory.level]}`}>
              {LEVEL_NAMES[currentStory.level]}
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">{currentStory.title}</h2>

          {/* Story text */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 leading-relaxed text-gray-700 text-base">
            {currentStory.text}
          </div>

          {/* Read aloud button */}
          <button
            onClick={() => handleSpeak(currentStory.text)}
            className="w-full mb-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all"
          >
            🔊 朗读故事
          </button>

          {/* Vocabulary list */}
          {currentStory.vocabulary && currentStory.vocabulary.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 text-sm mb-2">📝 本课词汇</h3>
              <div className="flex flex-wrap gap-2">
                {currentStory.vocabulary.map((v, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-sm cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => speak(v.word)}
                    title={`${v.chinese} [${v.phonetic || ''}]`}
                  >
                    {v.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleReadComplete}
            className="w-full py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 transition-all active:scale-[0.98]"
          >
            {currentStory.question ? '📝 开始答题' : '✅ 完成阅读'}
          </button>
        </div>
      </div>
    );
  }

  // Question view
  if (view === 'question' && currentStory?.question) {
    const q = currentStory.question;
    return (
      <div className="page-container max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={backToList} className="text-gray-400 hover:text-gray-600">
              ← 返回
            </button>
            <span className="text-sm text-gray-400">理解题</span>
          </div>

          <h2 className="text-lg font-bold text-gray-800 mb-4">{currentStory.title}</h2>

          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-blue-800 font-bold mb-1">❓ 阅读理解</p>
            <p className="text-blue-700">{q.question}</p>
          </div>

          <div className="space-y-2">
            {q.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`w-full p-3 rounded-xl text-left font-medium transition-all border-2 ${
                  selectedAnswer === i
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300'
                }`}
              >
                {String.fromCharCode(65 + i)}. {option}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswer === null}
            className={`w-full mt-4 py-3 rounded-xl font-bold transition-all ${
              selectedAnswer !== null
                ? 'bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            ✅ 提交答案
          </button>
        </div>
      </div>
    );
  }

  // Result view
  if (view === 'result' && currentStory && result) {
    return (
      <div className="page-container max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 text-center">
          <div className="text-6xl mb-4">{result.correct ? '🎉' : '💪'}</div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {result.correct ? '回答正确！' : '继续加油！'}
          </h2>
          <p className="text-gray-500 mb-4">{result.message}</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">⭐ 获得星星</span>
              <span className="font-bold text-yellow-600">+{result.stars}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📚 新增单词</span>
              <span className="font-bold text-green-600">+{result.words_added}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={backToList}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              📚 故事列表
            </button>
            {currentStory.question && !result.correct && (
              <button
                onClick={() => {
                  setView('question');
                  setSelectedAnswer(null);
                  setResult(null);
                }}
                className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 transition-all"
              >
                🔄 再试一次
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Story;
