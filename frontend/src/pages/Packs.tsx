import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { packsApi, WordPack, PackProgress } from '../services/api';
import ProgressBar from '../components/ProgressBar';

const PACK_ICONS: Record<string, string> = {
  '小学基础': '🔤', '小学进阶': '📚',
  '初中基础': '📖', '初中进阶': '📗',
  '高中基础': '📘', '高中进阶': '📙',
  'CET-4': '🎓', 'CET-6': '🎓',
  '考研': '🎯', 'IELTS': '🌍', 'TOEFL': '🇺🇸',
};

const Packs: React.FC = () => {
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    packsApi.list()
      .then((res) => setPacks(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载词库...</p>
      </div>
    );
  }

  // Group by level
  const grouped = packs.reduce((acc, pack) => {
    const key = pack.level;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pack);
    return acc;
  }, {} as Record<string, WordPack[]>);

  const levelLabels: Record<string, string> = {
    'primary_basic': '🌱 小学基础', 'primary_advanced': '🌿 小学进阶',
    'junior_basic': '📗 初中基础', 'junior_advanced': '📘 初中进阶',
    'senior_basic': '📙 高中基础', 'senior_advanced': '📚 高中进阶',
    'cet4': '🎓 大学四级', 'cet6': '🎓 大学六级',
    'kaoyan': '🎯 考研词汇',
    'ielts': '🌍 IELTS',
    'toefl': '🇺🇸 TOEFL',
  };

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold mb-2">词库选择</h1>
      <p className="text-gray-500 text-sm mb-6">选择适合你水平的词库开始学习</p>

      {Object.entries(grouped).map(([level, levelPacks]) => (
        <div key={level} className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            {levelLabels[level] || level}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {levelPacks.map((pack) => {
              const progress = pack.progress || { percent: 0, learned: 0, mastered: 0, total: pack.word_count };
              const icon = PACK_ICONS[pack.name] || '📖';
              return (
                <div
                  key={pack.id}
                  onClick={() => navigate(`/learn?pack_id=${pack.id}&name=${encodeURIComponent(pack.name)}`)}
                  className="card cursor-pointer hover:shadow-md transition-shadow !p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">{pack.name}</h3>
                        <span className="text-xs text-gray-400">{pack.word_count}词</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{pack.description}</p>
                      <div className="mt-2">
                        <ProgressBar
                          value={progress.learned || 0}
                          max={progress.total || pack.word_count}
                          size="sm"
                          color={progress.percent >= 80 ? 'green' : progress.percent >= 40 ? 'primary' : 'amber'}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Packs;
