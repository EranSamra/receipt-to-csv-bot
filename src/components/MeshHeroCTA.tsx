import { useEffect, useState } from 'react';

export const MeshHeroCTA = () => {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const portalId = "9157499";
  const formId = "4ca21b58-81a3-48d5-a839-16d837f8178e";
  const endpoint = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;

  const blocked = new Set([
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
    "aol.com", "proton.me", "zoho.com", "gmx.com", "yandex.com", "live.com", "msn.com"
  ]);

  function isBusiness(email: string): boolean {
    const match = String(email || "").toLowerCase().match(/@([^@]+)$/);
    return match ? !blocked.has(match[1]) : false;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    if (!email || !isBusiness(email)) {
      setMessage("Use a business email.");
      return;
    }

    if (!company || company.trim().length < 2) {
      setMessage("Enter your company name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        fields: [
          { name: "email", value: email },
          { name: "company", value: company }
        ],
        context: { pageUri: window.location.href, pageName: document.title }
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("HubSpot submission failed");

      setMessage("Thanks. We will reach out shortly.");
      setEmail("");
      setCompany("");
    } catch (err) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-scroll to hero when results are ready
  useEffect(() => {
    function resultsReady(): boolean {
      const out = document.getElementById("output-section");
      return !!(out && out.innerHTML.trim() !== "");
    }

    if (resultsReady()) {
      setTimeout(() => {
        const hero = document.getElementById("mesh-hero");
        if (hero) {
          hero.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 800);
    }
  }, []);

  return (
    <section id="mesh-hero" className="mesh-hero">
      <div className="mesh-hero__inner">
        {/* Decorative icons on the left */}
        <div className="mesh-hero__right" aria-hidden="true">
          <div className="mesh-card"></div>
          <div className="mesh-card mesh-card--2"></div>
          <div className="mesh-card mesh-card--3"></div>
        </div>

        {/* Form on the right */}
        <div className="mesh-hero__left">
          <h2 className="mesh-hero__title">See how Mesh AI simplifies expenses</h2>
          <form id="mesh-hero-form" className="mesh-hero__form" onSubmit={handleSubmit} noValidate>
            <input
              id="hero-email"
              name="email"
              type="email"
              placeholder="Your work email*"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <input
              id="hero-company"
              name="company"
              type="text"
              placeholder="Company name*"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <button id="hero-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Book a Demo"}
            </button>
          </form>
          {message && (
            <p id="hero-msg" className="mesh-hero__msg" aria-live="polite">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

