import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// One-time cleanup: we used to keep the bearer session token in localStorage,
// but auth is now an httpOnly cookie set by the API. Wipe any stale value so
// it can never accidentally be sent again.
try {
  localStorage.removeItem("auth_token");
} catch {
  // localStorage may be unavailable (private mode, etc.) — safe to ignore.
}

createRoot(document.getElementById("root")!).render(<App />);
