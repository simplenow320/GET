import { Link } from "wouter";
import logoHeroPath from "@assets/6BEE8433-78A4-49DD-9122-EDC5A3E40858_1777094465701.png";
import { BRAND, tone, type, ease, Wordmark } from "@/lib/ui";

export default function LandingPage() {
  return (
    <div style={{ backgroundColor: BRAND.paper, color: BRAND.ink, minHeight: "100dvh" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: "20px 24px",
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark size={22} />
        <Link
          href="/login"
          style={{
            fontSize: type.base,
            color: tone[600],
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "32px 24px 80px",
        }}
      >
        <img
          src={logoHeroPath}
          alt=""
          style={{
            width: "100%",
            maxWidth: 280,
            marginBottom: -28,
            mixBlendMode: "multiply",
          }}
        />

        <h1
          style={{
            fontSize: "clamp(30px, 5vw, 46px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            maxWidth: 560,
            margin: "0 auto 18px",
          }}
        >
          Let clients edit your app — without breaking it.
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 18px)",
            lineHeight: 1.6,
            color: tone[600],
            maxWidth: 460,
            margin: "0 auto 36px",
          }}
        >
          The simplest way to give clients safe, visual editing in apps you build.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/signup"
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
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              title: "Visual editing for clients",
              body:
                "Clients see a clean, simple editor — just the areas you've allowed. No code, no confusion.",
            },
            {
              title: "Design stays protected",
              body:
                "Layouts, styles, and logic stay locked. Only the content you choose can change.",
            },
            {
              title: "Three-minute setup",
              body:
                "A few lines of code and you're connected. Works with any web app — Replit included.",
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
      <section style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { n: "1", title: "Build your app", body: "Finish building in Replit or any framework." },
              { n: "2", title: "Connect it", body: "Install the SDK, add your project key. Three minutes." },
              { n: "3", title: "Invite clients", body: "Clients get a private editor. They change content. Nothing else." },
            ].map((step, i, arr) => (
              <div key={step.n} style={{ display: "flex", gap: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
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
                <div style={{ paddingBottom: i < arr.length - 1 ? 28 : 0, paddingTop: 4 }}>
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
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────── */}
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
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            You stay in control of layout, permissions, publishing, and access.
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 96px", textAlign: "center" }}>
        <p
          style={{
            fontSize: "clamp(22px, 4vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            marginBottom: 24,
          }}
        >
          Set up client editing in minutes.
        </p>
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
      </section>

      <footer
        style={{
          padding: "20px 24px 40px",
          textAlign: "center",
          fontSize: type.xs,
          color: tone[400],
        }}
      >
        © {new Date().getFullYear()} get
      </footer>
    </div>
  );
}
