# Claude Crab Desktop Pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop pet — pixel-art Claude crab that reflects Claude Code work status via animations.

**Architecture:** Tauri v2 app split into 7 independent branches. Rust backend handles signal listening (file watcher), process detection, tray menu, and window control. TypeScript frontend handles state machine, animation engine, behavior scheduler, and Canvas rendering. Communication via Tauri `invoke` commands.

**Tech Stack:** Tauri v2, Rust (backend), TypeScript (frontend), Canvas API, `notify` crate (file watching), `sysinfo` crate (process detection)

**Work Constraints:**
- Each module = independent git branch off `main`
- Each task = one sub-agent dispatch
- 3 consecutive failures → stop, ask user
- Check context/environment before each action
- Reusable code → `code/reusable/`

---

## File Map

```
code/desktop-pet/                        # Tauri v2 project root
├── package.json
├── tsconfig.json
├── index.html
├── src/                                 # Frontend (TypeScript)
│   ├── main.ts                          # Entry: init window, start loop
│   ├── state-machine.ts                 # State enum + transition table
│   ├── animation.ts                     # Spritesheet loader + frame player
│   ├── behavior.ts                      # Action queue + random scheduler
│   ├── canvas-renderer.ts              # Canvas draw loop (requestAnimationFrame)
│   ├── interaction.ts                   # Mouse drag/double-click handlers
│   └── pet-window.ts                    # Window position, boundary, click-through
├── src-tauri/                           # Backend (Rust)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/
│       ├── main.rs                      # Tauri entry point
│       ├── lib.rs                       # Command registration
│       ├── signal_listener.rs           # File watcher (notify crate)
│       ├── process_detector.rs          # Process/CPU detection (sysinfo crate)
│       └── bridge.rs                    # Unified status → state machine event
```

---

### Task 1: Scaffold Tauri v2 Project

**Branch:** `project-scaffold` (from `main`)

**Files:**
- Create: `code/desktop-pet/` (full Tauri scaffold)
- Create: `code/desktop-pet/src-tauri/src/main.rs`
- Create: `code/desktop-pet/src-tauri/src/lib.rs`
- Create: `code/desktop-pet/src-tauri/tauri.conf.json`
- Create: `code/desktop-pet/src/main.ts`
- Create: `code/desktop-pet/index.html`
- Create: `code/desktop-pet/package.json`
- Create: `code/desktop-pet/src/assets/` (empty placeholder dirs)

- [ ] **Step 1: Create Tauri v2 project scaffold**

```bash
cd code && source "$HOME/.cargo/env" && npm create tauri-app@latest desktop-pet -- --template vanilla-ts --manager npm
```

- [ ] **Step 2: Verify scaffold builds**

```bash
cd code/desktop-pet && npm install && npm run tauri build 2>&1 | tail -20
```

- [ ] **Step 3: Create placeholder asset directories**

```bash
mkdir -p code/desktop-pet/src/assets/{idle,working,complete,error,sleep}
```

- [ ] **Step 4: Create placeholder spritesheets (1x1 transparent PNGs as placeholders)**

For each required spritesheet, create a minimal placeholder PNG (1x1 pixel transparent) so the animation loader has files to reference. Actual pixel art will replace these later.

- [ ] **Step 5: Configure tauri.conf.json window settings**

Set in `code/desktop-pet/src-tauri/tauri.conf.json`:
```json
{
  "app": {
    "windows": [
      {
        "title": "Claude Crab",
        "width": 128,
        "height": 128,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "x": 0,
        "y": 0
      }
    ]
  }
}
```

- [ ] **Step 6: Verify window appears transparent and borderless**

```bash
cd code/desktop-pet && cargo tauri dev
```
Expected: Transparent window opens (close with Ctrl+C).

- [ ] **Step 7: Commit scaffold**

