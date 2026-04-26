import { tone, type } from "@/lib/ui";

/**
 * "Last seen" pill — shows whether the customer's site has actually pinged
 * us recently. The honest signal vibe coders ask for first: "is the script
 * even running?". Four states:
 *   never  — red, "Never seen"
 *   live   — green dot + "Live" (≤10 min ago)
 *   recent — neutral, "Seen Xh ago" (≤24h)
 *   stale  — yellow, "Last seen Xd ago" (>24h)
 */
export function LastSeenBadge({
  at,
  compact = false,
}: {
  at?: string | null;
  compact?: boolean;
}) {
  const palette = pickPalette(at);
  const padding = compact ? "2px 8px" : "4px 10px";
  const fontSize = compact ? 10.5 : type.xs;

  return (
    <span
      title={at ? `Last script ping: ${new Date(at).toLocaleString()}` : "The script tag has never contacted us for this project."}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding,
        borderRadius: 999,
        fontSize,
        fontWeight: 600,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {palette.dot && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: palette.fg,
            // Subtle pulse just for the live state so it actually feels alive.
            animation: palette.kind === "live" ? "lsb-pulse 1.6s ease-in-out infinite" : undefined,
          }}
        />
      )}
      {palette.label}
      <style>{`@keyframes lsb-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
    </span>
  );
}

type Palette = {
  kind: "never" | "live" | "recent" | "stale";
  label: string;
  bg: string;
  fg: string;
  border: string;
  dot: boolean;
};

function pickPalette(at?: string | null): Palette {
  if (!at) {
    return {
      kind: "never",
      label: "Never seen",
      bg: "rgba(220, 38, 38, 0.08)",
      fg: "#b91c1c",
      border: "rgba(220, 38, 38, 0.20)",
      dot: false,
    };
  }
  const ms = Date.now() - new Date(at).getTime();
  if (ms < 10 * 60 * 1000) {
    return {
      kind: "live",
      label: "Live",
      bg: "rgba(16, 185, 129, 0.10)",
      fg: "#047857",
      border: "rgba(16, 185, 129, 0.25)",
      dot: true,
    };
  }
  if (ms < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
    return {
      kind: "recent",
      label: `Seen ${hours}h ago`,
      bg: tone[100],
      fg: tone[700],
      border: tone[200],
      dot: false,
    };
  }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return {
    kind: "stale",
    label: `Last seen ${days}d ago`,
    bg: "rgba(217, 119, 6, 0.10)",
    fg: "#b45309",
    border: "rgba(217, 119, 6, 0.25)",
    dot: false,
  };
}
