import { afterEach, describe, expect, it, mock } from 'bun:test'

const sentCommands: string[] = []

mock.module('@aws-sdk/client-s3', () => {
  class HeadBucketCommand {}
  class CreateBucketCommand {}
  class PutObjectCommand {}
  class GetObjectCommand {}
  class DeleteObjectCommand {}

  class S3Client {
    async send(command: object) {
      sentCommands.push(command.constructor.name)
      if (command instanceof HeadBucketCommand) throw new Error('NoSuchBucket')
      return {}
    }
  }

  return { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand }
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

  it('deletes objects by key', async () => {
    const { MinioService } = await import('./minio.service')
    const service = new MinioService()

    await service.deleteObject('replays/project-1/event-1.json')

    expect(sentCommands).toEqual(['DeleteObjectCommand'])
  })
})