```bash
git checkout -b project-scaffold
git add code/desktop-pet/ .gitignore
git commit -m "feat: scaffold Tauri v2 project with transparent window

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge project-scaffold
```

---

### Task 2: Status Bridge — Signal Listener

**Branch:** `status-bridge` (from `main`)

**Files:**
- Create: `code/desktop-pet/src-tauri/src/signal_listener.rs`
- Modify: `code/desktop-pet/src-tauri/src/lib.rs`
- Modify: `code/desktop-pet/src-tauri/Cargo.toml` (add `notify` crate)

- [ ] **Step 1: Add `notify` dependency to Cargo.toml**

```toml
[dependencies]
notify = { version = "6", features = ["macos_kqueue"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Write signal_listener.rs**

```rust
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, PartialEq)]
pub enum CrabStatus {
    Idle,
    Working,
    Complete,
    Error(String),
}

#[derive(Debug, Clone, serde::Deserialize)]
struct SignalPayload {
    status: String,
    #[allow(dead_code)]
    timestamp: String,
    message: Option<String>,
}

pub struct SignalListener {
    status_file: PathBuf,
    last_read: Instant,
}

impl SignalListener {
    pub fn new() -> Self {
        let home = dirs_next().unwrap_or_else(|| PathBuf::from("."));
        let status_dir = home.join(".claude").join("status-bridge");
        std::fs::create_dir_all(&status_dir).ok();
        Self {
            status_file: status_dir.join("state.json"),
            last_read: Instant::now(),
        }
    }

    pub fn read_current_status(&mut self) -> Option<CrabStatus> {
        self.last_read = Instant::now();
        let content = std::fs::read_to_string(&self.status_file).ok()?;
        let payload: SignalPayload = serde_json::from_str(&content).ok()?;
        Some(match payload.status.as_str() {
            "working" => CrabStatus::Working,
            "complete" => CrabStatus::Complete,
            "error" => CrabStatus::Error(payload.message.unwrap_or_default()),
            _ => CrabStatus::Idle,
        })
    }

    pub fn watch<F>(&self, on_change: F) -> notify::Result<()>
    where
        F: Fn(CrabStatus) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_)) {
                        tx.send(()).ok();
                    }
                }
            },
            Config::default(),
        )?;

        let parent = self.status_file.parent().unwrap();
        watcher.watch(parent, RecursiveMode::NonRecursive)?;

        let mut listener = SignalListener {
            status_file: self.status_file.clone(),
            last_read: Instant::now(),
        };

        std::thread::spawn(move || {
            let mut last_event = Instant::now();
            for _ in rx {
                let now = Instant::now();
                // Debounce: 200ms
                if now.duration_since(last_event) < Duration::from_millis(200) {
                    continue;
                }
                last_event = now;
                if let Some(status) = listener.read_current_status() {
                    on_change(status);
                }
            }
        });

        Ok(())
    }

    pub fn seconds_since_last_read(&self) -> u64 {
        self.last_read.elapsed().as_secs()
    }
}

fn dirs_next() -> Option<PathBuf> {
    std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok().map(PathBuf::from)
}
```

- [ ] **Step 3: Write unit test — parse valid signal JSON**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_read_working_status() {
        let dir = std::env::temp_dir().join("crab-test-signal");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("state.json");
        std::fs::write(&file, r#"{"status":"working","timestamp":"2026-01-01T00:00:00Z"}"#).unwrap();

        let mut listener = SignalListener {
            status_file: file,
            last_read: Instant::now(),
        };
        assert_eq!(listener.read_current_status(), Some(CrabStatus::Working));
    }

    #[test]
    fn test_read_error_status_with_message() {
        let dir = std::env::temp_dir().join("crab-test-error");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("state.json");
        std::fs::write(&file, r#"{"status":"error","timestamp":"2026-01-01T00:00:00Z","message":"something broke"}"#).unwrap();

        let mut listener = SignalListener {
            status_file: file,
            last_read: Instant::now(),
        };
        assert_eq!(listener.read_current_status(), Some(CrabStatus::Error("something broke".into())));
    }

    #[test]
    fn test_missing_file_returns_none() {
        let mut listener = SignalListener {
            status_file: PathBuf::from("/nonexistent/crab-test.json"),
            last_read: Instant::now(),
        };
        assert_eq!(listener.read_current_status(), None);
    }
}
```

