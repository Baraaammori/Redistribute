import React, { useState } from 'react';
import { Mail, ExternalLink, Globe, Send } from 'lucide-react';
import Footer from '../../components/Footer';

const CONTACT_INFO = [
  { icon: Mail,   label: 'Email',   value: 'team@redistribute.io' },
  { icon: ExternalLink, label: 'GitHub',   value: 'github.com/redistribute-io' },
  { icon: Globe,  label: 'Live app', value: 'app.redistribute.io' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F5F4F0', color: '#0C0B09' }}>
      <div className="flex-1 px-14 py-14">
        <div className="grid gap-14 max-w-5xl mx-auto" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
          {/* Left */}
          <div>
            <h1 className="font-display font-extrabold m-0" style={{ fontSize: 48, letterSpacing: '-0.04em', color: '#0C0B09', lineHeight: 1 }}>
              Say hello.
            </h1>
            <p className="font-sans mt-4" style={{ fontSize: 14, color: '#706D64', lineHeight: 1.6 }}>
              Bug, request, partnership, or just curious — we read everything.
            </p>
            <div className="flex flex-col gap-4 mt-9">
              {CONTACT_INFO.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3.5">
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg"
                    style={{ width: 36, height: 36, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', color: '#0C0B09' }}
                  >
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#706D64' }}>
                      {label}
                    </div>
                    <div className="font-mono mt-0.5" style={{ fontSize: 13, color: '#0C0B09' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', padding: 28 }}>
            {sent ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-10 text-center">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, background: 'rgba(14,210,160,0.15)', color: '#0ED2A0' }}
                >
                  <Send size={20} />
                </div>
                <div className="font-display font-bold" style={{ fontSize: 22, letterSpacing: '-0.02em', color: '#0C0B09' }}>Message sent!</div>
                <p className="font-sans m-0" style={{ fontSize: 14, color: '#706D64' }}>We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {(['name', 'email'] as const).map(field => (
                    <label key={field} className="flex flex-col gap-1.5">
                      <span className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#706D64' }}>
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                      </span>
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        value={form[field]}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        required
                        style={{
                          background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
                          padding: '10px 14px', color: '#0C0B09', fontSize: 14, outline: 'none', width: '100%',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#706D64' }}>Subject</span>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    style={{
                      background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
                      padding: '10px 14px', color: '#0C0B09', fontSize: 14, outline: 'none', width: '100%',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-sans font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#706D64' }}>Message</span>
                  <textarea
                    rows={6}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    required
                    style={{
                      background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
                      padding: '10px 14px', color: '#0C0B09', fontSize: 14, outline: 'none', resize: 'none', width: '100%',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className="self-start inline-flex items-center gap-2 font-sans font-medium rounded-full"
                  style={{
                    background: '#6C47FF', color: '#fff', border: 'none', padding: '12px 24px', fontSize: 13, cursor: 'pointer',
                    boxShadow: '0 0 32px rgba(108,71,255,0.35)',
                  }}
                >
                  Send message <Send size={13} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
