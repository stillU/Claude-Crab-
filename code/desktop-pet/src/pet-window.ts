import { invoke } from '@tauri-apps/api/core';
import { CrabState } from './state-machine';

export class PetWindow {
  private x: number = 0;
  private y: number = 0;
  private screenW: number = 1920;
  private screenH: number = 1080;
  private boundaryPadding: number = 64;
  private edgeThreshold: number = 80;

  constructor() {
    this.screenW = window.screen.width;
    this.screenH = window.screen.height;
  }

  async init(): Promise<void> {
    this.x = this.screenW - 200;
    this.y = this.screenH - 200;
    await this.setWindowPosition(this.x, this.y);
  }

  private async setWindowPosition(x: number, y: number): Promise<void> {
    try {
      await invoke('set_window_position', { x: Math.round(x), y: Math.round(y) });
    } catch {
      // Command not yet registered (will be added in Task 8)
    }
    this.x = x;
    this.y = y;
  }

  async moveTo(x: number, y: number): Promise<void> {
    this.x = x;
    this.y = y;
    await this.setWindowPosition(x, y);
  }

  walk(direction: number, speed: number, deltaMs: number): void {
    const dx = direction * speed * (deltaMs / 1000);
    let newX = this.x + dx;

    if (newX < 0) {
      newX = 0;
    } else if (newX > this.screenW - this.boundaryPadding) {
      newX = this.screenW - this.boundaryPadding;
    }

    this.x = newX;
  }

  nearEdge(): 'left' | 'right' | null {
    if (this.x < this.edgeThreshold) return 'left';
    if (this.x > this.screenW - this.boundaryPadding - this.edgeThreshold) return 'right';
    return null;
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  async setClickThrough(ignore: boolean): Promise<void> {
    try {
      await invoke('set_click_through', { ignore });
    } catch {
      // Command not yet registered (will be added in Task 8)
    }
  }
}
