# QONNECT Deployment Checklist (AWS)

To ensure the platform is ready for real customers, you must configure the following Environment Variables in your **AWS App Runner** console.

## 🔑 Required Environment Variables

| Variable | Description |
| :--- | :--- |
| **`VITE_SHOPIFY_STORE_DOMAIN`** | Your Shopify store domain. |
| **`VITE_SHOPIFY_STOREFRONT_TOKEN`** | Public Storefront API token. |
| **`VITE_STRIPE_PUBLISHABLE_KEY`** | Stripe public key (starts with `pk_`). |
| **`STRIPE_SECRET_KEY`** | Stripe private key (starts with `sk_`). |
| **`SUPABASE_URL`** | Your Supabase Project URL. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Your Supabase Service Role Key (Found in Settings > API). |
| **`ADMIN_PASSWORD`** | The password for the `/admin` command center. |

---

## 🗄️ Database Setup (Supabase)

To ensure your customer data is never lost, follow these steps:
1.  Create a project at [supabase.com](https://supabase.com).
2.  Go to the **SQL Editor** in your Supabase dashboard.
3.  Copy the contents of **`docs/database/schema.sql`** from this repo and run it.
4.  Copy your **Project URL** and **service_role API Key** into your AWS Environment Variables.

---

## 🚀 How to Launch
1.  Push the latest changes to GitHub.
2.  In AWS App Runner, connect your repo.
3.  Set the **Port** to `3000`.
4.  Add the **Environment Variables** listed above.
5.  Deploy!

Once live, visit `yourdomain.com/admin` to manage your fulfillment queue.
