pub mod cli;
pub mod config;
pub mod monitor;
pub mod store;

pub fn run() -> anyhow::Result<()> {
    cli::run()
}
