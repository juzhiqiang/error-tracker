import type { Breadcrumb } from '../types'

export class BreadcrumbManager {
  private buffer: Breadcrumb[]
  private head = 0
  private size = 0

  constructor(private readonly maxSize = 100) {
    this.buffer = new Array(maxSize)
  }

  add(crumb: Breadcrumb): void {
    this.buffer[this.head] = crumb
    this.head = (this.head + 1) % this.maxSize
    if (this.size < this.maxSize) this.size++
  }

  getAll(): Breadcrumb[] {
    if (this.size < this.maxSize) {
      return this.buffer.slice(0, this.size)
    }
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)]
  }

  clear(): void {
    this.head = 0
    this.size = 0
  }
}
