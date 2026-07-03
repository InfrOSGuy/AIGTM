import { useState } from "react";
import { Integrations } from "./pages/Integrations";
import { Login } from "./pages/Login";

export function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }

  return <Integrations />;
}
