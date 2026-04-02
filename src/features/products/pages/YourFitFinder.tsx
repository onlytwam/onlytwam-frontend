import { useNavigate } from 'react-router-dom';
export default function YourFitFinder() {
  const navigate = useNavigate();
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #6A012A, #111)', color: '#fff', padding: '80px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 12px' }}>Your Perfect Fit Finder</h1>
        <p style={{ fontSize: 16, opacity: .85, maxWidth: 500, margin: '0 auto 28px' }}>Answer a few quick questions and we'll find your perfect bra size and style.</p>
        <button onClick={() => navigate('/take-quiz')}
          style={{ background: '#fff', color: '#6A012A', border: 'none', padding: '14px 32px', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Take the Quiz →
        </button>
      </div>
      <div className="container" style={{ padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, maxWidth: 700, margin: '0 auto' }}>
          {[['bi-1-circle', 'Answer Questions', 'Tell us about your body and preferences'],
            ['bi-2-circle', 'Get Your Size', 'We calculate your perfect fit'],
            ['bi-3-circle', 'Shop Your Style', 'Discover products made for you']].map(([icon, title, desc]) => (
            <div key={title} style={{ padding: 24, textAlign: 'center' }}>
              <i className={`bi ${icon}`} style={{ fontSize: 40, color: '#6A012A', display: 'block', marginBottom: 12 }} />
              <h4 style={{ margin: '0 0 6px', color: '#111' }}>{title}</h4>
              <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}