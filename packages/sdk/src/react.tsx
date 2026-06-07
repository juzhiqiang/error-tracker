import React from 'react'
import type { ErrorTrackerClient } from './core/client'

interface Props {
  client: ErrorTrackerClient
  fallback?: React.ReactNode
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.client.captureException(error, {
      componentStack: info.componentStack ?? undefined,
    })
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? React.createElement('div', null, 'Something went wrong.')
    }
    return this.props.children
  }
}
