import fetch from 'node-fetch';
import Table from 'cli-table3';
import pc from 'picocolors';
import { spawn } from 'child_process';
import path from 'path';

const DAEMON_URL = `http://localhost:${process.env.ZERVOX_PORT || 4040}`;

export async function pingDaemon(): Promise<boolean> {
  try {
    const res = await fetch(`${DAEMON_URL}/api/ping`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function ensureDaemon() {
  const isUp = await pingDaemon();
  if (!isUp) {
    console.log(pc.gray('Spawning Zervox Daemon in background...'));
    const daemonPath = path.join(__dirname, 'daemon.js');
    const child = spawn('node', [daemonPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    // Wait for daemon to spin up
    await new Promise(r => setTimeout(r, 1500));
  }
}

export async function startProcess(file: string) {
  await ensureDaemon();
  try {
    const res = await fetch(`${DAEMON_URL}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file })
    });
    const data = await res.json();
    console.log(pc.green(`✓ Process ${file} started with ID: ${data.id}`));
  } catch (err) {
    console.error(pc.red(`Failed to start process: ${err}`));
  }
}

export async function listProcesses() {
  await ensureDaemon();
  try {
    const res = await fetch(`${DAEMON_URL}/api/list`);
    const processes: any[] = await res.json();

    const table = new Table({
      head: [pc.cyan('ID'), pc.cyan('File'), pc.cyan('Status'), pc.cyan('Restarts')],
      style: { head: [], border: [] }
    });

    processes.forEach(p => {
      let statusColor = p.status;
      if (p.status === 'online') statusColor = pc.green(p.status);
      else if (p.status === 'crashed') statusColor = pc.red(p.status);
      else statusColor = pc.yellow(p.status);

      table.push([p.id, p.file, statusColor, p.restarts.toString()]);
    });

    console.log(table.toString());
  } catch (err) {
    console.error(pc.red(`Failed to list processes: ${err}`));
  }
}

export async function stopProcess(id: string) {
  await ensureDaemon();
  try {
    const res = await fetch(`${DAEMON_URL}/api/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      console.log(pc.green(`✓ Process ${id} stopped.`));
    } else {
      console.log(pc.red(`✗ Failed to stop process ${id}.`));
    }
  } catch (err) {
    console.error(pc.red(`Failed to stop process: ${err}`));
  }
}
