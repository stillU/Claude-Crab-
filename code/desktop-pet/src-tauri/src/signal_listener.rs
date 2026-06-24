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
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_working_status() {
        let dir = std::env::temp_dir().join("crab-test-signal");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("state.json");
        std::fs::write(
            &file,
            r#"{"status":"working","timestamp":"2026-01-01T00:00:00Z"}"#,
        )
        .unwrap();

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
        std::fs::write(
            &file,
            r#"{"status":"error","timestamp":"2026-01-01T00:00:00Z","message":"something broke"}"#,
        )
        .unwrap();

        let mut listener = SignalListener {
            status_file: file,
            last_read: Instant::now(),
        };
        assert_eq!(
            listener.read_current_status(),
            Some(CrabStatus::Error("something broke".into()))
        );
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
