import { useEffect, useMemo, useState } from "react";

import {
  type EventEnvelope,
  type HealthSnapshot,
  type ObservabilityMessage,
  decodeSocketMessage,
  fetchMsgpack,
} from "./protocol";

const HEALTH_ROUTE = "/health";
const HEALTH_VIEW_ROUTE = "/health/view";
const RECENT_ROUTE = "/recent";
const MAX_EVENTS = 80;

interface TokenEstimate {
  baselineTokens: number;
  returnedTokens: number;
  savedTokens: number;
  savedPercent: number;
}

interface ToolLedgerEntry {
  id: string;
  ts: string;
  toolName: string;
  summary: string;
  detail: string[];
  durationMs: number | null;
  tokenEstimate?: TokenEstimate;
  status: "finished" | "failed";
  message?: string;
}

function healthTone(snapshot: HealthSnapshot | null): "ok" | "warn" | "error" {
  if (!snapshot) {
    return "warn";
  }
  if (snapshot.watch?.lastError) {
    return "error";
  }
  if (snapshot.staleStatus === "stale") {
    return "warn";
  }
  return "ok";
}

function formatTimestamp(input: string): string {
  const value = new Date(input);
  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTokenCount(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }

  return String(value);
}

function asToolLedgerEntry(event: EventEnvelope): ToolLedgerEntry | null {
  if (event.event !== "mcp.tool.finished" && event.event !== "mcp.tool.failed") {
    return null;
  }

  const data = event.data ?? {};
  const toolName = typeof data.toolName === "string" ? data.toolName : "unknown";
  const summary = typeof data.summary === "string"
    ? data.summary
    : event.event === "mcp.tool.failed"
      ? `${toolName} failed`
      : `${toolName} completed`;
  const detail = Array.isArray(data.detail)
    ? data.detail.filter((item): item is string => typeof item === "string")
    : [];
  const durationMs = typeof data.durationMs === "number" ? data.durationMs : null;
  const tokenEstimate = data.tokenEstimate
    && typeof data.tokenEstimate === "object"
    && !Array.isArray(data.tokenEstimate)
    ? data.tokenEstimate as TokenEstimate
    : undefined;
  const message = typeof data.message === "string" ? data.message : undefined;

  return {
    id: event.id ?? `${toolName}-${event.ts ?? "unknown"}`,
    ts: event.ts ?? new Date().toISOString(),
    toolName,
    summary,
    detail,
    durationMs,
    tokenEstimate,
    status: event.event === "mcp.tool.failed" ? "failed" : "finished",
    message,
  };
}