Run: `cd code/desktop-pet/src-tauri && cargo test`
Expected: 3 tests pass.

- [ ] **Step 4: Register Tauri command in lib.rs**

```rust
mod signal_listener;
mod process_detector;
mod bridge;

use signal_listener::SignalListener;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub listener: Mutex<SignalListener>,
}

#[tauri::command]
fn get_status(state: State<AppState>) -> String {
    let mut listener = state.listener.lock().unwrap();
    match listener.read_current_status() {
        Some(status) => serde_json::to_string(&status).unwrap(),
        None => r#"{"status":"idle"}"#.to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            listener: Mutex::new(SignalListener::new()),
        })
        .invoke_handler(tauri::generate_handler![get_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Update main.rs to use lib::run()**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    desktop_pet_lib::run();
}
```

Rename `main.rs` to call `lib.rs::run()` and update `Cargo.toml` `[lib]` section:
```toml
[lib]
name = "desktop_pet_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

- [ ] **Step 6: Run all tests and verify build**

```bash
cd code/desktop-pet/src-tauri && cargo test && cargo build
```
Expected: All tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git checkout -b status-bridge
git add code/desktop-pet/src-tauri/
git commit -m "feat: add signal listener with file watcher

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge status-bridge
```

---

### Task 3: Status Bridge — Process Detector (Fallback)

**Branch:** `status-bridge-fallback` (from `main`)

**Files:**
- Modify: `code/desktop-pet/src-tauri/src/process_detector.rs` (replace placeholder)
- Modify: `code/desktop-pet/src-tauri/src/bridge.rs` (replace placeholder)
- Modify: `code/desktop-pet/src-tauri/Cargo.toml` (add `sysinfo`)

- [ ] **Step 1: Add `sysinfo` to Cargo.toml**

```toml
sysinfo = "0.31"
```

- [ ] **Step 2: Write process_detector.rs**

```rust
use sysinfo::{PidExt, ProcessExt, System, SystemExt};
use crate::signal_listener::CrabStatus;

pub struct ProcessDetector {
    sys: System,
    target_pid: Option<u32>,
}

impl ProcessDetector {
    pub fn new() -> Self {
        Self {
            sys: System::new_all(),
            target_pid: None,
        }
    }

    pub fn refresh(&mut self) {
        self.sys.refresh_all();
    }

    fn find_claude_process(&self) -> Option<u32> {
        for (pid, process) in self.sys.processes() {
            let name = process.name().to_lowercase();
            if name.contains("claude") && !name.contains("crab") {
                return Some(pid.as_u32());
            }
        }
        None
    }

    pub fn detect(&mut self) -> Option<CrabStatus> {
        self.refresh();
        match self.find_claude_process() {
            None => {
                // Claude process not found → IDLE
                Some(CrabStatus::Idle)
            }
            Some(pid) => {
                if let Some(process) = self.sys.process(sysinfo::Pid::from_u32(pid)) {
                    let cpu = process.cpu_usage();
                    if cpu > 5.0 {
                        Some(CrabStatus::Working)
                    } else {
                        Some(CrabStatus::Idle)
                    }
                } else {
                    Some(CrabStatus::Idle)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detector_returns_some_status() {
        let mut detector = ProcessDetector::new();
        let result = detector.detect();
        // Should always return Some variant (either Idle or Working)
        assert!(result.is_some());
    }
}
```

- [ ] **Step 3: Write bridge.rs — unified status with fallback logic**

