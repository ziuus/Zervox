# Understanding the Auto-Fix Loop

The Zervox Auto-Fix loop is the core of our autonomous SRE architecture. It combines real-time monitoring with Gemini-powered reasoning to resolve incidents without human intervention.

## The 4-Stage Lifecycle

### 1. Detection
Zervox scans `stderr` for exception patterns (e.g., `Error: Cannot find module`, `SyntaxError: Unexpected token`, `Connection refused`). It also monitors exit codes.

### 2. Context Extraction
When a crash occurs, Zervox extracts:
- The last 50 lines of logs.
- The environment variables (sanitized).
- The `package.json` manifest.

### 3. AI Analysis
This context is sent to the Gemini API with a specialized SRE prompt. The AI acts as a Senior DevOps Engineer, analyzing the root cause and proposing a safe, reproducible shell-based fix.

### 4. Application & Verification
Zervox executes the proposed solution (e.g., `npm install missing-dep`, `systemctl restart db`). After execution, it restarts the target process. If the process remains stable for 60 seconds, the fix is marked as successful.

## Best Practices for Auto-Fix
- **Provide clear logs**: The better your error messages, the more accurate the AI's fix.
- **Environment isolation**: Ensure Zervox has sufficient permissions to run fix commands but is isolated from critical system resources.
- **Review History**: Check the `zervox history` command periodically to review autonomous actions.
