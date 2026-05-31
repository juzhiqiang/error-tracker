import { afterEach, describe, expect, it, mock } from 'bun:test'

const sentCommands: string[] = []

mock.module('@aws-sdk/client-s3', () => {
  class HeadBucketCommand {}
  class CreateBucketCommand {}
  class PutObjectCommand {}
  class GetObjectCommand {}

  class S3Client {
    async send(command: object) {
      sentCommands.push(command.constructor.name)
      if (command instanceof HeadBucketCommand) throw new Error('NoSuchBucket')
      return {}
    }
  }

  return { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand }
})

describe('MinioService', () => {
  afterEach(() => {
    sentCommands.length = 0
  })

  it('creates the bucket on startup when it does not exist', async () => {
    const { MinioService } = await import('./minio.service')
    const service = new MinioService()

    await service.onModuleInit()

    expect(sentCommands).toEqual(['HeadBucketCommand', 'CreateBucketCommand'])
  })
})
