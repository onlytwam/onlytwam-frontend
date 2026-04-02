import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';

const PRI      = 'var(--brand)';
const IVORY    = 'var(--ivory)';
const HEIRLOOM = 'var(--heirloom)';

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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: PRI, fontFamily: 'var(--font-heading)', margin: '0 0 6px', fontSize: 22 }}>
          Send Newsletter Update
        </h2>
        <p style={{ color: HEIRLOOM, fontSize: 13, margin: 0 }}>
          Sends to all active subscribers. Each email includes a personal unsubscribe link.
        </p>
      </div>

      {/* Subject */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: PRI, marginBottom: 6 }}>
          Subject *
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. New Arrivals This Week!"
          style={{
            width: '100%', padding: '10px 14px', border: '1.5px solid var(--border-color)',
            borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Body HTML */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: PRI }}>
            Email Body (HTML) *
          </label>
          <button
            onClick={() => setPreview(p => !p)}
            style={{ background: 'none', border: `1px solid ${HEIRLOOM}`, color: HEIRLOOM,
              padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            style={{ border: '1.5px solid var(--border-color)', borderRadius: 8, padding: 20,
              minHeight: 200, background: '#fff', fontSize: 14 }}
          />
        ) : (
          <textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            placeholder={`<h2 style="color:#6B0F2A">New Arrivals!</h2>\n<p>Check out our latest collection...</p>\n<a href="https://onlytwam.com/user-products/product-list"\n   style="background:#6B0F2A;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;">\n  Shop Now\n</a>`}
            rows={12}
            style={{
              width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-color)',
              borderRadius: 8, fontSize: 13, fontFamily: 'monospace', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        )}
        <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>
          TWAM header and unsubscribe footer are added automatically by the backend.
        </p>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={blastMut.isPending}
        style={{
          background: PRI, color: '#fff', border: 'none', padding: '12px 32px',
          borderRadius: 8, cursor: blastMut.isPending ? 'not-allowed' : 'pointer',
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          opacity: blastMut.isPending ? 0.7 : 1,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        {blastMut.isPending ? (
          <>
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)',
              borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            Sending…
          </>
        ) : (
          <><i className="bi bi-send-fill" /> Send to All Subscribers</>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </button>

      {/* Result */}
      {result && (
        <div style={{ marginTop: 24, padding: 20, background: IVORY,
          border: '1.5px solid var(--border-color)', borderRadius: 10 }}>
          <h4 style={{ color: PRI, margin: '0 0 12px', fontSize: 15 }}>Blast Result</h4>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total subscribers', val: result.total, color: '#555' },
              { label: 'Sent',    val: result.sent,   color: '#2e7d32' },
              { label: 'Failed',  val: result.failed, color: result.failed > 0 ? '#A84C6B' : '#888' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {result.failed_emails.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: '#A84C6B', margin: '0 0 4px', fontWeight: 600 }}>
                Failed emails:
              </p>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                {result.failed_emails.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}