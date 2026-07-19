import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { gardenApi, GardenData, GardenPlant, GardenPackInfo } from '../services/api';

/* ────────────────────  Stage & style constants ──────────────────── */

const STAGE_META: Record<number, { label: string; plural: string; emoji: string; bg: string; border: string; text: string }> = {
  0: { label: '种子', plural: '种子',   emoji: '🌰', bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700' },
  1: { label: '嫩芽', plural: '嫩芽',   emoji: '🌱', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
  2: { label: '生长', plural: '生长中', emoji: '🌿', bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700' },
  3: { label: '开花', plural: '已开花', emoji: '🌸', bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700' },
  4: { label: '成林', plural: '已成林', emoji: '🌳', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
};

const STAGE_ORDER = [0, 1, 2, 3, 4];

/* ────────────────────  Plant emoji resolver ──────────────────── */

function getPlantEmoji(stage: number, plantType: string): string {
  switch (stage) {
    case 0: return '🌰';
    case 1: return '🌱';
    case 2: return '🌿';
    case 3: return plantType;   // e.g. 🌸 🌺 🌷 🌹
    case 4: return '🌳';
    default: return '🌱';
  }
}

function getStageBg(stage: number): string {
  return STAGE_META[stage]?.bg ?? 'bg-gray-50';
}

/* ────────────────────  Stat card ──────────────────── */

const StatCard: React.FC<{ icon: string; label: string; value: string | number; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border border-green-100 p-3 text-center hover:shadow-md transition-shadow">
    <span className="text-2xl block">{icon}</span>
    <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

/* ────────────────────  Plant detail modal ──────────────────── */

const PlantModal: React.FC<{ plant: GardenPlant; onClose: () => void; onReview: (wordId: number) => void }> = ({ plant, onClose, onReview }) => {
  const meta = STAGE_META[plant.stage] ?? STAGE_META[0];
  const emoji = getPlantEmoji(plant.stage, plant.plant_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Plant visual */}
        <div className="text-center mb-4">
          <span className="text-6xl block">{emoji}</span>
          <h3 className="text-2xl font-bold text-gray-800 mt-2">{plant.english}</h3>
          <p className="text-lg text-gray-500">{plant.chinese}</p>
          {plant.phonetic && <p className="text-sm text-gray-400">{plant.phonetic}</p>}
        </div>

        {/* Stage badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${meta.bg} ${meta.text} ${meta.border} border mx-auto block w-fit mb-4`}>
          {meta.emoji} {meta.label}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-5">
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-gray-400 text-xs">词包</p>
            <p className="font-bold text-gray-700 truncate">{plant.pack_name}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-gray-400 text-xs">复习次数</p>
            <p className="font-bold text-gray-700">{plant.repetitions} 次</p>
          </div>
          {plant.is_mastered && (
            <div className="bg-green-50 rounded-lg p-2.5 text-center col-span-2">
              <p className="text-green-600 font-bold">✅ 已掌握</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onReview(plant.word_id)}
            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 transition-all active:scale-95"
          >
            📝 去复习
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────  Plant card (garden plot) ──────────────────── */

const PlantCard: React.FC<{ plant: GardenPlant; onClick: () => void }> = ({ plant, onClick }) => {
  const meta = STAGE_META[plant.stage] ?? STAGE_META[0];
  const emoji = getPlantEmoji(plant.stage, plant.plant_type);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer ${meta.bg} ${meta.border}`}
      style={{ width: 100, height: 120 }}
      title={`${plant.english} — ${plant.chinese} (${meta.label})`}
    >
      {/* Plant emoji */}
      <span className="text-3xl mt-1 mb-0.5 leading-none">{emoji}</span>

      {/* Word text */}
      <span className="text-xs font-bold text-gray-700 text-center leading-tight line-clamp-2 max-w-[90px]">
        {plant.english}
      </span>

      {/* Stage indicator dots */}
      <div className="flex gap-0.5 mt-1">
        {[0, 1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={`w-1.5 h-1.5 rounded-full ${
              plant.stage >= s ? (plant.stage === 4 ? 'bg-purple-500' : plant.stage === 3 ? 'bg-pink-400' : 'bg-green-400') : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </button>
  );
};

/* ────────────────────  Empty garden state ──────────────────── */

const EmptyGarden: React.FC<{ onStartLearning: () => void }> = ({ onStartLearning }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <span className="text-8xl mb-4">🏡</span>
    <h2 className="text-xl font-bold text-gray-700 mb-2">花园还空着呢</h2>
    <p className="text-gray-500 mb-6 max-w-xs">
      开始学习单词吧，每学一个单词就会在你的花园里种下一颗种子！
    </p>
    <button
      onClick={onStartLearning}
      className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 shadow-lg transition-all active:scale-95"
    >
      🌱 去学习新词
    </button>
  </div>
);

/* ════════════════════════  Main Garden Page ════════════════════════ */

const Garden: React.FC = () => {
  const navigate = useNavigate();
  const [garden, setGarden] = useState<GardenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState<GardenPlant | null>(null);
  const [filterStage, setFilterStage] = useState<number | null>(null);
  const [filterPack, setFilterPack] = useState<number | null>(null);

  const loadGarden = async () => {
    try {
      setLoading(true);
      const params: { stage?: number; pack_id?: number } = {};
      if (filterStage !== null) params.stage = filterStage;
      if (filterPack !== null) params.pack_id = filterPack;
      const res = await gardenApi.getGarden(params);
      setGarden(res.data);
    } catch (err) {
      console.error('Garden: failed to load garden data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGarden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStage, filterPack]);

  const summary = garden?.summary;
  const plants = garden?.plants ?? [];
  const packs = garden?.packs ?? [];

  const handleReview = (wordId: number) => {
    setSelectedPlant(null);
    navigate(`/review?focus=${wordId}`);
  };

  const handleLearn = () => {
    navigate('/packs');
  };

  /* ---------- compute stage distribution for legend (MUST be before early returns — hooks rules) ---------- */
  const stageDist = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    plants.forEach((p) => { counts[p.stage] = (counts[p.stage] ?? 0) + 1; });
    return counts;
  }, [plants]);

  /* ---- loading spinner ---- */
  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="animate-spin text-5xl mb-3">🌱</div>
          <p className="text-gray-500">花园正在生长中...</p>
        </div>
      </div>
    );
  }

  /* ---- empty state ---- */
  if (!garden || summary?.total_plants === 0) {
    return (
      <div className="page-container max-w-5xl mx-auto">
        <EmptyGarden onStartLearning={handleLearn} />
      </div>
    );
  }

  return (
    <div className="page-container max-w-5xl mx-auto pb-10">
      {/* ── Header ── */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">🌻 单词花园</h1>
        <p className="text-gray-500 text-sm mt-1">你学过的每一个单词都在这里开花结果</p>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon="🌱" label="已种植" value={summary!.total_plants} sub="累计学习单词" />
        <StatCard icon="🌸" label="已开花" value={summary!.flowering_count} sub="已掌握" />
        <StatCard icon="🌳" label="已成林" value={summary!.bloomed_count} sub="完全掌握" />
        <StatCard icon="📈" label="掌握率" value={`${summary!.mastery_rate}%`} sub="开花+成林占比" />
      </div>

      {/* ── Stage legend ── */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {STAGE_ORDER.map((s) => {
          const m = STAGE_META[s];
          const count = stageDist[s] ?? 0;
          const isActive = filterStage === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStage(isActive ? null : s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isActive
                  ? `${m.bg} ${m.border} ${m.text} ring-2 ring-offset-1 ring-${m.text.replace('text-', '')}`
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {m.emoji} {m.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
        {filterStage !== null && (
          <button
            onClick={() => setFilterStage(null)}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200 transition-all"
          >
            ✕ 清除筛选
          </button>
        )}
      </div>

      {/* ── Pack filter ── */}
      {packs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          <select
            value={filterPack ?? ''}
            onChange={(e) => setFilterPack(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">📚 全部词包</option>
            {packs.map((p) => (
              <option key={p.pack_id} value={p.pack_id}>
                {p.pack_name} ({p.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Garden scene ── */}
      <div className="relative rounded-2xl overflow-hidden border border-green-200 shadow-lg bg-gradient-to-b from-sky-200 via-sky-100 to-green-200">
        {/* Sky zone */}
        <div className="relative h-20 bg-gradient-to-b from-sky-300 to-sky-100 overflow-hidden">
          <span className="absolute top-2 right-[15%] text-2xl opacity-80">☁️</span>
          <span className="absolute top-5 right-[35%] text-xl opacity-60">☁️</span>
          <span className="absolute top-1 left-[20%] text-3xl opacity-70">⛅</span>
          <span className="absolute -bottom-1 left-0 right-0 h-4 bg-gradient-to-b from-transparent to-green-200" />
        </div>

        {/* Ground zone */}
        <div
          className="relative bg-gradient-to-b from-green-200 via-green-300 to-green-400 px-4 pt-4 pb-6"
          style={{ minHeight: 360 }}
        >
          {/* Garden plot grid */}
          {plants.length > 0 ? (
            <div className="flex flex-wrap gap-3 justify-center">
              {plants.map((plant) => (
                <PlantCard
                  key={plant.word_id}
                  plant={plant}
                  onClick={() => setSelectedPlant(plant)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-green-800">
              <span className="text-5xl mb-3">🔍</span>
              <p className="font-bold text-lg">没有匹配的植物</p>
              <button
                onClick={() => { setFilterStage(null); setFilterPack(null); }}
                className="mt-3 px-5 py-2 bg-white/80 rounded-xl text-sm font-bold hover:bg-white transition-all"
              >
                清除筛选
              </button>
            </div>
          )}

          {/* Decorative grass tufts */}
          <div className="absolute bottom-2 left-4 text-xl opacity-30 select-none pointer-events-none">🌿</div>
          <div className="absolute bottom-2 right-8 text-xl opacity-30 select-none pointer-events-none">🌾</div>
          <div className="absolute bottom-6 left-1/3 text-lg opacity-20 select-none pointer-events-none">🌷</div>
        </div>
      </div>

      {/* ── Bottom tip ── */}
      <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
        <p className="font-bold">💡 花园小贴士</p>
        <ul className="mt-1 space-y-0.5 text-xs">
          <li>• 🌰 <strong>种子</strong>：新学的单词，刚刚播下</li>
          <li>• 🌱 <strong>嫩芽</strong>：复习过一次，开始生长</li>
          <li>• 🌿 <strong>生长中</strong>：多次复习，茁壮成长</li>
          <li>• 🌸 <strong>已开花</strong>：已掌握，美丽绽放</li>
          <li>• 🌳 <strong>已成林</strong>：完全掌握，根深叶茂</li>
        </ul>
      </div>

      {/* ── Plant detail modal ── */}
      {selectedPlant && (
        <PlantModal
          plant={selectedPlant}
          onClose={() => setSelectedPlant(null)}
          onReview={handleReview}
        />
      )}
    </div>
  );
};

export default Garden;
