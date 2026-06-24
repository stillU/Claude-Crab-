mod signal_listener;

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
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            listener: Mutex::new(SignalListener::new()),
        })
        .invoke_handler(tauri::generate_handler![get_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
