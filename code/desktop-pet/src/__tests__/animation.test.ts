import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationPlayer, AnimationClip } from '../animation';

function makeClip(overrides?: Partial<AnimationClip>): AnimationClip {
  return {
    name: 'test',
    src: 'test.png',
    frameCount: 4,
    fps: 10,
    loop: true,
    ...overrides,
  };
}

describe('AnimationPlayer', () => {
  let player: AnimationPlayer;

  beforeEach(() => {
    player = new AnimationPlayer();
  });

  it('throws when playing unregistered clip', () => {
    expect(() => player.play('nonexistent')).toThrow('Clip not registered');
  });

  it('advances frames over time (loop)', () => {
    const clip = makeClip({ frameCount: 4, fps: 10, loop: true });
    player.registerClip(clip);
    player.play('test');
    expect(player.getCurrentFrameData()?.frame).toBe(0);

    player.update(100);
    expect(player.getCurrentFrameData()?.frame).toBe(1);

    player.update(100);
    expect(player.getCurrentFrameData()?.frame).toBe(2);

    player.update(100);
    expect(player.getCurrentFrameData()?.frame).toBe(3);

    player.update(100);
    expect(player.getCurrentFrameData()?.frame).toBe(0); // looped
  });

  it('stops at last frame for non-loop clip', () => {
    const clip = makeClip({ frameCount: 2, fps: 10, loop: false });
    const onFinish = vi.fn();
    player.registerClip(clip);
    player.play('test', onFinish);

    player.update(100);
    player.update(100);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(player.isPlaying()).toBe(false);
  });

  it('pause and resume work correctly', () => {
    const clip = makeClip({ frameCount: 4, fps: 10, loop: true });
    player.registerClip(clip);
    player.play('test');
    player.update(100);
    player.pause();
    expect(player.isPlaying()).toBe(false);
    const frame = player.getCurrentFrameData()?.frame;
    player.update(500);
    expect(player.getCurrentFrameData()?.frame).toBe(frame); // unchanged
    player.resume();
    expect(player.isPlaying()).toBe(true);
  });

  it('stop resets to frame 0', () => {
    const clip = makeClip({ frameCount: 4, fps: 10, loop: true });
    player.registerClip(clip);
    player.play('test');
    player.update(300);
    player.stop();
    expect(player.getCurrentFrameData()?.frame).toBe(0);
    expect(player.isPlaying()).toBe(false);
  });
});
