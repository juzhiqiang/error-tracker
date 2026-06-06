import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { SelfMonitoringService } from './self-monitoring.service'

@Catch()
export class SelfMonitoringExceptionFilter implements ExceptionFilter {
  constructor(private readonly selfMonitoring: SelfMonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const statusCode = statusFromException(exception)
    const path = request.originalUrl ?? request.url
    const context = { method: request.method, path, statusCode }

    if (this.selfMonitoring.shouldCapture(exception, context)) {
      void this.selfMonitoring.captureException(exception, context)
    }

    if (response.headersSent) return
    response.status(statusCode).json(responseBody(exception, statusCode, path))
  }
}

function statusFromException(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus()
  const status = statusCodeFromPlainError(exception)
  if (status) return status
  return HttpStatus.INTERNAL_SERVER_ERROR
}

function responseBody(exception: unknown, statusCode: number, path: string): Record<string, unknown> {
  if (exception instanceof HttpException) {
    const body = exception.getResponse()
    if (typeof body === 'string') return { statusCode, message: body, path }
    if (isRecord(body)) return { ...body, path }
  }

  return {
    statusCode,
    message: statusCode >= 500 ? 'Internal server error' : messageFromPlainError(exception),
    path,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function statusCodeFromPlainError(exception: unknown): number | undefined {
  if (!isRecord(exception)) return undefined
  const status = exception.status ?? exception.statusCode
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined
  if (status < 400 || status > 599) return undefined
  return status
}

function messageFromPlainError(exception: unknown): string {
  if (isRecord(exception) && typeof exception.message === 'string' && exception.message) {
    return exception.message
  }
  return 'Request failed'
}
