import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/shared/api/axiosInstance';

interface BlastResult {
  total:         number;
  email_count:   number;
  wa_count:      number;
  email_sent:    number;
  email_failed:  number;
  wa_sent:       number;
  wa_failed:     number;
  failed_emails: string[];
  failed_phones: string[];
}

interface SubscriberStats {
  total:          number;
  email_count:    number;
  whatsapp_count: number;
  email_list:     string[];
  wa_list:        string[];
}

type Channel = 'both' | 'email' | 'whatsapp';

const CHANNEL_OPTIONS: { value: Channel; label: string; icon: string; desc: string }[] = [
  { value: 'both',     icon: 'bi-send-fill',    label: 'Email + WhatsApp', desc: 'Blast both lists' },
  { value: 'email',    icon: 'bi-envelope-fill', label: 'Email only',       desc: 'Email list only' },
  { value: 'whatsapp', icon: 'bi-whatsapp',      label: 'WhatsApp only',    desc: 'WhatsApp list only' },
];

export default function AdminNewsletterBlast() {
  const [subject,     setSubject]     = useState('');
  const [bodyHtml,    setBodyHtml]    = useState('');
  const [mediaUrl,    setMediaUrl]    = useState('');
  const [channel,     setChannel]     = useState<Channel>('both');
  const [preview,     setPreview]     = useState(false);
  const [result,      setResult]      = useState<BlastResult | null>(null);
  const [showEmList,  setShowEmList]  = useState(false);
  const [showWaList,  setShowWaList]  = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<SubscriberStats>({
    queryKey: ['newsletter-subscribers'],
    queryFn:  () => api.get('/Newsletter/Subscribers').then(r => r.data),
  });

  const blastMut = useMutation({
    mutationFn: () => api.post('/Newsletter/Blast', {
      subject,
      body_html: bodyHtml,
      sent_by:   'admin',
      media_url: mediaUrl || null,
      channels:  channel,
    }),
    onSuccess: (res) => {
      setResult(res.data);
      const d = res.data;
      toast.success(`Done! Email: ${d.email_sent} sent · WhatsApp: ${d.wa_sent} sent`);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || 'Blast failed. Check server logs.'),
  });

  const handleSend = () => {
    if (!subject.trim() && channel !== 'whatsapp') { toast.error('Subject is required'); return; }
    if (!bodyHtml.trim()) { toast.error('Message content is required'); return; }
    const count = channel === 'email'
      ? stats?.email_count
      : channel === 'whatsapp'
        ? stats?.whatsapp_count
        : stats?.total;
    if (!window.confirm(
      `Send to ${count} subscriber(s)?\n\nChannel: ${channel}\nSubject: "${subject}"`
    )) return;
    blastMut.mutate();
  };

  const needsEmail    = channel !== 'whatsapp';
  const needsWhatsApp = channel !== 'email';

  const statCard = (icon: string, label: string, val: number | undefined, color: string) => (
    <div style={{ flex: '1 1 90px', background: '#fff', border: '1px solid var(--ivory)',
                  borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
      <i className={`bi ${icon}`} style={{ color, fontSize: 20 }} />
      <div style={{ fontSize: 22, fontWeight: 700, color, margin: '4px 0' }}>{val ?? '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--heirloom)' }}>{label}</div>
    </div>
  );

  return (
    <div className="s-adminnewslet-1a6034">

      <div className="s-adminnewslet-70cb1d">
        <h2 className="s-adminnewslet-c03dca">Newsletter Blast</h2>
        <p className="s-adminnewslet-ae3404">
          Email list and WhatsApp list are kept separate. Choose which to blast.
        </p>
      </div>

      {/* Subscriber stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {statCard('bi-people-fill',   'Total subscribers',  stats?.total,          'var(--heirloom)')}
        {statCard('bi-envelope-fill', 'Email list',         stats?.email_count,    'var(--brand)')}
        {statCard('bi-whatsapp',      'WhatsApp list',      stats?.whatsapp_count, '#22c55e')}
      </div>

      {/* Expandable subscriber lists */}
      {!statsLoading && stats && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* Email list toggle */}
          {stats.email_count > 0 && (
            <div style={{ flex: '1 1 200px' }}>
              <button onClick={() => setShowEmList(v => !v)}
                style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 8,
                         padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--brand)', width: '100%' }}>
                <i className="bi bi-envelope-fill me-1" />
                {showEmList ? 'Hide' : 'Show'} email list ({stats.email_count})
              </button>
              {showEmList && (
                <div style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8,
                              padding: 12, marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {stats.email_list.map(e => (
                    <div key={e} style={{ fontSize: 12, color: '#444', padding: '2px 0',
                                         borderBottom: '1px solid #f5f5f5' }}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp list toggle */}
          {stats.whatsapp_count > 0 && (
            <div style={{ flex: '1 1 200px' }}>
              <button onClick={() => setShowWaList(v => !v)}
                style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 8,
                         padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#22c55e', width: '100%' }}>
                <i className="bi bi-whatsapp me-1" />
                {showWaList ? 'Hide' : 'Show'} WhatsApp list ({stats.whatsapp_count})
              </button>
              {showWaList && (
                <div style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8,
                              padding: 12, marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {stats.wa_list.map(p => (
                    <div key={p} style={{ fontSize: 12, color: '#444', padding: '2px 0',
                                         borderBottom: '1px solid #f5f5f5' }}>{p}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Channel selector */}
      <div className="s-updateprofil-246fef">
        <label className="s-adminnewslet-9822cd">Send via *</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {CHANNEL_OPTIONS.map(opt => (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '10px 16px', borderRadius: 8,
              border: `2px solid ${channel === opt.value ? 'var(--brand)' : 'var(--ivory)'}`,
              background: channel === opt.value ? 'rgba(107,15,42,0.06)' : '#fff',
              transition: 'all 0.15s', flex: '1 1 110px',
            }}>
              <input type="radio" name="channel" value={opt.value}
                checked={channel === opt.value} onChange={() => setChannel(opt.value)}
                style={{ accentColor: 'var(--brand)' }} />
              <i className={`bi ${opt.icon}`}
                style={{ color: opt.value === 'whatsapp' ? '#22c55e' : 'var(--brand)', fontSize: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--heirloom)' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Subject */}
      {needsEmail && (
        <div className="s-updateprofil-246fef">
          <label className="s-adminnewslet-9822cd">Email Subject *</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. New Arrivals This Week!" className="s-adminnewslet-24126d" />
        </div>
      )}

      {/* WhatsApp image */}
      {needsWhatsApp && (
        <div className="s-updateprofil-246fef">
          <label className="s-adminnewslet-9822cd">
            <i className="bi bi-image me-1" style={{ color: '#22c55e' }} />
            WhatsApp Image URL <span style={{ fontWeight: 400, color: 'var(--heirloom)' }}>(optional)</span>
          </label>
          <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
            placeholder="https://onlytwam.com/assets/images/promo.jpg"
            className="s-adminnewslet-24126d" />
          {mediaUrl && (
            <img src={mediaUrl} alt="preview"
              style={{ marginTop: 8, maxHeight: 100, borderRadius: 8, border: '1px solid var(--ivory)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
      )}

      {/* Body */}
      <div className="s-updateprofil-246fef">
        <div className="s-adminnewslet-04052b">
          <label className="s-adminnewslet-bbeadd">
            {needsEmail ? 'Email Body (HTML) *' : 'Message *'}
          </label>
          <button onClick={() => setPreview(p => !p)} className="s-adminnewslet-b2efc8">
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview
          ? <div dangerouslySetInnerHTML={{ __html: bodyHtml }} className="s-adminnewslet-d5972b" />
          : <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} rows={10}
              placeholder={needsEmail
                ? '<h2 style="color:#6B0F2A;">New Arrivals!</h2>\n<p>Check out our latest...</p>'
                : 'Check out our latest collection!'}
              className="s-adminnewslet-1ef8bf" />
        }
        <p className="s-adminnewslet-68143e">
          {needsEmail
            ? 'TWAM header and unsubscribe link are added automatically.'
            : 'For WhatsApp-only, HTML tags are stripped automatically.'}
        </p>
      </div>

      {/* Send button */}
      <button onClick={handleSend} disabled={blastMut.isPending}
        className="s-adminnewslet-08e757"
        style={{ cursor: blastMut.isPending ? 'not-allowed' : 'pointer', opacity: blastMut.isPending ? 0.7 : 1 }}>
        {blastMut.isPending
          ? <><span className="s-adminnewslet-19ec44" /> Sending…</>
          : <><i className={`bi ${channel === 'whatsapp' ? 'bi-whatsapp' : channel === 'email' ? 'bi-envelope-fill' : 'bi-send-fill'} me-1`} />
              Send to {
                channel === 'email' ? `${stats?.email_count ?? 0} email subscribers`
                : channel === 'whatsapp' ? `${stats?.whatsapp_count ?? 0} WhatsApp subscribers`
                : `all subscribers`
              }</>
        }
      </button>

      {/* Result */}
      {result && (
        <div className="s-adminnewslet-a4d091">
          <h4 className="s-adminnewslet-d22ace">Blast Result</h4>
          <div className="s-adminnewslet-8776ee">
            {[
              { label: 'Total subscribers', val: result.total,        color: 'var(--heirloom)' },
              { label: 'Email sent',        val: result.email_sent,   color: 'var(--brand)' },
              { label: 'Email failed',      val: result.email_failed, color: result.email_failed  > 0 ? '#c0392b' : 'var(--heirloom)' },
              { label: 'WhatsApp sent',     val: result.wa_sent,      color: '#22c55e' },
              { label: 'WhatsApp failed',   val: result.wa_failed,    color: result.wa_failed > 0 ? '#c0392b' : 'var(--heirloom)' },
            ].map(s => (
              <div key={s.label} className="s-adminnewslet-e2e1e0">
                <div className="s-adminnewslet-af7cb0 s-adminnewslet-a8e0c8" style={{ color: s.color }}>{s.val}</div>
                <div className="s-adminnewslet-f01220">{s.label}</div>
              </div>
            ))}
          </div>
          {result.failed_emails.length > 0 && (
            <div className="s-adminnewslet-171a67">
              <p className="s-adminnewslet-257fc7">Failed emails:</p>
              <p className="s-adminnewslet-799840">{result.failed_emails.join(', ')}</p>
            </div>
          )}
          {result.failed_phones.length > 0 && (
            <div className="s-adminnewslet-171a67">
              <p className="s-adminnewslet-257fc7" style={{ color: '#c0392b' }}>
                Failed WhatsApp numbers (check server logs for [WA-DEBUG-BLAST]):
              </p>
              <p className="s-adminnewslet-799840">{result.failed_phones.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
