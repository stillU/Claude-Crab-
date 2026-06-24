import { describe, it, expect } from 'vitest';
import { StateMachine, CrabState, CrabEvent } from '../state-machine';

describe('StateMachine', () => {
  it('starts in Idle', () => {
    const sm = new StateMachine();
    expect(sm.getState()).toBe(CrabState.Idle);
  });

  it('transitions Idle → Working on SignalWorking', () => {
    const sm = new StateMachine();
    expect(sm.send(CrabEvent.SignalWorking)).toBe(true);
    expect(sm.getState()).toBe(CrabState.Working);
  });

  it('transitions Working → Complete → Idle timeout', () => {
    const sm = new StateMachine();
    sm.send(CrabEvent.SignalWorking);
    sm.send(CrabEvent.SignalComplete);
    expect(sm.getState()).toBe(CrabState.Complete);
    (sm as any).completeSince = Date.now() - StateMachine.COMPLETE_TIMEOUT - 1;
    sm.tick();
    expect(sm.getState()).toBe(CrabState.Idle);
  });

  it('ignores invalid transition: Idle → Complete', () => {
    const sm = new StateMachine();
    expect(sm.send(CrabEvent.SignalComplete)).toBe(false);
    expect(sm.getState()).toBe(CrabState.Idle);
  });

  it('ignores duplicate signal', () => {
    const sm = new StateMachine();
    sm.send(CrabEvent.SignalWorking);
    expect(sm.send(CrabEvent.SignalWorking)).toBe(false);
  });

  it('Idle timeout → Sleep', () => {
    const sm = new StateMachine();
    (sm as any).idleSince = Date.now() - StateMachine.IDLE_TIMEOUT - 1;
    sm.tick();
    expect(sm.getState()).toBe(CrabState.Sleep);
  });

  it('Sleep wakes on SignalWorking', () => {
    const sm = new StateMachine(CrabState.Sleep);
    sm.send(CrabEvent.SignalWorking);
    expect(sm.getState()).toBe(CrabState.Working);
  });

  it('Error dismisses on UserClickError', () => {
    const sm = new StateMachine(CrabState.Error);
    sm.send(CrabEvent.UserClickError);
    expect(sm.getState()).toBe(CrabState.Idle);
  });

  it('fires onChange callback', () => {
    const sm = new StateMachine();
    const events: Array<[CrabState, CrabState]> = [];
    sm.onChange((curr, prev) => events.push([curr, prev]));
    sm.send(CrabEvent.SignalWorking);
    expect(events).toEqual([[CrabState.Working, CrabState.Idle]]);
  });
});
