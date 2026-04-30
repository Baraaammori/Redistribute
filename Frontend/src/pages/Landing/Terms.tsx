import React, { useEffect } from "react";
import Footer from "../../components/Footer";

export default function Terms() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(e => e.forEach(el => { if(el.isIntersecting) el.target.classList.add("visible"); }), { threshold: 0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const sections = [
    {
      title: "1. Acceptance of Terms",
      body: "By accessing or using Redistribute (the \"Service\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms apply to all visitors, users, and others who access the Service.",
    },
    {
      title: "2. Description of Service",
      body: "Redistribute is an intelligent media distribution platform that allows creators to upload a single video and distribute it across multiple social media platforms including YouTube, TikTok, and Instagram. The Service uses automated processing and AI-powered decision making to optimize content for each platform.",
    },
    {
      title: "3. User Accounts",
      body: "You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use. You must provide accurate, complete, and current information when creating your account.",
    },
    {
      title: "4. Content & Intellectual Property",
      body: "You retain full ownership of all content you upload to the Service. By uploading content, you grant Redistribute a limited, non-exclusive license to process, store, and distribute your content on your behalf to the platforms you authorize. We do not claim ownership of your content and will never use it for any purpose other than providing the Service.",
    },
    {
      title: "5. Prohibited Activities",
      body: "You agree not to: upload content that infringes on intellectual property rights; use the Service to distribute spam or misleading content; attempt to reverse engineer or compromise the Service; upload content that is illegal, abusive, or violates third-party platform policies; resell or sublicense access to the Service without written permission.",
    },
    {
      title: "6. Third-Party Platforms",
      body: "Redistribute connects to third-party platforms (YouTube, TikTok, Instagram) using official APIs. You are responsible for complying with each platform's terms of service. We are not liable for changes to third-party APIs, platform policy violations, or content rejection by third-party platforms.",
    },
    {
      title: "7. Payments & Subscriptions",
      body: "Some features of the Service require a paid subscription. All payments are processed securely via Stripe. Subscription fees are billed in advance on a monthly basis. You may cancel your subscription at any time, and your access will continue until the end of the current billing period. No refunds are provided for partial months.",
    },
    {
      title: "8. Termination",
      body: "We reserve the right to suspend or terminate your account at our sole discretion if you violate these Terms of Service, engage in fraudulent activity, or use the Service in a way that harms other users or third parties. Upon termination, your right to use the Service will immediately cease.",
    },
    {
      title: "9. Limitation of Liability",
      body: "The Service is provided \"as is\" without warranties of any kind. Redistribute shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability to you for any claims shall not exceed the amount you paid for the Service in the last 12 months.",
    },
    {
      title: "10. Changes to Terms",
      body: "We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or a notice on our website. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.",
    },
    {
      title: "11. Contact",
      body: "If you have any questions about these Terms of Service, please contact us at legal@redistribute.io or through our Contact page.",
    },
  ];

  return (
    <div>
      <style>{`.reveal{opacity:0;transform:translateY(24px);transition:opacity 0.65s,transform 0.65s}.reveal.visible{opacity:1;transform:none}`}</style>

      {/* HERO */}
      <div style={{ background: "#0A0A0F", padding: "140px 48px 80px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(155,126,255,0.8)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>Legal</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(40px,6vw,72px)", fontWeight: 800, letterSpacing: -3, color: "white", marginBottom: 20, lineHeight: 1 }}>Terms of<br />Service.</h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 500, margin: "0 auto", fontWeight: 300, lineHeight: 1.7 }}>Please read these terms carefully before using Redistribute. Last updated: April 29, 2025.</p>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "80px 48px 96px" }}>
        {sections.map((s, i) => (
          <div key={i} className="reveal" style={{ marginBottom: 48 }}>
            <div style={{ height: 1, background: "rgba(0,0,0,0.07)", marginBottom: 32 }} />
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginBottom: 14, color: "#0A0A0F" }}>{s.title}</h2>
            <p style={{ fontSize: 15, color: "#6B6960", lineHeight: 1.8, fontWeight: 300 }}>{s.body}</p>
          </div>
        ))}

        {/* CTA box */}
        <div className="reveal" style={{ background: "#0A0A0F", borderRadius: 20, padding: "40px 44px", marginTop: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(155,126,255,0.8)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 12, fontFamily: "'Syne',sans-serif" }}>Questions?</div>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: -1, color: "white", marginBottom: 10 }}>We're here to help.</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 300, marginBottom: 24, lineHeight: 1.65 }}>Have questions about our terms? Reach out to our team and we'll get back to you within 24 hours.</p>
          <a href="/contact" style={{ display: "inline-block", padding: "11px 28px", background: "linear-gradient(135deg,#7C5CFC,#1FCFA0)", color: "white", borderRadius: 100, fontSize: 13, textDecoration: "none", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>Contact us →</a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
