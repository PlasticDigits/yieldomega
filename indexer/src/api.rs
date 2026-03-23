//! HTTP API (axum).
//!
//! Exposes paginated, versioned endpoints for the frontend and autonomous
//! agents. Schema version is returned in a response header.
//!
//! **Stub:** routes return placeholder JSON until event tables exist.

use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use sqlx::PgPool;

/// Current API schema version — bump when response shapes change.
const SCHEMA_VERSION: &str = "0.0.0-stub";

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/status", get(status))
        // Future routes (stubbed topics from design.md):
        // .route("/v1/timecurve/sales", get(todo))
        // .route("/v1/timecurve/buys", get(todo))
        // .route("/v1/rabbit/epochs", get(todo))
        // .route("/v1/rabbit/deposits", get(todo))
        // .route("/v1/leprechauns", get(todo))
        .with_state(state)
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn status(State(state): State<AppState>) -> impl IntoResponse {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();

    let body = serde_json::json!({
        "schema_version": SCHEMA_VERSION,
        "database_connected": db_ok,
        "note": "Event endpoints are stubs — contract ABIs required."
    });

    (StatusCode::OK, Json(body))
}