```rust
use crate::signal_listener::{CrabStatus, SignalListener};
use crate::process_detector::ProcessDetector;
use std::time::{Duration, Instant};

pub struct Bridge {
    listener: SignalListener,
    detector: ProcessDetector,
    startup: Instant,
}

impl Bridge {
    pub fn new(listener: SignalListener) -> Self {
        Self {
            listener,
            detector: ProcessDetector::new(),
            startup: Instant::now(),
        }
    }

    /// Returns current status, using fallback if signal is stale.
    pub fn current_status(&mut self) -> CrabStatus {
        // Startup grace period: first 5 seconds, return Idle
        if self.startup.elapsed() < Duration::from_secs(5) {
            return CrabStatus::Idle;
        }

        // If signal file updated within last 10 seconds, trust it
        if self.listener.seconds_since_last_read() < 10 {
            return self.listener.read_current_status().unwrap_or(CrabStatus::Idle);
        }

        // Fallback: use process detector
        self.detector.detect().unwrap_or(CrabStatus::Idle)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_returns_idle_at_startup() {
        let listener = SignalListener::new();
        let mut bridge = Bridge::new(listener);
        assert_eq!(bridge.current_status(), CrabStatus::Idle);
    }
}
```

- [ ] **Step 4: Update lib.rs to use Bridge instead of raw SignalListener**

Update `AppState`:
```rust
use bridge::Bridge;

pub struct AppState {
    pub bridge: Mutex<Bridge>,
}

#[tauri::command]
fn get_status(state: State<AppState>) -> String {
    let mut bridge = state.bridge.lock().unwrap();
    let status = bridge.current_status();
    serde_json::to_string(&status).unwrap()
}

pub fn run() {
    let listener = SignalListener::new();
    tauri::Builder::default()
        .manage(AppState {
            bridge: Mutex::new(Bridge::new(listener)),
        })
        .invoke_handler(tauri::generate_handler![get_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Run tests**

```bash
cd code/desktop-pet/src-tauri && cargo test
```

- [ ] **Step 6: Commit**

```bash
git checkout -b status-bridge-fallback
git add code/desktop-pet/src-tauri/
git commit -m "feat: add process detector fallback and bridge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge status-bridge-fallback
```

---

### Task 4: State Machine (Frontend)

**Branch:** `state-machine` (from `main`)

**Files:**
- Create: `code/desktop-pet/src/state-machine.ts`

- [ ] **Step 1: Write state-machine.ts**

```typescript
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
  static IDLE_TIMEOUT = 5 * 60 * 1000;   // 5 min idle → sleep
  static COMPLETE_TIMEOUT = 3 * 60 * 1000; // 3 min complete → idle

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

  /** Check and fire time-based transitions. Call each frame. */
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
```

- [ ] **Step 2: Write tests for state-machine**

Create `code/desktop-pet/src/__tests__/state-machine.test.ts`:

```typescript
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
    // Force timeout by setting a short override
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
```

- [ ] **Step 3: Setup vitest and run tests**

```bash
cd code/desktop-pet && npm install -D vitest && npx vitest run
```
Expected: 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git checkout -b state-machine
git add code/desktop-pet/src/state-machine.ts code/desktop-pet/src/__tests__/ code/desktop-pet/package.json
git commit -m "feat: add state machine with transitions and tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge state-machine
```

---

### Task 5: Animation Engine

**Branch:** `animation` (from `main`)

**Files:**
- Create: `code/desktop-pet/src/animation.ts`
- Create: `code/desktop-pet/src/__tests__/animation.test.ts`

- [ ] **Step 1: Write animation.ts — Spritesheet loader + frame player**

```typescript
export interface AnimationClip {
  name: string;
  src: string;          // path to spritesheet PNG
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
```

- [ ] **Step 2: Write animation tests**

