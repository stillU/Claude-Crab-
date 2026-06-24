import { StateMachine, CrabState, CrabEvent } from './state-machine';
import { AnimationPlayer, AnimationClip } from './animation';
import { BehaviorScheduler } from './behavior';
import { CanvasRenderer } from './canvas-renderer';
import { InteractionHandler } from './interaction';
import { PetWindow } from './pet-window';
import { invoke } from '@tauri-apps/api/core';

const CLIPS: AnimationClip[] = [
  { name: 'walk', src: '/assets/idle/walk.png', frameCount: 8, fps: 8, loop: true },
  { name: 'idle', src: '/assets/idle/idle.png', frameCount: 2, fps: 2, loop: true },
  { name: 'poke', src: '/assets/idle/poke.png', frameCount: 2, fps: 10, loop: false },
  { name: 'coding', src: '/assets/working/coding.png', frameCount: 6, fps: 12, loop: true },
  { name: 'sweat', src: '/assets/working/sweat.png', frameCount: 3, fps: 6, loop: false },
  { name: 'phone', src: '/assets/complete/phone.png', frameCount: 4, fps: 6, loop: true },
  { name: 'panic', src: '/assets/error/panic.png', frameCount: 2, fps: 4, loop: true },
  { name: 'sleep', src: '/assets/sleep/sleep.png', frameCount: 4, fps: 4, loop: true },
];

async function main() {
  const canvas = document.getElementById('crab-canvas') as HTMLCanvasElement;
  canvas.width = 128;
  canvas.height = 128;

  const animPlayer = new AnimationPlayer();
  const sm = new StateMachine(CrabState.Idle);
  const behavior = new BehaviorScheduler();
  const renderer = new CanvasRenderer(canvas, animPlayer);
  const petWindow = new PetWindow();
  const interaction = new InteractionHandler(canvas, sm);

  // Register clips
  for (const clip of CLIPS) {
    animPlayer.registerClip(clip);
  }

  // Preload all clips so they're ready before rendering
  for (const clip of CLIPS) {
    try {
      await animPlayer.preload(clip.name);
    } catch (e) {
      console.warn(`Failed to preload ${clip.name}:`, e);
    }
  }

  // Init window position
  await petWindow.init();

  // State change handler
  let lastStatus: string = '';
  sm.onChange((curr, _prev) => {
    behavior.setState(curr);

    if (curr === CrabState.Complete) {
      renderer.showBubble('任务完成！');
    }
    if (curr === CrabState.Error) {
      renderer.showCloud('ERROR');
    } else {
      renderer.hideCloud();
    }
  });

  // Interaction callbacks
  interaction.onDrag((x, y) => {
    petWindow.moveTo(x, y);
  });

  interaction.onPoke(() => {
    behavior.applyOverride({
      id: 'poke_override',
      type: 'override',
      animClip: 'poke',
      priority: 3,
      interruptible: true,
    });
  });

  interaction.onErrorClick(() => {
    renderer.hideCloud();
  });

  // Status polling from Rust bridge
  setInterval(async () => {
    try {
      const result = await invoke<string>('get_status');
      const status = JSON.parse(result) as { status: string };
      if (status.status !== lastStatus) {
        lastStatus = status.status;
        switch (status.status) {
          case 'Working': sm.send(CrabEvent.SignalWorking); break;
          case 'Complete': sm.send(CrabEvent.SignalComplete); break;
          case 'Error': sm.send(CrabEvent.SignalError); break;
          case 'Idle':
            if (sm.getState() === CrabState.Working) {
              sm.send(CrabEvent.SignalLost);
            }
            break;
        }
      }
    } catch (e) {
      console.error('Status poll error:', e);
    }
  }, 500);

  // Main render loop
  let lastTime = performance.now();
  function loop() {
    const now = performance.now();
    const delta = Math.min(now - lastTime, 100);
    lastTime = now;

    sm.tick();

    const clip = behavior.tick(delta);
    if (clip && clip !== animPlayer.getCurrentClipName()) {
      animPlayer.play(clip);
    }

    // IDLE walking
    const action = behavior.getCurrentAction();
    if (action?.id === 'walk_right') {
      petWindow.walk(1, 60, delta);
      renderer.setFacing(true);
    } else if (action?.id === 'walk_left') {
      petWindow.walk(-1, 60, delta);
      renderer.setFacing(false);
    }

    renderer.update(delta);
    renderer.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);
