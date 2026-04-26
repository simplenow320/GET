import { Link } from "wouter";
import { BRAND, tone, type, ease, BrandLogo, mascotPath } from "@/lib/ui";

export default function LandingPage() {
  return (
    <div style={{ backgroundColor: BRAND.paper, color: BRAND.ink, minHeight: "100dvh" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* The brand asset already includes the wordmark, the mascot, and the
          tagline — so the hero is just that one image plus the CTA. No
          supporting paragraph here; the next section delivers the pitch. */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "80px 24px 56px",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <BrandLogo
          variant="full"
          width="100%"
          linkToHome={false}
          style={{ maxWidth: 540, marginBottom: 36 }}
        />

        {/* Visually-hidden H1 so screen readers / SEO get the tagline that's
            baked into the brand asset above. */}
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          Let clients edit your app without breaking it.
        </h1>

        <Link
          href="/signup"
          data-testid="button-hero-cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            padding: "0 30px",
            borderRadius: 999,
            background: BRAND.ink,
            color: BRAND.paper,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "-0.01em",
            textDecoration: "none",
            transition: `opacity 0.25s ${ease}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          Start free
        </Link>
      </section>

      {/* ── Pain → Relief ────────────────────────────────────────────────── */}
      <section style={{ padding: "8px 24px 72px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: "clamp(24px, 3.4vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            You build fast. Then the tiny edits start.
          </p>
          <p
            style={{
              fontSize: type.md,
              lineHeight: 1.6,
              color: tone[600],
              marginBottom: 28,
            }}
          >
            Ship with Replit, Cursor, or Lovable — and every text or image tweak still lands on you.
          </p>

          <div
            style={{
              display: "inline-block",
              padding: "8px 16px",
              borderRadius: 999,
              background: BRAND.ink,
              color: BRAND.paper,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            get makes the handoff easy.
          </div>

          <p
            style={{
              fontSize: type.base,
              lineHeight: 1.6,
              color: tone[600],
              marginTop: 24,
              maxWidth: 520,
              marginInline: "auto",
            }}
          >
            You stay in control. Your client gets a no-code editor for the parts you approve.
          </p>
        </div>
      </section>

      {/* ── Three pillars ────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 88px" }}>
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              title: "Safe handoff",
              body: "Clients edit only what you approve. Layout and publishing stay yours.",
            },
            {
              title: "Drops into your app",
              body: "Replit, Next.js, plain HTML — paste one snippet.",
            },
            {
              title: "Simple for clients",
              body: "No code. Just a clean editor.",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: BRAND.surface,
                border: `1px solid ${tone[100]}`,
                borderRadius: 18,
                padding: "26px 24px",
              }}
            >
              <p
                style={{
                  fontSize: type.md,
                  fontWeight: 700,
                  marginBottom: 8,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.title}
              </p>
              <p style={{ fontSize: type.base, lineHeight: 1.6, color: tone[600] }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      {/* Second mascot placement: nestled to the right of the steps as a
          friendly accent. On narrow screens it stacks above the steps. */}
      <section style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p
            style={{
              fontSize: type.xs,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: tone[500],
              marginBottom: 28,
              textAlign: "center",
            }}
          >
            How it works
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 32,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { n: "1", title: "Build your app", body: "Replit or any stack." },
                { n: "2", title: "Connect get", body: "One key, one snippet." },
                { n: "3", title: "Choose what's editable", body: "Approve fields. Lock the rest." },
                { n: "4", title: "Invite your client", body: "Private, no-code editor." },
                { n: "5", title: "Review and publish", body: "Nothing goes live until you approve." },
              ].map((step, i, arr) => (
                <div key={step.n} style={{ display: "flex", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: BRAND.ink,
                        color: BRAND.paper,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {step.n}
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: tone[200], margin: "6px 0" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 22 : 0, paddingTop: 2 }}>
                    <p
                      style={{
                        fontSize: type.md,
                        fontWeight: 700,
                        marginBottom: 4,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {step.title}
                    </p>
                    <p style={{ fontSize: type.base, lineHeight: 1.6, color: tone[600] }}>
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mascot accent — hidden on narrow viewports via inline media
                rule (we render an empty container; visibility is controlled
                with a CSS class defined in index.css). */}
            <div
              className="landing-mascot-side"
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={mascotPath}
                alt=""
                style={{
                  width: 140,
                  height: 140,
                  objectFit: "contain",
                  display: "block",
                  userSelect: "none",
                }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Control / safe ───────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            background: BRAND.ink,
            borderRadius: 22,
            padding: "44px 36px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "clamp(18px, 3vw, 24px)",
              fontWeight: 600,
              color: BRAND.paper,
              letterSpacing: "-0.02em",
              lineHeight: 1.35,
              maxWidth: 520,
              margin: "0 auto",
            }}
          >
            You stay in control of layout, permissions, publishing, and access.
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 64px", textAlign: "center" }}>
        <p
          style={{
            fontSize: "clamp(22px, 4vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            marginBottom: 12,
            lineHeight: 1.25,
          }}
        >
          Build your app. Connect get.
          <br />
          Let clients edit safely.
        </p>
        <p
          style={{
            fontSize: type.sm,
            color: tone[500],
            marginBottom: 24,
          }}
        >
          Minutes, not a migration.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 52,
              padding: "0 32px",
              borderRadius: 999,
              background: BRAND.ink,
              color: BRAND.paper,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              textDecoration: "none",
              transition: `opacity 0.25s ${ease}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            Start free
          </Link>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 52,
              padding: "0 28px",
              borderRadius: 999,
              background: "transparent",
              color: BRAND.ink,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              textDecoration: "none",
              border: `1px solid ${tone[200]}`,
              transition: `background 0.25s ${ease}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = tone[50]; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            Sign in
          </Link>
        </div>
      </section>

      <footer
        style={{
          padding: "24px 24px 40px",
          textAlign: "center",
          fontSize: type.xs,
          color: tone[400],
        }}
      >
        © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