```typescript
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

  it('registers and retrieves a clip', () => {
    const clip = makeClip();
    player.registerClip(clip);
    // Play will throw if clip not registered, so no throw = pass
  });

  it('throws when playing unregistered clip', () => {
    expect(() => player.play('nonexistent')).toThrow('Clip not registered');
  });

  it('advances frames over time (loop)', () => {
    const clip = makeClip({ frameCount: 4, fps: 10, loop: true });
    player.registerClip(clip);
    player.play('test');
    expect(player.getCurrentFrameData()?.frame).toBe(0);

    player.update(100); // 10fps = 100ms per frame
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

    player.update(100); // frame 1
    player.update(100); // should stop, no more frames
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
```

- [ ] **Step 3: Run tests**

```bash
cd code/desktop-pet && npx vitest run
```
Expected: All animation tests pass.

- [ ] **Step 4: Commit**

```bash
git checkout -b animation
git add code/desktop-pet/src/animation.ts code/desktop-pet/src/__tests__/animation.test.ts
git commit -m "feat: add animation engine with spritesheet player

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge animation
```

---

### Task 6: Behavior Scheduler

**Branch:** `behavior` (from `main`)

**Files:**
- Create: `code/desktop-pet/src/behavior.ts`
- Create: `code/desktop-pet/src/__tests__/behavior.test.ts`

- [ ] **Step 1: Write behavior.ts**

```typescript
import { CrabState } from './state-machine';

export type BehaviorType = 'primary' | 'random' | 'override';

export interface BehaviorAction {
  id: string;
  type: BehaviorType;
  animClip: string;
  priority: number; // 3=override, 2=random, 1=primary
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
  private randomInterval: number = 0;
  private lastIdleAction: string | null = null;
  private sleepApproaching: boolean = false;

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
        ? 8000 + Math.random() * 7000   // 8-15s
        : 10000 + Math.random() * 10000; // 10-20s

      if (this.randomTimer >= interval) {
        this.randomTimer = 0;
        this.enqueueRandom();
      }
    }

    if (this.currentAction === null || this.currentAction.interruptible) {
      if (this.queue.length > 0) {
        const override = this.queue.find(a => a.priority === 3);
        if (override) {
          this.currentAction = override;
          this.queue = this.queue.filter(a => a !== override);
        } else if (this.currentAction === null) {
          this.currentAction = this.queue.shift()!;
        }
        this.actionStart = performance.now();
        this.actionDuration = 0;
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
```

- [ ] **Step 2: Write behavior tests**

```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
cd code/desktop-pet && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git checkout -b behavior
git add code/desktop-pet/src/behavior.ts code/desktop-pet/src/__tests__/behavior.test.ts
git commit -m "feat: add behavior scheduler with action queue

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge behavior
```

---

### Task 7: Canvas Renderer + Window Interaction

**Branch:** `interaction` (from `main`)

**Files:**
- Create: `code/desktop-pet/src/canvas-renderer.ts`
- Create: `code/desktop-pet/src/interaction.ts`
- Create: `code/desktop-pet/src/pet-window.ts`

- [ ] **Step 1: Write canvas-renderer.ts**

```typescript
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
    this.bubbleTimer = 3000; // 3 seconds
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

    // Flip if facing left
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
      const width = ctx.measureText(this.bubbleText).width + 16;
      ctx.beginPath();
      ctx.roundRect(bx - width / 2, by - 12, width, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.bubbleText, bx, by + 4);
    }
  }
}
```

- [ ] **Step 2: Write interaction.ts**

```typescript
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

    // Error state: any click closes error cloud
    if (state === CrabState.Error) {
      this.sm.send(CrabEvent.UserClickError);
      this.onErrorClickCallback?.();
      return;
    }

    // Double-click detection (IDLE only)
    const now = performance.now();
    if (state === CrabState.Idle && now - this.lastClickTime < InteractionHandler.DOUBLE_CLICK_MS) {
      this.onPokeCallback?.();
    }
    this.lastClickTime = now;

    // Start drag
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
```

