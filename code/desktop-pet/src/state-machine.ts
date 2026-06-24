export enum CrabState {
  Idle = 'idle',
  Working = 'working',
  Complete = 'complete',
  Error = 'error',
  Sleep = 'sleep',
}

export enum CrabEvent {
  SignalWorking = 'signal_working',
  SignalComplete = 'signal_complete',
  SignalError = 'signal_error',
  SignalLost = 'signal_lost',
  IdleTimeout = 'idle_timeout',
  CompleteTimeout = 'complete_timeout',
  UserClickError = 'user_click_error',
}

type Transition = {
  from: CrabState;
  event: CrabEvent;
  to: CrabState;
};

const TRANSITIONS: Transition[] = [
  { from: CrabState.Idle, event: CrabEvent.SignalWorking, to: CrabState.Working },
  { from: CrabState.Idle, event: CrabEvent.SignalError, to: CrabState.Error },
  { from: CrabState.Idle, event: CrabEvent.IdleTimeout, to: CrabState.Sleep },

  { from: CrabState.Sleep, event: CrabEvent.SignalWorking, to: CrabState.Working },
  { from: CrabState.Sleep, event: CrabEvent.SignalComplete, to: CrabState.Idle },
  { from: CrabState.Sleep, event: CrabEvent.SignalError, to: CrabState.Error },

  { from: CrabState.Working, event: CrabEvent.SignalComplete, to: CrabState.Complete },
  { from: CrabState.Working, event: CrabEvent.SignalError, to: CrabState.Error },
  { from: CrabState.Working, event: CrabEvent.SignalLost, to: CrabState.Idle },

  { from: CrabState.Complete, event: CrabEvent.CompleteTimeout, to: CrabState.Idle },
  { from: CrabState.Complete, event: CrabEvent.SignalWorking, to: CrabState.Working },

  { from: CrabState.Error, event: CrabEvent.SignalWorking, to: CrabState.Working },
  { from: CrabState.Error, event: CrabEvent.UserClickError, to: CrabState.Idle },
];

export class StateMachine {
  private state: CrabState;
  private idleSince: number = Date.now();
  private completeSince: number = 0;
  private listeners: Array<(state: CrabState, prev: CrabState) => void> = [];

  // Timing constants (ms)
  static IDLE_TIMEOUT = 5 * 60 * 1000;
  static COMPLETE_TIMEOUT = 3 * 60 * 1000;

  constructor(initial: CrabState = CrabState.Idle) {
    this.state = initial;
  }

  getState(): CrabState {
    return this.state;
  }

  send(event: CrabEvent): boolean {
    const match = TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!match) return false;

    const prev = this.state;
    this.state = match.to;

    if (this.state === CrabState.Idle) {
      this.idleSince = Date.now();
    }
    if (this.state === CrabState.Complete) {
      this.completeSince = Date.now();
    }

    this.listeners.forEach(fn => fn(this.state, prev));
    return true;
  }

  tick(): void {
    if (this.state === CrabState.Idle) {
      if (Date.now() - this.idleSince >= StateMachine.IDLE_TIMEOUT) {
        this.send(CrabEvent.IdleTimeout);
      }
    }
    if (this.state === CrabState.Complete) {
      if (Date.now() - this.completeSince >= StateMachine.COMPLETE_TIMEOUT) {
        this.send(CrabEvent.CompleteTimeout);
      }
    }
  }

  onChange(fn: (state: CrabState, prev: CrabState) => void): void {
    this.listeners.push(fn);
  }
}
