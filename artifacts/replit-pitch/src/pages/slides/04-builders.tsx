export default function BuildersSlide() {
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
        04
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
            What this means for builders
          </div>
        </div>

        <div style={{ marginTop: "6vh" }}>
          <h2
            className="font-display font-bold text-text m-0"
            style={{
              fontSize: "4.6vw",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
              maxWidth: "75vw",
            }}
          >
            Hours back. More clients. A real line item.
          </h2>

          <ul
            className="font-body font-normal text-text list-none p-0"
            style={{
              marginTop: "5vh",
              fontSize: "1.7vw",
              lineHeight: 1.45,
              maxWidth: "78vw",
              textWrap: "pretty",
            }}
          >
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                01
              </span>
              <span>
                <span style={{ fontWeight: 700 }}>Stop being the CMS.</span>{" "}
                The 30-minute &ldquo;can you tweak this?&rdquo; ticket goes
                away. That&apos;s hours back, per client, every week.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                02
              </span>
              <span>
                <span style={{ fontWeight: 700 }}>Charge for it.</span>{" "}
                &ldquo;Client editor access&rdquo; becomes a recurring line
                item — handoff turns into monthly revenue instead of a
                one-time invoice.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                03
              </span>
              <span>
                <span style={{ fontWeight: 700 }}>Take more clients without taking more hours.</span>{" "}
                Capacity stops being capped by maintenance, so the next
                build can actually start.
              </span>
            </li>
            <li className="flex items-start" style={{ marginBottom: "2.2vh" }}>
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                04
              </span>
              <span>
                <span style={{ fontWeight: 700 }}>Look like a product, not a freelancer.</span>{" "}
                Clients log into a clean, branded editor under the
                builder&apos;s name — not a Notion doc or a Slack DM.
              </span>
            </li>
            <li className="flex items-start">
              <span
                className="text-text/40"
                style={{ marginRight: "1.6vw", fontWeight: 600 }}
              >
                05
              </span>
              <span>
                <span style={{ fontWeight: 700 }}>Keep clients longer.</span>{" "}
                When clients feel ownership of the site, they don&apos;t
                churn to a &ldquo;real&rdquo; agency a year in.
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
