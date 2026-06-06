import { describe, expect, it, mock } from 'bun:test'
import { BadRequestException } from '@nestjs/common'
import { SelfMonitoringExceptionFilter } from './self-monitoring.filter'

describe('SelfMonitoringExceptionFilter', () => {
  it('reports 5xx exceptions and returns a normalized response', () => {
    const captureException = mock(async () => undefined)
    const filter = new SelfMonitoringExceptionFilter({
      shouldCapture: () => true,
      captureException,
    } as never)
    const response = mockResponse()

    filter.catch(new Error('boom'), mockHost({ response, request: { method: 'POST', url: '/api/issues' } }) as never)

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][1]).toEqual({ method: 'POST', path: '/api/issues', statusCode: 500 })
    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/issues',
    })
  })

  it('does not report 4xx exceptions', () => {
    const captureException = mock(async () => undefined)
    const filter = new SelfMonitoringExceptionFilter({
      shouldCapture: () => false,
      captureException,
    } as never)
    const response = mockResponse()

    filter.catch(new BadRequestException('invalid input'), mockHost({ response, request: { method: 'GET', url: '/api/projects' } }) as never)

    expect(captureException).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'invalid input',
      error: 'Bad Request',
      path: '/api/projects',
    })
  })
})

function mockResponse() {
  const response = {
    headersSent: false,
    status: mock(function status() {
      return response
    }),
    json: mock(() => undefined),
  }
  return response
}

function mockHost({ request, response }: { request: unknown; response: unknown }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }
}
