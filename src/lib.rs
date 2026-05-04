pub mod cli;
pub mod config;
pub mod monitor;
pub mod runtime;
pub mod store;
pub mod supervisor;
pub mod systemd;

pub fn run() -> anyhow::Result<()> {
    cli::run()
}