- [ ] **Step 3: Write pet-window.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';
import { CrabState } from './state-machine';

export class PetWindow {
  private x: number = 0;
  private y: number = 0;
  private screenW: number = 1920;
  private screenH: number = 1080;
  private boundaryPadding: number = 64; // crab size * scale
  private edgeThreshold: number = 80;
  private velocityX: number = 0;

  constructor() {
    this.screenW = window.screen.width;
    this.screenH = window.screen.height;
  }

  async init(): Promise<void> {
    // Position at bottom-right initially
    this.x = this.screenW - 200;
    this.y = this.screenH - 200;
    await this.setWindowPosition(this.x, this.y);
  }

  private async setWindowPosition(x: number, y: number): Promise<void> {
    await invoke('set_window_position', { x: Math.round(x), y: Math.round(y) });
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

    // Boundary check
    if (newX < 0) {
      newX = 0;
      this.velocityX *= -1;
    } else if (newX > this.screenW - this.boundaryPadding) {
      newX = this.screenW - this.boundaryPadding;
      this.velocityX *= -1;
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
    await invoke('set_click_through', { ignore });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git checkout -b interaction
git add code/desktop-pet/src/canvas-renderer.ts code/desktop-pet/src/interaction.ts code/desktop-pet/src/pet-window.ts
git commit -m "feat: add canvas renderer, interaction handler, and window controller

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge interaction
```

---

### Task 8: Integration — Main Loop + Tauri Commands

**Branch:** `integration` (from `main`)

**Files:**
- Create: `code/desktop-pet/src/main.ts` (full rewrite from scaffold)
- Modify: `code/desktop-pet/src-tauri/src/lib.rs` (add commands)
- Modify: `code/desktop-pet/index.html`
- Modify: `code/desktop-pet/src-tauri/tauri.conf.json` (final config)

- [ ] **Step 1: Add Tauri commands in lib.rs (set_window_position, set_click_through)**

```rust
use tauri::Manager;

#[tauri::command]
fn set_window_position(window: tauri::Window, x: i32, y: i32) {
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y })).ok();
}

#[tauri::command]
fn set_click_through(window: tauri::Window, ignore: bool) {
    window.set_ignore_cursor_events(ignore).ok();
}

// Also update the run() invoke_handler to include these:
// .invoke_handler(tauri::generate_handler![get_status, set_window_position, set_click_through])
```

- [ ] **Step 2: Write main.ts — full integration**

```typescript
import { StateMachine, CrabState, CrabEvent } from './state-machine';
import { AnimationPlayer, AnimationClip } from './animation';
import { BehaviorScheduler } from './behavior';
import { CanvasRenderer } from './canvas-renderer';
import { InteractionHandler } from './interaction';
import { PetWindow } from './pet-window';
import { invoke } from '@tauri-apps/api/core';

// --- Register animation clips ---
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

