/** A tiny typed emitter. The sim returns events from `step`; main wires them to listeners here. */
export class Emitter<T> {
  private listeners = new Set<(event: T) => void>();

  on(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: T): void {
    for (const l of [...this.listeners]) l(event);
  }
}
