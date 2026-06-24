export interface AnimationClip {
  name: string;
  src: string;
  frameCount: number;
  fps: number;
  loop: boolean;
}

export class AnimationPlayer {
  private clips: Map<string, AnimationClip> = new Map();
  private images: Map<string, HTMLImageElement> = new Map();
  private currentClip: string | null = null;
  private currentFrame: number = 0;
  private elapsed: number = 0;
  private frameDuration: number = 0;
  private playing: boolean = false;
  private onFinishCallback: (() => void) | null = null;

  private static readonly FRAME_SIZE = 64;

  registerClip(clip: AnimationClip): void {
    this.clips.set(clip.name, clip);
  }

  async preload(clipName: string): Promise<void> {
    const clip = this.clips.get(clipName);
    if (!clip) throw new Error(`Clip not registered: ${clipName}`);

    if (!this.images.has(clipName)) {
      const img = new Image();
      img.src = clip.src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load: ${clip.src}`));
      });
      this.images.set(clipName, img);
    }
  }

  play(clipName: string, onFinish?: () => void): void {
    const clip = this.clips.get(clipName);
    if (!clip) throw new Error(`Clip not registered: ${clipName}`);

    if (clipName !== this.currentClip) {
      this.currentFrame = 0;
      this.elapsed = 0;
    }
    this.currentClip = clipName;
    this.frameDuration = 1000 / clip.fps;
    this.playing = true;
    this.onFinishCallback = onFinish || null;
  }

  stop(): void {
    this.playing = false;
    this.currentFrame = 0;
  }

  pause(): void {
    this.playing = false;
  }

  resume(): void {
    this.playing = true;
  }

  update(deltaMs: number): void {
    if (!this.playing || !this.currentClip) return;
    const clip = this.clips.get(this.currentClip);
    if (!clip) return;

    this.elapsed += deltaMs;
    if (this.elapsed >= this.frameDuration) {
      this.elapsed = 0;
      if (this.currentFrame + 1 >= clip.frameCount) {
        if (clip.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = clip.frameCount - 1;
          this.playing = false;
          if (this.onFinishCallback) {
            const cb = this.onFinishCallback;
            this.onFinishCallback = null;
            cb();
          }
        }
      } else {
        this.currentFrame++;
      }
    }
  }

  getCurrentFrame(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 2): void {
    if (!this.currentClip) return;
    const img = this.images.get(this.currentClip);
    if (!img) return;

    const size = AnimationPlayer.FRAME_SIZE;
    const sx = this.currentFrame * size;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, 0, size, size, x, y, size * scale, size * scale);
  }

  getCurrentFrameData(): { clipName: string; frame: number } | null {
    if (!this.currentClip) return null;
    return { clipName: this.currentClip, frame: this.currentFrame };
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getCurrentClipName(): string | null {
    return this.currentClip;
  }
}
