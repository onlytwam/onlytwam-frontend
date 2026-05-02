import { useNavigate } from 'react-router-dom';
export default function YourFitFinder() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="s-yourfitfinde-d09e17">
        <h1 className="s-yourfitfinde-eb5fe4">Your Perfect Fit Finder</h1>
        <p className="s-yourfitfinde-9ddc5e s-yourfitfinde-034768">Answer a few quick questions and we'll find your perfect bra size and style.</p>
        <button onClick={() => navigate('/take-quiz')}
          className="s-yourfitfinde-f5d44e">
          Take the Quiz →
        </button>
      </div>
      <div className="container s-yourfitfinde-b60864">
        <div className="s-yourfitfinde-6b02af">
          {[['bi-1-circle', 'Answer Questions', 'Tell us about your body and preferences'],
            ['bi-2-circle', 'Get Your Size', 'We calculate your perfect fit'],
            ['bi-3-circle', 'Shop Your Style', 'Discover products made for you']].map(([icon, title, desc]) => (
            <div key={title} className="s-yourfitfinde-fc7872">
              <i className={`bi ${icon} s-yourfitfinde-ee56e7`} />
              <h4 className="s-yourfitfinde-0c174a">{title}</h4>
              <p className="s-yourfitfinde-82177b">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}