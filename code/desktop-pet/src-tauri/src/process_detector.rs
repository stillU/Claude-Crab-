use sysinfo::{Pid, System};
use crate::signal_listener::CrabStatus;

pub struct ProcessDetector {
    sys: System,
    #[allow(dead_code)]
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
            let name = process.name().to_str().unwrap_or_default().to_lowercase();
            if name.contains("claude") && !name.contains("crab") {
                return Some(pid.as_u32());
            }
        }
        None
    }

    pub fn detect(&mut self) -> Option<CrabStatus> {
        self.refresh();
        match self.find_claude_process() {
            None => Some(CrabStatus::Idle),
            Some(pid_val) => {
                if let Some(process) = self.sys.process(Pid::from_u32(pid_val)) {
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
        assert!(result.is_some());
    }
}
