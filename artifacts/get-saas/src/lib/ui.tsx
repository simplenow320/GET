import React from "react";

export const BRAND = {
  ink: "#1a1a2e",
  paper: "#faf9f6",
  surface: "#ffffff",
  yellow: "#FFD747",
};

export const tone = {
  900: "#1a1a2e",
  700: "rgba(26,26,46,0.78)",
  600: "rgba(26,26,46,0.62)",
  500: "rgba(26,26,46,0.48)",
  400: "rgba(26,26,46,0.36)",
  300: "rgba(26,26,46,0.24)",
  200: "rgba(26,26,46,0.12)",
  100: "rgba(26,26,46,0.06)",
  50:  "rgba(26,26,46,0.035)",
} as const;

export const line = {
  faint: "rgba(0,0,0,0.04)",
  soft: "rgba(0,0,0,0.06)",
  base: "rgba(0,0,0,0.08)",
  strong: "rgba(0,0,0,0.12)",
} as const;

export const type = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 18,
  xl: 22,
  display: 28,
} as const;

export const r = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

export const ease = "cubic-bezier(0.4,0,0.2,1)";

export const status = {
  active:   { bg: "#ecfdf5", fg: "#059669" },
  draft:    { bg: "#fffbeb", fg: "#b45309" },
  archived: { bg: "#f4f4f5", fg: "#71717a" },
  pending:  { bg: "#eff6ff", fg: "#2563eb" },
  published:{ bg: "#ecfdf5", fg: "#059669" },
  rejected: { bg: "#fef2f2", fg: "#dc2626" },
};

// ── Style objects ────────────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  background: BRAND.surface,
  border: `1px solid ${line.faint}`,
  borderRadius: r.xl,
  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
};

export const inputStyle: React.CSSProperties = {
  height: 44,
  padding: "0 14px",
  borderRadius: r.md,
  border: `1px solid ${line.base}`,
  background: BRAND.surface,
  fontSize: type.base,
};

export const labelStyle: React.CSSProperties = {
  fontSize: type.sm,
  fontWeight: 500,
  color: tone[700],
  letterSpacing: "-0.005em",
};

export const helperTextStyle: React.CSSProperties = {
  fontSize: type.xs,
  color: tone[500],
  marginTop: 6,
  lineHeight: 1.55,
};

const btnBase: React.CSSProperties = {
  height: 40,
  padding: "0 18px",
  borderRadius: r.md,
  border: "none",
  fontSize: type.sm,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  transition: `opacity 0.18s ${ease}, background 0.18s ${ease}, color 0.18s ${ease}`,
  letterSpacing: "-0.005em",
  whiteSpace: "nowrap",
};

export const primaryBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: BRAND.ink,
  color: "#fff",
};

export const secondaryBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: tone[700],
  border: `1px solid ${line.strong}`,
};

export const ghostBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: tone[100],
  color: tone[700],
};

export const dangerBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: "#fef2f2",
  color: "#dc2626",
};

// ── Components ───────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  block?: boolean;
  size?: "sm" | "md" | "lg";
};

function withSize(s: React.CSSProperties, size?: "sm" | "md" | "lg"): React.CSSProperties {
  if (size === "lg") return { ...s, height: 48, padding: "0 22px", fontSize: type.base, borderRadius: r.lg };
  if (size === "sm") return { ...s, height: 32, padding: "0 12px", fontSize: type.xs, borderRadius: r.sm };
  return s;
}

export function PrimaryButton({ children, loading, block, disabled, style, size, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        ...withSize(primaryBtnStyle, size),
        width: block ? "100%" : undefined,
        opacity: disabled || loading ? 0.55 : 1,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, loading, block, disabled, style, size, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        ...withSize(secondaryBtnStyle, size),
        width: block ? "100%" : undefined,
        opacity: disabled || loading ? 0.55 : 1,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, block, disabled, style, size, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...withSize(ghostBtnStyle, size),
        width: block ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, block, disabled, style, size, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...withSize(dangerBtnStyle, size),
        width: block ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  padded,
  style,
  as: As = "div",
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: React.CSSProperties;
  as?: any;
}) {
  return (
    <As style={{ ...cardStyle, padding: padded ? 24 : 0, ...style }}>
      {children}
    </As>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header
      style={{
        marginBottom: 36,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontSize: type.display,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
            margin: 0,
            color: BRAND.ink,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p style={{ fontSize: type.base, color: tone[500], marginTop: 6, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </header>
  );
}

export function SectionTitle({
  children,
  description,
  action,
  style,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        marginBottom: 18,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontSize: type.lg,
            fontWeight: 600,
            color: BRAND.ink,
            letterSpacing: "-0.015em",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {children}
        </h2>
        {description ? (
          <p
            style={{
              fontSize: type.sm,
              color: tone[500],
              marginTop: 4,
              lineHeight: 1.55,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: compact ? "44px 24px" : "64px 24px",
        maxWidth: 360,
        margin: "0 auto",
      }}
    >
      {Icon ? (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: tone[50],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Icon style={{ width: 20, height: 20, color: tone[400] }} />
        </div>
      ) : null}
      <p style={{ fontSize: type.md, fontWeight: 600, color: BRAND.ink, marginBottom: description ? 6 : 0 }}>
        {title}
      </p>
      {description ? (
        <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.6, marginBottom: action ? 22 : 0 }}>
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export function Pill({
  children,
  variant = "neutral",
  style,
}: {
  children: React.ReactNode;
  variant?: keyof typeof status | "neutral";
  style?: React.CSSProperties;
}) {
  const palette = variant === "neutral"
    ? { bg: tone[100], fg: tone[600] }
    : { bg: status[variant].bg, fg: status[variant].fg };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: type.xs,
        fontWeight: 500,
        padding: "3px 9px",
        borderRadius: r.pill,
        background: palette.bg,
        color: palette.fg,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const autoId = React.useId();
  const child = React.isValidElement(children) ? children : null;
  const childId = (child?.props as any)?.id as string | undefined;
  const inputId = childId ?? `field-${autoId}`;
  const wired = child && !childId
    ? React.cloneElement(child as React.ReactElement<any>, { id: inputId })
    : children;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={inputId} style={labelStyle}>
        {label}
        {optional ? <span style={{ color: tone[400], fontWeight: 400, marginLeft: 6 }}>(optional)</span> : null}
      </label>
      {wired}
      {hint ? <p style={helperTextStyle}>{hint}</p> : null}
    </div>
  );
}

export function Wordmark({ size = 18, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: BRAND.ink,
        lineHeight: 1,
        ...style,
      }}
    >
      get<span style={{ color: BRAND.yellow }}>.</span>
    </span>
  );
}

export function PageContainer({
  children,
  maxWidth = 880,
  style,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        maxWidth,
        margin: "0 auto",
        padding: "44px clamp(20px, 4vw, 40px) 80px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
