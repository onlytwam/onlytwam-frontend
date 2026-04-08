import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Category = 'Bra' | 'Panty' | 'Active Wear' | null;
type Brand = 'Amante' | 'Enamor' | 'Soie' | 'Blossom' | 'OnlyTWAM';

const BRANDS: Brand[] = ['Amante', 'Enamor', 'Soie', 'Blossom', 'OnlyTWAM'];

const BRA_BANDS = { Amante:['32','34','36','38','40','42'], Enamor:['32','34','36','38','40','42','44'], Soie:['30','32','34','36','38','40','42','44'], Blossom:['28','30','32','34','36','38','40','42','44'], OnlyTWAM:['32','34','36','38','40','42'] };
const BRA_CUPS = ['A','B','C','D','DD','E','F'];
const PANTY_SIZES = ['XS','S','M','L','XL','XXL','3XL','4XL'];
const ACTIVE_SIZES = ['XS','S','M','L','XL','XXL'];

// Band measurement guide
const BAND_GUIDE: Record<string, string> = { '28':'59–64 cm / 23–24"', '30':'64–69 cm / 25–26"', '32':'67–72 cm / 26.5–28.5"', '34':'72–77 cm / 28.5–30.5"', '36':'77–83 cm / 30.5–32.5"', '38':'83–88 cm / 32.5–34.5"', '40':'88–93 cm / 34.5–36.5"', '42':'93–98 cm / 36.5–38.5"', '44':'98–104 cm / 38.5–40.5"' };
const CUP_GUIDE: Record<string, string> = { A:'+1"', B:'+2"', C:'+3"', D:'+4"', DD:'+5"', E:'+6"', F:'+7"' };
const PANTY_GUIDE: Record<string, string> = { XS:'Waist 66–71 cm / Hip 78–83 cm', S:'Waist 71–76 cm / Hip 83–88 cm', M:'Waist 76–81 cm / Hip 88–93 cm', L:'Waist 81–86 cm / Hip 93–98 cm', XL:'Waist 86–91 cm / Hip 98–103 cm', XXL:'Waist 91–96 cm / Hip 103–108 cm', '3XL':'Waist 96–101 cm / Hip 108–113 cm', '4XL':'Waist 101–106 cm / Hip 113–118 cm' };
const ACTIVE_GUIDE: Record<string, string> = { XS:'Bust 78–83 cm', S:'Bust 83–88 cm', M:'Bust 88–93 cm', L:'Bust 93–98 cm', XL:'Bust 98–103 cm', XXL:'Bust 103–108 cm' };

const Step = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
  <div className="s-sizeguide-ccd3e6">
    <div className="s-sizeguide-66ab56" style={ {background: done ? 'var(--brand)' : active ? 'var(--brand)' : 'var(--ivory)', color: done || active ? '#fff' : 'var(--heirloom)'} }>
      {done ? <i className="bi bi-check" /> : n}
    </div>
    <span className="s-sizeguide-fc9cca" style={ {color: active ? 'var(--brand)' : done ? 'var(--brand)' : 'var(--heirloom)', fontWeight: active ? 600 : 400} }>{label}</span>
  </div>
);

