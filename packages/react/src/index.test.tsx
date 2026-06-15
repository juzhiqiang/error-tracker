import { describe, expect, it, mock } from 'bun:test'
import React from 'react'
import { ErrorBoundary, type ErrorTrackerReactClient } from './index'

function makeClient() {
  const captureException = mock((_error: Error, _extra?: Record<string, unknown>) => undefined)
  const client: ErrorTrackerReactClient = { captureException }
  return { client, captureException }
}

describe('ErrorBoundary', () => {
  it('derives the error state from a thrown render error', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true })
  })

  it('reports caught errors to the tracker client with the component stack', () => {
    const { client, captureException } = makeClient()
    const boundary = new ErrorBoundary({ client, children: null })
    const error = new Error('render boom')

    boundary.componentDidCatch(error, { componentStack: '\n    at Broken' })

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(error, { componentStack: '\n    at Broken' })
  })

  it('renders its children while healthy', () => {
    const { client } = makeClient()
    const children = React.createElement('span', null, 'healthy')
    const boundary = new ErrorBoundary({ client, children })

    expect(boundary.render()).toBe(children)
  })

  it('renders the provided fallback after an error', () => {
    const { client } = makeClient()
    const fallback = React.createElement('span', null, 'custom fallback')
    const boundary = new ErrorBoundary({ client, fallback, children: null })
    boundary.state = { hasError: true }

    expect(boundary.render()).toBe(fallback)
  })

  it('renders a default message when no fallback is provided', () => {
    const { client } = makeClient()
    const boundary = new ErrorBoundary({ client, children: null })
    boundary.state = { hasError: true }

    const rendered = boundary.render() as React.ReactElement<{ children: React.ReactNode }>
    expect(rendered.props.children).toBe('Something went wrong.')
  })
})
