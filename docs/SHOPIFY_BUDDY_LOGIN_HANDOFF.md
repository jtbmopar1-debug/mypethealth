# Shopify to Buddy login handoff

Buddy cannot directly read the login cookie owned by `allgoodpetfood.co.nz`.
The clean flow is therefore:

1. Customer opens Buddy from All Good Petfood.
2. My Pet Health silently checks the Shopify Customer Account session.
3. If Shopify needs a login, it returns the customer to a dedicated storefront page.
4. That page immediately relaunches Buddy, where the silent OAuth handoff completes.

## Shopify theme setup

Create a Shopify page with the handle `buddy-launch`. Use a **Custom liquid**
section on that page containing:

```liquid
<div style="padding: 48px 20px; text-align: center;">
  <p>Opening Buddy...</p>
  <p><a href="https://www.mypethealth.co.nz/api/auth/shopify/start?silent=1">Continue to Buddy</a></p>
</div>
<script>
  window.location.replace('https://www.mypethealth.co.nz/api/auth/shopify/start?silent=1');
</script>
```

Keep the page out of normal navigation if desired. Test it while signed both in
and out of the Shopify customer account.

After that page exists, set this protected Vercel variable and redeploy:

```text
SHOPIFY_BUDDY_RETURN_PATH=/pages/buddy-launch
```

Until the page exists, leave the value as `/`; otherwise Shopify would return
customers to a missing page after login.
