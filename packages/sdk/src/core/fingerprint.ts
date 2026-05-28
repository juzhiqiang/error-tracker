import type { StackFrame } from '../types'

export function parseStackFrames(stack: string): StackFrame[] {
  const lines = stack.split('\n').slice(1)
  return lines
    .slice(0, 10)
    .map((line) => {
      const match = line.trim().match(/^at (?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
      if (!match) return { function: '<unknown>', filename: '<unknown>' }
      return {
        function: match[1] ?? '<anonymous>',
        filename: match[2],
        lineno: parseInt(match[3], 10),
        colno: parseInt(match[4], 10),
      }
    })
    .filter((f) => f.filename !== '<unknown>')
}

function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function clientFingerprint(error: Error): string {
  const frames = parseStackFrames(error.stack ?? '')
  const frameKey = frames
    .slice(0, 3)
    .map((f) => {
      const basename = f.filename.split(/[/\\]/).pop() ?? f.filename
      // 去掉文件名中的 hash 段（main.abc123.js -> main.js），不同构建版本指纹一致
      const normalized = basename.replace(/\.[a-zA-Z0-9]+(?=\.[a-zA-Z]+$)/, '')
      return `${f.function}@${normalized}`
    })
    .join('|')
  return djb2(`${error.name}:${error.message}:${frameKey}`)
}
