import { Link } from "wouter";
import logoHeroPath from "@assets/6BEE8433-78A4-49DD-9122-EDC5A3E40858_1777094465701.png";

const C = "#1a1a2e";
const BG = "#faf9f6";

export default function LandingPage() {
  return (
    <div style={{ backgroundColor: BG, color: C, minHeight: "100dvh" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "72px 24px 80px" }}>
        <img
          src={logoHeroPath}
          alt="get"
          style={{
            width: "100%", maxWidth: 320, marginBottom: 28,
            mixBlendMode: "multiply",
          }}
        />

        <h1 style={{
          fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700,
          letterSpacing: "-0.03em", lineHeight: 1.15,
          maxWidth: 520, margin: "0 auto 20px",
        }}>
          Let clients edit your app without breaking it.
        </h1>

        <p style={{
          fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.65,
          color: `${C}99`, maxWidth: 420, margin: "0 auto 44px",
        }}>
          The simplest way to give clients safe, visual editing in apps you build.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/signup">
            <button style={{
              height: 52, padding: "0 32px", borderRadius: 999,
              background: C, color: BG,
              border: "none", fontSize: 16, fontWeight: 600,
              cursor: "pointer", letterSpacing: "-0.01em",
            }}>
              Start free
            </button>
          </Link>
          <Link href="/login">
            <button style={{
              height: 52, padding: "0 24px", borderRadius: 999,
              background: "transparent", color: C,
              border: "none", fontSize: 16, fontWeight: 500,
              cursor: "pointer", opacity: 0.45,
            }}>
              Sign in
            </button>
          </Link>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 88px" }}>
        <div style={{
          maxWidth: 860, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}>
          {[
            {
              title: "Visual editing for clients",
              body: "Clients see a clean, simple editor — just the areas you've allowed. No code, no confusion.",
            },
            {
              title: "Design stays protected",
              body: "Layouts, styles, and logic are never exposed. Only the content you choose can change.",
            },
            {
              title: "Fast setup for Replit-built apps",
              body: "A few lines of setup and you're connected. Works with any Replit app out of the box.",
            },
          ].map((item) => (
            <div key={item.title} style={{
              background: "#fff", border: `1px solid ${C}0d`,
              borderRadius: 18, padding: "28px 26px",
            }}>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.01em" }}>
                {item.title}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: `${C}88` }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: "0.09em",
            textTransform: "uppercase", color: `${C}55`, marginBottom: 32,
            textAlign: "center",
          }}>
            How it works
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { n: "1", title: "Build your app", body: "Finish building in Replit or your framework of choice. Get runs alongside whatever you build." },
              { n: "2", title: "Connect get", body: "Install the SDK, add your project key, and you're live. Takes about three minutes." },
              { n: "3", title: "Invite clients to edit safely", body: "Clients get a private link to their editor. They change content. Nothing else." },
            ].map((step, i, arr) => (
              <div key={step.n} style={{ display: "flex", gap: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: C, color: BG,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {step.n}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: `${C}12`, margin: "6px 0" }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? 32 : 0, paddingTop: 6 }}>
                  <p style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>{step.title}</p>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: `${C}77` }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 88px" }}>
        <div style={{
          maxWidth: 860, margin: "0 auto",
          background: C, borderRadius: 22,
          padding: "48px 40px", textAlign: "center",
        }}>
          <p style={{
            fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 700,
            color: BG, letterSpacing: "-0.02em", lineHeight: 1.35,
            maxWidth: 480, margin: "0 auto",
          }}>
            Keep control of layout, permissions, publishing, and access.
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 96px", textAlign: "center" }}>
        <p style={{
          fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 700,
          letterSpacing: "-0.025em", marginBottom: 28,
        }}>
          Set up client editing in minutes.
        </p>
        <Link href="/signup">
          <button style={{
            height: 52, padding: "0 36px", borderRadius: 999,
            background: C, color: BG,
            border: "none", fontSize: 16, fontWeight: 600,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}>
            Start free
          </button>
        </Link>
      </section>

    </div>
  );
}
