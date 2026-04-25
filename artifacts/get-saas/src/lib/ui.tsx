import React from "react";
import brandLogoPath from "@assets/IMG_6687_1777091776547.jpeg";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  faint: "rgba(26,26,46,0.05)",
  soft: "rgba(26,26,46,0.08)",
  base: "rgba(26,26,46,0.10)",
  strong: "rgba(26,26,46,0.14)",
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

/**
 * Brand-only status palette. We never reach for ad-hoc greens / reds / blues —
 * the whole product is told in BRAND.ink + BRAND.yellow + neutral tones.
 *   - "positive" states (active / published / verified) get the BRAND.yellow dot
 *   - "negative" states (rejected) get an inked dot
 *   - everything else is neutral
 */
export const status = {
  active:    { bg: tone[100], fg: BRAND.ink, dot: BRAND.yellow },
  published: { bg: tone[100], fg: BRAND.ink, dot: BRAND.yellow },
  draft:     { bg: tone[100], fg: tone[600], dot: tone[400] },
  pending:   { bg: tone[100], fg: tone[600], dot: tone[400] },
  archived:  { bg: tone[100], fg: tone[500], dot: tone[300] },
  rejected:  { bg: tone[100], fg: tone[600], dot: BRAND.ink },
} as const;

// ── Style objects ────────────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  background: BRAND.surface,
  border: `1px solid ${line.faint}`,
  borderRadius: r.xl,
  boxShadow: "0 1px 2px rgba(26,26,46,0.03)",
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

/**
 * Destructive actions read as "intentionally heavy" via an outlined ink
 * treatment — never bright red. Distinct from primary (filled) and secondary
 * (lighter outline) without leaving the brand palette.
 */
export const dangerBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: BRAND.ink,
  border: `1.5px solid ${BRAND.ink}`,
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

export function DangerButton({ children, loading, block, disabled, style, size, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        ...withSize(dangerBtnStyle, size),
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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <IconTile icon={Icon} variant="soft" size={52} />
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
  const palette =
    variant === "neutral"
      ? { bg: tone[100], fg: tone[600], dot: null as string | null }
      : { ...status[variant] };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: type.xs,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: r.pill,
        background: palette.bg,
        color: palette.fg,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        ...style,
      }}
    >
      {palette.dot ? (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: palette.dot,
            flexShrink: 0,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

// ── IconTile ─────────────────────────────────────────────────────────────────
// A small "Apple-builder"-style icon container: rounded squircle (~22% radius),
// brand-only fills with a subtle gradient for depth, single glyph centered.
// Use this everywhere an icon needs visual weight: sidebar nav, list-row
// leading icons, empty states, dashboard stat cards, status banners.

export type IconTileVariant = "ink" | "soft" | "accent" | "outline";

// All gradients here use only BRAND-palette colors. The "highlight" lift on
// ink/accent is achieved via a translucent BRAND.surface (white) overlay rather
// than introducing a new off-palette hex.
const tileFill: Record<IconTileVariant, { bg: string; fg: string; ring?: string }> = {
  // Default — strong brand presence: dark navy with subtle top highlight.
  ink: {
    bg: `linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), ${BRAND.ink}`,
    fg: BRAND.paper,
    ring: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(26,26,46,0.18)",
  },
  // Quiet — used for tertiary / inactive states.
  soft: {
    bg: `linear-gradient(180deg, ${BRAND.surface} 0%, ${tone[50]} 100%)`,
    fg: BRAND.ink,
    ring: `inset 0 0 0 1px ${line.base}`,
  },
  // Accent — brand yellow, reserved for emphasis (positive, highlighted).
  accent: {
    bg: `linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%), ${BRAND.yellow}`,
    fg: BRAND.ink,
    ring: "inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 2px rgba(26,26,46,0.10)",
  },
  // Outline — flat cream with a hairline border, lightest possible.
  outline: {
    bg: BRAND.surface,
    fg: BRAND.ink,
    ring: `inset 0 0 0 1px ${line.base}`,
  },
};

export function IconTile({
  icon: Icon,
  variant = "soft",
  size = 36,
  style,
  label,
}: {
  icon: React.ElementType;
  variant?: IconTileVariant;
  size?: number;
  style?: React.CSSProperties;
  /**
   * Optional accessible label. When omitted, the tile is treated as
   * decorative (`aria-hidden`) — which is the right default since IconTile
   * is almost always paired with a visible text label next to it.
   */
  label?: string;
}) {
  const palette = tileFill[variant];
  const radius = Math.round(size * 0.26);
  const glyph = Math.round(size * 0.46);
  const decorative = !label;
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={label}
      aria-hidden={decorative ? true : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: palette.bg,
        boxShadow: palette.ring,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon
        aria-hidden
        style={{
          width: glyph,
          height: glyph,
          color: palette.fg,
          strokeWidth: 1.75,
        }}
      />
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

/**
 * The official brand asset (uploaded image with wordmark + mascot + tagline).
 * Per brand rules: this is the ONLY way to render the get brand. Never recreate
 * the wordmark or mascot programmatically. Use only on landing / auth / 404
 * surfaces — NEVER inside the authenticated product UI.
 */
export function BrandLogo({
  width = 220,
  alt = "get — Let clients edit your app without breaking it.",
  style,
}: {
  width?: number | string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={brandLogoPath}
      alt={alt}
      style={{
        width,
        height: "auto",
        display: "block",
        userSelect: "none",
        mixBlendMode: "multiply",
        ...style,
      }}
      draggable={false}
    />
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

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[420px]"
        style={{
          borderRadius: r.lg,
          border: `1px solid ${line.base}`,
          background: BRAND.surface,
          padding: 24,
        }}
      >
        <AlertDialogHeader style={{ textAlign: "left" as const }}>
          <AlertDialogTitle
            style={{
              fontSize: type.lg,
              fontWeight: 600,
              color: BRAND.ink,
              letterSpacing: "-0.015em",
              lineHeight: 1.3,
            }}
          >
            {title}
          </AlertDialogTitle>
          {description ? (
            <AlertDialogDescription
              style={{
                fontSize: type.sm,
                color: tone[600],
                lineHeight: 1.55,
                marginTop: 6,
              }}
            >
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 18,
            flexDirection: "row" as const,
          }}
        >
          <AlertDialogCancel asChild>
            <SecondaryButton type="button" disabled={loading}>
              {cancelLabel}
            </SecondaryButton>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            {destructive ? (
              <DangerButton
                type="button"
                onClick={onConfirm}
                loading={loading}
                disabled={loading}
              >
                {confirmLabel}
              </DangerButton>
            ) : (
              <PrimaryButton
                type="button"
                onClick={onConfirm}
                loading={loading}
                disabled={loading}
              >
                {confirmLabel}
              </PrimaryButton>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
