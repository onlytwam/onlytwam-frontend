import { useSearchParams, Link } from 'react-router-dom';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || 'success';
  const email  = searchParams.get('email')  || '';
  const isSuccess = status === 'success';

  return (
    <div className="s-unsubscribe-2ad715">
      <div className="s-unsubscribe-1c1f37">

        <div className="s-unsubscribe-9ee44b" style={ {background: isSuccess ? 'rgba(107,15,42,.08)' : 'rgba(168,76,107,.08)'} }>
          <i
            className={`${isSuccess ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-circle-fill'} s-unsubscribe-9f799e`} style={ {color: isSuccess ? 'var(--brand)' : 'var(--blush)'} }
          />
        </div>

        {isSuccess ? (
          <>
            <h1 className="s-unsubscribe-3d21d9">
              You have been unsubscribed
            </h1>
            {email && (
              <p className="s-unsubscribe-3485eb">
                <strong className="s-unsubscribe-76d778">{email}</strong>
              </p>
            )}
            <p className="s-unsubscribe-434ca1">
              You have been successfully removed from our marketing emails.
            </p>
            <p className="s-unsubscribe-477937">
              You will still receive order confirmations and important account updates.
            </p>
          </>
        ) : (
          <>
            <h1 className="s-unsubscribe-565265">
              Invalid Link
            </h1>
            <p className="s-unsubscribe-df13b8">
              This unsubscribe link is invalid or has expired. Please contact us at{' '}
              <a href="mailto:customercustomersupport@onlytwam.com" className="s-unsubscribe-76d778">
                customercustomersupport@onlytwam.com
              </a>
            </p>
          </>
        )}

        <Link to="/" className="s-unsubscribe-beccd2">
          Back to TWAM
        </Link>

      </div>
    </div>
  );
}