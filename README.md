<div align="center">
  <h1>🚀 Zervox AI</h1>
  <p><strong>The world's first autonomous AI Site Reliability Engineer (SRE).</strong></p>
  <p>Zervox is a PM2-style daemon that monitors your Node.js apps, catches crashes in real-time, and uses Google Gemini AI to analyze the stack trace and instantly apply a fix.</p>
</div>

---

## ✨ Features

- **PM2-Style Daemon**: Run multiple apps in the background. Zervox keeps them alive.
- **AI Crash Resolution**: When an app crashes, Zervox streams the exact error logs to an AI LLM to determine _why_ it failed and exactly _how_ to fix it.
- **Ultra-Premium Dashboard**: A beautifully designed, ultra-dark glassmorphic web dashboard to monitor your fleet of Node processes in real-time.
- **Self-Healing Execution**: Zervox doesn't just suggest fixes; it can automatically run the terminal commands to resolve the issue (e.g., clearing a hanging port or installing a missing dependency) and restart the app.
- **Slack/Discord Integration**: Get pinged instantly with a human-readable summary of why the server went down.

## 🛠️ Quick Start

### 1. Install Globally

Install Zervox via NPM so you can use it anywhere on your machine.
\`\`\`bash
npm install -g zervox-agent
\`\`\`

_(Note: Currently in beta. Clone this repo, `npm run build`, and `npm link` to run locally)._

### 2. Set your AI Key

Zervox needs a free Google Gemini key to analyze crashes.
\`\`\`bash
export GEMINI_API_KEY="your_api_key_here"
\`\`\`

### 3. Start your Apps

Instead of running `node server.js` or `pm2 start server.js`, let Zervox take the wheel:
\`\`\`bash
zervox start server.js
zervox start worker.js
\`\`\`

### 4. Open the Dashboard

Check on your fleet by opening the local dashboard:
**[http://localhost:4040](http://localhost:4040)**

### 5. Manage Processes

\`\`\`bash
$ zervox list
┌────────┬────────────┬─────────┬──────────┐
│ ID │ File │ Status │ Restarts │
├────────┼────────────┼─────────┼──────────┤
│ c0yjs6 │ server.js │ online │ 0 │
│ hb0ptr │ worker.js │ crashed │ 0 │
└────────┴────────────┴─────────┴──────────┘

$ zervox stop c0yjs6
\`\`\`

## 🧠 How it Works

1. Zervox spawns your application as a child process and pipes `stdout` and `stderr`.
2. A centralized Daemon (`port 4040`) tracks all running processes and serves the React-like glass UI.
3. If a process exits with code `1` or throws an `Error:`, Zervox kills it and captures the last 50 lines of logs.
4. The logs are sent to the `@google/genai` API with a strict structural prompt.
5. Zervox prompts you (in the CLI or Dashboard) to approve the AI's suggested CLI command to fix the bug.
6. Zervox executes the fix, clears the logs, and restarts the process.

## 💼 Enterprise & Teams (Coming Soon)

We are building **Zervox Cloud**, a centralized control plane for teams managing 100s of servers.

- Stream logs from all your VPS/EC2 instances to a single global dashboard.
- Advanced Claude 3.5 Sonnet integrations.
- Auto-revert functionalities.

**[Join the Waitlist (Link Coming Soon)](#)**

## 🤝 Contributing

Pull requests are welcome! If you want to add support for Python apps, Go binaries, or new LLM providers, open an issue.

## 📄 License

MIT
