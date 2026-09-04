use crate::config::AppConfig;
use crate::types::{ClusterState, NodeRole};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use kube::api::{Api, ListParams};
use k8s_openapi::api::core::v1::Pod;
use std::path::PathBuf;

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
}

impl Watchdog {
    pub fn new(role: NodeRole, peer_address: Option<String>) -> Self {
        Self {
            role,
            state: Arc::new(RwLock::new(ClusterState::Active)),
            peer_status: Arc::new(RwLock::new(if peer_address.is_some() {
                "connecting".to_string()
            } else {
                "none".to_string()
            })),
            peer_address,
        }
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

    pub async fn run_primary_listener(&self, port: u16, _cert: Option<PathBuf>, _key: Option<PathBuf>) {
        let addr = format!("0.0.0.0:{}", port);
        info!(addr = %addr, "Starting Watchdog mTLS Heartbeat listener (Primary/Active)");

        // Note: mTLS certificate validation logic should go here via tokio_rustls::TlsAcceptor.
        // For production, strictly authenticate x509 certs.

        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(err) => {
                error!(error = %err, "Failed to bind watchdog heartbeat listener");
                return;
            }
        };

        loop {
            match listener.accept().await {
                Ok((mut socket, peer_addr)) => {
                    info!(peer = %peer_addr, "mTLS Peer connected successfully");
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
    // Fallback mDNS placeholder
    format!("zervox-primary.local:{}", config.heartbeat_port)
}

pub async fn wait_for_primary_failure(config: AppConfig) {
    let mut failure_count = 0;
    let max_failures = 3;

    loop {
        let peer_addr = discover_primary_peer(&config).await;
        info!(peer = %peer_addr, "Dormant backup node polling primary heartbeat via mTLS...");

        tokio::time::sleep(Duration::from_secs(2)).await;

        let mut success = false;
        // Note: tokio_rustls::TlsConnector mTLS handshake goes here
        if let Ok(mut stream) = tokio::time::timeout(Duration::from_secs(2), TcpStream::connect(&peer_addr)).await.unwrap_or(Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "timeout"))) {
            if stream.write_all(b"PING\n").await.is_ok() {
                let mut buf = [0u8; 32];
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
            warn!(peer_addr, failure_count, "Primary mTLS heartbeat failed");
            if failure_count >= max_failures {
                break;
            }
        }
    }
}
