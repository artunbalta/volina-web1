'use client';

import { Suspense, lazy, useState, useEffect, Component, ReactNode } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface InteractiveRobotSplineProps {
  scene: string;
  className?: string;
  onClick?: () => void;
}

// Error Boundary for WebGL errors
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('WebGL Error caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Check if WebGL is available
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

// Fallback component when WebGL is not available
function RobotFallback({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <div 
      className={`w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 to-black ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="text-center p-8">
        <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Volina AI</h3>
        <p className="text-white/60 text-sm mb-4">AI-Powered Voice Assistant</p>
        {onClick && (
          <button 
            onClick={onClick}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
          >
            Try Volina
          </button>
        )}
      </div>
    </div>
  );
}

export function InteractiveRobotSpline({ scene, className, onClick }: InteractiveRobotSplineProps) {
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
  }, []);

  // Show loading while checking WebGL support
  if (webGLSupported === null) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-transparent ${className}`}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path>
          </svg>
          <span className="text-blue-500 font-medium animate-pulse">Loading...</span>
        </div>
      </div>
    );
  }

  // Show fallback if WebGL is not supported
  if (!webGLSupported) {
    return <RobotFallback onClick={onClick} className={className} />;
  }

  return (
    <WebGLErrorBoundary fallback={<RobotFallback onClick={onClick} className={className} />}>
      <Suspense
        fallback={
          <div className={`w-full h-full flex items-center justify-center bg-transparent ${className}`}>
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path>
              </svg>
              <span className="text-blue-500 font-medium animate-pulse">Loading 3D Agent...</span>
            </div>
          </div>
        }
      >
        <div onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
          <Spline
            scene={scene}
            className={className} 
          />
        </div>
      </Suspense>
    </WebGLErrorBoundary>
  );
}

