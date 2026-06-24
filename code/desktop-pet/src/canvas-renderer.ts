import { AnimationPlayer } from './animation';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animPlayer: AnimationPlayer;
  private crabX: number = 0;
  private crabY: number = 0;
  private facingRight: boolean = true;
  private scale: number = 2;
  private cloudVisible: boolean = false;
  private cloudText: string = '';
  private bubbleText: string = '';
  private bubbleTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, player: AnimationPlayer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.animPlayer = player;
    this.crabX = canvas.width / 2 - 32 * this.scale;
    this.crabY = canvas.height / 2 - 32 * this.scale;
  }

  setPosition(x: number, y: number): void {
    this.crabX = x;
    this.crabY = y;
  }

  setFacing(right: boolean): void {
    this.facingRight = right;
  }

  showCloud(text: string): void {
    this.cloudVisible = true;
    this.cloudText = text;
  }

  hideCloud(): void {
    this.cloudVisible = false;
    this.cloudText = '';
  }

  showBubble(text: string): void {
    this.bubbleText = text;
    this.bubbleTimer = 3000;
  }

  update(deltaMs: number): void {
    this.animPlayer.update(deltaMs);
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= deltaMs;
      if (this.bubbleTimer <= 0) this.bubbleText = '';
    }
  }

  render(): void {
    const { ctx, canvas, animPlayer } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (!this.facingRight) {
      ctx.translate(this.crabX + 64 * this.scale, this.crabY);
      ctx.scale(-1, 1);
      animPlayer.getCurrentFrame(ctx, 0, 0, this.scale);
    } else {
      animPlayer.getCurrentFrame(ctx, this.crabX, this.crabY, this.scale);
    }
    ctx.restore();

    // Cloud above crab (ERROR state)
    if (this.cloudVisible) {
      const cx = this.crabX + 32 * this.scale;
      const cy = this.crabY - 30;
      ctx.fillStyle = '#ffffffee';
      ctx.strokeStyle = '#999';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#cc0000';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.cloudText, cx, cy + 4);
    }

    // Bubble (COMPLETE state)
    if (this.bubbleText) {
      const bx = this.crabX + 70 * this.scale;
      const by = this.crabY - 20;
      ctx.fillStyle = '#ffffffee';
      ctx.strokeStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      const width = ctx.measureText(this.bubbleText).width + 16;
      ctx.beginPath();
      ctx.roundRect(bx - width / 2, by - 12, width, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.fillText(this.bubbleText, bx, by + 4);
    }
  }
}
