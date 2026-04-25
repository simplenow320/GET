import { Link } from "wouter";

const C = "#1a1a2e";
const BG = "#faf9f6";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100dvh", background: BG, color: C,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <p style={{
          fontSize: 12.5, fontWeight: 600, letterSpacing: "0.09em",
          textTransform: "uppercase", color: `${C}66`, marginBottom: 18,
        }}>
          404
        </p>
        <h1 style={{
          fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em",
          marginBottom: 12, lineHeight: 1.2,
        }}>
          Page not found
        </h1>
        <p style={{ fontSize: 15, color: `${C}80`, lineHeight: 1.6, marginBottom: 32 }}>
          This page doesn't exist or has moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            height: 44, padding: "0 22px", borderRadius: 999,
            background: C, color: BG,
            fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none",
            transition: "opacity 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
