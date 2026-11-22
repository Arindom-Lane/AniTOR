use std::{fs, net::TcpListener, path::PathBuf, sync::Mutex};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager, RunEvent, State};
#[cfg(windows)]
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

// ─────────────────────────────────────────────────────────────────────────────
// What the user can open from outside the app
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum OpenRequest {
    /// magnet:?xt=urn:btih:...
    Magnet { link: String },
    /// the bytes of a .torrent file, base64 encoded
    TorrentFile { name: String, data: String },
}

/// Requests that arrived but the web page has not picked up yet.
#[derive(Default)]
struct Pending(Mutex<Vec<OpenRequest>>);

/// The NestJS backend: where it listens, and the process we started (if any).
struct Backend {
    url: String,
    child: Mutex<Option<CommandChild>>,
}

const MAX_TORRENT_FILE_BYTES: u64 = 8 * 1024 * 1024;

/// A magnet link, or a path / file:// URL pointing at a .torrent file.
fn request_from_arg(arg: &str) -> Option<OpenRequest> {
    if arg.get(..7).is_some_and(|p| p.eq_ignore_ascii_case("magnet:")) {
        return Some(OpenRequest::Magnet { link: arg.to_string() });
    }

    // file managers hand over either a plain path or a file:// URL
    let path: PathBuf = if arg.starts_with("file://") {
        url::Url::parse(arg).ok()?.to_file_path().ok()?
    } else {
        PathBuf::from(arg)
    };
    if !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("torrent")) {
        return None;
    }
    let meta = fs::metadata(&path).ok()?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_TORRENT_FILE_BYTES {
        return None;
    }
    Some(OpenRequest::TorrentFile {
        name: path.file_name()?.to_string_lossy().into_owned(),
        data: STANDARD.encode(fs::read(&path).ok()?),
    })
}

fn requests_from_args(args: &[String]) -> Vec<OpenRequest> {
    args.iter().skip(1).filter_map(|a| request_from_arg(a)).collect()
}

