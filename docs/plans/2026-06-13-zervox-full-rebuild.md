# Zervox Full Rebuild Plan

> **Goal:** Fix all Rust core issues + rebuild the product website (complete landing, docs, pricing, about pages) in one stretch.

**Architecture:**
- **Rust core** — Fix config persistence, apply_solution, webhooks, auth, graceful shutdown, AI mode switching
- **Product website** — New HTML/CSS/JS standalone site in `web/` directory (no framework build step needed), served via Rust's axum static file handler. Modern dark theme consistent with current dashboard aesthetic.

**Tech Stack:**
- Rust: axum, serde, tokio, socketioxide
- Web: Vanilla HTML + CSS + JS (no build step, served directly)

---

## Phase 1: Rust Core Fixes

### Task 1: Config persistence for dashboard settings

**Objective:** Save dashboard mode and webhook URL to a config file so they survive restarts.

**Files:**
- Create: `src/web/config_persist.rs`
- Modify: `src/web/mod.rs`

**Details:**
```rust
// src/web/config_persist.rs
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardConfigPersisted {
    pub mode: String,       // "INTERACTIVE" | "AUTO_FIX" | "NOTIFY_ONLY"
    pub webhook_url: String,
}

impl Default for DashboardConfigPersisted {
    fn default() -> Self {
        Self {
            mode: "INTERACTIVE".into(),
            webhook_url: String::new(),
        }
    }
}

impl DashboardConfigPersisted {
    fn path() -> PathBuf {
        let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        base.join("zervox").join("dashboard.json")
    }

    pub fn load() -> Self {
        let path = Self::path();
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = fs::write(&path, json);
        }
    }
}
```

Modify `src/web/mod.rs`:
- Import `DashboardConfigPersisted`
- On `init_state`, emit persisted config instead of hardcoded
- On `update_config`, persist the received config
- Add `DashboardConfigPersisted::load()` call in the socket handler

### Task 2: Implement webhook dispatch

**Objective:** When a crash is detected and a webhook URL is configured, POST the crash data.

**Files:**
- Modify: `src/web/mod.rs` (in `trigger_ai_analysis`)

**Modification:**
After AI analysis completes (if webhook_url is set and non-empty), fire a non-blocking POST with the crash payload.

```rust
// Add after the crash emit
if let Ok(cfg) = DashboardConfigPersisted::load() {
    if !cfg.webhook_url.is_empty() {
        let url = cfg.webhook_url.clone();
        let payload = crash_data.clone();
        tokio::spawn(async move {
            let client = reqwest::Client::new();
            let _ = client.post(&url).json(&payload).send().await;
        });
    }
}
```

### Task 3: Implement "apply_solution" to actually execute fix commands

**Objective:** When a user clicks "Apply Solution" in the dashboard, actually run the suggested fix command.

**Files:**
- Modify: `src/task/mod.rs` ... actually `src/web/mod.rs`

**Modification:**
In `apply_solution` handler, execute the solution command using `tokio::process::Command` and log the output.

### Task 4: Bind to 127.0.0.1 by default

**Objective:** Security fix — don't expose dashboard to LAN.

**Files:**
- Modify: `src/web/mod.rs:134`

Change `"0.0.0.0:{port}"` to `"127.0.0.1:{port}"`.

### Task 5: Call reconcile on web start

**Objective:** Dashboard shows accurate process state from the start.

**Files:**
- Modify: `src/web/mod.rs:48-51`

Before loading processes, call `RuntimeStore::load_default()?.reconcile_stale_processes()`.

### Task 6: Add graceful shutdown for web server

**Objective:** Allow clean systemd service stops.

**Files:**
- Modify: `src/web/mod.rs`

Replace `axum::serve(listener, app).await` with a graceful shutdown using `tokio::signal::ctrl_c()`.

---

## Phase 2: Product Website

### Task 7: Create directory structure and landing page HTML

**Objective:** Create `web/zervox-site/` with a complete, served landing page.

**Files:**
- Create: `web/zervox-site/index.html` — Complete landing page (hero, features, how-it-works, pricing section, cta, footer)
- Create: `web/zervox-site/css/style.css` — Styles
- Create: `web/zervox-site/js/main.js` — Interactions
- Create: `web/zervox-site/pages/docs.html` — Full documentation with sidebar navigation
- Create: `web/zervox-site/pages/pricing.html` — Pricing tiers
- Create: `web/zervox-site/pages/about.html` — About page

**Serving:** Update axum fallback to serve `web/zervox-site/` instead of `public/`. Keep the old public dir for the dashboard app.

### Task 8: Build docs page with full sidebar + content

**Objective:** Working docs with click-to-load sidebar, real markdown content for all sections.

**Content sections:**
- Getting Started
- CLI Reference (actual zervox commands, not the old Node.js ones)
- Auto-Fix / AI
- Configuration
- Dashboard
- systemd Integration

### Task 9: Build pricing page

**Objective:** Show Community, Pro, Enterprise tiers. Community = free (GitHub), Pro = $9/mo (dashboard + AI), Enterprise = custom (on-prem, SLA).

### Task 10: Build about page

**Objective:** Project story, tech stack (Rust), creator info, GitHub stats.

### Task 11: Wire Rust web server to serve site

**Objective:** Mount the site alongside the dashboard.

**Files:**
- Modify: `src/web/mod.rs`

Add a secondary `ServeDir` for `web/zervox-site/` under a prefix or as default redirect.

### Task 12: Build and verify

**Objective:** `cargo build` succeeds, site renders at `http://127.0.0.1:3000`.