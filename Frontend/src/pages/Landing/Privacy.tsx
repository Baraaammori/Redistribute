import React, { useEffect } from "react";
import Footer from "../../components/Footer";

export default function Privacy() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(e => e.forEach(el => { if(el.isIntersecting) el.target.classList.add("visible"); }), { threshold: 0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const sections = [
    {
      title: "1. Information We Collect",
      body: "We collect information you provide directly to us when you create an account (name, email address, password), connect social media accounts (OAuth tokens), and use the Service (uploaded videos, titles, descriptions, tags). We also collect usage data automatically, including log data, device information, and cookies.",
    },
    {
      title: "2. How We Use Your Information",
      body: "We use the information we collect to: provide, maintain, and improve the Service; process your video uploads and distribute them to authorized platforms; send transactional emails (upload confirmations, error notifications); process payments via Stripe; respond to your comments and questions; and comply with legal obligations.",
    },
    {
      title: "3. OAuth Tokens & Platform Access",
      body: "When you connect a social media platform (YouTube, TikTok, Instagram), we store OAuth access and refresh tokens in our database. These tokens are encrypted at rest and are used exclusively to upload your content on your behalf. We never post content without your explicit instruction, and you can revoke access at any time from your account settings.",
    },
    {
      title: "4. Data Storage & Security",
      body: "Your data is stored on Supabase-hosted PostgreSQL databases and Supabase Storage (built on AWS S3). Video files are temporarily stored during processing and permanently stored in your personal storage bucket. We implement industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest, and regular security audits.",
    },
    {
      title: "5. Data Retention",
      body: "We retain your account information for as long as your account is active. Uploaded videos and clips are retained until you delete them. If you close your account, we will delete your personal data within 30 days, except where we are required to retain it by law. Distribution logs may be retained for up to 12 months for debugging purposes.",
    },
    {
      title: "6. Sharing of Information",
      body: "We do not sell, trade, or rent your personal information to third parties. We share your information only with: third-party platforms (YouTube, TikTok, Instagram) when you explicitly authorize a distribution; Stripe for payment processing; and service providers who assist in operating the Service (hosting, email). All service providers are bound by confidentiality agreements.",
    },
    {
      title: "7. Cookies & Tracking",
      body: "We use cookies and similar tracking technologies to maintain your session, remember your preferences, and analyze usage patterns to improve the Service. You can control cookies through your browser settings. Disabling cookies may affect some functionality of the Service.",
    },
    {
      title: "8. Your Rights",
      body: "Depending on your location, you may have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your data; object to or restrict processing of your data; and data portability. To exercise these rights, please contact us at privacy@redistribute.io.",
    },
    {
      title: "9. Children's Privacy",
      body: "The Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal data from a child under 13, we will take steps to delete that information promptly.",
    },
    {
      title: "10. Changes to This Policy",
      body: "We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the \"last updated\" date. Your continued use of the Service after any changes constitutes your acceptance of the updated policy.",
    },
    {
      title: "11. Contact Us",
      body: "If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at privacy@redistribute.io or through our Contact page. We aim to respond to all privacy-related inquiries within 48 hours.",
    },
  ];

  return (
    <div>
      <style>{`.reveal{opacity:0;transform:translateY(24px);transition:opacity 0.65s,transform 0.65s}.reveal.visible{opacity:1;transform:none}`}</style>

      {/* HERO */}
      <div style={{ background: "#0A0A0F", padding: "140px 48px 80px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(155,126,255,0.8)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>Legal</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(40px,6vw,72px)", fontWeight: 800, letterSpacing: -3, color: "white", marginBottom: 20, lineHeight: 1 }}>Privacy<br />Policy.</h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 500, margin: "0 auto", fontWeight: 300, lineHeight: 1.7 }}>Your privacy is important to us. We're transparent about what we collect and why. Last updated: April 29, 2025.</p>
      </div>

      {/* KEY POINTS */}
      <div className="reveal" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 48px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
          {[
            { icon: "🔐", t: "Encrypted storage", d: "Tokens & data encrypted at rest with AES-256." },
            { icon: "🚫", t: "Never sold", d: "Your data is never sold or rented to third parties." },
            { icon: "✅", t: "You're in control", d: "Revoke platform access or delete your data anytime." },
          ].map(v => (
            <div key={v.t} style={{ background: "#F7F6F2", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: "24px" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{v.icon}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{v.t}</div>
              <div style={{ fontSize: 13, color: "#6B6960", lineHeight: 1.6, fontWeight: 300 }}>{v.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 48px 96px" }}>
        {sections.map((s, i) => (
          <div key={i} className="reveal" style={{ marginBottom: 48 }}>
            <div style={{ height: 1, background: "rgba(0,0,0,0.07)", marginBottom: 32 }} />
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginBottom: 14, color: "#0A0A0F" }}>{s.title}</h2>
            <p style={{ fontSize: 15, color: "#6B6960", lineHeight: 1.8, fontWeight: 300 }}>{s.body}</p>
          </div>
        ))}

        {/* CTA box */}
        <div className="reveal" style={{ background: "#0A0A0F", borderRadius: 20, padding: "40px 44px", marginTop: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(155,126,255,0.8)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 12, fontFamily: "'Syne',sans-serif" }}>Privacy concerns?</div>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: -1, color: "white", marginBottom: 10 }}>We take privacy seriously.</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 300, marginBottom: 24, lineHeight: 1.65 }}>Have a question or concern about how we handle your data? Our team is ready to help and we'll respond within 48 hours.</p>
          <a href="/contact" style={{ display: "inline-block", padding: "11px 28px", background: "linear-gradient(135deg,#7C5CFC,#1FCFA0)", color: "white", borderRadius: 100, fontSize: 13, textDecoration: "none", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>Contact us →</a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
