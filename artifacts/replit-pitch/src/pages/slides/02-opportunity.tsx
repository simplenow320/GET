export default function OpportunitySlide() {
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
        01
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
            The Opportunity
          </div>
        </div>

        <div style={{ marginTop: "7vh", maxWidth: "72vw" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "4.6vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            The next challenge begins after the app ships.
          </h2>

          <p
            className="font-body font-normal text-text"
            style={{
              marginTop: "4vh",
              fontSize: "1.9vw",
              lineHeight: 1.5,
              maxWidth: "64vw",
              textWrap: "pretty",
            }}
          >
            People who never considered themselves developers are now building
            real applications, launching businesses, and serving paying
            clients. Then every client asks for updates.
          </p>
        </div>

        <div
          className="flex"
          style={{ marginTop: "5vh", gap: "1.4vw", flexWrap: "wrap" }}
        >
          <div
            className="font-body font-semibold text-text"
            style={{
              fontSize: "1.5vw",
              padding: "1.4vh 1.6vw",
              borderRadius: "1vh",
              background: "rgba(255, 215, 71, 0.28)",
            }}
          >
            Change this headline.
          </div>
          <div
            className="font-body font-semibold text-text"
            style={{
              fontSize: "1.5vw",
              padding: "1.4vh 1.6vw",
              borderRadius: "1vh",
              background: "rgba(255, 215, 71, 0.28)",
            }}
          >
            Swap this image.
          </div>
          <div
            className="font-body font-semibold text-text"
            style={{
              fontSize: "1.5vw",
              padding: "1.4vh 1.6vw",
              borderRadius: "1vh",
              background: "rgba(255, 215, 71, 0.28)",
            }}
          >
            Update our pricing.
          </div>
          <div
            className="font-body font-semibold text-text"
            style={{
              fontSize: "1.5vw",
              padding: "1.4vh 1.6vw",
              borderRadius: "1vh",
              background: "rgba(255, 215, 71, 0.28)",
            }}
          >
            Fix this typo.
          </div>
        </div>

        <p
          className="font-body font-semibold text-text"
          style={{
            marginTop: "5vh",
            fontSize: "1.9vw",
            lineHeight: 1.45,
            maxWidth: "64vw",
            textWrap: "pretty",
          }}
        >
          These aren&apos;t coding problems. They&apos;re content problems. The
          app is finished &mdash; the maintenance never is.
        </p>

        <div
          className="font-body font-medium text-muted uppercase"
          style={{ marginTop: "auto", fontSize: "1vw", letterSpacing: "0.2em" }}
        >
          A Proposal for Replit
        </div>
      </div>
    </div>
  );
}
