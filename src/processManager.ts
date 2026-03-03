import { spawn, ChildProcess } from 'child_process';
import pc from 'picocolors';
import { EventEmitter } from 'events';
import { AIAnalyzer } from './aiAnalyzer';
import { Executor } from './executor';
import fetch from 'node-fetch';

export class ProcessManager extends EventEmitter {
  public id: string;
  public file: string;
  public status: 'online' | 'crashed' | 'stopped' = 'stopped';
  public restarts: number = 0;
  public recentLogs: string[] = [];
  public lastCrash: any = null;
  
  private process: ChildProcess | null = null;

  constructor(id: string, file: string) {
    super();
    this.id = id;
    this.file = file;
  }

  start() {
    console.log(pc.gray(`[Zervox] Spawning process: node ${this.file}`));
    this.status = 'online';
    
    this.process = spawn('node', [this.file], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(`[${this.file}] ` + text);
        this.bufferLog(text);
        this.emit('log', text);
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        const text = data.toString();
        process.stderr.write(`[${this.file}] [ERROR] ` + text);
        this.bufferLog(text);
        this.emit('log', `[ERROR] ${text}`);
        
        // Basic error detection heuristics
        if (this.detectError(text)) {
          this.handleCrash(text);
        }
      });
    }

    this.process.on('close', (code, signal) => {
      console.log(pc.gray(`[Zervox] Process exited with code ${code} signal ${signal}`));
      if (this.status === 'crashed') return;

      if (code !== 0 && code !== null) {
        this.handleCrash(`Process exited with non-zero code: ${code}`);
      } else {
        this.status = 'stopped';
        this.emit('exit');
      }
    });
  }

  private bufferLog(text: string) {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    this.recentLogs.push(...lines);
    // Keep last 50 lines for context
    if (this.recentLogs.length > 50) {
      this.recentLogs = this.recentLogs.slice(this.recentLogs.length - 50);
    }
  }

  private detectError(text: string): boolean {
    const errorKeywords = ['Error:', 'Exception', 'Trace:', 'EADDRINUSE'];
    return errorKeywords.some(keyword => text.includes(keyword));
  }

  private async handleCrash(triggerReason: string) {
    if (this.status === 'crashed') return; // Prevent loop
    this.status = 'crashed';
    
    console.log('\n' + pc.bgRed(pc.white(' 🚨 CRASH DETECTED ')) + ' ' + pc.red('Intercepting log stream...'));
    console.log(pc.yellow(`Reason: ${triggerReason}`));
    
    if (this.process) {
      this.process.kill();
    }

    const analyzer = new AIAnalyzer();
    const solutions = await analyzer.analyzeError([...this.recentLogs]);

    this.lastCrash = { reason: triggerReason, solutions };
    this.emit('crash', this.lastCrash);
  }

  public async applySolutionAndRestart(solution: any, executor: Executor) {
    console.log(pc.green(`\n[Zervox] Applying fix: ${solution.description}`));
    await (executor as any).applySolution(solution);
    console.log(pc.green('\n🔄 Restarting process after fix...\n'));
    this.restarts++;
    this.recentLogs = [];
    this.lastCrash = null;
    this.start();
  }

  public stop() {
    this.status = 'stopped';
    if (this.process) {
      this.process.kill();
    }
  }

  private async sendNotification(url: string, reason: string, solutions: any[]) {
    console.log(pc.cyan(`\n[Zervox] Sending notification to ${url}...`));
    try {
      const body = {
        text: `🚨 *Zervox Alert: Crash Detected*\n*Reason:* ${reason}\n*AI Solutions:* \n${solutions.map(s => `- ${s.description}`).join('\n')}`
      };
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      console.log(pc.green('[Zervox] Notification sent successfully.'));
    } catch (error) {
      console.error(pc.red('[Zervox] Failed to send notification:'), error);
    }
  }
}
