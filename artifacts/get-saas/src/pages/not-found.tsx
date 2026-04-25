import { Link } from "wouter";
import { BRAND, tone, type, PrimaryButton, Wordmark } from "@/lib/ui";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BRAND.paper,
        color: BRAND.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ marginBottom: 28 }}>
          <Wordmark size={20} />
        </div>
        <p
          style={{
            fontSize: type.xs,
            fontWeight: 600,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tone[400],
            marginBottom: 14,
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          Page not found
        </h1>
        <p style={{ fontSize: type.md, color: tone[600], lineHeight: 1.6, marginBottom: 28 }}>
          This page doesn't exist or has moved.
        </p>
        <Link href="/">
          <PrimaryButton size="lg">Back home</PrimaryButton>
        </Link>
      </div>
    </div>
  );
}
