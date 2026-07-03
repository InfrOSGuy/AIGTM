import { startIntegrationConnect } from "../lib/api";

// HubSpot is temporarily disabled (plan upgrade needed) — see
// docs/SCOPE.md. Add it back to this list once that's resolved.
const PROVIDERS = [
  { id: "gmail", label: "Gmail", description: "Draft AI-personalized outreach emails" },
  { id: "slack", label: "Slack", description: "Alert on qualified leads and replies" },
] as const;

export function Integrations() {
  const params = new URLSearchParams(window.location.search);
  const justConnected = params.get("connected");

  return (
    <div style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Integrations</h1>
      {justConnected && (
        <p style={{ color: "seagreen" }}>Connected {justConnected} successfully.</p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {PROVIDERS.map((provider) => (
          <li
            key={provider.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem",
              border: "1px solid #ddd",
              borderRadius: 8,
              marginBottom: "0.75rem",
            }}
          >
            <div>
              <strong>{provider.label}</strong>
              <p style={{ margin: 0, color: "#666" }}>{provider.description}</p>
            </div>
            <button onClick={() => startIntegrationConnect(provider.id)}>Connect</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
