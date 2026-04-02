import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createSupportRequest } from '@/features/products/api/products.api';

export default function ContactUs() {
  const [form, setForm] = useState({ subject: '', message: '', name: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => createSupportRequest({ subject: form.subject, message: `From: ${form.name} (${form.email})\n\n${form.message}` }),
    onSuccess: () => { toast.success("Message sent! We'll get back to you within 24 hours."); setForm({ subject: '', message: '', name: '', email: '' }); },
    onError: () => toast.error('Failed to send. Please try again.'),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name    = 'Name is required';
    if (!form.email.trim())   e.email   = 'Email is required';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.message.trim()) e.message = 'Message is required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const contactInfo = [
    { icon: 'bi-envelope',   label: 'Email',   value: 'support@onlytwam.com' },
    { icon: 'bi-telephone',  label: 'Phone',   value: '+91 98765 43210' },
    { icon: 'bi-clock',      label: 'Hours',   value: 'Mon–Sat, 9 AM – 6 PM IST' },
    { icon: 'bi-geo-alt',    label: 'Address', value: 'Only TWAM HQ, India' },
  ];

  return (
    <div>
      {/* ── Hero image banner */}
      <div style={{ position: 'relative', height: 320, overflow: 'hidden' }}>
        <img
          src="/assets/images/contact-hero.jpg"
          alt="Contact Us"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          onError={e => {
            // Fallback gradient if image missing
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
          }}
        />
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(106,1,42,0.72) 0%, rgba(30,0,10,0.45) 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 16px',
        }}>
          <span style={{
            display: 'inline-block', background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 3,
            textTransform: 'uppercase', padding: '5px 16px', borderRadius: 20, marginBottom: 16,
          }}>
            We're Here For You
          </span>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(28px, 5vw, 48px)', margin: '0 0 12px', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            Contact Us
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, maxWidth: 500, margin: 0, lineHeight: 1.6 }}>
            We'd love to hear from you. Our team is ready to help with any questions or concerns.
          </p>
        </div>
      </div>

      {/* ── Breadcrumb strip */}
      <div style={{ background: '#f9f4f6', borderBottom: '1px solid #f0e0e6', padding: '10px 24px' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <nav style={{ fontSize: 13, color: '#888' }}>
            <a href="/" style={{ color: '#6A012A', textDecoration: 'none' }}>Home</a>
            <i className="bi bi-chevron-right" style={{ margin: '0 6px', fontSize: 10 }} />
            <span>Contact Us</span>
          </nav>
        </div>
      </div>

      {/* ── Main content */}
      <div className="container" style={{ padding: '52px 16px', maxWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, flexWrap: 'wrap' }}>

          {/* Form */}
          <div>
            <h5 style={{ marginBottom: 6, fontWeight: 700 }}>Send a Message</h5>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>Fill in the form below and we'll respond within 24 hours.</p>
            <div className="row g-3">
              {[{ key: 'name', label: 'Your Name *', type: 'text' }, { key: 'email', label: 'Email Address *', type: 'email' }].map(({ key, label, type }) => (
                <div key={key} className="col-6">
                  <label className="form-label" style={{ fontSize: 13 }}>{label}</label>
                  <input className={`form-control ${errors[key] ? 'is-invalid' : ''}`} type={type}
                    value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  {errors[key] && <div className="invalid-feedback">{errors[key]}</div>}
                </div>
              ))}
              <div className="col-12">
                <label className="form-label" style={{ fontSize: 13 }}>Subject *</label>
                <input className={`form-control ${errors.subject ? 'is-invalid' : ''}`}
                  value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                {errors.subject && <div className="invalid-feedback">{errors.subject}</div>}
              </div>
              <div className="col-12">
                <label className="form-label" style={{ fontSize: 13 }}>Message *</label>
                <textarea className={`form-control ${errors.message ? 'is-invalid' : ''}`} rows={5}
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                {errors.message && <div className="invalid-feedback">{errors.message}</div>}
              </div>
              <div className="col-12">
                <button onClick={() => validate() && mutation.mutate()} disabled={mutation.isPending}
                  style={{ background: '#6A012A', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, width: '100%', fontSize: 15 }}>
                  {mutation.isPending ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div>
            <h5 style={{ marginBottom: 6, fontWeight: 700 }}>Get in Touch</h5>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>Reach us through any of the channels below.</p>
            {contactInfo.map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fdf3f6', border: '1px solid #f0dde4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`bi ${icon}`} style={{ fontSize: 20, color: '#6A012A' }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, marginTop: 2 }}>{value}</p>
                </div>
              </div>
            ))}

            {/* Social */}
            <div style={{ background: '#fdf3f6', borderRadius: 12, padding: '20px 24px', marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: '#333' }}>Follow Us</p>
              <div style={{ display: 'flex', gap: 20 }}>
                {[{ icon: 'bi-instagram', label: 'Instagram', url: '#' }, { icon: 'bi-facebook', label: 'Facebook', url: '#' }, { icon: 'bi-whatsapp', label: 'WhatsApp', url: '#' }].map(({ icon, label, url }) => (
                  <a key={label} href={url} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#555' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1px solid #f0dde4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`bi ${icon}`} style={{ fontSize: 18, color: '#6A012A' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
