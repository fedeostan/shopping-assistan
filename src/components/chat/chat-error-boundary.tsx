"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Chat Error Boundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 dark:bg-destructive/5">
            <h2 className="text-lg font-semibold text-destructive dark:text-red-200">
              Something went wrong with the chat
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Reset conversation
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
