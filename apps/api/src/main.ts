import 'reflect-metadata'
import { loadAndValidateApiEnv } from './config/env'
import { createCorsDelegate } from './config/cors'
import { resolveBodyParserLimit } from './config/body-parser'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './modules/auth/auth'

async function bootstrap() {
  loadAndValidateApiEnv()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  const bodyLimit = resolveBodyParserLimit()
  app.useBodyParser('json', { limit: bodyLimit })
  app.useBodyParser('urlencoded', { extended: true, limit: bodyLimit })
  app.enableCors(createCorsDelegate(process.env.CORS_ORIGIN))
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.use('/api/auth/*splat', toNodeHandler(auth))
  await app.listen(3002)
  console.log('error-tracker API running on http://localhost:3002')
}
bootstrap()
