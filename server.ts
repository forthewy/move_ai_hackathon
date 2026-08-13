import express from "express";
import path from "path";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Helper to invoke python bridge
function runPythonBridge(cmd: string, payload: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const child = execFile(
      pythonCmd,
      ["-X", "utf8", "-m", "backend.app.bridge", cmd],
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Python bridge error (${cmd}):`, stderr || error.message);
          return resolve({ error: error.message });
        }
        const trimmed = (stdout || "").trim();
        if (!trimmed) {
          console.error(`Python bridge empty output (${cmd}):`, stderr || error?.message);
          return resolve({ error: stderr || "Python 실행 결과가 비어 있습니다." });
        }

        try {
          return resolve(JSON.parse(trimmed));
        } catch (_) {
          // Extract JSON substring if python output includes leading/trailing logs
          const firstCurly = trimmed.indexOf("{");
          const firstSquare = trimmed.indexOf("[");
          const jsonStart =
            firstCurly !== -1 && firstSquare !== -1
              ? Math.min(firstCurly, firstSquare)
              : firstCurly !== -1
              ? firstCurly
              : firstSquare;

          const lastCurly = trimmed.lastIndexOf("}");
          const lastSquare = trimmed.lastIndexOf("]");
          const jsonEnd = Math.max(lastCurly, lastSquare);

          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            try {
              const sliced = trimmed.slice(jsonStart, jsonEnd + 1);
              return resolve(JSON.parse(sliced));
            } catch (err) {}
          }

          console.error(`Python bridge parse error (${cmd}):`, stdout);
          return resolve({ error: "Python 실행 응답을 파싱하지 못했습니다." });
        }
      }
    );

    if (child.stdin) {
      child.stdin.write(payloadStr);
      child.stdin.end();
    }
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

app.post("/api/news/search", async (req, res) => {
  const result = await runPythonBridge("search_news", req.body);
  res.json(result);
});

app.post("/api/pure/compare", async (req, res) => {
  const result = await runPythonBridge("pure_compare", req.body);
  res.json(result);
});

app.post("/api/mixed/optimize", async (req, res) => {
  const result = await runPythonBridge("mixed_optimize", req.body);
  if (result?.error) {
    const statusCode = result.status === "INVALID_ORDER_ID" ? 400 : 500;
    return res.status(statusCode).json(result);
  }
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
