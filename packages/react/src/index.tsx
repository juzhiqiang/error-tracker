import React from 'react'

export interface ErrorTrackerReactClient {
  captureException(error: Error, extra?: Record<string, unknown>): unknown
}

export interface ErrorBoundaryProps {
  client: ErrorTrackerReactClient
  fallback?: React.ReactNode
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.client.captureException(error, {
      componentStack: info.componentStack ?? undefined,
    })
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? React.createElement('div', null, 'Something went wrong.')
    }
    return this.props.children
  }
}
