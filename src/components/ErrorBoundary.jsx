import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

function AppErrorFallback({ error, onRetry }) {
  const errorMessage = import.meta.env.DEV
    ? error?.message || 'Unknown application error'
    : 'PropFlow could not load this screen. Refresh the page or return to the homepage.';

  return (
    <div className="auth-page router-state-page router-error-page">
      <div className="auth-card wide router-state-card">
        <div className="router-state-icon error">
          <AlertTriangle size={30} />
        </div>

        <p className="eyebrow">PropFlow</p>
        <h1>Something went wrong</h1>
        <p>
          A runtime error interrupted this part of PropFlow. Your workspace data remains protected;
          refresh the app or return to a safe public page.
        </p>

        <div className="helper error-helper">{errorMessage}</div>

        <div className="router-error-actions">
          <button type="button" className="primary" onClick={onRetry}>
            <RefreshCw size={16} />
            Retry
          </button>

          <button type="button" onClick={() => window.location.assign('/')}>
            <Home size={16} />
            Go to homepage
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[PropFlow] App render failed', error, info);
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return <AppErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
