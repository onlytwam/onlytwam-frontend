import { useState } from "react";

export default function SizeGuide() {
  const [activeTab, setActiveTab] = useState<
    "measure" | "size" | "calc" | "fit"
  >("measure");
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [sizePanel, setSizePanel] = useState<"bras" | "bottoms">("bras");
  const [openFit, setOpenFit] = useState<number | null>(null);
  const [underbust, setUnderbust] = useState("");
  const [bust, setBust] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [result, setResult] = useState<{
    bra: string;
    bottom: string;
    intl: string;
    note: string;
  } | null>(null);

  const toggleStep = (id: string) => setOpenStep(openStep === id ? null : id);
  const toggleFit = (i: number) => setOpenFit(openFit === i ? null : i);

  const calcSize = () => {
    const ub = parseFloat(underbust);
    const b = parseFloat(bust);
    const h = parseFloat(hips);
    if (!ub || !b) return;
    let band = ub % 2 === 0 ? ub : ub + 1;
    if (band < 28) band = 28;
    const diff = Math.round(b - band);
    const cups = ["AA", "A", "B", "C", "D", "DD", "E", "F", "G"];
    const idx = Math.max(0, Math.min(diff - 1, cups.length - 1));
    let bottom = "M",
      intl = "M / 10";
    if (h) {
      if (h <= 35) {
        bottom = "XS";
        intl = "XS / 6";
      } else if (h <= 37) {
        bottom = "S";
        intl = "S / 8";
      } else if (h <= 40) {
        bottom = "M";
        intl = "M / 10";
      } else if (h <= 43) {
        bottom = "L";
        intl = "L / 12";
      } else if (h <= 46) {
        bottom = "XL";
        intl = "XL / 14";
      } else {
        bottom = "XXL";
        intl = "XXL / 16";
      }
    }
    setResult({
      bra: `${band}${cups[idx]}`,
      bottom,
      intl,
      note: "This is your recommended starting size. If between sizes, always size up. The right fit is the one you forget you are wearing.",
    });
  };

  const steps = [
    {
      id: "step1",
      num: "1",
      title: "Band",
      short: "Around your ribcage, just below your bust",
      detailTitle: "Measuring your band",
      detail:
        "Breathe out gently. Wrap the tape snugly around your ribcage, just below your bust. The tape should sit parallel to the floor, not riding up at the back. Keep it firm but not tight. Note this number in inches. This is your band size.",
    },
    {
      id: "step2",
      num: "2",
      title: "Bust",
      short: "Around the fullest part of your chest",
      detailTitle: "Measuring your bust",
      detail:
        "Stand upright with your arms relaxed at your sides. Measure around the fullest part of your bust, usually across the nipple line. The tape should be level all the way around, not digging in or hanging loose. Take a relaxed breath and note the number.",
    },
    {
      id: "step3",
      num: "3",
      title: "Waist",
      short: "Around your narrowest natural waist",
      detailTitle: "Measuring your waist",
      detail:
        "Find the narrowest part of your natural waist, typically about an inch above your navel. Wrap the tape around this point and breathe normally. Do not suck in or hold your breath. The number you get is your natural waist.",
    },
    {
      id: "step4",
      num: "4",
      title: "Hips",
      short: "Around the fullest part of your hips",
      detailTitle: "Measuring your hips",
      detail:
        "Stand with your feet together. Measure around the fullest part of your hips and seat, typically 7 to 9 inches below your natural waist. Make sure the tape is level all the way around and not pulled too tight.",
    },
  ];

  const activeMeasureStep =
    steps.find((step) => step.id === openStep) ?? steps[0];

  const fitCards = [
    {
      icon: "❤",
      title: "The band fits right",
      tag: "Foundation",
      body: "The band should sit horizontally across your back, completely parallel to the floor. On a brand new bra, always start on the loosest hook. As the fabric relaxes over time, you move to tighter hooks. You should comfortably slip two fingers underneath, no more and no less. Remember, the band does 80% of the work. Not the straps.",
    },
    {
      icon: "★",
      title: "The underwire lies flat",
      tag: "Structure",
      body: "The underwire should follow the natural root of your breast, lying flat against your sternum at the centre and against your ribcage at the sides. It should never sit on breast tissue. If it pokes, digs, or lifts away from your body, you need a different size or shape. A well-fitted underwire is something you forget is there.",
    },
    {
      icon: "◆",
      title: "Cups encircle fully",
      tag: "Coverage",
      body: "All of your breast tissue should rest comfortably inside the cup with no spillage at the top, sides, or underarm. A gap at the top means the cup is too large. Tissue spilling over the top or under the arm means you need a larger cup. The centre gore, the small piece of fabric between the cups, should lie flat against your sternum.",
    },
    {
      icon: "♡",
      title: "Straps stay, never dig",
      tag: "Comfort",
      body: "Straps should rest on your shoulders without sliding off or leaving red marks. If they dig in and leave indentations at the end of the day, the band is too loose and the straps are compensating. Always fix the band first, then adjust the straps. Straps are for shape, not support.",
    },
    {
      icon: "✦",
      title: "You forget you are wearing it",
      tag: "The TWAM standard",
      body: "This is the only test that truly matters. A perfectly fitted TWAM bra disappears into your day. No tugging, no adjusting, no awareness of discomfort at all. You move, you breathe, you live. When you stop thinking about what you are wearing, that is your size. That is the TWAM standard.",
    },
  ];

  return (
    <div className="sg-page">
      <section className="sg-hero">
        <div className="container sg-hero__inner">
          <div className="sg-hero__eyebrow">twam</div>
          <h1 className="sg-hero__title">It's all about you</h1>
          <p className="sg-hero__subtitle">Your perfect fit, always</p>
          <div className="sg-hero__pills">
            <span className="sg-pill">True to body sizing</span>
            <span className="sg-pill">Designed for every woman</span>
            <span className="sg-pill">Made with love</span>
          </div>
        </div>
      </section>

      <div className="sg-tabs-wrap">
        <div className="container">
          <div className="sg-tabs" role="tablist" aria-label="Size guide sections">
            {(["measure", "size", "calc", "fit"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`sg-tab${activeTab === tab ? " active" : ""}`}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
              >
                {tab === "measure"
                  ? "Measure"
                  : tab === "size"
                  ? "Size chart"
                  : tab === "calc"
                  ? "Find my size"
                  : "Fit guide"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container sg-shell">
        {activeTab === "measure" && (
          <section className="sg-panel" aria-labelledby="sg-measure-title">
            <div className="sg-section-head">
              <div className="sg-section-label">Step by step</div>
              <h2 id="sg-measure-title" className="sg-section-title">
                How to measure yourself
              </h2>
              <p className="sg-section-desc">
                All you need is a soft measuring tape and two minutes. Measure
                over bare skin for the most accurate result.
              </p>
            </div>

            <div className="sg-measure-layout">
              <div className="sg-step-rail" role="list" aria-label="Measure steps">
                {steps.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`sg-step-card${
                      openStep === s.id ? " active-step" : ""
                    }`}
                    onClick={() => toggleStep(s.id)}
                    aria-expanded={openStep === s.id}
                    role="listitem"
                  >
                    <span className="sg-step-circle">{s.num}</span>
                    <span className="sg-step-title">{s.title}</span>
                    <span className="sg-step-short">{s.short}</span>
                  </button>
                ))}
              </div>

              <div className="sg-step-details">
                <div className="sg-step-detail show">
                  <div className="sg-step-detail-kicker">
                    Step {activeMeasureStep.num}
                  </div>
                  <div className="sg-step-detail-title">
                    {activeMeasureStep.detailTitle}
                  </div>
                  <p>{activeMeasureStep.detail}</p>
                </div>
                <div className="sg-step-side-note">
                  <div className="sg-tip-label">TWAM tip</div>
                  Measure twice and take the larger of the two numbers. Bodies
                  shift throughout the day, so morning measurements tend to be
                  the most consistent. If you are between sizes, always go up.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "size" && (
          <section className="sg-panel" aria-labelledby="sg-size-title">
            <div className="sg-section-head">
              <div className="sg-section-label">Reference</div>
              <h2 id="sg-size-title" className="sg-section-title">
                Size chart
              </h2>
              <p className="sg-section-desc">
                TWAM sizes are designed to fit real bodies. If you fall between
                two sizes, we always recommend sizing up for all-day comfort.
              </p>
            </div>

            <div className="sg-size-toggle" role="tablist" aria-label="Size chart type">
              <button
                type="button"
                className={`sg-stoggle${sizePanel === "bras" ? " active" : ""}`}
                onClick={() => setSizePanel("bras")}
                role="tab"
                aria-selected={sizePanel === "bras"}
              >
                Bras
              </button>
              <button
                type="button"
                className={`sg-stoggle${
                  sizePanel === "bottoms" ? " active" : ""
                }`}
                onClick={() => setSizePanel("bottoms")}
                role="tab"
                aria-selected={sizePanel === "bottoms"}
              >
                Bottoms
              </button>
            </div>

            <div className="sg-table-card">
              {sizePanel === "bras" ? (
                <>
                  <div className="sg-size-row sg-size-row--head">
                    <div className="sg-size-cell header">TWAM</div>
                    <div className="sg-size-cell header">Band (in)</div>
                    <div className="sg-size-cell header">Cup diff</div>
                    <div className="sg-size-cell header">Cup</div>
                  </div>
                  {[
                    ["XS", "28 - 30", 'less than 1"', "A"],
                    ["S", "30 - 32", '1"', "A - B"],
                    ["M", "32 - 34", '2"', "B - C"],
                    ["L", "34 - 36", '3"', "C - D"],
                    ["XL", "36 - 38", '4"', "D - DD"],
                    ["XXL", "38 - 42", '5"', "DD+"],
                  ].map(([sz, ...vals]) => (
                    <div className="sg-size-row" key={sz}>
                      <div className="sg-size-cell twam-size">{sz}</div>
                      {vals.map((v, i) => (
                        <div key={i} className="sg-size-cell">
                          {v}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="sg-size-row sg-size-row--head">
                    <div className="sg-size-cell header">TWAM</div>
                    <div className="sg-size-cell header">Waist (in)</div>
                    <div className="sg-size-cell header">Hips (in)</div>
                    <div className="sg-size-cell header">Intl</div>
                  </div>
                  {[
                    ["XS", "24 - 26", "33 - 35", "XS / 6"],
                    ["S", "26 - 28", "35 - 37", "S / 8"],
                    ["M", "28 - 31", "37 - 40", "M / 10"],
                    ["L", "31 - 34", "40 - 43", "L / 12"],
                    ["XL", "34 - 37", "43 - 46", "XL / 14"],
                    ["XXL", "37 - 41", "46 - 50", "XXL / 16"],
                  ].map(([sz, ...vals]) => (
                    <div className="sg-size-row" key={sz}>
                      <div className="sg-size-cell twam-size">{sz}</div>
                      {vals.map((v, i) => (
                        <div key={i} className="sg-size-cell">
                          {v}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
              <div className="sg-size-note">
                All measurements in inches. For cm, multiply by 2.54.
              </div>
            </div>
          </section>
        )}

        {activeTab === "calc" && (
          <section className="sg-panel" aria-labelledby="sg-calc-title">
            <div className="sg-section-head">
              <div className="sg-section-label">Just for you</div>
              <h2 id="sg-calc-title" className="sg-section-title">
                Find my perfect size
              </h2>
              <p className="sg-section-desc">
                Enter your measurements below and we will find your TWAM size
                instantly. All measurements in inches.
              </p>
            </div>

            <div className="sg-calc-layout">
              <div className="sg-calc-card">
                <div className="sg-calc-inputs">
                  {[
                    {
                      label: "Underbust (in)",
                      id: "ub",
                      val: underbust,
                      set: setUnderbust,
                      ph: "32",
                    },
                    {
                      label: "Bust (in)",
                      id: "b",
                      val: bust,
                      set: setBust,
                      ph: "35",
                    },
                    {
                      label: "Waist (in)",
                      id: "w",
                      val: waist,
                      set: setWaist,
                      ph: "28",
                    },
                    {
                      label: "Hips (in)",
                      id: "h",
                      val: hips,
                      set: setHips,
                      ph: "37",
                    },
                  ].map((f) => (
                    <div className="sg-input-group" key={f.id}>
                      <label htmlFor={f.id}>{f.label}</label>
                      <input
                        id={f.id}
                        type="number"
                        placeholder={f.ph}
                        value={f.val}
                        min={20}
                        max={60}
                        onChange={(e) => {
                          f.set(e.target.value);
                          setResult(null);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <button type="button" className="sg-calc-btn" onClick={calcSize}>
                  Find my size
                </button>

                <p className="sg-calc-hint">
                  All measurements are in inches. If you are between sizes, we
                  recommend sizing up.
                </p>
              </div>

              <div className={`sg-result-card${result ? " show" : ""}`}>
                <div className="sg-result-label">Your TWAM bra size</div>
                <div className="sg-result-size">{result?.bra ?? "-"}</div>
                <div className="sg-result-sub">bra size</div>
                <div className="sg-result-grid">
                  <div className="sg-result-mini">
                    <div className="sg-result-mini-label">Bottom size</div>
                    <div className="sg-result-mini-val">
                      {result?.bottom ?? "-"}
                    </div>
                  </div>
                  <div className="sg-result-mini">
                    <div className="sg-result-mini-label">Intl equiv.</div>
                    <div className="sg-result-mini-val">
                      {result?.intl ?? "-"}
                    </div>
                  </div>
                </div>
                {result?.note && <div className="sg-result-note">{result.note}</div>}
              </div>
            </div>
          </section>
        )}

        {activeTab === "fit" && (
          <section className="sg-panel" aria-labelledby="sg-fit-title">
            <div className="sg-section-head">
              <div className="sg-section-label">Feel the difference</div>
              <h2 id="sg-fit-title" className="sg-section-title">
                Signs of a perfect fit
              </h2>
              <p className="sg-section-desc">
                A bra that truly fits should feel like a second skin. Not tight,
                not loose. Just you.
              </p>
            </div>

            <div className="sg-fit-cards">
              {fitCards.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`sg-fit-card${openFit === i ? " open" : ""}`}
                  onClick={() => toggleFit(i)}
                  aria-expanded={openFit === i}
                >
                  <div className="sg-fit-card-header">
                    <div className="sg-fit-card-left">
                      <div className="sg-fit-icon">{c.icon}</div>
                      <div className="sg-fit-card-title">{c.title}</div>
                    </div>
                    <div className="sg-fit-card-tag">{c.tag}</div>
                  </div>
                  <div className="sg-fit-card-body">{c.body}</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="sg-footer">
        <div className="sg-footer-brand">TWAM</div>
        <div className="sg-footer-dots">
          <span className="sg-fdot" />
          <span className="sg-fdot" />
          <span className="sg-fdot" />
        </div>
      </footer>
    </div>
  );
}