export default function SizeGuide() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category>(null);
  const [brand, setBrand] = useState<Brand | ''>('');
  const [band, setBand] = useState('');
  const [cup, setCup] = useState('');
  const [pantySize, setPantySize] = useState('');
  const [activeSize, setActiveSize] = useState('');
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const [result, setResult] = useState('');

  const reset = () => { setStep(1); setCategory(null); setBrand(''); setBand(''); setCup(''); setPantySize(''); setActiveSize(''); setResult(''); };

  const selectCategory = (cat: Category) => { setCategory(cat); setBrand(''); setBand(''); setCup(''); setPantySize(''); setActiveSize(''); setResult(''); setStep(2); };
  const selectBrand = (b: Brand) => { setBrand(b); setBand(''); setCup(''); setPantySize(''); setActiveSize(''); setStep(3); };

  const calcResult = () => {
    if (category === 'Bra' && band && cup) { setResult(`${band}${cup}`); setStep(4); }
    else if (category === 'Panty' && pantySize) { setResult(pantySize); setStep(4); }
    else if (category === 'Active Wear' && activeSize) { setResult(activeSize); setStep(4); }
  };

  const shopNow = () => navigate(`/user-products/product-list?search=${encodeURIComponent(result + ' ' + brand)}`);

  const bands = brand ? (BRA_BANDS[brand as keyof typeof BRA_BANDS] || BRA_BANDS.Amante) : BRA_BANDS.Amante;

  const pillBtn = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} className="s-sizeguide-03c714" style={ {border: `2px solid ${selected ? 'var(--brand)' : 'var(--ivory)'}`, background: selected ? 'var(--brand)' : '#fff', color: selected ? '#fff' : '#000000', fontWeight: selected ? 600 : 400} }>
      {label}
    </button>
  );

  return (
    <div className="s-sizeguide-3d9799">
      <div className="s-sizeguide-513310">

        {/* Header */}
        <div className="s-sizeguide-853583">
          <h1 className="s-sizeguide-bef151">Find Your Perfect Fit</h1>
          <p className="s-sizeguide-94df9b">Follow the steps to discover your best size for {category || 'your favourite lingerie'}.</p>
        </div>

        {/* Stepper */}
        <div className="s-shopbysize-67bbc3">
          <div className="s-sizeguide-71f731">
            {[{n:1,label:'Category'},{n:2,label:'Brand'},{n:3,label:'Measure'},{n:4,label:'Result'}].map((s, i) => (
              <div key={s.n} className="s-sizeguide-1132ae">
                <Step n={s.n} label={s.label} active={step === s.n} done={step > s.n} />
                {i < 3 && <div className="s-sizeguide-6f75d9" style={ {background: step > s.n ? 'var(--brand)' : 'var(--ivory)'} } />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 — Category */}
        {step === 1 && (
          <div>
            <h2 className="s-sizeguide-403582">Select a category</h2>
            <p className="s-sizeguide-0146f4">We'll customise the guide for bras, panties or active wear.</p>
            <div className="s-sizeguide-f04e05">
              {(['Bra', 'Panty', 'Active Wear'] as Category[]).map(cat => (
                <button key={cat!} onClick={() => selectCategory(cat)}
                  className="s-sizeguide-0aee09" style={ {border: `2px solid ${category === cat ? 'var(--brand)' : 'var(--ivory)'}`, background: category === cat ? 'var(--ivory)' : '#fff'} }>
                  <div className="s-sizeguide-e2724c">{cat === 'Bra' ? '👙' : cat === 'Panty' ? '🩲' : '🏃‍♀️'}</div>
                  <h3 className="s-sizeguide-cc6951" style={ {color: category === cat ? 'var(--brand)' : '#000000'} }>{cat}</h3>
                  <p className="s-admindashboa-75a6ca">{cat === 'Bra' ? 'Band & cup based sizing' : cat === 'Panty' ? 'Waist & hip based sizing' : 'Bust based sizing'}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Brand */}
        {step === 2 && (
          <div>
            <h2 className="s-sizeguide-403582">Select a brand</h2>
            <p className="s-sizeguide-0146f4">Each brand has slightly different sizing charts.</p>
            <div className="s-productlist-a2d5a5">
              {BRANDS.map(b => pillBtn(b, brand === b, () => selectBrand(b)))}
            </div>
            <button onClick={() => setStep(1)} className="s-sizeguide-dd5be9">
              ← Back
            </button>
          </div>
        )}

        {/* Step 3 — Measure */}
        {step === 3 && (
          <div>
            <div className="s-userdashboar-aee024">
              <h2 className="s-sizeguide-d52304">
                {category === 'Bra' ? 'Select band & cup size' : category === 'Panty' ? 'Select your size' : 'Select active wear size'}
              </h2>
              {category === 'Bra' && (
                <button onClick={() => setUnit(u => u === 'cm' ? 'in' : 'cm')} className="s-sizeguide-7d5bdd">
                  {unit === 'cm' ? 'Switch to Inches' : 'Switch to cm'}
                </button>
              )}
            </div>

            {category === 'Bra' && (
              <>
                <p className="s-sizeguide-f13891">1. Select your band size (underbust measurement):</p>
                <div className="s-sizeguide-a071d7">
                  {bands.map(b => (
                    <button key={b} onClick={() => { setBand(b); setCup(''); }}
                      className="s-sizeguide-bb5ae7" style={ {border: `2px solid ${band === b ? 'var(--brand)' : 'var(--ivory)'}`, background: band === b ? 'var(--brand)' : '#fff', color: band === b ? '#fff' : '#000000'} }>
                      {b}
                    </button>
                  ))}
                </div>
                {band && (
                  <p className="s-sizeguide-0f2d2a">
                    <i className="bi bi-info-circle s-productdetai-39554d" />
                    Band {band}: {BAND_GUIDE[band]}
                  </p>
                )}
                {band && (
                  <>
                    <p className="s-sizeguide-f13891">2. Select your cup size (bust measurement minus band):</p>
                    <div className="s-sizeguide-a071d7">
                      {BRA_CUPS.map(c => (
                        <button key={c} onClick={() => setCup(c)}
                          className="s-sizeguide-7b2ef8" style={ {border: `2px solid ${cup === c ? 'var(--brand)' : 'var(--ivory)'}`, background: cup === c ? 'var(--brand)' : '#fff', color: cup === c ? '#fff' : '#000000'} }>
                          {c}
                        </button>
                      ))}
                    </div>
                    {cup && <p className="s-sizeguide-0f2d2a"><i className="bi bi-info-circle s-productdetai-39554d" />Cup {cup}: bust measurement is band {CUP_GUIDE[cup]} bigger</p>}
                  </>
                )}
              </>
            )}

            {category === 'Panty' && (
              <>
                <p className="s-sizeguide-f13891">Select your size:</p>
                <div className="s-sizeguide-34fd67">
                  {PANTY_SIZES.map(s => (
                    <button key={s} onClick={() => setPantySize(s)}
                      className="s-sizeguide-5fb590" style={ {border: `2px solid ${pantySize === s ? 'var(--brand)' : 'var(--ivory)'}`, background: pantySize === s ? 'var(--brand)' : '#fff', color: pantySize === s ? '#fff' : '#000000'} }>
                      {s}
                    </button>
                  ))}
                </div>
                {pantySize && <p className="s-sizeguide-0f2d2a"><i className="bi bi-info-circle s-productdetai-39554d" />{PANTY_GUIDE[pantySize]}</p>}
              </>
            )}

            {category === 'Active Wear' && (
              <>
                <p className="s-sizeguide-f13891">Select your size:</p>
                <div className="s-sizeguide-34fd67">
                  {ACTIVE_SIZES.map(s => (
                    <button key={s} onClick={() => setActiveSize(s)}
                      className="s-sizeguide-92d7de" style={ {border: `2px solid ${activeSize === s ? 'var(--brand)' : 'var(--ivory)'}`, background: activeSize === s ? 'var(--brand)' : '#fff', color: activeSize === s ? '#fff' : '#000000'} }>
                      {s}
                    </button>
                  ))}
                </div>
                {activeSize && <p className="s-sizeguide-0f2d2a"><i className="bi bi-info-circle s-productdetai-39554d" />{ACTIVE_GUIDE[activeSize]}</p>}
              </>
            )}

            <div className="s-addressform-4a7f76">
              <button onClick={() => setStep(2)} className="s-sizeguide-047a93">← Back</button>
              <button onClick={calcResult}
                disabled={category === 'Bra' ? !band || !cup : category === 'Panty' ? !pantySize : !activeSize}
                className="s-sizeguide-e34bff" style={{ opacity: (category === 'Bra' ? !band || !cup : category === 'Panty' ? !pantySize : !activeSize) ? 0.4 : 1 }}>
                Get My Size →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Result */}
        {step === 4 && (
          <div className="s-sizeguide-fa4b1a">
            <div className="s-sizeguide-8210a2">
              <i className="bi bi-check-circle-fill s-sizeguide-dd1eb9" />
            </div>
            <h2 className="s-sizeguide-234b51">Your Perfect Size</h2>
            <div className="s-sizeguide-6b413c">{result}</div>
            <p className="s-sizeguide-21f793">Based on {brand} sizing for {category}</p>
            <div className="s-sizeguide-e605a0">
              <button onClick={shopNow} className="s-sizeguide-df224c">
                Shop Size {result} →
              </button>
              <button onClick={reset} className="s-sizeguide-8540a6">
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Size chart image */}
      <div className="s-sizeguide-c819ef">
        <img src="/assets/size-guide/BRA-SIZE-CHART-copy-900x600.jpg" alt="Bra Size Chart"
          className="s-sizeguide-087664"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    </div>
  );
}