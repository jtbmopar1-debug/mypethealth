# Shopify contact-page Buddy gate

This gate makes Buddy the primary contact option without removing access to a
human. It hides the existing Shopify contact-form section only when JavaScript
successfully finds it. If the script fails or JavaScript is unavailable, the
normal form remains visible.

## Install

1. In Shopify, open **Online Store → Themes → Customize**.
2. Create or open a template used only by the Contact page. Do not add the
   section to Shopify's shared **Default page** template. A suggested template
   name is `contact-buddy`.
3. Add a **Custom liquid** section immediately above the existing contact-form
   section.
4. Paste the code below and save.
5. Edit the introductory contact-page copy so it points customers to Buddy
   rather than publishing `admin@allgoodpetfood.co.nz` as the first option.
   Keep the phone number, store address, and opening hours available.
6. Test both buttons while signed in and signed out of a Shopify customer
   account, on desktop and mobile.

The Buddy link uses the existing silent Shopify login handoff. The
`/pages/buddy-launch` setup and `SHOPIFY_BUDDY_RETURN_PATH` configuration are
documented in [SHOPIFY_BUDDY_LOGIN_HANDOFF.md](SHOPIFY_BUDDY_LOGIN_HANDOFF.md).

## Custom Liquid

```liquid
{% if request.page_type == 'page' and page.handle contains 'contact' %}
<section id="buddy-contact-gate-{{ section.id }}" class="buddy-contact-gate" aria-labelledby="buddy-contact-title-{{ section.id }}">
  <div class="buddy-contact-gate__mark" aria-hidden="true">🐾</div>
  <div class="buddy-contact-gate__copy">
    <p class="buddy-contact-gate__eyebrow">All Good Petfood assistant</p>
    <h2 id="buddy-contact-title-{{ section.id }}">Ask Buddy first</h2>
    <p>Buddy can help with products, current stock, feeding questions and finding the right option for your pet.</p>
    <div class="buddy-contact-gate__actions">
      <a
        class="buddy-contact-gate__primary"
        href="https://www.mypethealth.co.nz/api/auth/shopify/start?silent=1"
        target="_blank"
        rel="noopener"
      >Chat with Buddy</a>
      <button class="buddy-contact-gate__secondary" type="button" data-reveal-contact aria-expanded="false">
        I still need to contact the team
      </button>
    </div>
    <p class="buddy-contact-gate__note">For urgent health concerns, contact your veterinarian directly.</p>
  </div>
</section>

<style>
  #buddy-contact-gate-{{ section.id }} {
    max-width: 760px;
    margin: 32px auto;
    padding: 30px;
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
    border: 1px solid rgba(142, 178, 53, .28);
    border-radius: 20px;
    background: linear-gradient(135deg, #fbfcf7 0%, #f5f0f8 100%);
    box-shadow: 0 16px 42px rgba(30, 43, 65, .09);
    color: #17233e;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__mark {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 8px 22px rgba(30, 43, 65, .10);
    font-size: 32px;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__eyebrow {
    margin: 0 0 5px;
    color: #8eb235;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  #buddy-contact-gate-{{ section.id }} h2 {
    margin: 0 0 8px;
    color: #17233e;
    font-size: clamp(26px, 4vw, 38px);
    line-height: 1.1;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__copy > p:not(.buddy-contact-gate__eyebrow):not(.buddy-contact-gate__note) {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__actions {
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__primary,
  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__secondary {
    min-height: 46px;
    padding: 12px 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__primary {
    border: 1px solid #993b96;
    background: #993b96;
    color: #fff;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__secondary {
    border: 1px solid #993b96;
    background: transparent;
    color: #993b96;
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__primary:hover,
  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__secondary:hover {
    transform: translateY(-1px);
  }

  #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__note {
    margin: 14px 0 0;
    color: #667085;
    font-size: 12px;
  }

  @media (max-width: 600px) {
    #buddy-contact-gate-{{ section.id }} {
      margin: 20px 0;
      padding: 22px;
      grid-template-columns: 1fr;
    }

    #buddy-contact-gate-{{ section.id }} .buddy-contact-gate__actions {
      display: grid;
    }
  }
</style>

<script>
  (() => {
    const gate = document.getElementById('buddy-contact-gate-{{ section.id }}');
    if (!gate) return;

    const initializeGate = () => {
      const contactForm = [...document.querySelectorAll('form[action*="/contact"]')]
        .find((form) => form.querySelector('textarea'));
      const revealButton = gate.querySelector('[data-reveal-contact]');
      if (!contactForm || !revealButton) return;

      const formSection = contactForm.closest('.shopify-section');
      const formTarget = formSection && !formSection.contains(gate) ? formSection : contactForm;
      formTarget.hidden = true;

      revealButton.addEventListener('click', () => {
        formTarget.hidden = false;
        revealButton.hidden = true;
        revealButton.setAttribute('aria-expanded', 'true');
        formTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => contactForm.querySelector('textarea')?.focus(), 350);
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeGate, { once: true });
    } else {
      initializeGate();
    }
  })();
</script>
{% endif %}
```

## Recommended replacement for the current email-first sentence

> Need help? Start by chatting with Buddy, our pet health and shop assistant.
> You can also call us on **09 945 6498** or visit us at **12 Mill Lane,
> Kerikeri** during store hours.

Do not remove the secondary human-contact option. Buddy cannot handle every
customer-service, privacy, payment, complaint, or urgent animal-health matter.

For the FAQ page's single-button "More questions?" panel, copy the complete raw
Liquid file [`SHOPIFY_FAQ_BUDDY_CTA.liquid`](SHOPIFY_FAQ_BUDDY_CTA.liquid).
