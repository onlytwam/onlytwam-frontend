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
    <div className="s-ourblog-f6d3dd">
      <i className="bi bi-check-circle-fill s-takequiz-d435f6" />
      <h2 className="s-takequiz-1cc0e1">Your Perfect Fit is Ready!</h2>
      <p className="s-takequiz-8cad27">Based on your answers, we recommend browsing our curated collection.</p>
      <button onClick={() => navigate('/user-products/product-list')}
        className="s-takequiz-69b45a">
        Shop Your Recommendations →
      </button>
    </div>
  );
  const q = QUESTIONS[step];
  return (
    <div className="s-takequiz-c58c60">
      <div className="s-takequiz-9fd041">
        <div className="s-adminnewslet-70cb1d">
          <div className="s-takequiz-7782dc">
            {QUESTIONS.map((_, i) => <div key={i} className="s-takequiz-c1fa43" style={ {background: i <= step ? 'var(--brand)' : 'var(--ivory)'} } />)}
          </div>
          <p className="s-takequiz-e87ca4">Question {step + 1} of {QUESTIONS.length}</p>
          <h2 className="s-takequiz-7f5630">{q.q}</h2>
        </div>
        <div className="s-productlist-a2d5a5">
          {q.opts.map(opt => (
            <button key={opt} onClick={() => choose(opt)}
              className="s-takequiz-13e64c"
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ivory)'; e.currentTarget.style.color = '#000000'; }}>
              {opt}
            </button>
          ))}
        </div>
        {step > 0 && <button onClick={() => { setStep(step - 1); setAnswers(answers.slice(0, -1)); }}
          className="s-takequiz-d98c48">← Back</button>}
      </div>
    </div>
  );
}