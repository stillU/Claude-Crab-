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

        // Check file modification time, not poll time
        if self.listener.seconds_since_file_modified() < 10 {
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
