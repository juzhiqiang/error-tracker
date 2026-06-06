import 'reflect-metadata'
import { loadAndValidateApiEnv, parseCorsOrigins } from './config/env'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './modules/auth/auth'

function createCorsOriginOption(originEnv: string | undefined) {
  const origins = parseCorsOrigins(originEnv)
  if (origins.length <= 1) {
    return origins[0]
  }

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || origins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('CORS origin is not allowed'))
  }
}

async function bootstrap() {
  loadAndValidateApiEnv()
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: createCorsOriginOption(process.env.CORS_ORIGIN), credentials: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.use('/api/auth/*splat', toNodeHandler(auth))
  await app.listen(3002)
  console.log('error-tracker API running on http://localhost:3002')
}
bootstrap()
