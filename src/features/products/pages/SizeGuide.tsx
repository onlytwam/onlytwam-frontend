import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/shared/components/Breadcrumb';

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
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? '#2e7d32' : active ? '#6A012A' : '#eee', color: done || active ? '#fff' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'all .3s' }}>
      {done ? <i className="bi bi-check" /> : n}
    </div>
    <span style={{ fontSize: 11, color: active ? '#6A012A' : done ? '#2e7d32' : '#aaa', fontWeight: active ? 600 : 400 }}>{label}</span>
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
    <button key={label} onClick={onClick} style={{ padding: '10px 18px', border: `2px solid ${selected ? '#6A012A' : '#ddd'}`, borderRadius: 8, background: selected ? '#6A012A' : '#fff', color: selected ? '#fff' : '#333', cursor: 'pointer', fontSize: 14, fontWeight: selected ? 600 : 400, transition: 'all .15s', fontFamily: 'inherit' }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: '#f9f9f9', minHeight: '80vh', padding: '32px 16px' }}>
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Size Guide' }]} />
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: 32 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', color: '#111' }}>Find Your Perfect Fit</h1>
          <p style={{ color: '#888', margin: 0 }}>Follow the steps to discover your best size for {category || 'your favourite lingerie'}.</p>
        </div>

        {/* Stepper */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {[{n:1,label:'Category'},{n:2,label:'Brand'},{n:3,label:'Measure'},{n:4,label:'Result'}].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <Step n={s.n} label={s.label} active={step === s.n} done={step > s.n} />
                {i < 3 && <div style={{ flex: 1, height: 2, background: step > s.n ? '#2e7d32' : '#eee', margin: '0 4px', marginBottom: 20, transition: 'background .3s' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 — Category */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#111' }}>Select a category</h2>
            <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>We'll customise the guide for bras, panties or active wear.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {(['Bra', 'Panty', 'Active Wear'] as Category[]).map(cat => (
                <button key={cat!} onClick={() => selectCategory(cat)}
                  style={{ flex: '1 1 160px', padding: '20px 16px', border: `2px solid ${category === cat ? '#6A012A' : '#eee'}`, borderRadius: 12, background: category === cat ? '#fff5f5' : '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{cat === 'Bra' ? '👙' : cat === 'Panty' ? '🩲' : '🏃‍♀️'}</div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: category === cat ? '#6A012A' : '#111' }}>{cat}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{cat === 'Bra' ? 'Band & cup based sizing' : cat === 'Panty' ? 'Waist & hip based sizing' : 'Bust based sizing'}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Brand */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#111' }}>Select a brand</h2>
            <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>Each brand has slightly different sizing charts.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {BRANDS.map(b => pillBtn(b, brand === b, () => selectBrand(b)))}
            </div>
            <button onClick={() => setStep(1)} style={{ marginTop: 20, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Back
            </button>
          </div>
        )}

        {/* Step 3 — Measure */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#111' }}>
                {category === 'Bra' ? 'Select band & cup size' : category === 'Panty' ? 'Select your size' : 'Select active wear size'}
              </h2>
              {category === 'Bra' && (
                <button onClick={() => setUnit(u => u === 'cm' ? 'in' : 'cm')} style={{ background: '#f5f5f5', border: 'none', padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  {unit === 'cm' ? 'Switch to Inches' : 'Switch to cm'}
                </button>
              )}
            </div>

            {category === 'Bra' && (
              <>
                <p style={{ fontSize: 14, color: '#555', marginBottom: 12, fontWeight: 500 }}>1. Select your band size (underbust measurement):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {bands.map(b => (
                    <button key={b} onClick={() => { setBand(b); setCup(''); }}
                      style={{ minWidth: 52, padding: '10px 14px', border: `2px solid ${band === b ? '#6A012A' : '#ddd'}`, borderRadius: 6, background: band === b ? '#6A012A' : '#fff', color: band === b ? '#fff' : '#333', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                      {b}
                    </button>
                  ))}
                </div>
                {band && (
                  <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                    <i className="bi bi-info-circle" style={{ marginRight: 6 }} />
                    Band {band}: {BAND_GUIDE[band]}
                  </p>
                )}
                {band && (
                  <>
                    <p style={{ fontSize: 14, color: '#555', marginBottom: 12, fontWeight: 500 }}>2. Select your cup size (bust measurement minus band):</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {BRA_CUPS.map(c => (
                        <button key={c} onClick={() => setCup(c)}
                          style={{ minWidth: 48, padding: '10px 14px', border: `2px solid ${cup === c ? '#6A012A' : '#ddd'}`, borderRadius: 6, background: cup === c ? '#6A012A' : '#fff', color: cup === c ? '#fff' : '#333', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                          {c}
                        </button>
                      ))}
                    </div>
                    {cup && <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}><i className="bi bi-info-circle" style={{ marginRight: 6 }} />Cup {cup}: bust measurement is band {CUP_GUIDE[cup]} bigger</p>}
                  </>
                )}
              </>
            )}

            {category === 'Panty' && (
              <>
                <p style={{ fontSize: 14, color: '#555', marginBottom: 12, fontWeight: 500 }}>Select your size:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {PANTY_SIZES.map(s => (
                    <button key={s} onClick={() => setPantySize(s)}
                      style={{ padding: '10px 16px', border: `2px solid ${pantySize === s ? '#6A012A' : '#ddd'}`, borderRadius: 6, background: pantySize === s ? '#6A012A' : '#fff', color: pantySize === s ? '#fff' : '#333', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                      {s}
                    </button>
                  ))}
                </div>
                {pantySize && <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}><i className="bi bi-info-circle" style={{ marginRight: 6 }} />{PANTY_GUIDE[pantySize]}</p>}
              </>
            )}

            {category === 'Active Wear' && (
              <>
                <p style={{ fontSize: 14, color: '#555', marginBottom: 12, fontWeight: 500 }}>Select your size:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {ACTIVE_SIZES.map(s => (
                    <button key={s} onClick={() => setActiveSize(s)}
                      style={{ padding: '10px 18px', border: `2px solid ${activeSize === s ? '#6A012A' : '#ddd'}`, borderRadius: 6, background: activeSize === s ? '#6A012A' : '#fff', color: activeSize === s ? '#fff' : '#333', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                      {s}
                    </button>
                  ))}
                </div>
                {activeSize && <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}><i className="bi bi-info-circle" style={{ marginRight: 6 }} />{ACTIVE_GUIDE[activeSize]}</p>}
              </>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => setStep(2)} style={{ background: 'none', border: '1px solid #ddd', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>← Back</button>
              <button onClick={calcResult}
                disabled={category === 'Bra' ? !band || !cup : category === 'Panty' ? !pantySize : !activeSize}
                style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: (category === 'Bra' ? !band || !cup : category === 'Panty' ? !pantySize : !activeSize) ? 0.4 : 1, fontFamily: 'inherit' }}>
                Get My Size →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Result */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 80, height: 80, background: '#e8f5e9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: 40, color: '#2e7d32' }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#111' }}>Your Perfect Size</h2>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#6A012A', margin: '12px 0', letterSpacing: 2 }}>{result}</div>
            <p style={{ color: '#888', marginBottom: 8, fontSize: 14 }}>Based on {brand} sizing for {category}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
              <button onClick={shopNow} style={{ background: '#111', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 500, fontFamily: 'inherit' }}>
                Shop Size {result} →
              </button>
              <button onClick={reset} style={{ background: '#fff', color: '#111', border: '1px solid #ddd', padding: '12px 24px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Size chart image */}
      <div style={{ maxWidth: 720, margin: '24px auto 0' }}>
        <img src="/assets/size-guide/BRA-SIZE-CHART-copy-900x600.jpg" alt="Bra Size Chart"
          style={{ width: '100%', borderRadius: 12 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    </div>
  );
}