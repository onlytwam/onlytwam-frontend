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
    { icon: 'bi-envelope',   label: 'Email',   value: 'customersupport@onlytwam.com' },
    { icon: 'bi-telephone',  label: 'Phone',   value: '+91 7036534449' },
    { icon: 'bi-clock',      label: 'Hours',   value: 'Mon–Sat to All Days: 9 AM – 9 PM IST' },
    { icon: 'bi-geo-alt',    label: 'Address', value: 'Only TWAM HQ, India' },
  ];

  return (
    <div>
      {/* ── Hero image banner */}
      <img
        src="/assets/images/contact-hero.jpg"
        alt="Contact Us"
        style={{ width: "100%", display: "block" }}
        onError={e => {
          const el = e.target as HTMLImageElement;
          el.style.display = 'none';
        }}
      />

      {/* ── Main content */}
      <div className="container s-contactus-4e9077">
        <div className="s-contactus-deb84a">

          {/* Form */}
          <div>
            <h5 className="s-contactus-a1bd8a">Send a Message</h5>
            <p className="s-contactus-889464">Fill in the form below and we'll respond within 24 hours.</p>
            <div className="row g-3">
              {[{ key: 'name', label: 'Your Name *', type: 'text' }, { key: 'email', label: 'Email Address *', type: 'email' }].map(({ key, label, type }) => (
                <div key={key} className="col-6">
                  <label className="form-label s-addresslist-9eec06">{label}</label>
                  <input className={`form-control ${errors[key] ? 'is-invalid' : ''}`} type={type}
                    value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  {errors[key] && <div className="invalid-feedback">{errors[key]}</div>}
                </div>
              ))}
              <div className="col-12">
                <label className="form-label s-addresslist-9eec06">Subject *</label>
                <input className={`form-control ${errors.subject ? 'is-invalid' : ''}`}
                  value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                {errors.subject && <div className="invalid-feedback">{errors.subject}</div>}
              </div>
              <div className="col-12">
                <label className="form-label s-addresslist-9eec06">Message *</label>
                <textarea className={`form-control ${errors.message ? 'is-invalid' : ''}`} rows={5}
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                {errors.message && <div className="invalid-feedback">{errors.message}</div>}
              </div>
              <div className="col-12">
                <button onClick={() => validate() && mutation.mutate()} disabled={mutation.isPending}
                  className="s-contactus-322913">
                  {mutation.isPending ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div>
            <h5 className="s-contactus-a1bd8a">Get in Touch</h5>
            <p className="s-contactus-889464">Reach us through any of the channels below.</p>
            {contactInfo.map(({ icon, label, value }) => (
              <div key={label} className="s-contactus-a45cb2">
                <div className="s-contactus-aba3e4">
                  <i className={`bi ${icon} s-contactus-50f301`} />
                </div>
                <div>
                  <p className="s-contactus-0ba945">{label}</p>
                  <p className="s-contactus-3df12a">{value}</p>
                </div>
              </div>
            ))}

            {/* Social */}
            <div className="s-contactus-b168a0">
              <p className="s-contactus-d8d032">Follow Us</p>
              <div className="s-contactus-5627cc">
                {[{ icon: 'bi-instagram', label: 'Instagram', url: 'https://www.instagram.com/onlytwam/' }, { icon: 'bi-facebook', label: 'Facebook', url: 'https://www.facebook.com/onlyTwam/' }, { icon: 'bi-whatsapp', label: 'WhatsApp', url: '#' }].map(({ icon, label, url }) => (
                  <a key={label} href={url} className="s-contactus-111fde">
                    <div className="s-contactus-31c18b">
                      <i className={`bi ${icon} s-contactus-d72715`} />
                    </div>
                    <span className="s-adminsizes-b54cfc">{label}</span>
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
