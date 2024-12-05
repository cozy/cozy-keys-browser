interface Job {
  function: (...args: any[]) => Promise<void>;
  arguments: any[];
}

export class SynchronousJobQueue {
  private isRunning: boolean;
  private queue: Job[];
  private onDone: () => void;

  constructor({ onDone }: { onDone?: () => void } = {}) {
    this.isRunning = false;
    this.queue = [];
    this.onDone = onDone;
  }

  push(job: Job) {
    this.queue.push(job);
    if (!this.isRunning) {
      this.run();
    }
  }

  async run() {
    this.isRunning = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      await job.function(job.arguments);
    }
    this.isRunning = false;
    if (this.onDone) {
      this.onDone();
    }
  }
}
