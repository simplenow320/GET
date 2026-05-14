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
          color: "rgba(255, 215, 71, 0.22)",
          zIndex: 0,
        }}
      >
        08
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
            What I&apos;m looking for
          </div>
        </div>

        <div
          className="flex-1 flex items-center"
          style={{ marginTop: "2vh", gap: "4vw" }}
        >
          <div style={{ flex: "1 1 55%", maxWidth: "55vw" }}>
            <h2
              className="font-display font-bold text-text m-0"
              style={{
                fontSize: "8vw",
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              Let&apos;s partner.
            </h2>
            <p
              className="font-body font-normal text-text"
              style={{
                fontSize: "1.9vw",
                marginTop: "4vh",
                lineHeight: 1.45,
                textWrap: "pretty",
              }}
            >
              I&apos;d love to talk about how get fits into Replit&apos;s story
              for builders shipping client work — pilot, integration, or
              distribution.
            </p>
            <p
              className="font-body font-semibold text-text"
              style={{
                fontSize: "1.6vw",
                marginTop: "3vh",
                lineHeight: 1.45,
              }}
            >
              Happy to start anywhere.
            </p>
          </div>

          <div
            className="flex items-center justify-center"
            style={{ flex: "1 1 45%" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}get-partnership-clean.png`}
              crossOrigin="anonymous"
              alt="get and Replit, together"
              style={{
                maxHeight: "55vh",
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
