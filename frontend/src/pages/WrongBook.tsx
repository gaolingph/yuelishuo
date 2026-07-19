import React, { useEffect, useState } from 'react';
import { statsApi } from '../services/api';

interface WrongWordItem {
  id: number;
  word: {
    id: number;
    english: string;
    chinese: string;
    phonetic: string;
    example_en: string;
    example_cn: string;
  };
  wrong_count: number;
  practice_type: string;
  last_wrong_at: string;
}

const practiceTypeLabels: Record<string, string> = {
  choice: '选择题',
  spelling: '拼写题',
  listening: '听力题',
};

const WrongBook: React.FC = () => {
  const [words, setWords] = useState<WrongWordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    statsApi.wrongBook()
      .then((res) => setWords(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (wordId: number) => {
    try {
      await statsApi.removeWrong(wordId);
      setWords((prev) => prev.filter((w) => w.word.id !== wordId));
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = filter === 'all' ? words : words.filter((w) => w.practice_type === filter);
  const totalWrong = words.reduce((sum, w) => sum + w.wrong_count, 0);

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载错题本...</p>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">📕 错题本</h1>
        <span className="text-sm text-gray-400">{words.length} 个单词，{totalWrong} 次错误</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">记录你答错的单词，针对性巩固复习</p>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { key: 'all', label: '全部' },
          { key: 'choice', label: '选择题' },
          { key: 'spelling', label: '拼写题' },
          { key: 'listening', label: '听力题' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${
              filter === f.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-6xl mb-4 block">🎉</span>
          <p className="text-gray-500">错题本空空如也，继续保持！</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="card !p-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{item.word.english}</span>
                    <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                      错{item.wrong_count}次
                    </span>
                    <span className="text-xs text-gray-400">
                      {practiceTypeLabels[item.practice_type] || item.practice_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{item.word.chinese}</p>
                </div>
                <span className="text-gray-300 text-xl ml-2">
                  {expandedId === item.id ? '▾' : '▸'}
                </span>
              </div>

              {expandedId === item.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {item.word.phonetic && (
                    <p className="text-sm text-gray-400">{item.word.phonetic}</p>
                  )}
                  {item.word.example_en && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                      <p className="text-sm text-gray-600">{item.word.example_en}</p>
                      <p className="text-sm text-gray-400 mt-0.5">{item.word.example_cn}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item.word.id);
                      }}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition-colors"
                    >
                      移出错题本
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WrongBook;
