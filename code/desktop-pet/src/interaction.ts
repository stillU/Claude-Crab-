import { CrabState, StateMachine, CrabEvent } from './state-machine';

export class InteractionHandler {
  private canvas: HTMLCanvasElement;
  private sm: StateMachine;
  private dragging: boolean = false;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private onDragCallback: ((x: number, y: number) => void) | null = null;
  private onPokeCallback: (() => void) | null = null;
  private onErrorClickCallback: (() => void) | null = null;

  private lastClickTime: number = 0;
  private static DOUBLE_CLICK_MS = 400;

  constructor(canvas: HTMLCanvasElement, sm: StateMachine) {
    this.canvas = canvas;
    this.sm = sm;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
  }

  private onMouseDown(e: MouseEvent): void {
    const state = this.sm.getState();

    if (state === CrabState.Error) {
      this.sm.send(CrabEvent.UserClickError);
      this.onErrorClickCallback?.();
      return;
    }

    const now = performance.now();
    if (state === CrabState.Idle && now - this.lastClickTime < InteractionHandler.DOUBLE_CLICK_MS) {
      this.onPokeCallback?.();
    }
    this.lastClickTime = now;

    this.dragging = true;
    const rect = this.canvas.getBoundingClientRect();
    this.dragOffsetX = e.clientX - rect.left;
    this.dragOffsetY = e.clientY - rect.top;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.dragging) return;
    this.onDragCallback?.(e.clientX - this.dragOffsetX, e.clientY - this.dragOffsetY);
  }

  private onMouseUp(): void {
    this.dragging = false;
  }

  onDrag(fn: (x: number, y: number) => void): void { this.onDragCallback = fn; }
  onPoke(fn: () => void): void { this.onPokeCallback = fn; }
  onErrorClick(fn: () => void): void { this.onErrorClickCallback = fn; }

  isDragging(): boolean { return this.dragging; }
}
