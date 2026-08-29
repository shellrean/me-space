use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState(pub Mutex<Option<PtySession>>);

#[tauri::command]
pub fn pty_spawn(app: AppHandle, state: State<PtyState>, cwd: Option<String>) -> Result<(), String> {
    // Kill any previously running shell before starting a new one.
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut session) = guard.take() {
            let _ = session.child.kill();
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(shell);
    if let Some(dir) = &cwd {
        cmd.cwd(dir);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    {
        let mut guard = state.0.lock().map_err(|_| "pty state poisoned".to_string())?;
        *guard = Some(PtySession {
            writer,
            master: pair.master,
            child,
        });

        // `CommandBuilder::cwd` sets the process's initial working directory,
        // but interactive shell startup files (.zshrc, .bashrc, etc.) can
        // still `cd` elsewhere before printing the first prompt. Send an
        // explicit `cd` as if typed by the user so the final directory is
        // always right regardless of what the user's dotfiles do. The PTY
        // buffers this input in the kernel until the shell's readline loop
        // is ready to consume it, so no artificial delay is needed.
        if let Some(dir) = &cwd {
            if let Some(session) = guard.as_mut() {
                let escaped = dir.replace('\'', "'\\''");
                let _ = session.writer.write_all(format!("cd '{escaped}'\n").as_bytes());
                let _ = session.writer.flush();
            }
        }
    }

    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = BASE64.encode(&buf[..n]);
                    if app.emit("pty-output", encoded).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("pty-closed", ());
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<PtyState>, data: String) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "pty state poisoned".to_string())?;
    if let Some(session) = guard.as_mut() {
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(state: State<PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let guard = state.0.lock().map_err(|_| "pty state poisoned".to_string())?;
    if let Some(session) = guard.as_ref() {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_kill(state: State<PtyState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "pty state poisoned".to_string())?;
    if let Some(mut session) = guard.take() {
        let _ = session.child.kill();
    }
    Ok(())
}
