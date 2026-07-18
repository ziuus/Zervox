/* ============================================================
   Zervox — Single-Page Application Router + Content
   ============================================================ */
(function () {
  'use strict';

  const CONTENT = {};

  /* ---- Shared: render a markdown-like block ---- */
  function h(level, text) { return `<h${level}>${text}</h${level}>`; }
  function p(text) { return `<p>${text}</p>`; }
  function code(text) { return `<code>${text}</code>`; }
  function pre(text) { return `<pre><code>${text}</code></pre>`; }
  function li(text) { return `<li>${text}</li>`; }
  function ul(items) { return `<ul>${items.map(li).join('')}</ul>`; }
  function note(text) { return `<div class="note">${text}</div>`; }
  function hr() { return '<hr>'; }

  /* ================ HOME ================ */
  CONTENT.home = `
    <section class="hero">
      <div class="hero-badge">✦ v0.1.0 — Open Source</div>
      <h1>Autonomous AI<br><span class="gradient">Site Reliability Engineer</span></h1>
      <p>Zervox watches your processes, detects crashes in real-time, runs AI-powered root cause analysis, and auto-fixes dependency issues — all locally, privately, in Rust.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" onclick="Zervox.navigate('docs')">Get Started →</a>
        <a class="btn btn-ghost" href="https://github.com/ziuus/Zervox" target="_blank">GitHub ↗</a>
      </div>
      <div class="hero-screenshot">
        <img src="img/dashboard-screenshot.png" alt="Zervox Dashboard preview" loading="lazy">
        <div class="screenshot-caption">Live dashboard — real-time process monitoring, crash detection, and AI diagnostics</div>
      </div>
    </section>

    <section class="terminal-demo">
      <h2 class="section-title">One binary, one command</h2>
      <p class="section-subtitle">No runtime deps. No config files. Just install and go.</p>
      <div class="terminal-window">
        <div class="terminal-header">
          <span class="terminal-dot red"></span>
          <span class="terminal-dot yellow"></span>
          <span class="terminal-dot green"></span>
          <span class="terminal-title">zervox start -- node server.js</span>
        </div>
        <div class="terminal-body">
          <span class="prompt">$</span> <span class="cmd">zervox start --cwd ./myapp --auto-fix -- node server.js</span>
          <div class="term-line"><span class="dim">[supervisor]</span> starting child: node server.js</div>
          <div class="term-line"><span class="dim">[supervisor]</span> child pid=14237 status=online</div>
          <div class="term-line spacer"></div>
          <div class="term-line"><span class="dim">[stderr]</span> <span class="err">Error: Cannot find module 'express'</span></div>
          <div class="term-line"><span class="dim">[supervisor]</span> <span class="highlight">crash detected — running diagnostics...</span></div>
          <div class="term-line spacer"></div>
          <div class="term-line"><span class="dim">[auto-fix]</span> <span class="ok">✓ detected missing package: express</span></div>
          <div class="term-line"><span class="dim">[auto-fix]</span> <span class="ok">✓ running: npm install express</span></div>
          <div class="term-line"><span class="dim">[auto-fix]</span> <span class="ok">✓ install complete — restarting</span></div>
          <div class="term-line spacer"></div>
          <div class="term-line"><span class="dim">[supervisor]</span> child pid=14289 status=online</div>
          <span class="prompt">$</span> <span class="cmd blink">▊</span>
        </div>
      </div>
    </section>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(59,130,246,0.12);color:var(--accent-blue);">🛡</div>
        <h3>Auto-Restart & Supervision</h3>
        <p>Automatic crash detection, configurable restart limits, and exponential backoff. Your processes stay up without manual intervention.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(139,92,246,0.12);color:var(--accent-purple);">🧠</div>
        <h3>AI-Powered Diagnostics</h3>
        <p>When a crash occurs, Zervox analyzes the last 50 log lines via AI, identifies the root cause, and suggests precise fix commands.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(16,185,129,0.12);color:var(--accent-green);">🔧</div>
        <h3>Auto-Fix Dependency Issues</h3>
        <p>Scans crash logs for "Cannot find module" patterns, detects the missing package, verifies it's declared in package.json, and runs the correct install command.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(245,158,11,0.12);color:var(--accent-amber);">📊</div>
        <h3>Real-Time Dashboard</h3>
        <p>Web-based dashboard with Socket.IO live updates. View process status, tail logs, and apply AI-suggested fixes with one click.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(59,130,246,0.12);color:var(--accent-blue);">⚡</div>
        <h3>7KB Binary — Written in Rust</h3>
        <p>Single lean binary with zero runtime dependencies. Installs in seconds, uses minimal memory, and integrates with systemd for permanent supervision.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(139,92,246,0.12);color:var(--accent-purple);">🔌</div>
        <h3>Systemd Integration</h3>
        <p>Generate systemd user services from any tracked process. Zervox manages itself so your apps survive reboots and crashes transparently.</p>
      </div>
    </div>

    <h2 class="section-title">How It Works</h2>
    <p class="section-subtitle">From crash to fix in seconds — fully autonomous.</p>

    <div class="steps">
      <div class="step">
        <div class="step-number">1</div>
        <h3>Watch</h3>
        <p>Zervox monitors your Node.js or shell processes. Every crash is captured with the last 80 lines of logs.</p>
      </div>
      <div class="step">
        <div class="step-number">2</div>
        <h3>Diagnose</h3>
        <p>AI analysis identifies the root cause — missing modules, port conflicts, syntax errors, or permissions issues.</p>
      </div>
      <div class="step">
        <div class="step-number">3</div>
        <h3>Fix</h3>
        <p>Auto-applies safe repairs: npm/bun/pnpm install for missing dependencies. Or approve AI-suggested fixes from the dashboard.</p>
      </div>
      <div class="step">
        <div class="step-number">4</div>
        <h3>Restart</h3>
        <p>Zero-downtime restart with configurable delay and max retry count. Integrated with systemd for permanent reliability.</p>
      </div>
    </div>

    <section class="cta-section">
      <h2>Ready to ship reliable software?</h2>
      <p>Install Zervox in seconds and never manually restart a crashed process again.</p>
      <div class="cta-actions">
        <a class="btn btn-primary" onclick="Zervox.navigate('docs')">Read the Docs</a>
        <a class="btn btn-ghost" onclick="Zervox.navigate('pricing')">View Pricing</a>
      </div>
    </section>
  `;

  /* ================ DOCS ================ */

  const DOC_PAGES = {
    'getting-started': {
      title: 'Getting Started',
      body: `
        <h1>Getting Started with Zervox</h1>
        <p>Zervox is a Rust-based watchdog daemon that monitors your Node.js and shell processes, detects crashes, runs AI-powered root cause analysis, and can auto-fix dependency issues.</p>

        <h2>Installation</h2>
        <pre><code># Install from source
git clone https://github.com/ziuus/Zervox
cd Zervox
cargo install --path .

# Or download a pre-built binary from GitHub Releases</code></pre>

        <h2>Quick Start</h2>
        <p>Watch a Node.js app with automatic restart:</p>
        <pre><code>zervox start -- node server.js</code></pre>
        <p>Or from a specific directory with auto-fix enabled:</p>
        <pre><code>zervox start --cwd /path/to/project --max-restarts 5 --auto-fix -- node server.js</code></pre>

        <h2>Add as a Background Service</h2>
        <pre><code># Add the process to the tracked list
zervox add --name myapp --cwd /path/to/project -- node server.js

# Start supervising in the background
zervox start myapp

# Check status
zervox status myapp</code></pre>

        <h2>Open the Dashboard</h2>
        <pre><code>zervox web</code></pre>
        <p>Opens the web dashboard at <code>http://127.0.0.1:3000</code> with real-time process monitoring and AI diagnostics.</p>

        <div class="note">
          <strong>Tip:</strong> Use <code>zervox help</code> to see all available commands and flags.
        </div>
      `
    },
    'cli-reference': {
      title: 'CLI Reference',
      body: `
        <h1>CLI Reference</h1>
        <p>Zervox is controlled entirely through a single binary. All commands follow <code>zervox &lt;command&gt; [options] [-- command to watch]</code>.</p>

        <hr>

        <h2>zervox start</h2>
        <p>Start supervising a command with auto-restart on crash.</p>
        <pre><code>zervox start [OPTIONS] -- &lt;COMMAND&gt;

Options:
  --cwd &lt;PATH&gt;         Working directory
  --max-restarts &lt;N&gt;   Max restarts before giving up [default: 3]
  --delay &lt;SECS&gt;       Delay before first restart [default: 1]
  --auto-fix           Enable auto-fix for dependency issues
  --name &lt;NAME&gt;        Name for the tracked process
  --detach             Run in background as a supervised process

Example:
  zervox start --cwd ./api --max-restarts 5 --auto-fix -- node server.js</code></pre>

        <hr>

        <h2>zervox add</h2>
        <p>Add a process to the tracked list (stored in config).</p>
        <pre><code>zervox add --name &lt;NAME&gt; [OPTIONS] -- &lt;COMMAND&gt;

Options:
  --cwd &lt;PATH&gt;         Working directory
  --max-restarts &lt;N&gt;   Max restarts [default: 3]
  --auto-fix           Enable auto-fix [default: false]

Example:
  zervox add --name myapp --cwd /project --auto-fix -- node index.js</code></pre>

        <hr>

        <h2>zervox list</h2>
        <p>List all tracked processes and their current status.</p>
        <pre><code>zervox list</code></pre>

        <hr>

        <h2>zervox start / stop / restart</h2>
        <pre><code>zervox start &lt;NAME&gt;      # Start supervising a tracked process
zervox stop &lt;NAME&gt;       # Stop supervision
zervox restart &lt;NAME&gt;    # Restart supervision</code></pre>

        <hr>

        <h2>zervox status</h2>
        <pre><code>zervox status [NAME]     # Show status of a specific or all processes</code></pre>

        <hr>

        <h2>zervox logs</h2>
        <pre><code>zervox logs &lt;NAME&gt; [-n &lt;LINES&gt;]  # Show persistent logs for a supervised process [default: 80 lines]</code></pre>

        <hr>

        <h2>zervox remove</h2>
        <pre><code>zervox remove &lt;NAME&gt;     # Remove a process from tracking</code></pre>

        <hr>

        <h2>zervox check</h2>
        <pre><code>zervox check -- &lt;COMMAND&gt; [--cwd &lt;PATH&gt;]  # Run a command once and print crash summary if it fails</code></pre>

        <hr>

        <h2>zervox supervise</h2>
        <p>Internal command used by systemd integration. Starts supervising a pre-configured process from JSON config.</p>
        <pre><code>zervox supervise &lt;NAME&gt; &lt;JSON_CONFIG&gt;</code></pre>

        <hr>

        <h2>zervox web</h2>
        <pre><code>zervox web [--port &lt;N&gt;]   # Start the web dashboard [default port: 3000]</code></pre>
      `
    },
    'auto-fix': {
      title: 'AI Auto-Fix',
      body: `
        <h1>AI Auto-Fix</h1>
        <p>Zervox provides two levels of automated crash recovery: a static pattern matcher and an optional AI-powered analysis engine.</p>

        <h2>Built-in Pattern Detection</h2>
        <p>Without any API key, Zervox can classify common Node.js crash types:</p>
        <ul>
          <li><strong>Port conflicts</strong> — <code>EADDRINUSE</code> → suggests stopping the existing process</li>
          <li><strong>Missing dependencies</strong> — <code>Cannot find module</code> → triggers auto-fix</li>
          <li><strong>Permission errors</strong> — <code>EACCES</code> → suggests checking file permissions</li>
          <li><strong>Syntax errors</strong> — <code>SyntaxError</code> → points to the failing file</li>
        </ul>

        <h2>Auto-Fix (Dependency Repair)</h2>
        <p>When enabled with <code>--auto-fix</code>, Zervox will:</p>
        <ol>
          <li>Parse crash logs for missing module/package errors</li>
          <li>Extract the package name (handles scoped packages like <code>@org/pkg</code>)</li>
          <li>Verify the package is declared in <code>package.json</code></li>
          <li>Automatically detect the package manager (<code>bun</code>, <code>pnpm</code>, <code>yarn</code>, <code>npm</code>)</li>
          <li>Run <code>install</code> to restore the missing dependency</li>
        </ol>
        <pre><code>zervox start --cwd /project --auto-fix -- node server.js</code></pre>

        <h2>AI-Powered Analysis</h2>
        <p>With an OpenAI API key set in the <code>OPENAI_API_KEY</code> environment variable, the web dashboard also provides:</p>
        <ul>
          <li>Deep log analysis using GPT models</li>
          <li>Suggested fix commands with explanations</li>
          <li>One-click fix execution from the dashboard</li>
        </ul>

        <h2>Local AI (Coming Soon)</h2>
        <p>Future versions will support Ollama and other local models for fully offline AI crash analysis — no API key needed.</p>
      `
    },
    'configuration': {
      title: 'Configuration',
      body: `
        <h1>Configuration</h1>

        <h2>Tracked Processes</h2>
        <p>Processes are stored in <code>~/.config/zervox/runtime.json</code>. This JSON file contains the list of tracked processes, their commands, status, and restart counts.</p>

        <h2>Dashboard Settings</h2>
        <p>The web dashboard stores persistent configuration in <code>~/.config/zervox/dashboard.json</code>:</p>
        <pre><code>{
  "mode": "INTERACTIVE",
  "webhookUrl": "https://hooks.example.com/crashes"
}</code></pre>

        <h3>Modes</h3>
        <ul>
          <li><strong>INTERACTIVE</strong> — Default. Dashboard shows crash alerts, AI analysis available, user approves fixes.</li>
          <li><strong>AUTO_FIX</strong> — Automatically applies safe fixes (dep installs, restarts) without user approval.</li>
          <li><strong>NOTIFY_ONLY</strong> — Logs crashes and sends webhooks (if configured) without attempting fixes.</li>
        </ul>

        <h2>Webhook Integration</h2>
        <p>Set a webhook URL in the dashboard or directly in <code>dashboard.json</code>. On every crash, Zervox POSTs a JSON payload:</p>
        <pre><code>{
  "event": "crash",
  "process": "myapp",
  "restarts": 3
}</code></pre>
      `
    },
    'dashboard': {
      title: 'Web Dashboard',
      body: `
        <h1>Web Dashboard</h1>
        <p>The Zervox dashboard is a real-time web interface served by the Rust binary — no Node.js, no build step.</p>

        <h2>Starting the Dashboard</h2>
        <pre><code>zervox web
# Opens at http://127.0.0.1:3000</code></pre>

        <h2>Features</h2>
        <ul>
          <li><strong>Process List</strong> — Sidebar shows all tracked processes with status indicators (green = online, red = crashed, gray = stopped).</li>
          <li><strong>Live Terminal</strong> — Real-time log output via Socket.IO for the selected process.</li>
          <li><strong>AI Crash Panel</strong> — Automatically appears when a crash is detected. Shows root cause analysis and suggested fix commands.</li>
          <li><strong>Apply Solution</strong> — One-click execution of AI-suggested fix commands directly on the server.</li>
          <li><strong>Global Config</strong> — Adjust mode and webhook URL from the dashboard. Settings persist across restarts.</li>
        </ul>

        <h2>Architecture</h2>
        <p>The dashboard communicates with the Zervox backend via WebSocket (Socket.IO). The backend pushes real-time state changes every second:</p>
        <ul>
          <li><code>init_state</code> — Initial process list on connect</li>
          <li><code>process_update</code> — Status or restart count changes</li>
          <li><code>crash</code> — AI analysis results for a crash</li>
          <li><code>log</code> — New log lines</li>
        </ul>

        <div class="note">
          <strong>Security:</strong> The dashboard binds to <code>127.0.0.1</code> by default and is not authenticated. It is designed for local-only access.
        </div>
      `
    },
    'systemd': {
      title: 'Systemd Integration',
      body: `
        <h1>Systemd Integration</h1>
        <p>Zervox can generate systemd user service files so your supervised processes survive reboots and run as proper system services.</p>

        <h2>Generate a Service</h2>
        <p>First add the process to tracking, then generate the systemd unit:</p>
        <pre><code>zervox add --name myapp --cwd /project -- node server.js
zervox systemd myapp</code></pre>
        <p>This creates <code>~/.config/systemd/user/zervox-myapp.service</code>.</p>

        <h2>Enable and Start</h2>
        <pre><code>systemctl --user daemon-reload
systemctl --user enable zervox-myapp.service
systemctl --user start zervox-myapp.service</code></pre>

        <h2>View Logs</h2>
        <pre><code>journalctl --user -u zervox-myapp.service -f</code></pre>

        <h2>Service Unit Contents</h2>
        <p>The generated unit runs <code>zervox supervise</code> with the process configuration embedded as a JSON argument, so it's fully self-contained.</p>
        <pre><code>[Unit]
Description=Zervox watchdog for myapp
After=network.target

[Service]
Type=simple
ExecStart=/home/user/.cargo/bin/zervox supervise myapp '{"command":["node","server.js"],"cwd":"/project","max_restarts":3,"restart_delay":1,"auto_fix":false}'
Restart=always
RestartSec=3

[Install]
WantedBy=default.target</code></pre>
      `
    }
  };

  CONTENT.docs = `
    <div class="docs-layout">
      <aside class="docs-sidebar">
        <h4>Documentation</h4>
        <ul class="docs-nav">
          ${Object.entries(DOC_PAGES).map(([key, page]) =>
            `<li><a href="#" data-doc="${key}" class="${key === 'getting-started' ? 'active' : ''}" onclick="Zervox.openDoc('${key}')">${page.title}</a></li>`
          ).join('')}
        </ul>
      </aside>
      <div class="docs-content" id="doc-content">
        ${DOC_PAGES['getting-started'].body}
      </div>
    </div>
  `;

  /* ================ PRICING ================ */
  CONTENT.pricing = `
    <h1 class="section-title" style="margin-top:60px;">Simple, Transparent Pricing</h1>
    <p class="section-subtitle">Zervox is open-source under MIT. All core features are free forever.</p>

    <div class="pricing-grid">
      <div class="pricing-card featured">
        <div class="pricing-name">Community</div>
        <div class="pricing-desc">Everything you need, free forever</div>
        <div class="pricing-price">$0 <span>/ forever</span></div>
        <div class="pricing-period">Open source — MIT license</div>
        <ul class="pricing-features">
          <li><span class="check">✓</span> Process supervision & auto-restart</li>
          <li><span class="check">✓</span> Pattern-based crash detection</li>
          <li><span class="check">✓</span> Auto-fix for missing dependencies</li>
          <li><span class="check">✓</span> Real-time web dashboard (Socket.IO)</li>
          <li><span class="check">✓</span> Systemd integration</li>
          <li><span class="check">✓</span> CLI — full command reference</li>
          <li><span class="check">✓</span> AI-powered diagnostics (bring your own key)</li>
        </ul>
        <a class="btn btn-primary" href="https://github.com/ziuus/Zervox" target="_blank" style="width:100%;">Get Started on GitHub ↗</a>
      </div>

      <div class="pricing-card">
        <div class="pricing-name">Pro</div>
        <div class="pricing-desc">For teams and production use</div>
        <div class="pricing-price">— <span>coming soon</span></div>
        <div class="pricing-period">Pricing TBD</div>
        <ul class="pricing-features">
          <li><span class="check">✓</span> Everything in Community</li>
          <li><span class="check">✓</span> Webhook & Slack integration</li>
          <li><span class="check">✓</span> Multi-host dashboard</li>
          <li><span class="check">✓</span> Priority support</li>
          <li><span class="cross">✗</span> No pricing announced yet</li>
        </ul>
        <a class="btn btn-ghost" href="#" style="width:100%;" onclick="document.getElementById('waitlist-form')?.classList.toggle('show')">Join Waitlist</a>
      </div>

      <div class="pricing-card">
        <div class="pricing-name">Enterprise</div>
        <div class="pricing-desc">For organizations at scale</div>
        <div class="pricing-price">— <span>coming soon</span></div>
        <div class="pricing-period">Custom tailored</div>
        <ul class="pricing-features">
          <li><span class="check">✓</span> Everything in Pro</li>
          <li><span class="check">✓</span> On-premise deployment</li>
          <li><span class="check">✓</span> SLA & uptime guarantees</li>
          <li><span class="check">✓</span> Custom integrations</li>
          <li><span class="cross">✗</span> No pricing announced yet</li>
        </ul>
        <a class="btn btn-ghost" href="https://github.com/ziuus/Zervox/issues/new" target="_blank" style="width:100%;">Open an Issue →</a>
      </div>
    </div>

    <div id="waitlist-form" class="waitlist-form">
      <p>Interested in Pro or Enterprise? <a href="https://github.com/ziuus/Zervox/issues/new" target="_blank">Open a GitHub issue</a> describing your use case, or reach out to <a href="https://github.com/ziuus" target="_blank">@ziuus</a>.</p>
    </div>
  `;

  /* ================ ABOUT ================ */
  CONTENT.about = `
    <h1 class="section-title" style="margin-top:60px;">About Zervox</h1>
    <p class="section-subtitle">A production-grade watchdog, reimagined for the AI era.</p>

    <div class="about-section">
      <h2>The Problem</h2>
      <p>Every developer who runs Node.js apps in production has been there — a crash at 3 AM, a confusing error log, and the manual hunt for the missing dependency or port conflict. Traditional process managers (pm2, forever) restart processes but don't tell you why they crashed or how to fix them.</p>
      <p>Zervox was built to close this loop: crash → diagnose → fix → restart. All in one tool.</p>
    </div>

    <div class="about-section">
      <h2>Why Rust?</h2>
      <p>Zervox is a single Rust binary with zero runtime dependencies. It installs in seconds, uses under 10 MB of memory in steady state, and starts before your Node.js runtime even initializes. No Electron, no Python, no Node.js required to run the watchdog itself.</p>
    </div>

    <div class="about-stats">
      <div class="stat-card">
        <div class="stat-value">Rust</div>
        <div class="stat-label">Language</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">&lt; 10 MB</div>
        <div class="stat-label">Steady Memory</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">&lt; 7 KB</div>
        <div class="stat-label">Binary Size (stripped)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">MIT</div>
        <div class="stat-label">License</div>
      </div>
    </div>

    <div class="about-section">
      <h2>Built by Noel</h2>
      <p>Zervox is an open-source project by <a href="https://github.com/ziuus" style="color:var(--accent-blue);text-decoration:none;">@ziuus</a> — a CS/AI student and freelance developer from Kerala, India. It started as a "things I wish existed" project and grew into a production-grade tool used across personal and client deployments.</p>
    </div>
  `;

  /* ================ ROUTER ================ */
  function getPage() {
    const hash = window.location.hash.replace(/^#\//, '').replace(/^#/, '') || Zervox._currentPage || 'home';
    return CONTENT[hash] ? hash : 'home';
  }

  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => {
      // Immediately reveal elements already in the viewport
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 40 && rect.bottom > 0) {
        el.classList.add('visible');
      } else {
        observer.observe(el);
      }
    });
  }

  function render() {
    const page = getPage();
    const container = document.getElementById('page-container');
    container.innerHTML = CONTENT[page] || CONTENT.home;
    container.className = 'page active';

    // Add fade-in to sections
    container.querySelectorAll('section, .features-grid, .steps, .pricing-grid, .about-stats, .cta-section, .terminal-demo').forEach(el => {
      if (!el.classList.contains('hero')) el.classList.add('fade-in');
    });

    // Update nav
    document.querySelectorAll('.nav-links a').forEach(a => {
      const target = a.getAttribute('data-page');
      a.classList.toggle('active', target === page);
    });

    // Close mobile nav
    document.querySelector('.nav-links')?.classList.remove('open');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Init scroll animations
    setTimeout(initScrollAnimations, 50);
  }

  function navigate(page) {
    window.location.hash = page;
  }

  function openDoc(key) {
    const page = DOC_PAGES[key];
    if (!page) return;
    const content = document.getElementById('doc-content');
    if (content) content.innerHTML = page.body;

    // Update active link
    document.querySelectorAll('.docs-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-doc') === key);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleMobileNav() {
    document.querySelector('.nav-links')?.classList.toggle('open');
  }

  // Init: detect real URL path and convert to hash for SPA
  function initSPA() {
    const path = window.location.pathname.replace(/\/$/, '') || '';
    if (path && !window.location.hash) {
      const page = path.replace(/^\//, '');
      if (CONTENT[page]) {
        // Pre-rendered content is already in the DOM (static page).
        // Override the hash so subsequent SPA navigation works.
        history.replaceState(null, '', window.location.pathname + window.location.search);
        window.Zervox._currentPage = page;
      }
    }
  }

  // Expose globally
  window.Zervox = { navigate, openDoc, toggleMobileNav, render, _currentPage: 'home' };

  // Listen
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', () => {
    initSPA();
    render();
  });
})();
