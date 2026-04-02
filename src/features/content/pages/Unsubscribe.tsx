import { useSearchParams, Link } from 'react-router-dom';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || 'success';
  const email  = searchParams.get('email')  || '';
  const isSuccess = status === 'success';

  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Trebuchet MS", Arial, sans-serif', padding: '40px 16px',
      background: '#F5F0E6',
    }}>
      <div style={{
        maxWidth: 460, width: '100%', textAlign: 'center',
        background: '#fff', borderRadius: 16, padding: '48px 40px',
        boxShadow: '0 8px 32px rgba(107,15,42,.12)',
        border: '1px solid #e8d0d8',
      }}>

        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: isSuccess ? 'rgba(107,15,42,.08)' : 'rgba(168,76,107,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <i
            className={isSuccess ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-circle-fill'}
            style={{ fontSize: 40, color: isSuccess ? '#6B0F2A' : '#A84C6B' }}
          />
        </div>

        {isSuccess ? (
          <>
            <h1 style={{ color: '#6B0F2A', fontSize: 24, fontWeight: 700, margin: '0 0 12px' }}>
              You have been unsubscribed
            </h1>
            {email && (
              <p style={{ color: '#9E6070', fontSize: 14, margin: '0 0 8px' }}>
                <strong style={{ color: '#6B0F2A' }}>{email}</strong>
              </p>
            )}
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
              You have been successfully removed from our marketing emails.
            </p>
            <p style={{ color: '#999', fontSize: 13, lineHeight: 1.6, margin: '0 0 32px' }}>
              You will still receive order confirmations and important account updates.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ color: '#A84C6B', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
              Invalid Link
            </h1>
            <p style={{ color: '#555', fontSize: 14, margin: '0 0 32px' }}>
              This unsubscribe link is invalid or has expired. Please contact us at{' '}
              <a href="mailto:customersupport@onlytwam.com" style={{ color: '#6B0F2A' }}>
                customersupport@onlytwam.com
              </a>
            </p>
          </>
        )}

        <Link to="/" style={{
          display: 'inline-block', padding: '12px 36px',
          background: '#6B0F2A', color: '#fff',
          borderRadius: 8, textDecoration: 'none',
          fontSize: 14, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(107,15,42,.25)',
        }}>
          Back to TWAM
        </Link>

      </div>
    </div>
  );
}