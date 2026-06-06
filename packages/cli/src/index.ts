#!/usr/bin/env node
import { parseUploadArgs, uploadSourcemaps } from './sourcemaps'

async function main() {
  try {
    const result = await uploadSourcemaps(parseUploadArgs(process.argv.slice(2)))
    console.log(`Uploaded ${result.uploaded} sourcemap file(s).`)
    for (const file of result.files ?? []) {
      console.log(`${file.status}: ${file.filename} ${file.checksum}`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

main()