// --- Init ---
async function main() {
  const canvas = document.getElementById('crab-canvas') as HTMLCanvasElement;
  const animPlayer = new AnimationPlayer();
  const sm = new StateMachine(CrabState.Idle);
  const behavior = new BehaviorScheduler();
  const renderer = new CanvasRenderer(canvas, animPlayer);
  const petWindow = new PetWindow();
  const interaction = new InteractionHandler(canvas, sm);

  // Register & preload all clips
  for (const clip of CLIPS) {
    animPlayer.registerClip(clip);
  }
  await animPlayer.preload('idle');

  // Init window position
  await petWindow.init();

  // --- State change handler ---
  let lastStatus: string = '';
  sm.onChange((curr, prev) => {
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

  // --- Interaction callbacks ---
  interaction.onDrag((x, y) => {
    petWindow.moveTo(x, y);
    renderer.setPosition(0, 0); // Window follows mouse
  });

  interaction.onPoke(() => {
    animPlayer.play('poke', () => {
      // After poke, resume current behavior
    });
  });

  interaction.onErrorClick(() => {
    renderer.hideCloud();
  });

  // --- Status polling from Rust bridge ---
  setInterval(async () => {
    try {
      const result: any = await invoke('get_status');
      const status = JSON.parse(result);
      if (status.status !== lastStatus) {
        lastStatus = status.status;
        switch (status.status) {
          case 'Working': sm.send(CrabEvent.SignalWorking); break;
          case 'Complete': sm.send(CrabEvent.SignalComplete); break;
          case 'Error': sm.send(CrabEvent.SignalError); break;
          case 'Idle':
            if (sm.getState() === CrabState.Working) sm.send(CrabEvent.SignalLost);
            break;
        }
      }
    } catch (e) {
      console.error('Status poll error:', e);
    }
  }, 500);

  // --- Main render loop ---
  let lastTime = performance.now();
  function loop() {
    const now = performance.now();
    const delta = Math.min(now - lastTime, 100); // cap at 100ms
    lastTime = now;

    sm.tick();

    // Update behavior, get current animation
    const clip = behavior.tick(delta);
    if (clip && clip !== animPlayer.getCurrentClipName()) {
      animPlayer.play(clip);
    } else if (!clip) {
      animPlayer.pause();
    }

    // IDLE walking logic
    if (sm.getState() === CrabState.Idle && behavior.getCurrentAction()?.id === 'walk_right') {
      petWindow.walk(1, 60, delta);
      renderer.setFacing(true);
    } else if (sm.getState() === CrabState.Idle && behavior.getCurrentAction()?.id === 'walk_left') {
      petWindow.walk(-1, 60, delta);
      renderer.setFacing(false);
    }

    // Sleep approaching flag (4 min into idle)
    // (handled by state-machine tick, but could pass to behavior here)

    animPlayer.update(delta);
    renderer.update(delta);
    renderer.render();

    // Click-through: toggle based on mouse proximity
    const pos = petWindow.getPosition();
    // (simplified — in production, check mouse relative to canvas)

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);
```

- [ ] **Step 3: Update index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; }
    html, body { background: transparent; overflow: hidden; width: 128px; height: 128px; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="crab-canvas" width="128" height="128"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Configure Tauri tray in Rust**

Add to `lib.rs`:
```rust
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

// In run(), after building the app:
let menu = MenuBuilder::new(app.handle())
    .item(&MenuItemBuilder::with_id("status", "Claude Crab · Idle").enabled(false).build(app.handle()))
    .separator()
    .item(&MenuItemBuilder::with_id("open_dir", "打开状态文件位置").build(app.handle()))
    .separator()
    .item(&MenuItemBuilder::with_id("quit", "退出").build(app.handle()))
    .build()?;

TrayIconBuilder::new()
    .menu(&menu)
    .on_menu_event(|app, event| {
        match event.id.as_ref() {
            "open_dir" => {
                let _ = open::that(dirs::home_dir().unwrap().join(".claude/status-bridge"));
            }
            "quit" => app.exit(0),
            _ => {}
        }
    })
    .build(app)?;
```

- [ ] **Step 5: Build and verify**

```bash
cd code/desktop-pet && npm install && cargo tauri build 2>&1 | tail -20
```
Expected: Build succeeds without errors.

- [ ] **Step 6: Commit**

```bash
git checkout -b integration
git add code/desktop-pet/
git commit -m "feat: integrate all modules — main loop, commands, tray

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git checkout main && git merge integration
```

---

## Post-Implementation Checklist

- [ ] `npx vitest run` — all unit tests pass
- [ ] `cargo test` — all Rust tests pass
- [ ] `cargo tauri build` — release build succeeds
- [ ] Manual test: launch app, transparent window appears
- [ ] Manual test: simulate signal file writes, verify state transitions
- [ ] Manual test: drag crab, double-click poke, error click dismiss
