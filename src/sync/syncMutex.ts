class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();
  private depth = 0;

  isLocked(): boolean {
    return this.depth > 0;
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    this.depth += 1;
    let release!: () => void;
    const prev = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await prev;
    try {
      return await fn();
    } finally {
      this.depth = Math.max(0, this.depth - 1);
      release();
    }
  }
}

export const syncMutex = new AsyncMutex();
