import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { ProcessManager } from './processManager';
import pc from 'picocolors';
import { Executor } from './executor';
import fetch from 'node-fetch';

export type AgentMode = 'INTERACTIVE' | 'AUTO_FIX' | 'NOTIFY_ONLY';
export interface AgentConfig {
  mode: AgentMode;
  webhookUrl: string;
}

const app = express();
app.use(express.json());
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

const processes: Map<string, ProcessManager> = new Map();
let config: AgentConfig = { mode: 'INTERACTIVE', webhookUrl: '' };

function broadcastLog(id: string, file: string, line: string) {
  io.emit('log', { id, file, line });
}

function broadcastCrash(id: string, file: string, reason: string, solutions: any[]) {
  io.emit('crash', { id, file, reason, solutions });
}

io.on('connection', (socket) => {
  console.log(pc.gray(`[Daemon] Client connected to Dashboard: ${socket.id}`));
  
  socket.emit('config_update', config);
  
  const activeProcesses = Array.from(processes.values()).map(p => ({
    id: p.id,
    file: p.file,
    status: p.status,
    restarts: p.restarts
  }));
  socket.emit('init_state', { processes: activeProcesses });

  socket.on('get_process_details', (id: string) => {
    const manager = processes.get(id);
    if (manager) {
      socket.emit('process_details', {
        id,
        logs: manager.recentLogs,
        lastCrash: manager.lastCrash
      });
    }
  });

  socket.on('update_config', (newConfig: Partial<AgentConfig>) => {
    config = { ...config, ...newConfig };
    console.log(pc.cyan(`\n[Daemon] Agent configuration updated:`), config);
    io.emit('config_update', config);
  });

  socket.on('apply_solution', async (data: { processId: string, solutionId: number, solution: any }) => {
    const { processId, solution } = data;
    const manager = processes.get(processId);
    if (manager) {
      console.log(pc.cyan(`\n[Web] User selected fix for process ${processId}: ${solution.description}`));
      const executor = new Executor();
      await manager.applySolutionAndRestart(solution, executor);
      io.emit('process_update', { id: manager.id, status: manager.status, restarts: manager.restarts });
    }
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/start', (req, res) => {
  const { file } = req.body;
  const id = Math.random().toString(36).substring(2, 8);
  const manager = new ProcessManager(id, file);
  processes.set(id, manager);

  manager.on('log', (line) => {
    broadcastLog(id, file, line);
  });

  manager.on('crash', async ({ reason, solutions }) => {
    broadcastCrash(id, file, reason, solutions);
    io.emit('process_update', { id: manager.id, status: manager.status, restarts: manager.restarts });

    if (config.webhookUrl) {
      try {
        const body = {
          text: `🚨 *Zervox Alert: Crash Detected in ${file}*\n*Reason:* ${reason}\n*AI Solutions:* \n${solutions.map((s: any) => `- ${s.description}`).join('\n')}`
        };
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch (err) {}
    }

    if (config.mode === 'AUTO_FIX' && solutions.length > 0) {
      console.log(pc.green(`\n[Daemon] Mode: AUTO_FIX. Applying best fix to ${id}`));
      const executor = new Executor();
      await manager.applySolutionAndRestart(solutions[0], executor);
      io.emit('process_update', { id: manager.id, status: manager.status, restarts: manager.restarts });
    } else if (config.mode === 'NOTIFY_ONLY') {
      console.log(pc.yellow(`\n[Daemon] Mode: NOTIFY_ONLY. Process ${id} stays crashed.`));
    }
  });

  manager.on('exit', () => {
    io.emit('process_update', { id: manager.id, status: manager.status, restarts: manager.restarts });
  });

  manager.start();
  io.emit('process_new', { id, file, status: manager.status, restarts: manager.restarts });
  
  res.json({ id, file, status: manager.status });
});

app.get('/api/list', (req, res) => {
  const list = Array.from(processes.values()).map(p => ({
    id: p.id,
    file: p.file,
    status: p.status,
    restarts: p.restarts
  }));
  res.json(list);
});

app.post('/api/stop', (req, res) => {
  const { id } = req.body;
  const manager = processes.get(id);
  if (!manager) return res.status(404).json({ error: 'Process not found' });
  
  manager.stop();
  io.emit('process_update', { id: manager.id, status: manager.status, restarts: manager.restarts });
  res.json({ success: true, id });
});

const PORT = process.env.ZERVOX_PORT || 4040;
server.listen(PORT, () => {
  console.log(pc.magenta(`\n🤖 Zervox Daemon running on port ${PORT}`));
});
