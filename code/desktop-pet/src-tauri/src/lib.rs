mod signal_listener;
mod process_detector;
mod bridge;

use bridge::Bridge;
use signal_listener::SignalListener;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub bridge: Mutex<Bridge>,
}

#[tauri::command]
fn get_status(state: State<AppState>) -> String {
    let mut bridge = state.bridge.lock().unwrap();
    let status = bridge.current_status();
    serde_json::to_string(&status).unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let listener = SignalListener::new();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            bridge: Mutex::new(Bridge::new(listener)),
        })
        .invoke_handler(tauri::generate_handler![get_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