function EventRow({ entry }: { entry: ToolLedgerEntry }) {
  return (
    <li className={`ledger-row ${entry.status === "failed" ? "ledger-row--failed" : ""}`}>
      <div className="ledger-row__header">
        <div>
          <div className="ledger-row__meta">
            <span>{formatTimestamp(entry.ts)}</span>
            <span>{entry.toolName}</span>
            {entry.durationMs !== null ? <span>{entry.durationMs} ms</span> : null}
          </div>
          <h2>{entry.summary}</h2>
        </div>
        {entry.tokenEstimate ? (
          <div className="savings-chip">
            <strong>{entry.tokenEstimate.savedPercent}% saved</strong>
            <span>{formatTokenCount(entry.tokenEstimate.savedTokens)} tokens avoided</span>
          </div>
        ) : (
          <div className="savings-chip savings-chip--muted">
            <strong>No savings estimate</strong>
            <span>Legacy event without a recorded estimate</span>
          </div>
        )}
      </div>

      {entry.detail.length > 0 ? (
        <ul className="ledger-row__detail">
          {entry.detail.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {entry.tokenEstimate ? (
        <div className="ledger-row__metrics">
          <span>baseline ~{formatTokenCount(entry.tokenEstimate.baselineTokens)}</span>
          <span>returned ~{formatTokenCount(entry.tokenEstimate.returnedTokens)}</span>
        </div>
      ) : null}

      {entry.message ? <p className="ledger-row__error">{entry.message}</p> : null}
    </li>
  );
}

function HealthView({ snapshot }: { snapshot: HealthSnapshot | null }) {
  return (
    <main className="page-shell terminal-app">
      <section className="panel terminal-panel terminal-panel--quiet">
        <a className="back-link" href="/">
          ← observability
        </a>
        <h1>@astrograph health inspect</h1>
      </section>
      <section className="panel terminal-panel">
        <div className="scroll-frame terminal-scrollbars">
          <pre className="inspector-pre">{JSON.stringify(snapshot, null, 2)}</pre>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [recent, setRecent] = useState<EventEnvelope[]>([]);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");

  const isHealthView = useMemo(
    () => window.location.pathname === HEALTH_VIEW_ROUTE,
    [],
  );

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;

    async function boot() {
      const [healthSnapshot, recentPayload] = await Promise.all([
        fetchMsgpack<HealthSnapshot>(HEALTH_ROUTE),
        fetchMsgpack<{ repoRoot: string; events: EventEnvelope[] }>(RECENT_ROUTE),
      ]);

      if (closed) {
        return;
      }

      setHealth(healthSnapshot);
      setRecent(recentPayload.events);

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(
        `${protocol}://${window.location.host}/events?encoding=msgpack`,
      );
      socket.binaryType = "arraybuffer";
      socket.addEventListener("open", () => {
        setStatus("connected");
      });
      socket.addEventListener("close", () => {
        setStatus("disconnected");
      });
      socket.addEventListener("error", () => {
        setStatus("error");
      });
      socket.addEventListener("message", (message) => {
        void Promise.resolve(decodeSocketMessage(message.data)).then(
          (payload: ObservabilityMessage) => {
            if (payload.type === "snapshot") {
              setHealth(payload.snapshot);
              return;
            }
            if (payload.type === "recent") {
              setRecent(payload.events);
              return;
            }
            if (payload.type === "event") {
              setEvents((current) => [payload.event, ...current].slice(0, MAX_EVENTS));
              if (payload.event.event === "health.snapshot") {
                setHealth((payload.event.data ?? {}) as HealthSnapshot);
              }
            }
          },
        );
      });
    }

    void boot();
    const healthTimer = window.setInterval(() => {
      void fetchMsgpack<HealthSnapshot>(HEALTH_ROUTE)
        .then((snapshot) => {
          if (!closed) {
            setHealth(snapshot);
          }
        })
        .catch(() => undefined);
    }, 3000);

    return () => {
      closed = true;
      window.clearInterval(healthTimer);
      socket?.close();
    };
  }, []);

  const ledgerEntries = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...events, ...recent];
    const entries: ToolLedgerEntry[] = [];

    for (const event of merged) {
      const entry = asToolLedgerEntry(event);
      if (!entry || seen.has(entry.id)) {
        continue;
      }
      seen.add(entry.id);
      entries.push(entry);
    }

    return entries.sort((left, right) => right.ts.localeCompare(left.ts));
  }, [events, recent]);

  const aggregate = useMemo(() => {
    return ledgerEntries.reduce(
      (total, entry) => {
        if (!entry.tokenEstimate) {
          return total;
        }

        total.baselineTokens += entry.tokenEstimate.baselineTokens;
        total.returnedTokens += entry.tokenEstimate.returnedTokens;
        total.savedTokens += entry.tokenEstimate.savedTokens;
        total.count += 1;
        return total;
      },
      {
        baselineTokens: 0,
        returnedTokens: 0,
        savedTokens: 0,
        count: 0,
      },
    );
  }, [ledgerEntries]);

  const savedPercent = aggregate.baselineTokens > 0
    ? Math.round((aggregate.savedTokens / aggregate.baselineTokens) * 100)
    : 0;

  if (isHealthView) {
    return <HealthView snapshot={health} />;
  }

  return (
    <main className="page-shell terminal-app">
      <section className="hero terminal-panel terminal-panel--quiet">
        <div className="hero-copy">
          <h1>@astrograph observability</h1>
          <p>
            Live MCP tool calls with plain-English summaries and estimated token
            savings when Astrograph can compare a compact response against a
            larger raw-code baseline.
          </p>
        </div>
        <a className="health-badge" href={HEALTH_VIEW_ROUTE}>
          <span className={`health-dot ${healthTone(health)}`} />
          <span>Health</span>
        </a>
      </section>

      <section className="kpi-row terminal-panel">
        <div className="kpi-card">
          <span className="kpi-label">Estimated Saved</span>
          <strong>{savedPercent}%</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Saved Tokens</span>
          <strong>{formatTokenCount(aggregate.savedTokens)}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Returned Tokens</span>
          <strong>{formatTokenCount(aggregate.returnedTokens)}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Calls With Estimate</span>
          <strong>{aggregate.count}</strong>
        </div>
      </section>

      <section className="status-note terminal-panel terminal-panel--quiet">
        <span className={`status-pill ${status}`}>{status}</span>
        <span>
          Estimates are approximate. They show where Astrograph likely avoided
          sending larger raw code blobs back to the model.
        </span>
      </section>

      <section className="panel terminal-panel">
        <div className="section-header">
          <h2>Tool Call Stream</h2>
        </div>
        {ledgerEntries.length === 0 ? (
          <p className="empty-state">
            No MCP tool calls yet. Run Astrograph tools and they will appear here.
          </p>
        ) : (
          <ol className="ledger terminal-scrollbars">
            {ledgerEntries.map((entry) => (
              <EventRow entry={entry} key={entry.id} />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
