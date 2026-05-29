import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

@Injectable()
export class MinioService {
  private readonly s3: S3Client
  private readonly bucket: string

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'error-tracker'
    this.s3 = new S3Client({
      endpoint: `http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9011'}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    })
  }

  async upload(key: string, body: Buffer | string, contentType = 'application/octet-stream'): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return key
  }

  async getObject(key: string): Promise<string> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    return res.Body!.transformToString()
  }
}
