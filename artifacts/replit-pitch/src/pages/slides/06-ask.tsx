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
          color: "rgba(255, 215, 71, 0.3)",
          zIndex: 0,
        }}
      >
        05
      </div>

      <div
        className="relative h-full flex flex-col box-border"
        style={{ padding: "6vh 6vw", zIndex: 1 }}
      >
        <div
          className="flex justify-between items-center"
          style={{
            paddingBottom: "3.5vh",
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
            Our Ask
          </div>
        </div>

        <h2
          className="font-display font-bold text-text m-0"
          style={{
            marginTop: "5vh",
            fontSize: "3.6vw",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          Two ways forward.
        </h2>

        <div
          className="flex"
          style={{ marginTop: "5vh", gap: "3vw", flex: "1 1 auto" }}
        >
          <div
            style={{
              flex: "1 1 50%",
              padding: "3vh 2.4vw",
              borderRadius: "1.4vh",
              background: "rgba(26, 26, 46, 0.04)",
              border: "0.15vh solid var(--slide-divider)",
            }}
          >
            <div
              className="font-display font-bold"
              style={{
                fontSize: "1.4vw",
                letterSpacing: "0.04em",
                color: "var(--slide-muted)",
              }}
            >
              Option 1
            </div>
            <div
              className="font-display font-bold text-text"
              style={{
                marginTop: "1.6vh",
                fontSize: "2.2vw",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              Enable get as a trusted internal integration.
            </div>
            <p
              className="font-body font-normal text-text"
              style={{
                marginTop: "2.6vh",
                fontSize: "1.4vw",
                lineHeight: 1.5,
                textWrap: "pretty",
              }}
            >
              Work with your team to validate installation, security,
              performance, and user experience inside the Replit ecosystem.
            </p>
          </div>

          <div
            style={{
              flex: "1 1 50%",
              padding: "3vh 2.4vw",
              borderRadius: "1.4vh",
              background: "rgba(255, 215, 71, 0.22)",
              border: "0.15vh solid rgba(255, 215, 71, 0.6)",
            }}
          >
            <div
              className="font-display font-bold"
              style={{
                fontSize: "1.4vw",
                letterSpacing: "0.04em",
                color: "var(--slide-muted)",
              }}
            >
              Option 2
            </div>
            <div
              className="font-display font-bold text-text"
              style={{
                marginTop: "1.6vh",
                fontSize: "2.2vw",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              Make get an official Replit Integration.
            </div>
            <p
              className="font-body font-normal text-text"
              style={{
                marginTop: "2.6vh",
                fontSize: "1.4vw",
                lineHeight: 1.5,
                textWrap: "pretty",
              }}
            >
              Build your app. Tell the Agent, &ldquo;Add get.&rdquo; Your client
              can immediately manage their own content.
            </p>
          </div>
        </div>

        <div
          className="font-body font-medium text-muted uppercase"
          style={{ marginTop: "2vh", fontSize: "1vw", letterSpacing: "0.2em" }}
        >
          A Proposal for Replit
        </div>
      </div>
    </div>
  );
}
