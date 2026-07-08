use eyre::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Create a connection pool and run pending migrations.
///
/// Migrations live in `indexer/migrations/` and are embedded at compile time
/// via `sqlx::migrate!()`.
pub async fn connect_and_migrate(database_url: &str, max_connections: u32) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .connect(database_url)
        .await?;

    tracing::info!(max_connections, "postgres connection pool ready");
    tracing::info!("running pending migrations");
    sqlx::migrate!("./migrations").run(&pool).await?;
    crate::arena_defended_streak::backfill_if_needed(&pool).await?;

    Ok(pool)
}
