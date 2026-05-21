class EventStream {
  private listeners = new Set<(evt: any) => void>();

  emit(evt: any) {
    for (const l of this.listeners) l(evt);
  }

  subscribe(listener: (evt: any) => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    this.listeners.clear();
  }
}

export const eventStream = new EventStream();
