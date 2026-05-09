import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import Footer from '../../components/Footer';

const PLANS = [
  {
    name: 'Free', price: 0, desc: 'For getting started.',
    features: [['3 uploads / mo', true], ['Manual posting', true], ['Auto-republish', false], ['AI smart clips', false], ['Priority queue', false]] as [string, boolean][],
    cta: 'Start free', primary: false,
  },
  {
    name: 'Pro', price: 12, desc: 'For working creators.', popular: true,
    features: [['Unlimited uploads', true], ['Auto-republish', true], ['AI smart clips', true], ['Priority queue', true], ['3 brand profiles', true]] as [string, boolean][],
    cta: 'Upgrade to Pro', primary: true,
  },
  {
    name: 'Studio', price: 49, desc: 'For agencies and teams.',
    features: [['Everything in Pro', true], ['10 brand profiles', true], ['Team seats', true], ['SLA + support', true], ['API access', true]] as [string, boolean][],
    cta: 'Talk to sales', primary: false,
  },
];

const FAQ = [
  { q: 'What counts as an upload?', a: 'Each video file you upload to Redistribute counts as one upload, regardless of how many platforms it gets distributed to.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel at any time from your billing page. Your Pro access continues until the end of your billing cycle.' },
  { q: 'What platforms are supported?', a: 'YouTube, TikTok, and Instagram. More platforms coming soon.' },
  { q: 'How does Auto-Republish work?', a: 'Connect your accounts, set your rules, and Redistribute polls your channels every 15 minutes for new videos. When one is found, it cross-posts automatically.' },
];

export default function Pricing() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F5F4F0', color: '#0C0B09' }}>
      <div className="flex-1 px-14 py-16 overflow-hidden">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="font-sans font-bold uppercase mb-4" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6C47FF' }}>
            Pricing
          </div>
          <h1 className="font-display font-extrabold m-0" style={{ fontSize: 60, letterSpacing: '-0.04em', color: '#0C0B09', lineHeight: 1 }}>
            Simple <span style={{ fontStyle: 'italic', fontWeight: 500 }}>pricing.</span>
          </h1>
          <p className="font-sans mt-4 mx-auto" style={{ fontSize: 15, color: '#706D64', maxWidth: 420 }}>
            Start free. Upgrade when auto-republish becomes a habit.
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-5 max-w-5xl mx-auto mb-20" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className="rounded-2xl relative"
              style={{
                background: '#fff',
                border: plan.popular ? '1px solid #6C47FF' : '1px solid rgba(0,0,0,0.06)',
                padding: '28px 28px 30px',
                boxShadow: plan.popular ? '0 8px 40px rgba(108,71,255,0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {plan.popular && (
                <div
                  className="absolute font-sans font-bold uppercase"
                  style={{ top: 14, right: 14, background: '#6C47FF', color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 9, letterSpacing: '0.08em' }}
                >
                  MOST POPULAR
                </div>
              )}
              <div className="font-sans font-bold uppercase mb-3.5" style={{ fontSize: 11, letterSpacing: '0.10em', color: '#706D64' }}>
                {plan.name}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-extrabold leading-none" style={{ fontSize: 52, letterSpacing: '-0.04em', color: '#0C0B09' }}>
                  ${plan.price}
                </span>
                <span className="font-sans" style={{ fontSize: 14, color: '#706D64' }}>/mo</span>
              </div>
              <div className="font-sans mt-2.5" style={{ fontSize: 13, color: '#706D64' }}>{plan.desc}</div>
              <div className="my-5 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />
              <div className="flex flex-col gap-2.5">
                {plan.features.map(([f, ok]) => (
                  <div key={f} className="flex items-center gap-2.5 font-sans" style={{ fontSize: 13, color: ok ? '#0C0B09' : 'rgba(0,0,0,0.35)' }}>
                    <span
                      className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{ width: 18, height: 18, background: ok ? 'rgba(14,210,160,0.15)' : 'rgba(0,0,0,0.04)', color: ok ? '#0ED2A0' : '#706D64' }}
                    >
                      {ok ? <Check size={11} strokeWidth={2.5} /> : <Minus size={11} strokeWidth={2.5} />}
                    </span>
                    {f}
                  </div>
                ))}
              </div>
              <Link
                to={plan.primary ? '/register' : plan.name === 'Studio' ? '/contact' : '/register'}
                className="block text-center font-sans font-medium rounded-full mt-6 transition-colors"
                style={{
                  background: plan.primary ? '#6C47FF' : 'transparent',
                  color: plan.primary ? '#fff' : '#0C0B09',
                  border: plan.primary ? 'none' : '1px solid rgba(0,0,0,0.15)',
                  padding: '12px 16px', fontSize: 13, textDecoration: 'none',
                  boxShadow: plan.primary ? '0 0 32px rgba(108,71,255,0.30)' : 'none',
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-bold mb-8 text-center" style={{ fontSize: 36, letterSpacing: '-0.03em', color: '#0C0B09' }}>
            FAQ
          </h2>
          <div className="flex flex-col gap-6">
            {FAQ.map(item => (
              <div key={item.q} className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="font-sans font-semibold mb-2" style={{ fontSize: 15, color: '#0C0B09' }}>{item.q}</div>
                <p className="font-sans m-0" style={{ fontSize: 14, color: '#706D64', lineHeight: 1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
