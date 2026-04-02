import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const QUESTIONS = [
  { q: 'What is your current band size?', opts: ['30', '32', '34', '36', '38', '40', '42'] },
  { q: 'What is your cup size?', opts: ['A', 'B', 'C', 'D', 'DD/E', 'F', 'G'] },
  { q: 'What type of bra do you usually wear?', opts: ['T-Shirt Bra', 'Sports Bra', 'Balconette', 'Full Coverage', 'Wireless', 'Push-Up'] },
  { q: 'What do you value most in a bra?', opts: ['Comfort', 'Support', 'Style', 'Lift', 'Coverage'] },
];
export default function TakeQuiz() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const choose = (opt: string) => {
    const newAnswers = [...answers, opt];
    if (step < QUESTIONS.length - 1) { setAnswers(newAnswers); setStep(step + 1); }
    else setDone(true);
  };
  if (done) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <i className="bi bi-check-circle-fill" style={{ fontSize: 64, color: '#2e7d32', display: 'block', marginBottom: 20 }} />
      <h2 style={{ fontWeight: 700, marginBottom: 10 }}>Your Perfect Fit is Ready!</h2>
      <p style={{ color: '#888', marginBottom: 28 }}>Based on your answers, we recommend browsing our curated collection.</p>
      <button onClick={() => navigate('/user-products/product-list')}
        style={{ background: '#111', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 6, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>
        Shop Your Recommendations →
      </button>
    </div>
  );
  const q = QUESTIONS[step];
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {QUESTIONS.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#6A012A' : '#eee', transition: 'background .3s' }} />)}
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Question {step + 1} of {QUESTIONS.length}</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>{q.q}</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {q.opts.map(opt => (
            <button key={opt} onClick={() => choose(opt)}
              style={{ padding: '12px 20px', border: '2px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 500, transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6A012A'; e.currentTarget.style.color = '#6A012A'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#111'; }}>
              {opt}
            </button>
          ))}
        </div>
        {step > 0 && <button onClick={() => { setStep(step - 1); setAnswers(answers.slice(0, -1)); }}
          style={{ marginTop: 20, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>← Back</button>}
      </div>
    </div>
  );
}