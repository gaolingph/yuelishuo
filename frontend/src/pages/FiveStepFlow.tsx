import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const STEPS = [
  { id: 1, title: '记忆扫描', desc: '5分钟快速测出你的单词掌握情况', icon: '🧠', route: (pid: number) => `/memory-scan/${pid}` },
  { id: 2, title: '生词记忆', desc: '四层递进学习，AI智能带读', icon: '📖', route: (pid: number) => `/progressive-learn/${pid}` },
  { id: 3, title: '闯关测试', desc: '多种题型闯关，巩固记忆效果', icon: '🏰', route: (pid: number) => `/practice?packId=${pid}` },
  { id: 4, title: '拼写练习', desc: '听音拼写，强化肌肉记忆', icon: '✍️', route: (pid: number) => `/practice?mode=spelling&packId=${pid}` },
  { id: 5, title: '智能复习', desc: '根据遗忘曲线自动安排复习', icon: '🔄', route: (_pid: number) => `/review` },
];

const FiveStepFlow: React.FC = () => {
  const { packId: packIdParam } = useParams<{ packId: string }>();
  const navigate = useNavigate();
  const packId = parseInt(packIdParam || '0');

  // Mark steps as "optional" based on whether previous steps exist
  // For now, all steps are clickable

  return (
    <div className="page-container max-w-3xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 text-sm mb-3 inline-flex items-center gap-1 hover:text-blue-600"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-gray-800">🚀 五步学习法</h1>
        <p className="text-gray-500 mt-1">
          遵循 5 个科学步骤，彻底掌握每一个单词
        </p>
      </div>

      {/* Step list */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block" />

        <div className="space-y-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="relative flex items-start gap-5">
              {/* Step number circle */}
              <div className="flex-shrink-0 z-10">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center text-2xl
                  shadow-md border-2 transition-all duration-300
                  ${step.id === 1
                    ? 'bg-blue-500 border-blue-500 text-white shadow-blue-200'
                    : 'bg-white border-gray-300 text-gray-500 hover:border-blue-400 hover:shadow-md'
                  }
                `}>
                  {step.icon}
                </div>
              </div>

              {/* Step content */}
              <div className={`
                flex-1 bg-white rounded-2xl border p-5 transition-all duration-200
                ${step.id === 1 ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-blue-200 hover:shadow-sm'}
              `}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      Step {step.id}
                      <span className="text-gray-600 ml-2 font-normal">{step.title}</span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                  {step.id === 1 && (
                    <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                      当前步骤
                    </span>
                  )}
                </div>

                <button
                  className={`
                    mt-3 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                    ${step.id === 1
                      ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }
                  `}
                  onClick={() => {
                    const target = step.route(packId);
                    if ((target.startsWith('/memory-scan') || target.startsWith('/progressive-learn')) && !packId) {
                      navigate('/packs');
                    } else {
                      navigate(target);
                    }
                  }}
                >
                  {step.id === 1 ? '开始扫描' : `进入${step.title}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Motivational footer */}
      <div className="mt-10 text-center text-gray-400 text-sm border-t pt-6">
        <p>五步学习法源自 智牛英语 科学背词体系</p>
        <p className="mt-1">坚持完成 5 步，单词掌握率提升 90%</p>
      </div>
    </div>
  );
};

export default FiveStepFlow;
