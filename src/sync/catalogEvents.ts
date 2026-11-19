const listeners = new Set<() => void>();

export function emitCatalogChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Isolate listener errors
    }
  }
}

export function subscribeCatalogChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
