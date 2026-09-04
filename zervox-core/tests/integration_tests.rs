use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Instant;
use tempfile::NamedTempFile;
use tower::ServiceExt;
use zervox_core::config::AppConfig;
use zervox_core::create_app;
use zervox_core::executor::RemediationExecutor;
use zervox_core::llm::LlmAnalyzer;
use zervox_core::policy::PolicyEngine;
use zervox_core::status::AppState;
use zervox_core::store::SqliteStore;
use zervox_core::types::NodeRole;
use zervox_core::watchdog::Watchdog;

async fn setup_test_app(role: NodeRole, force_fallback: bool) -> (axum::Router, NamedTempFile) {
    let tmp_db = NamedTempFile::new().unwrap();
    let store = Arc::new(SqliteStore::new(tmp_db.path()).unwrap());
    let policy = PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string());
    let executor = RemediationExecutor::new(None, true).await;
    let llm = LlmAnalyzer::new(None, None, "gpt-4o-mini".to_string(), force_fallback);
    let watchdog = Watchdog::new(role, None);

    let config = AppConfig {
        role: role.to_string(),
        http_port: 8080,
        heartbeat_port: 9000,
        peer: None,
        api_key: "test-secret-key".to_string(),
        db_path: tmp_db.path().to_path_buf(),
        opa_url: "http://127.0.0.1:8181/v1/data/zervox/authz".to_string(),
        llm_url: None,
        llm_api_key: None,
        llm_model: "gpt-4o-mini".to_string(),
        force_fallback,
        dry_run: true,
        kubeconfig: None,
        tls_cert_path: None,
        tls_key_path: None,
    };

    let correlation = Arc::new(zervox_core::correlation::ThreatCorrelationEngine::default());

    let app_state = Arc::new(AppState {
        config,
        store,
        policy,
        executor,
        watchdog,
        start_time: Instant::now(),
        llm,
        correlation,
    });

    (create_app(app_state), tmp_db)
}

#[tokio::test]
async fn test_health_check_endpoint() {
    let (app, _db) = setup_test_app(NodeRole::Primary, true).await;

    let req = Request::builder()
        .uri("/healthz")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "healthy");
    assert_eq!(json["role"], "primary");
}

#[tokio::test]
async fn test_webhook_unauthorized_rejected() {
    let (app, _db) = setup_test_app(NodeRole::Primary, true).await;

    let payload = json!({
        "status": "firing",
        "alerts": []
    });

    let req = Request::builder()
        .method("POST")
        .uri("/api/grafana_webhook")
        .header("content-type", "application/json")
        .header("x-api-key", "wrong-key")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_webhook_pod_crash_fallback_remediation() {
    let (app, _db) = setup_test_app(NodeRole::Primary, true).await;

    let payload = json!({
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "PodCrashLooping",
                    "namespace": "default",
                    "pod": "victim-api-7b89-a1b2",
                    "severity": "critical"
                },
                "annotations": {
                    "summary": "Pod victim-api-7b89-a1b2 is restarting repeatedly"
                }
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri("/api/grafana_webhook")
        .header("content-type", "application/json")
        .header("x-api-key", "test-secret-key")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "processed");
    let results = json["results"].as_array().unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0]["alert_name"], "PodCrashLooping");
    assert_eq!(results[0]["mode"], "fallback");
    assert_eq!(results[0]["policy_allowed"], true);
    assert_eq!(results[0]["execution_status"], "resolved");
}

#[tokio::test]
async fn test_simulate_attack_blocked_by_policy() {
    let (app, _db) = setup_test_app(NodeRole::Primary, true).await;

    let payload = json!({
        "attack_type": "delete_namespace",
        "namespace": "default",
        "target_name": "default"
    });

    let req = Request::builder()
        .method("POST")
        .uri("/api/simulate_attack")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["blocked"], true);
    assert_eq!(json["policy_allowed"], false);
    assert_eq!(json["status"], "ATTACK_SUCCESSFULLY_BLOCKED_BY_OPA");
    let violations = json["policy_violations"].as_array().unwrap();
    assert!(violations.iter().any(|v| v
        .as_str()
        .unwrap()
        .contains("Namespace deletion is absolutely prohibited")));
}

#[tokio::test]
async fn test_system_status_endpoint() {
    let (app, _db) = setup_test_app(NodeRole::Primary, true).await;

    let req = Request::builder()
        .uri("/api/status")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["service"], "zervox-core");
    assert_eq!(json["role"], "primary");
    assert_eq!(json["state"], "active");
}

#[tokio::test]
async fn test_audit_webhook_endpoint() {
    let (app, _db) = setup_test_app(NodeRole::Primary, true).await;

    let payload = json!({
        "kind": "EventList",
        "apiVersion": "audit.k8s.io/v1",
        "items": [
            {
                "auditID": "audit-12345",
                "verb": "delete",
                "requestURI": "/api/v1/namespaces/default",
                "user": {
                    "username": "system:serviceaccount:default:intruder-sa"
                },
                "objectRef": {
                    "resource": "namespaces",
                    "name": "default"
                }
            },
            {
                "auditID": "audit-67890",
                "verb": "list",
                "requestURI": "/api/v1/secrets",
                "user": {
                    "username": "system:serviceaccount:default:intruder-sa"
                },
                "objectRef": {
                    "resource": "secrets"
                }
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/audit")
        .header("content-type", "application/json")
        .header("x-api-key", "test-secret-key")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "processed");
    assert_eq!(json["events_received"], 2);
    assert_eq!(json["threats_detected"], 2);

    let detections = json["detections"].as_array().unwrap();
    assert_eq!(detections.len(), 2);
    assert!(detections.iter().any(|d| d["signature_id"] == "SIG-DESTRUCTIVE-API"));
    assert!(detections.iter().any(|d| d["signature_id"] == "SIG-SECRET-SWEEP"));

    assert_eq!(json["escalated_count"], 1);
    let correlated = json["correlated_incidents"].as_array().unwrap();
    assert_eq!(correlated.len(), 1);
    assert_eq!(correlated[0]["tier"], "CRITICAL");
    assert_eq!(correlated[0]["total_score"], 110);
    assert_eq!(correlated[0]["actor"], "system:serviceaccount:default:intruder-sa");
    assert_eq!(correlated[0]["recommended_action"]["type"], "quarantine_workload");
}
