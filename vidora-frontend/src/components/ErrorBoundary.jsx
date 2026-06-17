import React from "react";

/**
 * ErrorBoundary — catches render errors in child components and shows
 * a graceful fallback instead of crashing the whole app.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-900 text-gray-100 flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2 text-rose-400">Something went wrong</h1>
            <p className="text-neutral-400 text-sm mb-6">
              An unexpected error occurred. You can try reloading the page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-neutral-900 rounded p-3 mb-4 overflow-auto text-rose-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="bg-rose-600 hover:bg-rose-700 transition px-6 py-2 rounded-md font-medium"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
