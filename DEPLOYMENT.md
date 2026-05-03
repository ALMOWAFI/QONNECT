# QONNECT Deployment Checklist (AWS)

To ensure the platform is ready for real customers, you must configure the following Environment Variables in your **AWS App Runner** console.

## 🔑 Required Environment Variables

| Variable | Description |
| :--- | :--- |
| **`VITE_SHOPIFY_STORE_DOMAIN`** | Your Shopify store domain (e.g., `qonnect-l1tyf.myshopify.com`). |
| **`VITE_SHOPIFY_STOREFRONT_TOKEN`** | Public Storefront API token. |
| **`VITE_STRIPE_PUBLISHABLE_KEY`** | Stripe public key (starts with `pk_`). |
| **`STRIPE_SECRET_KEY`** | Stripe private key (starts with `sk_`). **Keep this secret.** |
| **`ADMIN_PASSWORD`** | The password you will use to access the `/admin` command center. |

---

## ⚠️ Critical Warning: Data Persistence

Right now, the app stores order data in a local file: `/server/data/orders.json`. 

**In AWS App Runner:** 
When your container restarts (which happens during every new deployment or periodically by AWS), **all orders in that JSON file will be deleted.**

### Recommendation for real customers:
Before you take real money, you should connect the backend to **Supabase (PostgreSQL)**. 
1.  I have already provided the SQL schema in `docs/database/schema.sql`.
2.  Once you create a Supabase project, tell me or Codex, and we can swap the `server/orderStore.js` logic from "JSON File" to "Postgres Database" in about 5 minutes.

---

## 🚀 How to Launch
1.  Push the latest changes to GitHub.
2.  In AWS App Runner, connect your repo.
3.  Set the **Port** to `3000`.
4.  Add the **Environment Variables** listed above.
5.  Deploy!

Once live, visit `yourdomain.com/admin` to manage your fulfillment queue.
