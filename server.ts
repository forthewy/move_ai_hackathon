import express from "express";
import path from "path";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Helper to invoke python bridge
function runPythonBridge(cmd: string, payload: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    execFile(
      pythonCmd,
      ["-X", "utf8", "-m", "backend.app.bridge", cmd, payloadStr],
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Python bridge error (${cmd}):`, stderr || error.message);
          return resolve({ error: error.message });
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (e) {
          console.error(`Python bridge parse error (${cmd}):`, stdout);
          resolve({ error: "Failed to parse Python response" });
        }
      }
    );
  });
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "kd-logistics-fullstack" });
});

app.get("/api/data/orders", async (req, res) => {
  const result = await runPythonBridge("get_orders");
  res.json(result);
});

app.get("/api/data/options", async (req, res) => {
  const result = await runPythonBridge("get_options");
  res.json(result);
});

app.post("/api/risk/analyze", async (req, res) => {
  const result = await runPythonBridge("risk_analyze", req.body);
  res.json(result);
});

app.post("/api/pure/compare", async (req, res) => {
  const result = await runPythonBridge("pure_compare", req.body);
  res.json(result);
});

app.post("/api/mixed/optimize", async (req, res) => {
  const result = await runPythonBridge("mixed_optimize", req.body);
  res.json(result);
});

app.post("/api/explain", async (req, res) => {
  const result = await runPythonBridge("explain", req.body);
  res.json(result);
});

// Vite & Static file serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
