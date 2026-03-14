class ZephyrEventStream {
  private listeners: ((evt: any) => void)[] = [];

  emit(evt: any) {
    for (const l of this.listeners) l(evt);
  }

  subscribe(listener: (evt: any) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const eventStream = new ZephyrEventStream();
