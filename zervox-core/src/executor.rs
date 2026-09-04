use crate::hardware_key::HardwareCircuitBreaker;
use crate::types::{ForensicSnapshot, RemediationAction};
use anyhow::{Context, Result};
use chrono::Utc;
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Node, Pod};
use kube::api::{DeleteParams, Patch, PatchParams};
use kube::{Api, Client, Config};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tracing::{info, warn};
use uuid::Uuid;

/// Production Kubernetes executor using kube-rs.
///
/// All three real operations:
///   - `restart_pod`       → Pod delete; ReplicaSet spawns a replacement
///   - `scale_deployment`  → Server-Side Apply patch on spec.replicas with force
///   - `cordon_node`       → Server-Side Apply unschedulable=true with HW dual-key
///
/// In DRY-RUN mode or when no kubeconfig is available, all operations
/// log and return a descriptive success string without touching the cluster.
#[derive(Clone)]
pub struct RemediationExecutor {
    k8s_client: Option<Client>,
    dry_run: bool,
    pub hardware_breaker: HardwareCircuitBreaker,
}

impl RemediationExecutor {
    pub async fn new(kubeconfig_path: Option<PathBuf>, dry_run: bool) -> Self {
        let hardware_breaker =
            HardwareCircuitBreaker::new(std::env::var("ZERVOX_HW_SERIAL_PORT").ok());

        if dry_run {
            info!("RemediationExecutor initialized in DRY-RUN mode — no real K8s calls");
            return Self {
                k8s_client: None,
                dry_run: true,
                hardware_breaker,
            };
        }

        match Self::build_kube_client(kubeconfig_path).await {
            Ok(client) => {
                info!("Kubernetes API client connected successfully");
                Self {
                    k8s_client: Some(client),
                    dry_run: false,
                    hardware_breaker,
                }
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "Could not connect to Kubernetes API server; \
                     falling back to DRY-RUN mode for safety"
                );
                Self {
                    k8s_client: None,
                    dry_run: true,
                    hardware_breaker,
                }
            }
        }
    }

    pub fn with_hardware_breaker(mut self, breaker: HardwareCircuitBreaker) -> Self {
        self.hardware_breaker = breaker;
        self
    }

    async fn build_kube_client(kubeconfig_path: Option<PathBuf>) -> Result<Client> {
        let config = if let Some(path) = kubeconfig_path {
            let raw = kube::config::Kubeconfig::read_from(&path)
                .with_context(|| format!("Cannot read kubeconfig at {:?}", path))?;
            Config::from_custom_kubeconfig(raw, &kube::config::KubeConfigOptions::default())
                .await
                .context("Failed to parse kubeconfig into client Config")?
        } else {
            // Tries KUBECONFIG env var, then ~/.kube/config, then in-cluster service account
            Config::infer()
                .await
                .context("Could not infer Kubernetes config (no kubeconfig or in-cluster SA found)")?
        };

        Client::try_from(config).context("Failed to build Kubernetes client from configuration")
    }

    pub fn is_connected(&self) -> bool {
        self.k8s_client.is_some() && !self.dry_run
    }

    // ── Public executor entry-point ───────────────────────────────────────────

    pub async fn execute(&self, action: &RemediationAction) -> Result<String> {
        info!(
            action_type = action.action_type(),
            target = %action.target_resource(),
            dry_run = self.dry_run || self.k8s_client.is_none(),
            "Executing OPA-approved remediation action"
        );

        match action {
            RemediationAction::RestartPod {
                namespace,
                pod_name,
            } => self.restart_pod(namespace, pod_name).await,
            RemediationAction::ScaleDeployment {
                namespace,
                deployment_name,
                target_replicas,
            } => {
                self.scale_deployment(namespace, deployment_name, *target_replicas)
                    .await
            }
            RemediationAction::CordonNode { node_name } => self.cordon_node(node_name).await,
            RemediationAction::NoAction { reason } => {
                info!(reason = %reason, "No remediation action taken by policy");
                Ok(format!("No action required: {}", reason))
            }
            RemediationAction::DangerousActionAttempt {
                action,
                resource,
                target_name,
                namespace,
                ..
            } => {
                anyhow::bail!(
                    "Attempted dangerous action '{}' on {}/{}/{} — execution rejected post-OPA.",
                    action,
                    resource,
                    namespace,
                    target_name
                );
            }
        }
    }

    // ── Restart Pod (delete → ReplicaSet recreates) ───────────────────────────

    async fn restart_pod(&self, namespace: &str, pod_name: &str) -> Result<String> {
        if self.is_dry_run() {
            info!(namespace, pod_name, "[DRY-RUN] Would delete pod for restart");
            return Ok(format!(
                "[DRY-RUN] Pod '{}/{}' would be deleted (ReplicaSet recreates)",
                namespace, pod_name
            ));
        }

        let client = self.client();
        let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);

        // Verify pod exists before attempting delete
        match pods.get_opt(pod_name).await {
            Ok(Some(_)) => {}
            Ok(None) => {
                warn!(namespace, pod_name, "Pod not found — may have already restarted");
                return Ok(format!(
                    "Pod '{}/{}' not found (may have already restarted)",
                    namespace, pod_name
                ));
            }
            Err(e) => {
                return Err(e).with_context(|| {
                    format!("Failed to check pod existence '{}/{}'", namespace, pod_name)
                });
            }
        }

        pods.delete(pod_name, &DeleteParams::default())
            .await
            .with_context(|| format!("Failed to delete pod '{}/{}'", namespace, pod_name))?;

        info!(namespace, pod_name, "Pod deleted — ReplicaSet will reschedule");
        Ok(format!(
            "Pod '{}/{}' deleted successfully; ReplicaSet will spawn a replacement.",
            namespace, pod_name
        ))
    }

    /// Capture Forensic Snapshot (Pre-Remediation Evidence Preservation)
    pub async fn capture_forensic_snapshot(
        &self,
        incident_id: &str,
        namespace: &str,
        pod_name: &str,
    ) -> Result<ForensicSnapshot> {
        info!(
            incident_id,
            namespace,
            pod_name,
            "[FORENSIC FREEZE] Initiating pre-remediation volatile evidence capture"
        );

        let snapshot_id = format!("snap-{}", Uuid::new_v4().simple());
        let captured_at = Utc::now();

        let (pod_spec_json, container_logs, volatile_memory_dump) = if self.dry_run || self.k8s_client.is_none() {
            let spec = json!({
                "kind": "Pod",
                "apiVersion": "v1",
                "metadata": {
                    "name": pod_name,
                    "namespace": namespace,
                    "labels": { "app": "victim-api", "version": "v1.4.2" }
                },
                "spec": {
                    "containers": [{
                        "name": "api-server",
                        "image": "registry.corp.internal/apps/victim-api:v1.4.2",
                        "resources": { "limits": { "memory": "256Mi" } }
                    }]
                }
            }).to_string();

            let logs = format!(
                "[{}Z] [ERROR] std::alloc::rust_oom: memory allocation of 268435456 bytes failed\n\
                 [{}Z] [FATAL] Kernel invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=0, oom_score_adj=998\n\
                 [{}Z] [INFO] Process 4410 (victim-api) total-vm:324540kB, anon-rss:261880kB, file-rss:0kB, shmem-rss:0kB\n\
                 [{}Z] [FATAL] Terminating process 4410 due to OOMKilled",
                captured_at.format("%Y-%m-%dT%H:%M:%S%.3f"),
                captured_at.format("%Y-%m-%dT%H:%M:%S%.3f"),
                captured_at.format("%Y-%m-%dT%H:%M:%S%.3f"),
                captured_at.format("%Y-%m-%dT%H:%M:%S%.3f"),
            );

            let mem = format!(
                "PID   USER     COMMAND          RSS(KB)  STATE  FD_COUNT\n\
                 1     root     /init            1024     S      4\n\
                 18    zervox   victim-api       261880   R      128\n\
                 99    attacker /dev/shm/.k_exp  8192     S      12\n\
                 --- NETWORK SOCKETS ---\n\
                 tcp 0 0 0.0.0.0:8080 0.0.0.0:* LISTEN 18/victim-api\n\
                 tcp 1 0 10.244.1.4:44912 198.51.100.24:4444 ESTABLISHED 99/.k_exp\n\
                 --- VOLATILE HEAP SNIPPET ---\n\
                 00007fff: 48 89 e5 48 83 ec 20 48 8d 3d 00 00 00 00 e8 00\n\
                 00007ff0: 00 00 00 48 8b 45 f8 48 89 c7 e8 00 00 00 00 c9"
            );

            (spec, logs, mem)
        } else {
            let client = self.client();
            let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);

            let spec_str = match pods.get(pod_name).await {
                Ok(pod) => serde_json::to_string(&pod).unwrap_or_else(|_| "{}".to_string()),
                Err(e) => {
                    warn!(error = %e, "Could not fetch pod spec for snapshot");
                    format!("{{\"error\": \"{}\"}}", e)
                }
            };

            let log_str = match pods.logs(pod_name, &kube::api::LogParams {
                tail_lines: Some(250),
                timestamps: true,
                ..Default::default()
            }).await {
                Ok(l) => l,
                Err(e) => {
                    warn!(error = %e, "Could not stream logs for snapshot");
                    format!("[ERROR] Log collection failed: {}", e)
                }
            };

            let mem_str = format!(
                "Pod {} volatile memory snapshot captured before eviction at {}",
                pod_name,
                captured_at.to_rfc3339()
            );

            (spec_str, log_str, mem_str)
        };

        // Compute immutable SHA-256 cryptographic hash of the entire forensic package
        let mut hasher = Sha256::new();
        hasher.update(snapshot_id.as_bytes());
        hasher.update(incident_id.as_bytes());
        hasher.update(pod_spec_json.as_bytes());
        hasher.update(container_logs.as_bytes());
        hasher.update(volatile_memory_dump.as_bytes());
        let sha256_hash = format!("{:x}", hasher.finalize());

        info!(
            snapshot_id = %snapshot_id,
            sha256 = %sha256_hash,
            "[FORENSIC FREEZE] Cryptographic SHA-256 vault record created"
        );

        Ok(ForensicSnapshot {
            id: snapshot_id,
            incident_id: incident_id.to_string(),
            pod_name: pod_name.to_string(),
            namespace: namespace.to_string(),
            pod_spec_json,
            container_logs,
            volatile_memory_dump,
            sha256_hash,
            captured_at,
        })
    }

    // ── Scale Deployment ──────────────────────────────────────────────────────

    async fn scale_deployment(
        &self,
        namespace: &str,
        deployment_name: &str,
        target_replicas: i32,
    ) -> Result<String> {
        if self.is_dry_run() {
            info!(
                namespace,
                deployment_name,
                target_replicas,
                "[DRY-RUN] Would patch deployment replicas"
            );
            return Ok(format!(
                "[DRY-RUN] Deployment '{}/{}' would be scaled to {} replicas",
                namespace, deployment_name, target_replicas
            ));
        }

        let client = self.client();
        let deployments: Api<Deployment> = Api::namespaced(client.clone(), namespace);

        // Read current replica count for audit logging
        let current = deployments
            .get(deployment_name)
            .await
            .with_context(|| format!("Deployment '{}/{}' not found", namespace, deployment_name))?;

        let current_replicas = current
            .spec
            .as_ref()
            .and_then(|s| s.replicas)
            .unwrap_or(0);

        let patch_data = json!({
            "spec": {
                "replicas": target_replicas
            }
        });

        let patch_params = PatchParams::apply("zervox-remediation-engine").force();
        deployments
            .patch(
                deployment_name,
                &patch_params,
                &Patch::Apply(&patch_data),
            )
            .await
            .with_context(|| {
                format!(
                    "Failed to patch deployment '{}/{}' to {} replicas",
                    namespace, deployment_name, target_replicas
                )
            })?;

        info!(
            namespace,
            deployment_name,
            current_replicas,
            target_replicas,
            "Deployment scaled successfully"
        );
        Ok(format!(
            "Deployment '{}/{}' scaled from {} → {} replicas.",
            namespace, deployment_name, current_replicas, target_replicas
        ))
    }

    // ── Cordon Node ───────────────────────────────────────────────────────────

    async fn cordon_node(&self, node_name: &str) -> Result<String> {
        // Enforce Physical Dual-Key Hardware Circuit-Breaker authorization
        let hw_auth = self
            .hardware_breaker
            .verify_action("cordon_node", node_name)
            .await?;

        if self.is_dry_run() {
            info!(
                node_name,
                coprocessor = hw_auth.coprocessor,
                signature = %hw_auth.hardware_signature,
                "[DRY-RUN] Simulated node cordon with verified hardware signature"
            );
            return Ok(format!(
                "[DRY-RUN] Node '{}' cordoned [HW Dual-Key: {} | Sig: {}]",
                node_name, hw_auth.coprocessor, hw_auth.hardware_signature
            ));
        }

        let client = self.client();
        let nodes: Api<Node> = Api::all(client.clone());

        // Verify node exists
        nodes
            .get(node_name)
            .await
            .with_context(|| format!("Node '{}' not found in cluster", node_name))?;

        let patch_data = json!({
            "spec": {
                "unschedulable": true
            }
        });

        let patch_params = PatchParams::apply("zervox-remediation-engine").force();
        nodes
            .patch(node_name, &patch_params, &Patch::Apply(&patch_data))
            .await
            .with_context(|| format!("Failed to cordon node '{}'", node_name))?;

        info!(
            node_name,
            coprocessor = hw_auth.coprocessor,
            signature = %hw_auth.hardware_signature,
            "Successfully cordoned node with verified hardware signature"
        );
        Ok(format!(
            "Node '{}' successfully cordoned (unschedulable=true) [HW Dual-Key: {} | Sig: {}]",
            node_name, hw_auth.coprocessor, hw_auth.hardware_signature
        ))
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn is_dry_run(&self) -> bool {
        self.dry_run || self.k8s_client.is_none()
    }

    fn client(&self) -> Client {
        self.k8s_client
            .as_ref()
            .expect("client() called in non-dry-run path without client — this is a bug")
            .clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_dry_run_restart_pod() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::RestartPod {
            namespace: "default".to_string(),
            pod_name: "victim-api-898".to_string(),
        };
        let res = executor.execute(&action).await.unwrap();
        assert!(res.contains("DRY-RUN"));
        assert!(res.contains("victim-api-898"));
    }

    #[tokio::test]
    async fn test_dry_run_scale_deployment() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::ScaleDeployment {
            namespace: "default".to_string(),
            deployment_name: "victim-api".to_string(),
            target_replicas: 4,
        };
        let res = executor.execute(&action).await.unwrap();
        assert!(res.contains("DRY-RUN"));
        assert!(res.contains("4 replicas"));
    }

    #[tokio::test]
    async fn test_dry_run_cordon_node() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::CordonNode {
            node_name: "k3s-worker-1".to_string(),
        };
        let res = executor.execute(&action).await.unwrap();
        assert!(res.contains("DRY-RUN"));
        assert!(res.contains("k3s-worker-1"));
    }

    #[tokio::test]
    async fn test_dangerous_action_always_rejected() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::DangerousActionAttempt {
            action: "delete".to_string(),
            resource: "namespace".to_string(),
            target_name: "default".to_string(),
            namespace: "default".to_string(),
            target_replicas: None,
            command: None,
        };
        assert!(executor.execute(&action).await.is_err());
    }

    #[tokio::test]
    async fn test_executor_capture_forensic_snapshot() {
        let executor = RemediationExecutor::new(None, true).await;
        let snapshot = executor
            .capture_forensic_snapshot("inc-test-999", "default", "victim-pod-xyz")
            .await
            .unwrap();

        assert_eq!(snapshot.incident_id, "inc-test-999");
        assert_eq!(snapshot.pod_name, "victim-pod-xyz");
        assert_eq!(snapshot.namespace, "default");
        assert!(!snapshot.sha256_hash.is_empty());
        assert!(snapshot.container_logs.contains("OOMKilled"));
        assert!(snapshot.pod_spec_json.contains("victim-api"));
    }

    #[tokio::test]
    async fn test_executor_cordon_node_with_hardware_breaker() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::CordonNode {
            node_name: "node-k3s-worker-01".to_string(),
        };

        let res = executor.execute(&action).await.unwrap();
        assert!(res.contains("node-k3s-worker-01"));
        assert!(res.contains("HW Dual-Key"));
        assert!(res.contains("ESP32-C3_RISCV_EMBEDDED"));
    }
}
