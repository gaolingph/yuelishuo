import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { parentApi, ChildInfo } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const Children: React.FC = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    parentApi
      .children()
      .then((res) => setChildren(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container text-center py-16">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="text-gray-500 mt-2">加载中...</p>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-5">我的孩子</h1>

      {children.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">👶</div>
          <p className="text-gray-500 text-lg">暂未关联孩子</p>
          <p className="text-gray-400 text-sm mt-1">请联系管理员关联您的孩子账号</p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => (
            <div key={child.user_id} className="card !p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
                    {(child.nickname || child.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">
                      {child.nickname || child.username}
                    </h2>
                    <span className="text-xs text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">
                      {child.relationship}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-5 gap-1 mb-3">
                <div className="text-center">
                  <p className="text-sm font-bold text-primary-600">{child.total_learned}</p>
                  <p className="text-xs text-gray-400">已学</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-green-600">{child.total_mastered}</p>
                  <p className="text-xs text-gray-400">掌握</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-amber-600">{child.to_review}</p>
                  <p className="text-xs text-gray-400">待复习</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-accent-600">{child.today_learned}</p>
                  <p className="text-xs text-gray-400">今日</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-purple-600">{child.streak_days}</p>
                  <p className="text-xs text-gray-400">连续</p>
                </div>
              </div>

              {/* Action */}
              <Link
                to={`/parent/children/${child.user_id}`}
                className="btn btn-primary w-full text-center text-sm"
              >
                查看报告
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Children;
