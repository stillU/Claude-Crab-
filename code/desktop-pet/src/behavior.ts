import { CrabState } from './state-machine';

export type BehaviorType = 'primary' | 'random' | 'override';

export interface BehaviorAction {
  id: string;
  type: BehaviorType;
  animClip: string;
  priority: number;
  interruptible: boolean;
}

interface IdleAction extends BehaviorAction {
  weight: number;
  minDuration: number;
  maxDuration: number;
}

const IDLE_ACTIONS: IdleAction[] = [
  { id: 'walk_right', type: 'random', animClip: 'walk', priority: 2, interruptible: false, weight: 30, minDuration: 2000, maxDuration: 5000 },
  { id: 'walk_left', type: 'random', animClip: 'walk', priority: 2, interruptible: false, weight: 30, minDuration: 2000, maxDuration: 5000 },
  { id: 'idle_stand', type: 'primary', animClip: 'idle', priority: 1, interruptible: true, weight: 25, minDuration: 3000, maxDuration: 8000 },
  { id: 'idle_jump', type: 'random', animClip: 'poke', priority: 2, interruptible: false, weight: 10, minDuration: 1000, maxDuration: 1000 },
  { id: 'idle_turn', type: 'random', animClip: 'idle', priority: 2, interruptible: false, weight: 5, minDuration: 500, maxDuration: 500 },
];

const STATE_PRIMARY: Record<CrabState, string> = {
  [CrabState.Idle]: 'idle',
  [CrabState.Working]: 'coding',
  [CrabState.Complete]: 'phone',
  [CrabState.Error]: 'panic',
  [CrabState.Sleep]: 'sleep',
};

export class BehaviorScheduler {
  private state: CrabState = CrabState.Idle;
  private queue: BehaviorAction[] = [];
  private currentAction: BehaviorAction | null = null;
  private actionStart: number = 0;
  private actionDuration: number = 0;
  private randomTimer: number = 0;
  private lastIdleAction: string | null = null;
  private sleepApproaching: boolean = false;

  constructor() {
    this.enqueuePrimary(this.state);
  }

  setState(state: CrabState): void {
    if (state === this.state) return;
    this.state = state;
    this.queue = [];
    this.currentAction = null;
    this.randomTimer = 0;
    this.enqueuePrimary(state);
  }

  private enqueuePrimary(state: CrabState): void {
    const anim = STATE_PRIMARY[state];
    this.queue.push({
      id: `primary_${state}`,
      type: 'primary',
      animClip: anim,
      priority: 1,
      interruptible: true,
    });
  }

  tick(deltaMs: number): string | null {
    if (this.state === CrabState.Idle || this.state === CrabState.Working) {
      this.randomTimer += deltaMs;
      const interval = this.state === CrabState.Working
        ? 8000 + Math.random() * 7000
        : 10000 + Math.random() * 10000;

      if (this.randomTimer >= interval) {
        this.randomTimer = 0;
        this.enqueueRandom();
      }
    }

    if (this.currentAction === null || this.currentAction.interruptible) {
      const override = this.queue.find(a => a.priority === 3);
      if (override) {
        this.currentAction = override;
        this.queue = this.queue.filter(a => a !== override);
      } else if (this.currentAction === null && this.queue.length > 0) {
        this.currentAction = this.queue.shift()!;
      }
      if (this.currentAction) {
        this.actionStart = performance.now();
      }
    }

    if (this.currentAction) {
      return this.currentAction.animClip;
    }
    return null;
  }

  private enqueueRandom(): void {
    if (this.state === CrabState.Working) {
      this.queue.push({
        id: 'sweat',
        type: 'random',
        animClip: 'sweat',
        priority: 2,
        interruptible: false,
      });
      return;
    }

    let pool = [...IDLE_ACTIONS];
    if (this.sleepApproaching) {
      pool = pool.map(a => ({ ...a, weight: a.id.includes('walk') ? a.weight * 0.5 : a.weight }));
    }

    const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const action of pool) {
      roll -= action.weight;
      if (roll <= 0) {
        if (action.id === this.lastIdleAction && pool.length > 1) continue;
        this.lastIdleAction = action.id;
        this.queue.push({ ...action });
        return;
      }
    }
  }

  applyOverride(action: BehaviorAction): void {
    this.queue.unshift(action);
  }

  setSleepApproaching(approaching: boolean): void {
    this.sleepApproaching = approaching;
  }

  getCurrentAction(): BehaviorAction | null {
    return this.currentAction;
  }
}
