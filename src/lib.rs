pub mod autofix;
pub mod cli;
pub mod config;
pub mod monitor;
pub mod runtime;
pub mod store;
pub mod supervisor;
pub mod systemd;
pub mod web;
pub mod models;
pub mod analysis;
pub mod recommend;
pub mod interface;
pub mod ingestion;
pub mod execution;

pub fn run() -> anyhow::Result<()> {
    cli::run()
}
