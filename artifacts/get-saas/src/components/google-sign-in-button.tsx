/**
 * "Continue with Google" button used on /login and /signup.
 *
 * Implemented as a plain anchor (not a fetch+redirect) so that the browser
 * does a full top-level navigation to /api/auth/google. This is essential for
 * two reasons:
 *   1. The state cookie has SameSite=Lax — only top-level GETs reliably set
 *      and replay the cookie across the cross-site Google round-trip.
 *   2. The final session cookie from the callback is set on a top-level
 *      navigation, which the browser will then carry on the SPA load that
 *      follows the redirect to /app/dashboard.
 */
import React from "react";
import { BRAND, tone, type } from "@/lib/ui";

interface Props {
  next?: string;
  label?: string;
}

function buildHref(next?: string): string {
  // Keep the URL within the same origin — the api-server is mounted at /api.
  const base = "/api/auth/google";
  if (!next) return base;
  if (!next.startsWith("/") || next.startsWith("//")) return base;
  const params = new URLSearchParams({ next });
  return `${base}?${params.toString()}`;
}

export function GoogleSignInButton({ next, label = "Continue with Google" }: Props) {
  return (
    <a
      href={buildHref(next)}
      data-testid="button-google-signin"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        height: 44,
        borderRadius: 8,
        border: `1px solid ${tone[300]}`,
        background: "#ffffff",
        color: BRAND.ink,
        fontSize: type.md,
        fontWeight: 500,
        textDecoration: "none",
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = tone[50];
        (e.currentTarget as HTMLAnchorElement).style.borderColor = tone[400];
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "#ffffff";
        (e.currentTarget as HTMLAnchorElement).style.borderColor = tone[300];
      }}
    >
      <GoogleGlyph />
      <span>{label}</span>
    </a>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function OrDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "18px 0 6px",
      }}
      aria-hidden="true"
    >
      <div style={{ flex: 1, height: 1, background: tone[200] }} />
      <span style={{ fontSize: type.xs, color: tone[500], fontWeight: 500 }}>or</span>
      <div style={{ flex: 1, height: 1, background: tone[200] }} />
    </div>
  );
}
