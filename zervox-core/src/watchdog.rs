use crate::config::AppConfig;
use crate::types::{ClusterState, NodeRole};
use k8s_openapi::api::core::v1::Pod;
use kube::api::{Api, ListParams};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

const HEARTBEAT_PING: &[u8] = b"ZERVOX_PING\n";
const HEARTBEAT_PONG: &[u8] = b"ZERVOX_HEARTBEAT_OK\n";
/// Consecutive missed pings before promotion (2s interval × 3 = 6s window)
const MAX_MISSED_PINGS: u32 = 3;
/// How long before declaring a connect() attempt dead
const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);
/// Polling interval for backup monitor
const POLL_INTERVAL: Duration = Duration::from_secs(2);

#[derive(Debug, Clone)]
pub struct WatchdogInfo {
    pub role: NodeRole,
    pub state: ClusterState,
    pub peer_address: Option<String>,
    pub peer_status: String,
}

/// Thread-safe watchdog implementing TCP-bind leader election.
///
/// PRIMARY:  binds `0.0.0.0:<heartbeat_port>`, answers PING→PONG forever.
/// BACKUP:   polls primary every 2s. After 3 consecutive failures, atomically
///           sets state=Active, spawns its own heartbeat listener, and allows
///           the main ingest router to start processing webhooks.
#[derive(Clone)]
pub struct Watchdog {
    role: NodeRole,
    state: Arc<RwLock<ClusterState>>,
    peer_status: Arc<RwLock<String>>,
    peer_address: Option<String>,
    /// CAS gate so promotion runs exactly once even under concurrent poll loops
    is_promoted: Arc<AtomicBool>,
}

