export default function ReplitSlide() {
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
            Why this is good for Replit
          </div>
        </div>

        <div style={{ marginTop: "6vh" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "4.6vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
              maxWidth: "75vw",
            }}
          >
            Replit becomes the place you build sites you can actually hand off.
          </h2>

          <ul
            className="font-body font-normal text-text list-none p-0"
            style={{
              marginTop: "5vh",
              fontSize: "1.7vw",
              lineHeight: 1.45,
              maxWidth: "78vw",
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
                <span style={{ fontWeight: 700 }}>Stickier builders.</span>{" "}
                The vibe coder who lands paying clients stays on Replit
                longer and upgrades — instead of bouncing to Webflow or Wix
                the moment a real client shows up.
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
                <span style={{ fontWeight: 700 }}>A new use case unlocked.</span>{" "}
                &ldquo;Build client sites on Replit&rdquo; stops being a
                technical demo and becomes a real freelancer/agency workflow.
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
                <span style={{ fontWeight: 700 }}>Builders ship more.</span>{" "}
                Time that was burned on tiny client edits goes back to
                building new things — which means more apps deployed on
                Replit, not fewer.
              </span>
            </li>
            <li className="flex items-start">
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                04
              </span>
              <span>
                <span style={{ fontWeight: 700 }}>A friendly door for non-technical clients.</span>{" "}
                Their first touch with a Replit-built site is a clean,
                white-labeled editor — not a 500 page or a stale export.
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
