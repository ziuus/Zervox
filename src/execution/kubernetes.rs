use anyhow::{Context, Result};
use k8s_openapi::api::apps::v1::Deployment;
use kube::{
    api::{Api, Patch, PatchParams},
    Client,
};

pub async fn restart_deployment(namespace: &str, deployment_name: &str) -> Result<()> {
    let client = Client::try_default().await.context("Failed to create K8s client")?;
    let deployments: Api<Deployment> = Api::namespaced(client, namespace);
    
    // Equivalent to `kubectl rollout restart deployment <name>`
    let patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "zervox/restartedAt": std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)?
                            .as_secs()
                            .to_string()
                    }
                }
            }
        }
    });

    deployments
        .patch(
            deployment_name,
            &PatchParams::apply("zervox").force(),
            &Patch::Apply(&patch),
        )
        .await?;

    Ok(())
}
