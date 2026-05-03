# QONNECT Backend & Fulfillment Automation

This folder contains technical designs and concepts for the second phase of QONNECT: **Automated Fulfillment**.

## Phase 2: From Order to Supplier

### 1. Order Capture (Stripe Webhook)
We need a backend service (Node.js/Express or Python/FastAPI) to listen for `checkout.session.completed` events from Stripe.

```javascript
// Example logic
app.post('/webhook', (req, res) => {
  const event = req.body;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // 1. Save order to Database (Supabase/PostgreSQL)
    // 2. Trigger "Intake Form" email via Resend/SendGrid
  }
});
```

### 2. QR Generation Service
A microservice responsible for:
1.  Fetching the URL from the customer's intake form.
2.  Generating a unique QR code (SVG format for high-quality printing).
3.  Compositing the QR code onto the "Back Print" template for the specific edition.

### 3. Supplier Integration
Since the agreement is **order-by-order**, we can automate the handoff:
*   **Manual (Initial):** Backend sends an email to the supplier with the Print-Ready PDF + Shipping Address.
*   **Automated (Scalable):** Use a Print-on-Demand API (like Printful, Gelato, or a custom local partner API) to submit the order programmatically.

### 4. Database Schema (Proposed)
| Table | Fields |
| :--- | :--- |
| **Orders** | `id`, `stripe_session_id`, `customer_email`, `edition`, `tier`, `status` |
| **Assets** | `order_id`, `target_url`, `qr_code_path`, `print_ready_file_path` |
| **Shipments** | `order_id`, `tracking_number`, `supplier_order_id`, `shipped_at` |

## Deployment Plan
The backend should be Dockerized and deployed alongside the frontend on **AWS App Runner** or as **AWS Lambda** functions for a cost-effective serverless approach.
