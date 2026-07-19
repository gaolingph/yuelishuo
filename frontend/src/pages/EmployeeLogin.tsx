import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 员工一键直达自动登录页
 * 访问 /employee 即可自动登录测试账号，无需输入任何信息
 */
const EmployeeLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'logging' | 'done' | 'error'>('logging');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // 已经登录 → 直接跳首页
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;

    const doAutoLogin = async () => {
      try {
        await login('test_employee', 'test123456');
        if (!cancelled) {
          setStatus('done');
          // 短暂停留让用户看到"登录成功"反馈
          setTimeout(() => navigate('/', { replace: true }), 600);
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.response?.data?.detail || err?.message || '自动登录失败');
        }
      }
    };

    doAutoLogin();

    return () => { cancelled = true; };
  }, [isAuthenticated, login, navigate]);

  /* ── 登录中 ── */
  if (status === 'logging') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-10 max-w-sm mx-4">
          <div className="animate-spin text-6xl mb-5">🌱</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">正在自动登录</h2>
          <p className="text-sm text-gray-400">请稍候，即将进入系统...</p>
        </div>
      </div>
    );
  }

  /* ── 登录成功 ── */
  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-10 max-w-sm mx-4">
          <span className="text-6xl block mb-4">✅</span>
          <h2 className="text-xl font-bold text-green-600 mb-1">登录成功！</h2>
          <p className="text-sm text-gray-400">正在跳转...</p>
        </div>
      </div>
    );
  }

  /* ── 登录失败 ── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
      <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-10 max-w-sm mx-4">
        <span className="text-6xl block mb-4">⚠️</span>
        <h2 className="text-xl font-bold text-red-600 mb-2">自动登录失败</h2>
        <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
        <div className="flex flex-col gap-3">
          <a
            href="/login"
            className="btn-primary text-center"
          >
            前往手动登录
          </a>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            重新尝试
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
