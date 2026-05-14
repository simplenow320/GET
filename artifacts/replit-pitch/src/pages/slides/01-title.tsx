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
          color: "rgba(255, 215, 71, 0.22)",
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
            Partnership Pitch
          </div>
        </div>

        <div style={{ marginTop: "4vh", maxWidth: "90vw" }}>
          <img
            src={`${import.meta.env.BASE_URL}get-logo.png`}
            crossOrigin="anonymous"
            alt="get logo"
            style={{ height: "55vh", width: "auto", display: "block", marginLeft: "-2vw" }}
          />
          <p
            className="font-body font-semibold text-text"
            style={{
              fontSize: "2.4vw",
              marginTop: "2vh",
              lineHeight: 1.35,
              maxWidth: "60vw",
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
