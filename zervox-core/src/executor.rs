use crate::types::{ForensicSnapshot, RemediationAction};
use anyhow::{Context, Result};
use chrono::Utc;
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Node, Pod};
use kube::api::{DeleteParams, Patch, PatchParams};
use kube::{Api, Client, Config};
use serde_json::json;
use sha2::{Digest, Sha256};
use crate::hardware_key::HardwareCircuitBreaker;
use std::path::PathBuf;
use tracing::{info, warn};
use uuid::Uuid;

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
            info!("RemediationExecutor initialized in DRY-RUN mode");
            return Self {
                k8s_client: None,
                dry_run: true,
                hardware_breaker,
            };
        }

        let client = match Self::init_kube_client(kubeconfig_path).await {
            Ok(c) => {
                info!("Successfully connected to Kubernetes API cluster");
                Some(c)
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "Could not connect to Kubernetes API; operating in simulated dry-run mode"
                );
                None
            }
        };

        Self {
            k8s_client: client,
            dry_run,
            hardware_breaker,
        }
    }

    pub fn with_hardware_breaker(mut self, breaker: HardwareCircuitBreaker) -> Self {
        self.hardware_breaker = breaker;
        self
    }

    async fn init_kube_client(kubeconfig_path: Option<PathBuf>) -> Result<Client> {
        let config = if let Some(path) = kubeconfig_path {
            let kubeconfig = kube::config::Kubeconfig::read_from(path)
                .context("Failed to read specified kubeconfig file")?;
            Config::from_custom_kubeconfig(kubeconfig, &kube::config::KubeConfigOptions::default())
                .await
                .context("Failed to parse custom kubeconfig")?
        } else {
            // Attempt standard infer from env / ~/.kube/config
            Config::infer()
                .await
                .context("Failed to infer kubeconfig from environment")?
        };

        Client::try_from(config).context("Failed to create Kube Client from config")
    }

    pub fn is_connected(&self) -> bool {
        self.k8s_client.is_some() && !self.dry_run
    }

    /// Execute the approved remediation action against the cluster
    pub async fn execute(&self, action: &RemediationAction) -> Result<String> {
        info!(
            action = action.action_type(),
            target = %action.target_resource(),
            dry_run = self.dry_run || self.k8s_client.is_none(),
            "Executing remediation action"
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
                info!(reason = %reason, "No remediation action performed");
                Ok(format!("No action taken: {}", reason))
            }
            RemediationAction::DangerousActionAttempt {
                action,
                resource,
                target_name,
                namespace,
                ..
            } => {
                anyhow::bail!(
                    "Attempted dangerous action '{}' on {}/{}/{} — execution rejected.",
                    action,
                    resource,
                    namespace,
                    target_name
                );
            }
        }
    }

    async fn restart_pod(&self, namespace: &str, pod_name: &str) -> Result<String> {
        if self.dry_run || self.k8s_client.is_none() {
            info!(
                namespace,
                pod_name, "[DRY-RUN] Simulated pod deletion/restart"
            );
            return Ok(format!(
                "[DRY-RUN] Pod '{}/{}' deleted to trigger restart",
                namespace, pod_name
            ));
        }

        let client = self.k8s_client.as_ref().unwrap();
        let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);

        // Delete pod so ReplicaSet spawns a new one
        pods.delete(pod_name, &DeleteParams::default())
            .await
            .with_context(|| format!("Failed to delete pod '{}/{}'", namespace, pod_name))?;

        info!(namespace, pod_name, "Successfully deleted pod for restart");
        Ok(format!(
            "Pod '{}/{}' deleted (ReplicaSet will reschedule)",
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
                    "labels": {
                        "app": "victim-api",
                        "security.zervox.io/quarantine": "pending"
                    },
                    "uid": Uuid::new_v4().to_string(),
                    "creationTimestamp": captured_at.to_rfc3339()
                },
                "spec": {
                    "containers": [{
                        "name": "victim-api",
                        "image": "python:3.11-slim",
                        "command": ["python3", "-c", "import os, sys, time\nprint('Memory leak starting...')\na = []\nwhile True:\n  a.append(' ' * 1024 * 1024)\n  time.sleep(0.1)"],
                        "resources": {
                            "limits": { "memory": "64Mi" }
                        }
                    }]
                },
                "status": {
                    "phase": "Running",
                    "containerStatuses": [{
                        "name": "victim-api",
                        "restartCount": 5,
                        "state": {
                            "waiting": {
                                "reason": "CrashLoopBackOff",
                                "message": "Back-off 5m0s restarting failed container=victim-api pod=victim-api"
                            }
                        }
                    }]
                }
            }).to_string();

            let logs = format!(
                "[CRASH_LOG] Container victim-api crashed with OOMKilled (Exit Code 137)\n\
                 [STACK_TRACE] Traceback (most recent call last):\n\
                   File \"<string>\", line 5, in <module>\n\
                 MemoryError: Out of memory (exceeded limit: 64MiB)\n\
                 [SECURITY_AUDIT] Anomaly detected: exponential allocation pattern prior to termination\n\
                 [CAPTURED_AT] {}",
                captured_at.to_rfc3339()
            );

            let memory_dump = format!(
                "PID 1 (victim-api): RSS 65536 kB, VSIZE 131072 kB\n\
                 THREAD DUMP:\n\
                   Thread 0x7f9a123: [RUNNING] allocation loop in bytecode eval\n\
                 OPEN DESCRIPTORS:\n\
                   0: /dev/null\n\
                   1: pipe:[189234]\n\
                   2: pipe:[189235]\n\
                 NETWORK CONNECTIONS:\n\
                   TCP 10.42.0.15:8080 ESTABLISHED (remote: 10.42.0.1:443)\n\
                 EVIDENCE INTEGRITY: SYNTHESIZED_DRYRUN_VAULT"
            );

            (spec, logs, memory_dump)
        } else {
            let client = self.k8s_client.as_ref().unwrap();
            let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);

            let pod_obj = pods.get(pod_name).await.unwrap_or_default();
            let spec = serde_json::to_string_pretty(&pod_obj).unwrap_or_else(|_| "{}".to_string());

            let log_params = kube::api::LogParams {
                tail_lines: Some(250),
                timestamps: true,
                ..Default::default()
            };
            let logs = pods.logs(pod_name, &log_params).await.unwrap_or_else(|e| format!("Failed to read live logs: {}", e));

            let memory_dump = format!(
                "LIVE CLUSTER FORENSICS:\n\
                 Pod UID: {:?}\n\
                 Node: {:?}\n\
                 IP: {:?}\n\
                 Status: {:?}\n\
                 Evidence snapshot captured by Zervox Out-Of-Band Agent.",
                pod_obj.metadata.uid,
                pod_obj.spec.as_ref().and_then(|s| s.node_name.clone()),
                pod_obj.status.as_ref().and_then(|s| s.pod_ip.clone()),
                pod_obj.status.as_ref().and_then(|s| s.phase.clone()),
            );

            (spec, logs, memory_dump)
        };

        // Compute cryptographic SHA-256 integrity hash
        let mut hasher = Sha256::new();
        hasher.update(snapshot_id.as_bytes());
        hasher.update(incident_id.as_bytes());
        hasher.update(namespace.as_bytes());
        hasher.update(pod_name.as_bytes());
        hasher.update(pod_spec_json.as_bytes());
        hasher.update(container_logs.as_bytes());
        hasher.update(volatile_memory_dump.as_bytes());
        let sha256_hash = format!("{:x}", hasher.finalize());

        info!(
            snapshot_id = %snapshot_id,
            sha256 = %sha256_hash,
            "[FORENSIC FREEZE] Evidence snapshot cryptographically locked and hashed"
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

    async fn scale_deployment(
        &self,
        namespace: &str,
        deployment_name: &str,
        target_replicas: i32,
    ) -> Result<String> {
        if self.dry_run || self.k8s_client.is_none() {
            info!(
                namespace,
                deployment_name, target_replicas, "[DRY-RUN] Simulated deployment scaling"
            );
            return Ok(format!(
                "[DRY-RUN] Deployment '{}/{}' scaled to {} replicas",
                namespace, deployment_name, target_replicas
            ));
        }

        let client = self.k8s_client.as_ref().unwrap();
        let deployments: Api<Deployment> = Api::namespaced(client.clone(), namespace);

        match deployments.get(deployment_name).await {
            Ok(_) => {}
            Err(kube::Error::Api(e)) if e.code == 404 => {
                let msg = format!(
                    "Target deployment '{}/{}' not found in cluster. Dropping action to prevent hallucinated scale panic.",
                    namespace, deployment_name
                );
                warn!("{}", msg);
                return Ok(msg);
            }
            Err(e) => {
                anyhow::bail!(
                    "Failed to get deployment '{}/{}': {}",
                    namespace, deployment_name, e
                );
            }
        }

        let patch_data = json!({
            "spec": {
                "replicas": target_replicas
            }
        });

        let patch_params = PatchParams::apply("zervox-remediation-engine");
        deployments
            .patch(deployment_name, &patch_params, &Patch::Merge(&patch_data))
            .await
            .with_context(|| {
                format!(
                    "Failed to patch deployment '{}/{}' replicas to {}",
                    namespace, deployment_name, target_replicas
                )
            })?;

        info!(
            namespace,
            deployment_name, target_replicas, "Successfully scaled deployment"
        );
        Ok(format!(
            "Deployment '{}/{}' successfully scaled to {} replicas",
            namespace, deployment_name, target_replicas
        ))
    }

    async fn cordon_node(&self, node_name: &str) -> Result<String> {
        // Enforce Physical Dual-Key Hardware Circuit-Breaker authorization
        let hw_auth = self
            .hardware_breaker
            .verify_action("cordon_node", node_name)
            .await?;

        if self.dry_run || self.k8s_client.is_none() {
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

        let client = self.k8s_client.as_ref().unwrap();
        let nodes: Api<Node> = Api::all(client.clone());

        let patch_data = json!({
            "spec": {
                "unschedulable": true
            }
        });

        let patch_params = PatchParams::apply("zervox-remediation-engine");
        nodes
            .patch(node_name, &patch_params, &Patch::Merge(&patch_data))
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_executor_dry_run_restart_pod() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::RestartPod {
            namespace: "default".to_string(),
            pod_name: "victim-api-898".to_string(),
        };

        let res = executor.execute(&action).await.unwrap();
        assert!(res.contains("victim-api-898"));
        assert!(res.contains("deleted"));
    }

    #[tokio::test]
    async fn test_executor_dry_run_scale_deployment() {
        let executor = RemediationExecutor::new(None, true).await;
        let action = RemediationAction::ScaleDeployment {
            namespace: "default".to_string(),
            deployment_name: "victim-api".to_string(),
            target_replicas: 4,
        };

        let res = executor.execute(&action).await.unwrap();
        assert!(res.contains("scaled to 4 replicas"));
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

