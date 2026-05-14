export default function WhyNowSlide() {
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
        07
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
            Why now
          </div>
        </div>

        <div style={{ marginTop: "12vh", maxWidth: "65vw" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "5.4vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            Vibe coding is mainstream. Client handoff isn&apos;t solved.
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
            More builders on Replit are shipping work for paying clients.
            They need a CMS that respects how their app is built — not one
            that asks them to migrate off the platform that built it.
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
