use crate::types::RemediationAction;
use anyhow::{Context, Result};
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Node, Pod};
use kube::api::{DeleteParams, Patch, PatchParams};
use kube::{Api, Client, Config};
use serde_json::json;
use std::path::PathBuf;
use tracing::{info, warn};

/// Production Kubernetes executor using kube-rs.
///
/// All three real operations:
///   - `restart_pod`       → Pod delete; ReplicaSet spawns a replacement
///   - `scale_deployment`  → Strategic merge patch on spec.replicas
///   - `cordon_node`       → Strategic merge patch unschedulable=true on Node
///
/// In DRY-RUN mode or when no kubeconfig is available, all operations
/// log and return a descriptive success string without touching the cluster.
#[derive(Clone)]
pub struct RemediationExecutor {
    k8s_client: Option<Client>,
    dry_run: bool,
}

impl RemediationExecutor {
    pub async fn new(kubeconfig_path: Option<PathBuf>, dry_run: bool) -> Self {
        if dry_run {
            info!("RemediationExecutor initialized in DRY-RUN mode — no real K8s calls");
            return Self {
                k8s_client: None,
                dry_run: true,
            };
        }

        match Self::build_kube_client(kubeconfig_path).await {
            Ok(client) => {
                info!("Kubernetes API client connected successfully");
                Self {
                    k8s_client: Some(client),
                    dry_run: false,
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
                }
            }
        }
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
                .context("Cannot infer Kubernetes client config from environment")?
        };

        Client::try_from(config).context("Failed to build Kubernetes client from config")
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
            RemediationAction::RestartPod { namespace, pod_name } => {
                self.restart_pod(namespace, pod_name).await
            }
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
        if self.is_dry_run() {
            info!(node_name, "[DRY-RUN] Would cordon node (unschedulable=true)");
            return Ok(format!("[DRY-RUN] Node '{}' would be cordoned", node_name));
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

        info!(node_name, "Node cordoned (unschedulable=true)");
        Ok(format!(
            "Node '{}' cordoned successfully (unschedulable=true).",
            node_name
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
}
