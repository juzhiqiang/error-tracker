export class Scope {
  private _user: Record<string, string> = {}
  private _tags: Record<string, string> = {}

  setUser(user: Record<string, string>): void {
    this._user = user
  }
  setTag(key: string, value: string): void {
    this._tags[key] = value
  }
  getUser() {
    return { ...this._user }
  }
  getTags() {
    return { ...this._tags }
  }
  clear(): void {
    this._user = {}
    this._tags = {}
  }
}
