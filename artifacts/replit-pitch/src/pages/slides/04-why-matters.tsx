export default function WhyMattersSlide() {
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
        03
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
            Why This Matters
          </div>
        </div>

        <h2
          className="font-display font-bold text-text m-0"
          style={{
            marginTop: "5vh",
            fontSize: "3.4vw",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          Everyone wins.
        </h2>

        <div
          className="flex"
          style={{ marginTop: "5vh", gap: "2.6vw", flex: "1 1 auto" }}
        >
          <div style={{ flex: "1 1 33%" }}>
            <div
              className="font-body font-bold uppercase"
              style={{
                fontSize: "1.3vw",
                letterSpacing: "0.14em",
                color: "var(--slide-text)",
                paddingBottom: "1.6vh",
                borderBottom: "0.4vh solid var(--slide-accent)",
                display: "inline-block",
              }}
            >
              For Replit
            </div>
            <ul
              className="font-body font-normal text-text list-none p-0"
              style={{
                marginTop: "2.6vh",
                fontSize: "1.35vw",
                lineHeight: 1.4,
                textWrap: "pretty",
              }}
            >
              <li style={{ marginBottom: "1.8vh" }}>
                More valuable for freelancers and agencies
              </li>
              <li style={{ marginBottom: "1.8vh" }}>
                Builders serve more clients with less support
              </li>
              <li style={{ marginBottom: "1.8vh" }}>
                Stronger long-term platform stickiness
              </li>
              <li>The easiest place to build and maintain client apps</li>
            </ul>
          </div>

          <div style={{ flex: "1 1 33%" }}>
            <div
              className="font-body font-bold uppercase"
              style={{
                fontSize: "1.3vw",
                letterSpacing: "0.14em",
                color: "var(--slide-text)",
                paddingBottom: "1.6vh",
                borderBottom: "0.4vh solid var(--slide-accent)",
                display: "inline-block",
              }}
            >
              For the Vibe Coder
            </div>
            <ul
              className="font-body font-normal text-text list-none p-0"
              style={{
                marginTop: "2.6vh",
                fontSize: "1.35vw",
                lineHeight: 1.4,
                textWrap: "pretty",
              }}
            >
              <li style={{ marginBottom: "1.8vh" }}>Build once, then hand it off</li>
              <li style={{ marginBottom: "1.8vh" }}>
                Stop making small edits every week
              </li>
              <li style={{ marginBottom: "1.8vh" }}>
                Look like you built a pro editing system
              </li>
              <li>More time building, less time maintaining</li>
            </ul>
          </div>

          <div style={{ flex: "1 1 33%" }}>
            <div
              className="font-body font-bold uppercase"
              style={{
                fontSize: "1.3vw",
                letterSpacing: "0.14em",
                color: "var(--slide-text)",
                paddingBottom: "1.6vh",
                borderBottom: "0.4vh solid var(--slide-accent)",
                display: "inline-block",
              }}
            >
              For the Client
            </div>
            <ul
              className="font-body font-normal text-text list-none p-0"
              style={{
                marginTop: "2.6vh",
                fontSize: "1.35vw",
                lineHeight: 1.4,
                textWrap: "pretty",
              }}
            >
              <li style={{ marginBottom: "1.8vh" }}>Update content in seconds</li>
              <li style={{ marginBottom: "1.8vh" }}>
                No technical knowledge required
              </li>
              <li style={{ marginBottom: "1.8vh" }}>No fear of breaking the app</li>
              <li>No waiting on someone else</li>
            </ul>
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
