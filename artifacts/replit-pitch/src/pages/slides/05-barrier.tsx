export default function BarrierSlide() {
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
          className="flex justify-between items-center"
          style={{
            paddingBottom: "4vh",
            borderBottom: "0.15vh solid var(--slide-divider)",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}get-logo.png`}
            crossOrigin="anonymous"
            alt="get"
            style={{ height: "5vh", width: "auto", display: "block" }}
          />
          <div
            className="font-body font-semibold text-muted uppercase"
            style={{ fontSize: "1vw", letterSpacing: "0.18em" }}
          >
            The Only Barrier
          </div>
        </div>

        <div style={{ marginTop: "6vh", maxWidth: "70vw" }}>
          <p
            className="font-body font-medium text-muted"
            style={{ fontSize: "1.5vw", lineHeight: 1.5 }}
          >
            The platform works. The runtime works. The editor works. The
            security model is in place.
          </p>

          <h2
            className="font-display font-bold text-text m-0"
            style={{
              marginTop: "3vh",
              fontSize: "4.8vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            The only friction is installation.
          </h2>
        </div>

        <div
          className="flex items-center"
          style={{ marginTop: "5vh", gap: "1vw", flexWrap: "wrap" }}
        >
          <span
            className="font-body font-semibold text-muted"
            style={{ fontSize: "1.3vw" }}
          >
            Today, users must manually:
          </span>
          <span
            className="font-body font-semibold text-text"
            style={{ fontSize: "1.4vw" }}
          >
            Download a scanner file
          </span>
          <span className="text-muted" style={{ fontSize: "1.4vw" }}>
            &rarr;
          </span>
          <span
            className="font-body font-semibold text-text"
            style={{ fontSize: "1.4vw" }}
          >
            Add it to the project
          </span>
          <span className="text-muted" style={{ fontSize: "1.4vw" }}>
            &rarr;
          </span>
          <span
            className="font-body font-semibold text-text"
            style={{ fontSize: "1.4vw" }}
          >
            Insert a script
          </span>
          <span className="text-muted" style={{ fontSize: "1.4vw" }}>
            &rarr;
          </span>
          <span
            className="font-body font-semibold text-text"
            style={{ fontSize: "1.4vw" }}
          >
            Configure the project
          </span>
        </div>

        <p
          className="font-body font-normal text-text"
          style={{
            marginTop: "4vh",
            fontSize: "1.6vw",
            lineHeight: 1.5,
            maxWidth: "62vw",
            textWrap: "pretty",
          }}
        >
          For a platform built around vibe coding, this feels unnecessarily
          technical. The ideal workflow is one prompt:
        </p>

        <div
          className="font-display font-bold text-text"
          style={{
            marginTop: "3vh",
            fontSize: "3vw",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            padding: "2.2vh 2.4vw",
            borderRadius: "1.2vh",
            background: "rgba(255, 215, 71, 0.35)",
            display: "inline-block",
          }}
        >
          &ldquo;Add get to my app.&rdquo;
        </div>

        <div
          className="font-body font-medium text-muted uppercase"
          style={{ marginTop: "auto", fontSize: "1vw", letterSpacing: "0.2em" }}
        >
          A Proposal for Replit
        </div>
      </div>
    </div>
  );
}