/// Queues requests for the web page, tells it to look, and brings the window forward.
fn queue(app: &AppHandle, requests: Vec<OpenRequest>) {
    if !requests.is_empty() {
        app.state::<Pending>().0.lock().unwrap().extend(requests);
        let _ = app.emit("open-request", ());
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands the web page can call
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn backend_url(backend: State<'_, Backend>) -> String {
    backend.url.clone()
}

/// Hands over (and forgets) everything queued, so nothing is ever handled twice.
#[tauri::command]
fn take_pending(pending: State<'_, Pending>) -> Vec<OpenRequest> {
    std::mem::take(&mut *pending.0.lock().unwrap())
}

// ─────────────────────────────────────────────────────────────────────────────
// The NestJS backend, started as a sidecar
// ─────────────────────────────────────────────────────────────────────────────

fn free_port() -> std::io::Result<u16> {
    Ok(TcpListener::bind(("127.0.0.1", 0))?.local_addr()?.port())
}

fn start_backend(app: &AppHandle) -> Result<Backend, Box<dyn std::error::Error>> {
    // While developing you run `npm run start:dev` inside ../backend yourself
    // (port 3000). Set ANITOR_SPAWN_BACKEND=1 to test the bundled one instead.
    if cfg!(debug_assertions) && std::env::var_os("ANITOR_SPAWN_BACKEND").is_none() {
        return Ok(Backend { url: "http://127.0.0.1:3000".into(), child: Mutex::new(None) });
    }

    let port = free_port()?;
    let data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&data_dir)?;

    let entry = app.path().resolve("backend/dist/main.js", BaseDirectory::Resource)?;
    let backend_dir = entry
        .parent()
        .and_then(|p| p.parent())
        .ok_or("unexpected backend path")?
        .to_path_buf();

    let (mut events, child) = app
        .shell()
        .sidecar("anitor-node")?
        .args([entry.to_string_lossy().to_string()])
        .current_dir(backend_dir)
        .env("PORT", port.to_string())
        .env("ANITOR_DATA_DIR", data_dir.to_string_lossy().to_string())
        .env("ANITOR_EXIT_WITH_PARENT", "1") // backend quits by itself if we crash
        .spawn()?;

    // Keep draining the backend's output (a full pipe would freeze it) and show it
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    print!("[backend] {}", String::from_utf8_lossy(&line))
                }
                CommandEvent::Error(e) => eprintln!("[backend] error: {e}"),
                CommandEvent::Terminated(p) => {
                    eprintln!("[backend] exited: {p:?}");
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(Backend { url: format!("http://127.0.0.1:{port}"), child: Mutex::new(Some(child)) })
}

// ─────────────────────────────────────────────────────────────────────────────
// Telling the desktop that AniTOR opens magnet links and .torrent files
// ─────────────────────────────────────────────────────────────────────────────

/// The file the user actually launched (inside an AppImage `current_exe` is a
/// temporary mount that changes on every run, so prefer $APPIMAGE).
fn launched_path() -> Option<PathBuf> {
    std::env::var_os("APPIMAGE").map(PathBuf::from).or_else(|| std::env::current_exe().ok())
}

/// Quotes a path for the Exec= line of a .desktop file.
#[cfg(target_os = "linux")]
fn desktop_quote(path: &std::path::Path) -> String {
    let escaped: String = path
        .to_string_lossy()
        .chars()
        .flat_map(|c| match c {
            '"' | '`' | '$' | '\\' => vec!['\\', c],
            _ => vec![c],
        })
        .collect();
    format!("\"{escaped}\"")
}

#[cfg(target_os = "linux")]
const HANDLER_FILE: &str = "anitor-handler.desktop";

#[cfg(target_os = "linux")]
fn handler_installed(app: &AppHandle) -> bool {
    app.path().data_dir().is_ok_and(|d| d.join("applications").join(HANDLER_FILE).exists())
}
#[cfg(not(target_os = "linux"))]
fn handler_installed(_app: &AppHandle) -> bool {
    true
}

/// Linux: one .desktop entry that opens both magnet: links and .torrent files.
/// (We write it ourselves instead of using the deep-link plugin's, because its
/// file lacks the trailing ';' that `xdg-mime` needs to find the handler.)
#[cfg(target_os = "linux")]
fn register_linux_handlers(app: &AppHandle, exe: &std::path::Path) -> Option<()> {
    let dir = app.path().data_dir().ok()?.join("applications");
    fs::create_dir_all(&dir).ok()?;
    let name = HANDLER_FILE;
    let entry = format!(
        "[Desktop Entry]\nType=Application\nName=AniTOR\nExec={} %U\nMimeType=x-scheme-handler/magnet;application/x-bittorrent;\nNoDisplay=true\nTerminal=false\n",
        desktop_quote(exe)
    );
    fs::write(dir.join(name), entry).ok()?;
    // best effort: refresh the desktop's cache (the tool is missing on some systems)
    let _ = std::process::Command::new("update-desktop-database").arg(&dir).status();
    std::process::Command::new("xdg-mime")
        .args(["default", name, "x-scheme-handler/magnet", "application/x-bittorrent"])
        .status()
        .ok()?;
    Some(())
}

/// Registers once per location of the app (not on every launch), so a default
/// the user picks later in their system settings is not overridden each time.
fn register_handlers(app: &AppHandle) {
    let (Some(exe), Ok(dir)) = (launched_path(), app.path().app_data_dir()) else { return };
    let marker = dir.join("registered-for.txt");
    // "v2" = version of the registration format; bump it to re-register everyone
    let me = format!("{}|v2", exe.to_string_lossy());
    if handler_installed(app) && fs::read_to_string(&marker).is_ok_and(|s| s.trim() == me) {
        return;
    }

    #[cfg(target_os = "linux")]
    {
        let _ = register_linux_handlers(app, &exe);
    }
    // Windows installers register magnet: and .torrent themselves; this is only
    // for running a development build there
    #[cfg(all(debug_assertions, windows))]
    {
        let _ = app.deep_link().register_all();
    }

    let _ = fs::create_dir_all(&dir);
    let _ = fs::write(marker, me);
}

// ─────────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // must be registered first: a second launch (e.g. another magnet click)
        // hands its arguments to this running instance and exits
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            queue(app, requests_from_args(&argv));
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Pending::default())
        .invoke_handler(tauri::generate_handler![backend_url, take_pending])
        .setup(|app| {
            let backend = start_backend(app.handle()).unwrap_or_else(|e| {
                eprintln!("could not start the AniTOR backend: {e}");
                Backend { url: "http://127.0.0.1:3000".into(), child: Mutex::new(None) }
            });
            app.manage(backend);

            // whatever launched us: a clicked magnet link, a double-clicked .torrent
            let args: Vec<String> = std::env::args().collect();
            app.state::<Pending>().0.lock().unwrap().extend(requests_from_args(&args));

            register_handlers(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the AniTOR app");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(backend) = app.try_state::<Backend>() {
                if let Some(child) = backend.child.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        }
    });
}