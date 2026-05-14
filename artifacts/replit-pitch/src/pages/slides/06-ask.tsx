export default function AskSlide() {
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
          color: "rgba(255, 215, 71, 0.45)",
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
          <div
            className="font-display font-bold text-text lowercase"
            style={{ fontSize: "2.4vw", lineHeight: 1, letterSpacing: "-0.03em" }}
          >
            get
          </div>
          <div
            className="font-body font-medium text-muted uppercase"
            style={{ fontSize: "1vw", letterSpacing: "0.18em" }}
          >
            What I&apos;m looking for
          </div>
        </div>

        <div style={{ marginTop: "14vh", maxWidth: "70vw" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "9vw",
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            Bring me in.
          </h2>
          <p
            className="font-body font-normal text-muted"
            style={{
              fontSize: "2.1vw",
              marginTop: "5vh",
              lineHeight: 1.5,
              maxWidth: "60vw",
              textWrap: "pretty",
            }}
          >
            I&apos;d love to talk about how get fits into Replit&apos;s story
            for builders shipping client work. Pilot, integration, distribution
            — happy to start anywhere.
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
          Replit Partnership Pitch · 2026
        </div>
      </div>
    </div>
  );
}
