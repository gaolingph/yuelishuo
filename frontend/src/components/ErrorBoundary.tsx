import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error('ErrorBoundary caught:', error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="page-container max-w-2xl mx-auto py-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-lg">
            <div className="text-center mb-4">
              <span className="text-5xl">🚨</span>
              <h2 className="text-xl font-bold text-red-700 mt-2">页面渲染出错</h2>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-100 mb-4">
              <p className="text-sm font-mono text-red-600 break-all mb-2">
                <strong>错误信息：</strong>{this.state.error?.message}
              </p>
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">查看详细堆栈</summary>
                <pre className="mt-2 whitespace-pre-wrap max-h-60 overflow-auto">
                  {this.state.error?.stack}
                  {'\n\nComponent Stack:'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
              >
                🔄 刷新页面
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null, errorInfo: null }); }}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                重试
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
