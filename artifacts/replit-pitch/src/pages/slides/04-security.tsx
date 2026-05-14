export default function SecuritySlide() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute font-display font-bold select-none pointer-events-none"
        style={{
          bottom: "-4vh",
          right: "-2vw",
          fontSize: "25vw",
          lineHeight: 0.8,
          letterSpacing: "-0.05em",
          color: "rgba(255, 215, 71, 0.35)",
          zIndex: 0,
        }}
      >
        04
      </div>

      <div
        className="relative h-full flex flex-col box-border"
        style={{ padding: "6vh 6vw", zIndex: 1 }}
      >
        <div
          className="flex justify-end items-center"
          style={{
            paddingBottom: "4vh",
            borderBottom: "0.15vh solid var(--slide-divider)",
          }}
        >
          <div
            className="font-body font-semibold text-muted uppercase"
            style={{ fontSize: "1vw", letterSpacing: "0.18em" }}
          >
            Security, already shipped
          </div>
        </div>

        <div style={{ marginTop: "8vh" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "5vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
              maxWidth: "70vw",
            }}
          >
            Built like infrastructure, not a side project.
          </h2>

          <ul
            className="font-body font-normal text-text list-none p-0"
            style={{
              marginTop: "5vh",
              fontSize: "1.7vw",
              lineHeight: 1.45,
              maxWidth: "72vw",
              textWrap: "pretty",
            }}
          >
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                01
              </span>
              <span>
                Sessions, project keys, reset and invite tokens are stored
                only as SHA-256 hashes — plaintext never touches the database.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                02
              </span>
              <span>
                CSRF defense in depth: SameSite=Lax cookies, an Origin gate
                on every mutating request, and an explicit CORS allowlist.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                03
              </span>
              <span>
                Per-project domain allowlist on the public API — a project
                key only works from origins the developer approved.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                04
              </span>
              <span>
                Every user-supplied string is sanitized server-side before
                it&apos;s persisted; the editor never renders raw HTML.
              </span>
            </li>
            <li className="flex items-start">
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                05
              </span>
              <span>
                Google OAuth with PKCE and HMAC-signed state; password
                resets run in constant time to prevent email enumeration.
              </span>
            </li>
          </ul>
        </div>

        <div
          className="font-body font-medium text-muted uppercase"
          style={{
            marginTop: "auto",
            fontSize: "1vw",
            letterSpacing: "0.2em",
          }}
        >
          Replit Partnership Pitch
        </div>
      </div>
    </div>
  );
}
