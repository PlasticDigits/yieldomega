use eyre::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Create a connection pool and run pending migrations.
///
/// Migrations live in `indexer/migrations/` and are embedded at compile time
/// via `sqlx::migrate!()`.
pub async fn connect_and_migrate(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;

    tracing::info!("running pending migrations");
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
