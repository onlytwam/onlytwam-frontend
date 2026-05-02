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
    <>
      <style>{`
        .fg { background: #ffffff; min-height: 100vh; font-family: Georgia, 'Times New Roman', serif; color: #3a1a22; }
        .sg-pink-bar { height: 3px; background: linear-gradient(90deg, #F2D6D6, #5C1A2A, #D4A0A0, #F2D6D6); }
        .sg-hero { background: #ffffff; padding: 3rem 2rem 2.5rem; text-align: center; position: relative; overflow: hidden; }
        .sg-hero-dots { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }
        .sg-dot { position: absolute; border-radius: 50%; background: #F2D6D6; opacity: 0.35; }
        .sg-eyebrow { font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.5em; color: #D4A0A0; text-transform: uppercase; margin-bottom: 0.8rem; font-weight: normal; }
        .sg-hero-title { font-family: Georgia, 'Times New Roman', serif; font-size: 2.8rem; font-weight: normal; font-style: italic; color: #5C1A2A; line-height: 1.15; margin-bottom: 0.5rem; }
        .sg-hero-sub { font-family: Helvetica, Arial, sans-serif; font-size: 10px; letter-spacing: 0.3em; color: #D4A0A0; text-transform: uppercase; font-weight: normal; margin-bottom: 1.5rem; }
        .sg-tagstrip { display: flex; justify-content: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.5rem; }
        .sg-tag { background: #FDF0F0; border: 0.5px solid #F2D6D6; border-radius: 20px; padding: 0.35rem 0.9rem; font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.12em; color: #D4A0A0; text-transform: uppercase; }
        .sg-tabs { display: flex; justify-content: center; background: #ffffff; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #F2D6D6; }
        .sg-tab { padding: 1rem; font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #D4A0A0; cursor: pointer; border-bottom: 2px solid transparent; border-top: none; border-left: none; border-right: none; background: none; transition: all 0.2s; font-weight: normal; }
        .sg-tab.active { color: #5C1A2A; border-bottom: 2px solid #5C1A2A; }
        .sg-tab:hover { color: #5C1A2A; }
        .sg-section { padding: 2rem 1.5rem 3rem; max-width: 600px; margin: 0 auto; }
        .sg-section-label { font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.4em; text-transform: uppercase; color: #D4A0A0; margin-bottom: 0.4rem; text-align: center; font-weight: normal; }
        .sg-section-title { font-family: Georgia, 'Times New Roman', serif; font-size: 1.6rem; font-weight: normal; font-style: italic; color: #5C1A2A; text-align: center; margin-bottom: 0.5rem; }
        .sg-section-desc { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #b08080; line-height: 1.7; text-align: center; margin-bottom: 2rem; max-width: 400px; margin-left: auto; margin-right: auto; }
        .sg-steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1.5rem; }
        .sg-step-card { background: #fff; border: 1px solid #F2D6D6; border-radius: 12px; padding: 1.4rem 1.2rem; text-align: center; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .sg-step-card:hover { border-color: #D4A0A0; background: #FDF8F8; }
        .sg-step-card.active-step { border-color: #5C1A2A; background: #FDF0F0; }
        .sg-step-circle { width: 40px; height: 40px; border-radius: 50%; background: #F2D6D6; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.8rem; font-family: Georgia, 'Times New Roman', serif; font-size: 1.1rem; color: #5C1A2A; font-style: italic; transition: background 0.2s; }
        .sg-step-card.active-step .sg-step-circle { background: #5C1A2A; color: #FAF5F0; }
        .sg-step-title { font-family: Georgia, 'Times New Roman', serif; font-size: 0.9rem; color: #5C1A2A; font-style: italic; margin-bottom: 0.4rem; }
        .sg-step-short { font-family: Helvetica, Arial, sans-serif; font-size: 10.5px; color: #b08080; line-height: 1.5; }
        .sg-step-detail { display: none; margin-top: 1rem; background: #FDF0F0; border: 1px solid #F2D6D6; border-radius: 10px; padding: 1.2rem 1.4rem; font-family: Helvetica, Arial, sans-serif; font-size: 12.5px; line-height: 1.75; color: #7a4a52; text-align: left; }
        .sg-step-detail.show { display: block; }
        .sg-step-detail-title { font-family: Georgia, 'Times New Roman', serif; font-size: 1rem; font-style: italic; color: #5C1A2A; margin-bottom: 0.5rem; }
        .sg-tip-box { background: #FDF0F0; border-left: 3px solid #D4A0A0; border-radius: 0 10px 10px 0; padding: 1rem 1.3rem; margin-top: 1.5rem; font-family: Georgia, 'Times New Roman', serif; font-size: 12.5px; line-height: 1.65; color: #5C1A2A; font-style: italic; }
        .sg-tip-label { font-family: Helvetica, Arial, sans-serif; font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #D4A0A0; margin-bottom: 0.4rem; font-style: normal; }
        .sg-size-toggle { display: flex; justify-content: center; gap: 0; margin-bottom: 1.8rem; border: 1px solid #F2D6D6; border-radius: 25px; overflow: hidden; width: fit-content; margin-left: auto; margin-right: auto; }
        .sg-stoggle { padding: 0.6rem 1.4rem; font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #D4A0A0; cursor: pointer; border: none; background: none; transition: all 0.2s; font-weight: normal; }
        .sg-stoggle.active { background: #5C1A2A; color: #FAF5F0; }
        .sg-size-row { display: grid; grid-template-columns: 0.8fr 1fr 1fr 1fr; margin-bottom: 0; }
        .sg-size-row:hover .sg-size-cell { background: #FDF8F8; }
        .sg-size-cell { padding: 0.75rem 0.5rem; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 11px; border-bottom: 1px solid #FDF0F0; color: #9a6a72; font-weight: normal; transition: background 0.15s; }
        .sg-size-cell.header { font-size: 8.5px; letter-spacing: 0.15em; text-transform: uppercase; color: #D4A0A0; border-bottom: 1.5px solid #F2D6D6; background: #FDF8F8; padding: 0.6rem 0.5rem; }
        .sg-size-cell.twam-size { font-family: Georgia, 'Times New Roman', serif; font-size: 1rem; color: #5C1A2A; font-weight: normal; font-style: italic; }
        .sg-size-note { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #D4A0A0; text-align: center; margin-top: 1rem; letter-spacing: 0.08em; }
        .sg-calc-wrap { max-width: 420px; margin: 0 auto; }
        .sg-calc-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.2rem; }
        .sg-input-group label { display: block; font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; color: #D4A0A0; margin-bottom: 0.4rem; font-weight: normal; }
        .sg-input-group input { width: 100%; padding: 0.8rem 1rem; background: #ffffff; border: 1px solid #F2D6D6; border-radius: 8px; font-family: Georgia, 'Times New Roman', serif; font-size: 1.15rem; color: #5C1A2A; text-align: center; outline: none; font-style: italic; transition: border-color 0.2s; }
        .sg-input-group input:focus { border-color: #D4A0A0; }
        .sg-input-group input::placeholder { color: #F2D6D6; font-style: italic; }
        .sg-calc-btn { display: block; width: 100%; padding: 1rem; background: #5C1A2A; color: #FAF5F0; border: none; border-radius: 25px; font-family: Helvetica, Arial, sans-serif; font-size: 9.5px; letter-spacing: 0.35em; text-transform: uppercase; cursor: pointer; margin-bottom: 1.5rem; font-weight: normal; transition: background 0.2s; }
        .sg-calc-btn:hover { background: #7a2a3e; }
        .sg-result-box { display: none; border: 1px solid #F2D6D6; border-radius: 16px; padding: 2rem; background: #FDF8F8; text-align: center; }
        .sg-result-box.show { display: block; }
        .sg-result-label { font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; color: #D4A0A0; margin-bottom: 0.5rem; font-weight: normal; }
        .sg-result-size { font-family: Georgia, 'Times New Roman', serif; font-size: 3.8rem; font-weight: normal; color: #5C1A2A; line-height: 1; margin-bottom: 0.2rem; font-style: italic; }
        .sg-result-sub { font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #D4A0A0; margin-bottom: 1rem; font-weight: normal; }
        .sg-result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-top: 0.8rem; }
        .sg-result-mini { border: 1px solid #F2D6D6; border-radius: 10px; padding: 0.9rem; background: #fff; }
        .sg-result-mini-label { font-family: Helvetica, Arial, sans-serif; font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #D4A0A0; margin-bottom: 0.3rem; font-weight: normal; }
        .sg-result-mini-val { font-family: Georgia, 'Times New Roman', serif; font-size: 1.5rem; color: #5C1A2A; font-weight: normal; font-style: italic; }
        .sg-result-note { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #b08080; line-height: 1.65; margin-top: 1rem; font-style: italic; }
        .sg-fit-intro { background: #FDF0F0; border-radius: 12px; padding: 1.2rem 1.5rem; margin-bottom: 1.5rem; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.7; color: #5C1A2A; font-style: italic; text-align: center; }
        .sg-fit-cards { display: flex; flex-direction: column; gap: 0.7rem; }
        .sg-fit-card { border: 1px solid #F2D6D6; border-radius: 12px; padding: 1.3rem 1.5rem; background: #fff; cursor: pointer; transition: all 0.2s; }
        .sg-fit-card:hover { border-color: #D4A0A0; background: #FDF8F8; }
        .sg-fit-card.open { border-color: #5C1A2A; background: #FDF8F8; }
        .sg-fit-card-header { display: flex; justify-content: space-between; align-items: center; }
        .sg-fit-card-left { display: flex; align-items: center; gap: 0.9rem; }
        .sg-fit-icon { width: 32px; height: 32px; border-radius: 50%; background: #F2D6D6; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; transition: background 0.2s; }
        .sg-fit-card.open .sg-fit-icon { background: #5C1A2A; }
        .sg-fit-card-title { font-family: Georgia, 'Times New Roman', serif; font-size: 0.95rem; color: #5C1A2A; font-weight: normal; font-style: italic; }
        .sg-fit-card-tag { font-family: Helvetica, Arial, sans-serif; font-size: 8.5px; letter-spacing: 0.15em; text-transform: uppercase; color: #D4A0A0; font-weight: normal; }
        .sg-fit-card-body { display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #F2D6D6; font-family: Helvetica, Arial, sans-serif; font-size: 12.5px; line-height: 1.75; color: #7a4a52; font-weight: normal; }
        .sg-fit-card.open .sg-fit-card-body { display: block; }
        .sg-footer-line { text-align: center; padding: 2.5rem 1rem 3rem; border-top: 1px solid #F2D6D6; background: #fff; }
        .sg-footer-brand { font-family: Helvetica, Arial, sans-serif; font-size: 18px; letter-spacing: 0.7em; text-transform: uppercase; color: #5C1A2A; font-weight: normal; }
        .sg-footer-dots { display: flex; justify-content: center; gap: 6px; margin-top: 1rem; }
        .sg-fdot { width: 5px; height: 5px; border-radius: 50%; background: #F2D6D6; }
        .sg-fdot:nth-child(2) { background: #D4A0A0; }
        .sg-fdot:nth-child(3) { background: #5C1A2A; }
      `}</style>

      <div className="fg">
        {/* Top gradient bar */}
        <div className="sg-pink-bar" />

        {/* Hero */}
        <div className="sg-hero">
          <div className="sg-hero-dots">
            <div
              className="sg-dot"
              style={{ width: 120, height: 120, top: -40, right: -30 }}
            />
            <div
              className="sg-dot"
              style={{ width: 60, height: 60, bottom: 10, left: 20 }}
            />
            <div
              className="sg-dot"
              style={{ width: 30, height: 30, top: 30, left: 80 }}
            />
          </div>
          <div className="sg-eyebrow">TWAM</div>
          <div className="sg-hero-title">It's all about you</div>
          <div className="sg-hero-sub">Your perfect fit, always</div>
          <div className="sg-tagstrip">
            <span className="sg-tag">True to body sizing</span>
            <span className="sg-tag">Designed for every woman</span>
            <span className="sg-tag">Made with love</span>
          </div>
        </div>

        {/* Sticky Tabs */}
        <div className="sg-tabs">
          {(["measure", "size", "calc", "fit"] as const).map((tab) => (
            <button
              key={tab}
              className={`sg-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
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

        {/* ── MEASURE ── */}
        {activeTab === "measure" && (
          <div className="sg-section">
            <div className="sg-section-label">Step by step</div>
            <div className="sg-section-title">How to measure yourself</div>
            <div className="sg-section-desc">
              All you need is a soft measuring tape and two minutes. Measure
              over bare skin for the most accurate result.
            </div>

            <div className="sg-steps-grid">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`sg-step-card${
                    openStep === s.id ? " active-step" : ""
                  }`}
                  onClick={() => toggleStep(s.id)}
                >
                  <div className="sg-step-circle">{s.num}</div>
                  <div className="sg-step-title">{s.title}</div>
                  <div className="sg-step-short">{s.short}</div>
                </div>
              ))}
            </div>

            {steps.map((s) => (
              <div
                key={s.id}
                className={`sg-step-detail${openStep === s.id ? " show" : ""}`}
              >
                <div className="sg-step-detail-title">{s.detailTitle}</div>
                {s.detail}
              </div>
            ))}

            <div className="sg-tip-box">
              <div className="sg-tip-label">TWAM tip</div>
              Measure twice and take the larger of the two numbers. Bodies shift
              throughout the day, so morning measurements tend to be the most
              consistent. If you are between sizes, always go up.
            </div>
          </div>
        )}

        {/* ── SIZE CHART ── */}
        {activeTab === "size" && (
          <div className="sg-section">
            <div className="sg-section-label">Reference</div>
            <div className="sg-section-title">Size chart</div>
            <div className="sg-section-desc">
              TWAM sizes are designed to fit real bodies. If you fall between
              two sizes, we always recommend sizing up for all-day comfort.
            </div>

            <div className="sg-size-toggle">
              <button
                className={`sg-stoggle${sizePanel === "bras" ? " active" : ""}`}
                onClick={() => setSizePanel("bras")}
              >
                Bras
              </button>
              <button
                className={`sg-stoggle${
                  sizePanel === "bottoms" ? " active" : ""
                }`}
                onClick={() => setSizePanel("bottoms")}
              >
                Bottoms
              </button>
            </div>

            {sizePanel === "bras" && (
              <div>
                <div className="sg-size-row">
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
                <div className="sg-size-note">
                  All measurements in inches. For cm, multiply by 2.54.
                </div>
              </div>
            )}

            {sizePanel === "bottoms" && (
              <div>
                <div className="sg-size-row">
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
                <div className="sg-size-note">
                  All measurements in inches. For cm, multiply by 2.54.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CALCULATOR ── */}
        {activeTab === "calc" && (
          <div className="sg-section">
            <div className="sg-section-label">Just for you</div>
            <div className="sg-section-title">Find my perfect size</div>
            <div className="sg-section-desc">
              Enter your measurements below and we will find your TWAM size
              instantly. All measurements in inches.
            </div>

            <div className="sg-calc-wrap">
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
                    <label>{f.label}</label>
                    <input
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
              <button className="sg-calc-btn" onClick={calcSize}>
                Find my size
              </button>

              <div className={`sg-result-box${result ? " show" : ""}`}>
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
                {result?.note && (
                  <div className="sg-result-note">{result.note}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FIT GUIDE ── */}
        {activeTab === "fit" && (
          <div className="sg-section">
            <div className="sg-section-label">Feel the difference</div>
            <div className="sg-section-title">Signs of a perfect fit</div>

            <div className="sg-fit-intro">
              A bra that truly fits should feel like a second skin. Not tight,
              not loose. Just you.
            </div>

            <div className="sg-fit-cards">
              {fitCards.map((c, i) => (
                <div
                  key={i}
                  className={`sg-fit-card${openFit === i ? " open" : ""}`}
                  onClick={() => toggleFit(i)}
                >
                  <div className="sg-fit-card-header">
                    <div className="sg-fit-card-left">
                      <div className="sg-fit-icon">{c.icon}</div>
                      <div className="sg-fit-card-title">{c.title}</div>
                    </div>
                    <div className="sg-fit-card-tag">{c.tag}</div>
                  </div>
                  <div className="sg-fit-card-body">{c.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sg-footer-line">
          <div className="sg-footer-brand">TWAM</div>
          <div className="sg-footer-dots">
            <div className="sg-fdot" />
            <div className="sg-fdot" />
            <div className="sg-fdot" />
          </div>
        </div>
      </div>
    </>
  );
}
