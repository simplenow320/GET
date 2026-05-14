export default function WhatSlide() {
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
        03
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
            What get does
          </div>
        </div>

        <div style={{ marginTop: "10vh" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "5vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
              maxWidth: "70vw",
            }}
          >
            Drop in one script. Tag the editable bits. Done.
          </h2>

          <ul
            className="font-body font-normal text-text list-none p-0"
            style={{
              marginTop: "6vh",
              fontSize: "2vw",
              lineHeight: 1.5,
              maxWidth: "70vw",
              textWrap: "pretty",
            }}
          >
            <li className="flex items-start" style={{ marginBottom: "2.4vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                01
              </span>
              <span>
                Hosted CMS that lives next to the code, not inside it.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.4vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                02
              </span>
              <span>
                Clients edit text and images in a white-labeled UI the
                developer brands as their own.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.4vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                03
              </span>
              <span>
                Optional review queue so nothing goes live without the
                developer&apos;s sign-off.
              </span>
            </li>
            <li className="flex items-start">
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                04
              </span>
              <span>
                Works with anything that renders HTML — React, Next, Astro,
                plain HTML.
              </span>
            </li>
          </ul>
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
