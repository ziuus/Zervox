use crate::types::{ClusterState, NodeRole};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

#[derive(Debug, Clone)]
pub struct WatchdogInfo {
    pub role: NodeRole,
    pub state: ClusterState,
    pub peer_address: Option<String>,
    pub peer_status: String,
}

#[derive(Clone)]
pub struct Watchdog {
    role: NodeRole,
    state: Arc<RwLock<ClusterState>>,
    peer_status: Arc<RwLock<String>>,
    peer_address: Option<String>,
    is_promoted: Arc<AtomicBool>,
}

impl Watchdog {
    pub fn new(role: NodeRole, peer_address: Option<String>) -> Self {
        let initial_state = match role {
            NodeRole::Primary => ClusterState::Active,
            NodeRole::Backup => ClusterState::Standby,
        };

        Self {
            role,
            state: Arc::new(RwLock::new(initial_state)),
            peer_status: Arc::new(RwLock::new(if peer_address.is_some() {
                "connecting".to_string()
            } else {
                "none".to_string()
            })),
            peer_address,
            is_promoted: Arc::new(AtomicBool::new(role == NodeRole::Primary)),
        }
    }

    pub async fn is_active(&self) -> bool {
        *self.state.read().await == ClusterState::Active
    }

    pub async fn get_info(&self) -> WatchdogInfo {
        let state = *self.state.read().await;
        let peer_status = self.peer_status.read().await.clone();
        WatchdogInfo {
            role: self.role,
            state,
            peer_address: self.peer_address.clone(),
            peer_status,
        }
    }

    /// Run the watchdog background task
    pub async fn start(&self, heartbeat_port: u16) {
        match self.role {
            NodeRole::Primary => {
                self.run_primary_listener(heartbeat_port).await;
            }
            NodeRole::Backup => {
                let peer = self.peer_address.clone().unwrap_or_else(|| {
                    format!("127.0.0.1:{}", heartbeat_port)
                });
                self.run_backup_monitor(peer, heartbeat_port).await;
            }
        }
    }

    async fn run_primary_listener(&self, port: u16) {
        let addr = format!("0.0.0.0:{}", port);
        info!(addr = %addr, "Starting Watchdog TCP Heartbeat listener (Primary)");

        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(err) => {
                error!(error = %err, "Failed to bind watchdog heartbeat listener");
                return;
            }
        };

        loop {
            match listener.accept().await {
                Ok((mut socket, _peer_addr)) => {
                    *self.peer_status.write().await = "peer_connected".to_string();
                    tokio::spawn(async move {
                        let mut buf = [0u8; 128];
                        if let Ok(n) = socket.read(&mut buf).await {
                            if n > 0 {
                                let _ = socket.write_all(b"ZERVOX_HEARTBEAT_OK\n").await;
                            }
                        }
                    });
                }
                Err(err) => {
                    warn!(error = %err, "Watchdog accept error");
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        }
    }

    async fn run_backup_monitor(&self, peer_addr: String, heartbeat_port: u16) {
        info!(
            peer = %peer_addr,
            "Starting Watchdog Backup monitor (connecting to Primary)"
        );

        let mut failure_count = 0;
        let max_failures_before_failover = 3;

        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;

            // Check if already promoted
            if self.is_promoted.load(Ordering::SeqCst) {
                continue;
            }

            match self.ping_peer(&peer_addr).await {
                Ok(_) => {
                    failure_count = 0;
                    *self.peer_status.write().await = "primary_alive".to_string();
                }
                Err(err) => {
                    failure_count += 1;
                    *self.peer_status.write().await = format!("unreachable (attempt {}/{})", failure_count, max_failures_before_failover);
                    warn!(
                        peer = %peer_addr,
                        failure_count,
                        error = %err,
                        "Primary heartbeat ping failed"
                    );

                    if failure_count >= max_failures_before_failover {
                        self.promote_to_active(heartbeat_port).await;
                    }
                }
            }
        }
    }

    pub async fn ping_peer(&self, peer_addr: &str) -> Result<(), anyhow::Error> {
        let mut stream = tokio::time::timeout(
            Duration::from_secs(1),
            TcpStream::connect(peer_addr),
        )
        .await??;

        stream.write_all(b"PING\n").await?;
        let mut buf = [0u8; 32];
        let n = tokio::time::timeout(Duration::from_secs(1), stream.read(&mut buf)).await??;

        if n > 0 && String::from_utf8_lossy(&buf[..n]).contains("OK") {
            Ok(())
        } else {
            anyhow::bail!("Invalid heartbeat response from peer");
        }
    }

    async fn promote_to_active(&self, heartbeat_port: u16) {
        if self.is_promoted.swap(true, Ordering::SeqCst) {
            return;
        }

        info!("🚨 WATCHDOG: Primary heartbeat lost! Promoting Backup instance to ACTIVE leader.");
        *self.state.write().await = ClusterState::Active;
        *self.peer_status.write().await = "primary_dead_promoted_to_leader".to_string();

        // Spawn heartbeat listener so downstream nodes can track this newly promoted leader
        let watchdog_clone = self.clone();
        tokio::spawn(async move {
            watchdog_clone.run_primary_listener(heartbeat_port).await;
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_watchdog_primary_backup_heartbeat() {
        let primary_port = 19001;
        let primary_watchdog = Watchdog::new(NodeRole::Primary, None);
        let p_clone = primary_watchdog.clone();
        tokio::spawn(async move {
            p_clone.start(primary_port).await;
        });

        // Give listener a moment to bind
        tokio::time::sleep(Duration::from_millis(100)).await;

        let backup_watchdog = Watchdog::new(
            NodeRole::Backup,
            Some(format!("127.0.0.1:{}", primary_port)),
        );

        assert_eq!(*backup_watchdog.state.read().await, ClusterState::Standby);
        let ping_res = backup_watchdog.ping_peer(&format!("127.0.0.1:{}", primary_port)).await;
        assert!(ping_res.is_ok());
    }
}