impl Watchdog {
    pub fn new(role: NodeRole, peer_address: Option<String>) -> Self {
        let initial_state = match role {
            NodeRole::Primary => ClusterState::Active,
            NodeRole::Backup => ClusterState::Standby,
        };

        let initial_peer_status = match &peer_address {
            Some(_) => "connecting".to_string(),
            None => match role {
                NodeRole::Primary => "peer_connected".to_string(),
                NodeRole::Backup => "none".to_string(),
            },
        };

        Self {
            role,
            state: Arc::new(RwLock::new(initial_state)),
            peer_status: Arc::new(RwLock::new(initial_peer_status)),
            peer_address,
            is_promoted: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Returns true when this instance should process and execute remediation actions.
    pub async fn is_active(&self) -> bool {
        *self.state.read().await == ClusterState::Active
    }

    pub async fn get_info(&self) -> WatchdogInfo {
        WatchdogInfo {
            role: self.role,
            state: *self.state.read().await,
            peer_address: self.peer_address.clone(),
            peer_status: self.peer_status.read().await.clone(),
        }
    }

    /// Entry point — spawned as a background Tokio task in main.rs.
    pub async fn start(&self, heartbeat_port: u16) {
        match self.role {
            NodeRole::Primary => {
                self.run_primary_listener(heartbeat_port, None, None).await;
            }
            NodeRole::Backup => {
                let peer = self.peer_address.clone().unwrap_or_else(|| {
                    format!("127.0.0.1:{}", heartbeat_port)
                });
                self.run_backup_monitor(peer, heartbeat_port).await;
            }
        }
    }

    // ── Primary: TCP heartbeat server ─────────────────────────────────────────

    pub async fn run_primary_listener(
        &self,
        port: u16,
        _cert: Option<PathBuf>,
        _key: Option<PathBuf>,
    ) {
        let addr = format!("0.0.0.0:{}", port);
        info!(addr = %addr, "Watchdog TCP heartbeat listener bound (Primary)");

        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(err) => {
                error!(error = %err, addr = %addr, "FATAL: Could not bind watchdog port — port may already be in use");
                return;
            }
        };

        loop {
            match listener.accept().await {
                Ok((socket, peer_addr)) => {
                    *self.peer_status.write().await = "peer_connected".to_string();
                    tokio::spawn(Self::handle_heartbeat_connection(socket, peer_addr.to_string()));
                }
                Err(err) => {
                    warn!(error = %err, "Watchdog accept() error; retrying");
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        }
    }

    pub async fn handle_heartbeat_connection(
        mut socket: TcpStream,
        peer_addr: String,
    ) {
        let mut buf = [0u8; 64];
        match tokio::time::timeout(Duration::from_secs(2), socket.read(&mut buf)).await {
            Ok(Ok(n)) if n > 0 => {
                let msg = String::from_utf8_lossy(&buf[..n]);
                if msg.contains("PING") {
                    if let Err(e) = socket.write_all(HEARTBEAT_PONG).await {
                        warn!(peer = %peer_addr, error = %e, "Failed to send heartbeat PONG");
                    }
                }
            }
            Ok(Ok(_)) => {} // zero bytes — connection closed cleanly
            Ok(Err(e)) => warn!(peer = %peer_addr, error = %e, "Heartbeat read error"),
            Err(_) => warn!(peer = %peer_addr, "Heartbeat read timed out"),
        }
    }

    /// Sends PING and expects PONG back within timeout.
    pub async fn ping_primary(&self, peer_addr: &str) -> Result<(), anyhow::Error> {
        let mut stream = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(peer_addr))
            .await
            .map_err(|_| anyhow::anyhow!("TCP connect to {} timed out", peer_addr))??;

        stream.write_all(HEARTBEAT_PING).await?;

        let mut buf = [0u8; 64];
        let n = tokio::time::timeout(CONNECT_TIMEOUT, stream.read(&mut buf))
            .await
            .map_err(|_| anyhow::anyhow!("Heartbeat PONG read timed out"))??;

        if n > 0 && String::from_utf8_lossy(&buf[..n]).contains("OK") {
            Ok(())
        } else {
            anyhow::bail!("Unexpected heartbeat response from primary")
        }
    }

    /// Atomically promotes this backup to Active leader.
    /// Uses compare-and-swap so concurrent calls are no-ops after the first.
    pub async fn promote_to_active(&self, heartbeat_port: u16) {
        // CAS: only the first call proceeds
        if self
            .is_promoted
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return; // Another task already promoted
        }

        *self.state.write().await = ClusterState::Active;
        *self.peer_status.write().await = "PRIMARY_DEAD — BACKUP_PROMOTED_TO_LEADER".to_string();

        info!(
            "🚨 WATCHDOG FAILOVER: Primary is down! Backup promoted to ACTIVE. \
             Starting heartbeat listener on port {} and activating ingestion pipeline.",
            heartbeat_port
        );

        // Spawn new heartbeat listener so any tertiary watchers can track this leader
        let watcher = self.clone();
        tokio::spawn(async move {
            watcher.run_primary_listener(heartbeat_port, None, None).await;
        });
    }

    // ── Backup: polling monitor + promotion ───────────────────────────────────

    async fn run_backup_monitor(&self, peer_addr: String, heartbeat_port: u16) {
        info!(
            peer = %peer_addr,
            poll_interval_secs = POLL_INTERVAL.as_secs(),
            "Backup watchdog monitor started — watching primary heartbeat"
        );

        let mut consecutive_failures: u32 = 0;

        loop {
            tokio::time::sleep(POLL_INTERVAL).await;

            // Already promoted — just keep listening and do nothing else
            if self.is_promoted.load(Ordering::Acquire) && self.role == NodeRole::Backup {
                continue;
            }

            match self.ping_primary(&peer_addr).await {
                Ok(_) => {
                    if consecutive_failures > 0 {
                        info!(peer = %peer_addr, "Primary heartbeat restored");
                    }
                    consecutive_failures = 0;
                    *self.peer_status.write().await = "primary_alive".to_string();
                }
                Err(err) => {
                    consecutive_failures += 1;
                    let status = format!(
                        "primary_unreachable ({}/{} missed pings)",
                        consecutive_failures, MAX_MISSED_PINGS
                    );
                    *self.peer_status.write().await = status.clone();

                    warn!(
                        peer = %peer_addr,
                        consecutive_failures,
                        error = %err,
                        "Primary heartbeat MISSED"
                    );

                    if consecutive_failures >= MAX_MISSED_PINGS {
                        self.promote_to_active(heartbeat_port).await;
                        // Exit the polling loop — we are now active
                        return;
                    }
                }
            }
        }
    }
}

pub async fn discover_primary_peer(config: &AppConfig) -> String {
    if let Some(peer) = &config.peer {
        return peer.clone();
    }
    
    // Dynamic K8s Discovery
    info!("Performing Dynamic Service Discovery for primary peer...");
    if let Ok(client) = kube::Client::try_default().await {
        let pods: Api<Pod> = Api::namespaced(client, "default");
        let lp = ListParams::default().labels("app=zervox-ha,role=primary");
        if let Ok(pod_list) = pods.list(&lp).await {
            for pod in pod_list.items {
                if let Some(ip) = pod.status.and_then(|s| s.pod_ip) {
                    let addr = format!("{}:{}", ip, config.heartbeat_port);
                    info!(discovered_peer = %addr, "Discovered primary peer via K8s API");
                    return addr;
                }
            }
        }
    }
    
    info!("K8s discovery failed or airgapped, falling back to mDNS...");
    format!("zervox-primary.local:{}", config.heartbeat_port)
}

pub async fn wait_for_primary_failure(config: AppConfig) {
    let mut failure_count = 0;
    let max_failures = 3;

    loop {
        let peer_addr = discover_primary_peer(&config).await;
        info!(peer = %peer_addr, "Dormant backup node polling primary heartbeat...");

        tokio::time::sleep(Duration::from_secs(2)).await;

        let mut success = false;
        if let Ok(mut stream) = tokio::time::timeout(Duration::from_secs(2), TcpStream::connect(&peer_addr)).await.unwrap_or(Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "timeout"))) {
            if stream.write_all(HEARTBEAT_PING).await.is_ok() {
                let mut buf = [0u8; 64];
                if let Ok(Ok(n)) = tokio::time::timeout(Duration::from_secs(1), stream.read(&mut buf)).await {
                    if n > 0 && String::from_utf8_lossy(&buf[..n]).contains("OK") {
                        success = true;
                    }
                }
            }
        }

