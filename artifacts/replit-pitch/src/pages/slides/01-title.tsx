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
          color: "rgba(255, 215, 71, 0.18)",
          zIndex: 0,
        }}
      >
        get
      </div>

      <div
        className="relative h-full flex flex-col box-border"
        style={{ padding: "5vh 6vw", zIndex: 1 }}
      >
        <div
          className="flex justify-end items-center"
          style={{
            paddingBottom: "3vh",
            borderBottom: "0.15vh solid var(--slide-divider)",
          }}
        >
          <div
            className="font-body font-semibold text-muted uppercase"
            style={{ fontSize: "1vw", letterSpacing: "0.18em" }}
          >
            A Proposal for Replit &middot; 2026
          </div>
        </div>

        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ marginTop: "1vh" }}
        >
          <img
            src={`${import.meta.env.BASE_URL}get-hero.png`}
            crossOrigin="anonymous"
            alt="get"
            style={{
              maxHeight: "44vh",
              maxWidth: "70vw",
              width: "auto",
              height: "auto",
              display: "block",
            }}
          />

          <h1
            className="font-display font-bold text-text text-center m-0"
            style={{
              marginTop: "4vh",
              fontSize: "4.2vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            The Missing Layer for Vibe Coding
          </h1>

          <p
            className="font-body font-semibold text-muted uppercase text-center"
            style={{
              marginTop: "3vh",
              fontSize: "1.15vw",
              letterSpacing: "0.22em",
            }}
          >
            A Proposal for Replit
          </p>
        </div>
      </div>
    </div>
  );
}
