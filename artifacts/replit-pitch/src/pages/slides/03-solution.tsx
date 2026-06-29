export default function SolutionSlide() {
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
        02
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
            The Solution
          </div>
        </div>

        <div style={{ marginTop: "8vh", maxWidth: "72vw" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "4.6vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Every Replit app gets a simple editing experience.
          </h2>

          <p
            className="font-body font-normal text-text"
            style={{
              marginTop: "5vh",
              fontSize: "2vw",
              lineHeight: 1.5,
              maxWidth: "66vw",
              textWrap: "pretty",
            }}
          >
            The vibe coder builds the app once. The client safely edits their
            own content forever.
          </p>

          <p
            className="font-display font-bold text-text"
            style={{
              marginTop: "4vh",
              fontSize: "2.6vw",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            No code.{" "}
            <span style={{ color: "var(--slide-muted)" }}>No prompts.</span> No
            redeployments.
          </p>

          <p
            className="font-body font-medium text-muted"
            style={{
              marginTop: "4vh",
              fontSize: "1.6vw",
              lineHeight: 1.5,
              maxWidth: "66vw",
              textWrap: "pretty",
            }}
          >
            Clients can edit only what the builder has approved. Everything else
            stays protected &mdash; a built-in content layer, without turning
            the app into a CMS.
          </p>
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
