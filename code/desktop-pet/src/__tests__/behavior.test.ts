import { describe, it, expect, beforeEach } from 'vitest';
import { BehaviorScheduler } from '../behavior';
import { CrabState } from '../state-machine';

describe('BehaviorScheduler', () => {
  let bs: BehaviorScheduler;

  beforeEach(() => { bs = new BehaviorScheduler(); });

  it('returns primary idle animation on first tick', () => {
    const clip = bs.tick(16);
    expect(clip).toBe('idle');
  });

  it('returns coding animation when state is Working', () => {
    bs.setState(CrabState.Working);
    const clip = bs.tick(16);
    expect(clip).toBe('coding');
  });

  it('returns phone animation when state is Complete', () => {
    bs.setState(CrabState.Complete);
    const clip = bs.tick(16);
    expect(clip).toBe('phone');
  });

  it('returns sleep animation when state is Sleep', () => {
    bs.setState(CrabState.Sleep);
    const clip = bs.tick(16);
    expect(clip).toBe('sleep');
  });

  it('returns panic animation when state is Error', () => {
    bs.setState(CrabState.Error);
    const clip = bs.tick(16);
    expect(clip).toBe('panic');
  });

  it('applyOverride inserts high-priority action', () => {
    bs.setState(CrabState.Idle);
    bs.applyOverride({ id: 'poke_reaction', type: 'override', animClip: 'poke', priority: 3, interruptible: true });
    const clip = bs.tick(16);
    expect(clip).toBe('poke');
  });

  it('clears queue on state change', () => {
    bs.setState(CrabState.Idle);
    bs.tick(16);
    bs.setState(CrabState.Working);
    const clip = bs.tick(16);
    expect(clip).toBe('coding');
  });
});