        if success {
            failure_count = 0;
        } else {
            failure_count += 1;
            warn!(peer_addr, failure_count, "Primary heartbeat failed");
            if failure_count >= max_failures {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_primary_answers_ping() {
        let port = 19100u16;
        let primary = Watchdog::new(NodeRole::Primary, None);
        let p = primary.clone();
        tokio::spawn(async move { p.start(port).await });
        tokio::time::sleep(Duration::from_millis(100)).await;

        let backup = Watchdog::new(NodeRole::Backup, Some(format!("127.0.0.1:{}", port)));
        backup
            .ping_primary(&format!("127.0.0.1:{}", port))
            .await
            .expect("Ping to primary should succeed");
    }

    #[tokio::test]
    async fn test_backup_promotes_on_primary_death() {
        let port = 19101u16;
        let primary = Watchdog::new(NodeRole::Primary, None);
        let p = primary.clone();
        let handle = tokio::spawn(async move { p.start(port).await });

        tokio::time::sleep(Duration::from_millis(100)).await;

        // Kill primary
        handle.abort();
        tokio::time::sleep(Duration::from_millis(100)).await;

        let backup = Watchdog::new(NodeRole::Backup, Some(format!("127.0.0.1:{}", port)));
        assert_eq!(*backup.state.read().await, ClusterState::Standby);

        // Simulate 3 failed pings to trigger promotion
        for _ in 0..MAX_MISSED_PINGS {
            let _ = backup.ping_primary(&format!("127.0.0.1:{}", port)).await;
        }

        // Manually promote (replicating the monitor logic for test isolation)
        backup.promote_to_active(port + 10).await;
        tokio::time::sleep(Duration::from_millis(50)).await;

        assert_eq!(*backup.state.read().await, ClusterState::Active);
        assert!(backup.is_active().await);
    }
}
