import 'reflect-metadata'
import { loadAndValidateApiEnv } from './config/env'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './modules/auth/auth'

async function bootstrap() {
  loadAndValidateApiEnv()
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.CORS_ORIGIN, credentials: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.use('/api/auth/*splat', toNodeHandler(auth))
  await app.listen(3002)
  console.log('error-tracker API running on http://localhost:3002')
}
bootstrap()
