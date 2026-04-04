import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';

interface BlastResult {
  total: number;
  sent: number;
  failed: number;
  failed_emails: string[];
}

export default function AdminNewsletterBlast() {
  const [subject,  setSubject]  = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [preview,  setPreview]  = useState(false);
  const [result,   setResult]   = useState<BlastResult | null>(null);

  const blastMut = useMutation({
    mutationFn: () => api.post('/Newsletter/Blast', {
      subject,
      body_html: bodyHtml,
      sent_by: 'admin',
    }),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success(`Sent to ${res.data.sent} subscribers!`);
    },
    onError: () => toast.error('Failed to send. Check SMTP credentials.'),
  });

  const handleSend = () => {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!bodyHtml.trim()) { toast.error('Email body is required'); return; }
    if (!window.confirm(`Send to ALL active subscribers?\n\nSubject: "${subject}"`)) return;
    blastMut.mutate();
  };

  return (
    <div className="s-adminnewslet-1a6034">

      {/* Header */}
      <div className="s-adminnewslet-70cb1d">
        <h2 className="s-adminnewslet-c03dca">
          Send Newsletter Update
        </h2>
        <p className="s-adminnewslet-ae3404">
          Sends to all active subscribers. Each email includes a personal unsubscribe link.
        </p>
      </div>

      {/* Subject */}
      <div className="s-updateprofil-246fef">
        <label className="s-adminnewslet-9822cd">
          Subject *
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. New Arrivals This Week!"
          className="s-adminnewslet-24126d"
        />
      </div>

      {/* Body HTML */}
      <div className="s-updateprofil-246fef">
        <div className="s-adminnewslet-04052b">
          <label className="s-adminnewslet-bbeadd">
            Email Body (HTML) *
          </label>
          <button
            onClick={() => setPreview(p => !p)}
            className="s-adminnewslet-b2efc8">
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            className="s-adminnewslet-d5972b"
          />
        ) : (
          <textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            placeholder={`<h2 style="color:var(--brand)">New Arrivals!</h2>\n<p>Check out our latest collection...</p>\n<a href="https://onlytwam.com/user-products/product-list"\n   style="background:var(--brand);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;">\n  Shop Now\n</a>`}
            rows={12}
            className="s-adminnewslet-1ef8bf"
          />
        )}
        <p className="s-adminnewslet-68143e">
          TWAM header and unsubscribe footer are added automatically by the backend.
        </p>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={blastMut.isPending}
        className="s-adminnewslet-08e757" style={ {cursor: blastMut.isPending ? 'not-allowed' : 'pointer', opacity: blastMut.isPending ? 0.7 : 1} }>
        {blastMut.isPending ? (
          <>
            <span className="s-adminnewslet-19ec44" />
            Sending…
          </>
        ) : (
          <><i className="bi bi-send-fill" /> Send to All Subscribers</>
        )}
        </button>

      {/* Result */}
      {result && (
        <div className="s-adminnewslet-a4d091">
          <h4 className="s-adminnewslet-d22ace">Blast Result</h4>
          <div className="s-adminnewslet-8776ee">
            {[
              { label: 'Total subscribers', val: result.total, color: 'var(--heirloom)' },
              { label: 'Sent',    val: result.sent,   color: 'var(--brand)' },
              { label: 'Failed',  val: result.failed, color: result.failed > 0 ? 'var(--blush)' : 'var(--heirloom)' },
            ].map(s => (
              <div key={s.label} className="s-adminnewslet-e2e1e0">
                <div className="s-adminnewslet-af7cb0 s-adminnewslet-a8e0c8">{s.val}</div>
                <div className="s-adminnewslet-f01220">{s.label}</div>
              </div>
            ))}
          </div>
          {result.failed_emails.length > 0 && (
            <div className="s-adminnewslet-171a67">
              <p className="s-adminnewslet-257fc7">
                Failed emails:
              </p>
              <p className="s-adminnewslet-799840">
                {result.failed_emails.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}