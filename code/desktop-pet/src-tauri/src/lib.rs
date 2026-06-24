mod signal_listener;
mod process_detector;
mod bridge;

use bridge::Bridge;
use signal_listener::SignalListener;
use std::sync::Mutex;
use tauri::State;
use tauri::tray::TrayIconBuilder;
use tauri::menu::{MenuBuilder, MenuItemBuilder};

pub struct AppState {
    pub bridge: Mutex<Bridge>,
}

#[tauri::command]
fn get_status(state: State<AppState>) -> String {
    let mut bridge = state.bridge.lock().unwrap();
    let status = bridge.current_status();
    serde_json::to_string(&status).unwrap()
}

#[tauri::command]
fn set_window_position(window: tauri::Window, x: i32, y: i32) {
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y })).ok();
}

#[tauri::command]
fn set_click_through(window: tauri::Window, ignore: bool) {
    window.set_ignore_cursor_events(ignore).ok();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let listener = SignalListener::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            bridge: Mutex::new(Bridge::new(listener)),
        })
        .invoke_handler(tauri::generate_handler![get_status, set_window_position, set_click_through])
        .setup(|app| {
            let menu = MenuBuilder::new(app.handle())
                .item(&MenuItemBuilder::with_id("status", "Claude Crab · Idle").enabled(false).build(app.handle())?)
                .separator()
                .item(&MenuItemBuilder::with_id("open_dir", "打开状态文件位置").build(app.handle())?)
                .separator()
                .item(&MenuItemBuilder::with_id("quit", "退出").build(app.handle())?)
                .build()?;

            TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open_dir" => {
                            let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
                            let _ = open::that(std::path::Path::new(&home).join(".claude/status-bridge"));
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
