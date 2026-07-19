import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { memoryScanApi, MemoryScanResult, MemoryScanWordItem, packsApi, WordPack } from '../services/api';

const ZONE_CONFIG = {
  green: { label: '已掌握', color: '#22c55e', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', icon: '✅' },
  yellow: { label: '模糊', color: '#eab308', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', icon: '⚠️' },
  red: { label: '不会', color: '#ef4444', bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', icon: '❌' },
};

const MemoryScan: React.FC = () => {
  const { packId: packIdParam } = useParams<{ packId: string }>();
  const navigate = useNavigate();
  const [packId, setPackId] = useState<number>(packIdParam ? parseInt(packIdParam) : 0);
  const [packs, setPacks] = useState<WordPack[]>([]);
  const [result, setResult] = useState<MemoryScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  // Load available packs
  useEffect(() => {
    packsApi.list().then(res => {
      setPacks(res.data);
      // Auto-select first pack if none selected
      if (!packId && res.data.length > 0) {
        setPackId(res.data[0].id);
      }
    }).catch(() => {});
  }, []);

  // Run scan when packId changes
  useEffect(() => {
    if (!packId) return;
    setLoading(true);
    setError('');
    memoryScanApi.scan(packId)
      .then(res => setResult(res.data))
      .catch(err => setError('扫描失败: ' + (err.response?.data?.detail || err.message)))
      .finally(() => setLoading(false));
  }, [packId]);

  // Donut chart SVG — three colored arcs
  const renderDonut = () => {
    if (!result || result.total_words === 0) return null;
    const { green_count, yellow_count, red_count, total_words } = result;
    const sections = [
      { count: green_count, color: ZONE_CONFIG.green.color },
      { count: yellow_count, color: ZONE_CONFIG.yellow.color },
      { count: red_count, color: ZONE_CONFIG.red.color },
    ].filter(s => s.count > 0);

    // Simple SVG pie chart
    const total = total_words;
    let cumulativeAngle = 0;
    const arcPaths = sections.map(s => {
      const fraction = s.count / total;
      const angle = fraction * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      const r = 80;
      const cx = 100;
      const cy = 100;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;

      return {
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: s.color,
        count: s.count,
        percent: Math.round((s.count / total) * 100),
      };
    });

    return (
      <div className="flex flex-col items-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {arcPaths.map((arc, i) => (
            <path key={i} d={arc.path} fill={arc.color} stroke="white" strokeWidth="2" />
          ))}
          <circle cx="100" cy="100" r="50" fill="white" />
          <text x="100" y="95" textAnchor="middle" className="text-2xl font-bold" fill="#333">
            {total_words}
          </text>
          <text x="100" y="115" textAnchor="middle" className="text-xs" fill="#888">
            个单词
          </text>
        </svg>
        {/* Legend */}
        <div className="flex gap-6 mt-3">
          {sections.map((s, i) => {
            const zone = ['green', 'yellow', 'red'][i] as keyof typeof ZONE_CONFIG;
            const cfg = ZONE_CONFIG[zone];
            return (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-gray-600">{cfg.label}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Zone list panel
  const renderZoneList = (zone: 'green' | 'yellow' | 'red') => {
    const cfg = ZONE_CONFIG[zone];
    const words = result?.[`${zone}_words` as keyof MemoryScanResult] as MemoryScanWordItem[] | undefined;
    if (!words || words.length === 0) return null;

    const isExpanded = expandedZone === zone;
    const count = zone === 'green' ? result!.green_count : zone === 'yellow' ? result!.yellow_count : result!.red_count;

    return (
      <div className={`border rounded-xl mb-3 overflow-hidden ${cfg.border} ${cfg.bg}`}>
        <button
          className={`w-full px-5 py-3.5 flex items-center justify-between text-left font-medium ${cfg.text}`}
          onClick={() => setExpandedZone(isExpanded ? null : zone)}
        >
          <span className="flex items-center gap-2">
            <span>{cfg.icon}</span>
            <span>{cfg.label}</span>
            <span className="text-sm opacity-75">({count}词)</span>
          </span>
          <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        {isExpanded && (
          <div className="px-5 pb-3 max-h-60 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {words.map((w) => (
                <div key={w.word_id} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium text-gray-800">{w.english}</span>
                  <span className="text-gray-500 text-xs">{w.chinese}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🧠 记忆扫描</h1>
        <p className="text-gray-500 mt-1">5分钟快速测评，生成专属单词地图</p>
      </div>

      {/* Pack selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-600 mb-1.5">选择词包</label>
        <select
          className="w-full border rounded-lg px-4 py-2.5 text-gray-700 bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          value={packId}
          onChange={(e) => {
            setPackId(parseInt(e.target.value));
            setResult(null);
            setExpandedZone(null);
          }}
        >
          <option value={0}>请选择词包...</option>
          {packs.filter(p => p.id >= 12 && p.id <= 17).map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.word_count}词)</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin text-4xl mb-3">🔍</div>
          <p className="text-gray-500">正在扫描你的单词记忆...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          {/* Donut chart */}
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
            {renderDonut()}
          </div>

          {/* Zone summary insight */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 mb-4 text-sm text-blue-700">
            {result.red_count > 0
              ? `💡 你有 ${result.red_count} 个单词需要重点突破，${result.yellow_count} 个需要巩固，${result.green_count} 个已安全掌握。`
              : result.yellow_count > 0
              ? `💡 整体不错！还有 ${result.yellow_count} 个单词需要巩固一下就能完全掌握。`
              : `🎉 太棒了！这个词包的所有单词你都已经掌握！`}
          </div>

          {/* Zone lists */}
          {renderZoneList('red')}
          {renderZoneList('yellow')}
          {renderZoneList('green')}

          {/* Action buttons */}
          <div className="flex flex-col gap-3 mt-6">
            <button
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
              onClick={() => navigate(`/five-step/${packId}`)}
            >
              🚀 开始五步学习法
            </button>
            <button
              className="w-full py-3 bg-white border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all"
              onClick={() => navigate(`/learn?pack_id=${packId}`)}
            >
              📖 从生词记忆开始
            </button>
          </div>
        </div>
      )}

      {/* Empty state - no pack selected */}
      {!packId && !loading && (
        <div className="text-center py-16 text-gray-400">
          <span className="text-6xl block mb-4">📋</span>
          <p>请先选择一个词包开始扫描</p>
        </div>
      )}
    </div>
  );
};

export default MemoryScan;
