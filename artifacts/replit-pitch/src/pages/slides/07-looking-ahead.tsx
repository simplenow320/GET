export default function LookingAheadSlide() {
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
          color: "rgba(255, 215, 71, 0.22)",
          zIndex: 0,
        }}
      >
        06
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
            Looking Ahead
          </div>
        </div>

        <div
          className="flex-1 flex items-center"
          style={{ marginTop: "2vh", gap: "4vw" }}
        >
          <div style={{ flex: "1 1 56%", maxWidth: "56vw" }}>
            <h2
              className="font-display font-bold text-text m-0"
              style={{
                fontSize: "5vw",
                lineHeight: 1.02,
                letterSpacing: "-0.04em",
                textWrap: "balance",
              }}
            >
              get could become part of Replit itself.
            </h2>

            <p
              className="font-body font-normal text-text"
              style={{
                marginTop: "4vh",
                fontSize: "1.6vw",
                lineHeight: 1.5,
                textWrap: "pretty",
              }}
            >
              If Replit sees long-term strategic value, we&apos;d welcome a
              conversation around partnership, licensing, or acquisition.
            </p>

            <p
              className="font-body font-semibold text-text"
              style={{
                marginTop: "3vh",
                fontSize: "1.5vw",
                lineHeight: 1.45,
                textWrap: "pretty",
              }}
            >
              Help every vibe coder ship applications their clients can
              confidently manage &mdash; while builders stay focused on
              creating, not maintaining.
            </p>
          </div>

          <div
            className="flex items-center justify-center"
            style={{ flex: "1 1 44%" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}get-partnership-clean.png`}
              crossOrigin="anonymous"
              alt="get and Replit, together"
              style={{
                maxHeight: "54vh",
                maxWidth: "38vw",
                width: "auto",
                height: "auto",
                display: "block",
              }}
            />
          </div>
        </div>

        <div
          className="font-body font-medium text-muted uppercase"
          style={{ marginTop: "auto", fontSize: "1vw", letterSpacing: "0.2em" }}
        >
          A Proposal for Replit &middot; 2026
        </div>
      </div>
    </div>
  );
}
