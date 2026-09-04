use proptest::prelude::*;
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;
use zervox_core::create_app;
use zervox_core::status::AppState;
use zervox_core::config::AppConfig;
use clap::Parser;
use zervox_core::executor::RemediationExecutor;
use zervox_core::llm::LlmAnalyzer;
use zervox_core::policy::PolicyEngine;
use zervox_core::store::SqliteStore;
use zervox_core::watchdog::Watchdog;
use zervox_core::types::NodeRole;
use std::sync::Arc;
use std::time::Instant;

fn build_test_app() -> axum::Router {
    let config = AppConfig::parse_from(vec!["zervox-core"]);
    let store = Arc::new(SqliteStore::new(":memory:").unwrap());
    let policy = PolicyEngine::new("http://127.0.0.1:8181/v1/data/zervox/authz".to_string());
    
    // Simulate dry run
    let executor = tokio::runtime::Runtime::new().unwrap().block_on(async {
        RemediationExecutor::new(None, true).await
    });
    
    let llm = LlmAnalyzer::new(None, None, "gpt-4o-mini".to_string(), true);
    let watchdog = Watchdog::new(NodeRole::Primary, None);
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

    create_app(app_state)
}

proptest! {
    #[test]
    fn fuzz_grafana_webhook_payloads(
        payload in "\\PC*",
        auth_header in "[a-zA-Z0-9_\\-]+"
    ) {
        let app = build_test_app();

        let req = Request::builder()
            .method("POST")
            .uri("/api/grafana_webhook")
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", auth_header))
            .body(Body::from(payload))
            .unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result: Result<(), proptest::test_runner::TestCaseError> = rt.block_on(async {
            let res = app.oneshot(req).await.unwrap();
            let status = res.status();
            prop_assert!(
                status == StatusCode::BAD_REQUEST || status == StatusCode::UNPROCESSABLE_ENTITY || status == StatusCode::UNPROCESSABLE_ENTITY || status == StatusCode::UNAUTHORIZED || status == StatusCode::OK,
                "Unexpected status code: {}", status
            );
            Ok(())
        });
        result?;
    }
}
