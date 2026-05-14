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

        <div style={{ marginTop: "10vh", maxWidth: "70vw" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "5vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Vibe coders get five clients — and then they stop building.
          </h2>

          <p
            className="font-body font-normal text-text"
            style={{
              marginTop: "5vh",
              fontSize: "2vw",
              lineHeight: 1.5,
              maxWidth: "62vw",
              textWrap: "pretty",
            }}
          >
            Their week stops being &ldquo;ship the next app&rdquo; and starts
            being &ldquo;change this headline, swap that photo, fix this
            paragraph&rdquo; — five times over, forever.
          </p>

          <p
            className="font-body font-medium text-muted"
            style={{
              marginTop: "3vh",
              fontSize: "1.5vw",
              lineHeight: 1.5,
              maxWidth: "62vw",
              textWrap: "pretty",
            }}
          >
            Every client they land is another standing maintenance ticket.
            The new ideas they came to Replit to build never get built.
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
