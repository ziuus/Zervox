use crate::types::RemediationAction;
use anyhow::{Context, Result};
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Node, Pod};
use kube::api::{DeleteParams, Patch, PatchParams};
use kube::{Api, Client, Config};
use serde_json::json;
use std::path::PathBuf;
use tracing::{info, warn};

#[derive(Clone)]
pub struct RemediationExecutor {
    k8s_client: Option<Client>,
    dry_run: bool,
}

impl RemediationExecutor {
    pub async fn new(kubeconfig_path: Option<PathBuf>, dry_run: bool) -> Self {
        if dry_run {
            info!("RemediationExecutor initialized in DRY-RUN mode");
            return Self {
                k8s_client: None,
                dry_run: true,
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
        }
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
            RemediationAction::CordonNode { node_name } => {
                self.cordon_node(node_name).await
            }
            RemediationAction::NoAction { reason } => {
                info!(reason = %reason, "No remediation action performed");
                Ok(format!("No action taken: {}", reason))
            }
            RemediationAction::DangerousActionAttempt { action, resource, target_name, namespace, .. } => {
                anyhow::bail!(
                    "Attempted dangerous action '{}' on {}/{}/{} — execution rejected.",
                    action, resource, namespace, target_name
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
        Ok(format!("Pod '{}/{}' deleted (ReplicaSet will reschedule)", namespace, pod_name))
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
                deployment_name,
                target_replicas,
                "[DRY-RUN] Simulated deployment scaling"
            );
            return Ok(format!(
                "[DRY-RUN] Deployment '{}/{}' scaled to {} replicas",
                namespace, deployment_name, target_replicas
            ));
        }

        let client = self.k8s_client.as_ref().unwrap();
        let deployments: Api<Deployment> = Api::namespaced(client.clone(), namespace);

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
        if self.dry_run || self.k8s_client.is_none() {
            info!(node_name, "[DRY-RUN] Simulated node cordon");
            return Ok(format!("[DRY-RUN] Node '{}' cordoned", node_name));
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

        info!(node_name, "Successfully cordoned node");
        Ok(format!("Node '{}' successfully cordoned (unschedulable=true)", node_name))
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
}
