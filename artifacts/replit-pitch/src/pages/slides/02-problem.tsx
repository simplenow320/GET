export default function ProblemSlide() {
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
            The Problem
          </div>
        </div>

        <div style={{ marginTop: "12vh", maxWidth: "62vw" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "5.6vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Vibe coders ship apps. Then clients ask for changes.
          </h2>
          <p
            className="font-body font-normal text-muted"
            style={{
              fontSize: "2.1vw",
              marginTop: "5vh",
              lineHeight: 1.5,
              maxWidth: "55vw",
              textWrap: "pretty",
            }}
          >
            Most builders hand off a static export, a Notion doc, or another
            round of edits. The site goes stale, the developer gets pinged,
            the client never feels ownership of the thing they paid for.
          </p>
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
