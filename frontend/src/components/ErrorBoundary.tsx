'use client';

/**
 * ErrorBoundary — class component (React 요구 사항).
 * Canvas, 3D 렌더러 등 크래시 위험이 높은 섹션을 감싸서
 * 앱 전체 크래시를 방지.
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** 에러 발생 시 대체 UI. 없으면 기본 fallback 사용 */
  fallback?: React.ReactNode;
  /** 에러 영역 이름 (로그용) */
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-cream-200 gap-3 p-4">
          <span className="text-[10px] tracking-widest uppercase text-ink-300">
            {this.props.name ?? '컴포넌트'} 오류 발생
          </span>
          <p className="text-[10px] text-ink-400 font-mono max-w-xs text-center break-all">
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest border border-cream-300 text-ink-500 hover:border-ink-500 hover:text-ink-900 transition-colors"
          >
            복구 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
