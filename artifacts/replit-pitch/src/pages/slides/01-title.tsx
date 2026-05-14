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
        2026
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
            Partnership Pitch &middot; 2026
          </div>
        </div>

        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ marginTop: "1vh" }}
        >
          <img
            src={`${import.meta.env.BASE_URL}get-hero.png`}
            crossOrigin="anonymous"
            alt="get — let clients edit your app without breaking it"
            style={{
              maxHeight: "62vh",
              maxWidth: "78vw",
              width: "auto",
              height: "auto",
              display: "block",
            }}
          />

          <p
            className="font-body font-semibold text-muted uppercase text-center"
            style={{
              marginTop: "3vh",
              fontSize: "1.15vw",
              letterSpacing: "0.22em",
            }}
          >
            For Replit builders shipping sites for real clients
          </p>
        </div>
      </div>
    </div>
  );
}
