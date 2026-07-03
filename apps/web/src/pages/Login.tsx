import { useState } from "react";
import { apiRequest } from "../lib/api";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      onLoggedIn();
    } catch {
      setError("Invalid token");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>AIGTM</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="token">Admin token</label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          style={{ display: "block", width: "100%", margin: "0.5rem 0" }}
        />
        <button type="submit" disabled={submitting || !token}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
