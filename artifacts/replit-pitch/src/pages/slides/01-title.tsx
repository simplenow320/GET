export default function TitleSlide() {
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
        2026
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
            Partnership Pitch
          </div>
        </div>

        <div style={{ marginTop: "10vh", maxWidth: "70vw" }}>
          <img
            src={`${import.meta.env.BASE_URL}get-logo.png`}
            crossOrigin="anonymous"
            alt="get logo"
            style={{ height: "30vh", width: "auto", display: "block" }}
          />
          <p
            className="font-body font-normal text-muted"
            style={{
              fontSize: "2.1vw",
              marginTop: "5vh",
              lineHeight: 1.4,
              maxWidth: "55vw",
              textWrap: "pretty",
            }}
          >
            A hosted control plane that lets vibe-coded sites give clients safe,
            visual editing access — without rebuilding in a CMS.
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
          For Replit · 2026
        </div>
      </div>
    </div>
  );
}
