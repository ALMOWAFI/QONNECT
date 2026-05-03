# QONNECT — Wear Your World

**QONNECT** is a premium custom hoodie brand where fashion meets networking. Every hoodie is a unique piece of tech-integrated apparel, featuring a scannable QR code on the back that links directly to the owner's professional world (LinkedIn, Portfolio, Linktree, or a custom-built landing page).

## 🚀 The Concept: "The Bridge"
The hoodie acts as a living business card. A conversation before the handshake. We bridge the physical and digital worlds for professionals who build, heal, and create.

### Current Editions
*   **Robotics & Tech:** For builders and engineers.
*   **Medicine:** For those who care and heal.
*   **Business:** (Upcoming) For founders and operators.

---

## 💎 Service Tiers

| Tier | Description |
| :--- | :--- |
| **Basic** | You provide the link, we generate the unique QR and print the hoodie. |
| **Standard** | We build you a personalized Linktree-style page, then generate the QR. |
| **Premium** | We build a full custom landing page with your own domain, then generate the QR. |

---

## 🛠 Tech Stack
*   **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui.
*   **E-commerce:** Shopify Storefront API (Headless).
*   **Deployment:** Dockerized for AWS App Runner.
*   **Payment:** Stripe (Integration Pending).

---

## 💼 Business Model: "Order-by-Order"
Unlike traditional apparel brands, QONNECT holds **zero inventory**. 
1.  **Unique Identity:** Every single hoodie is custom-generated because every QR code is unique.
2.  **Print-on-Demand:** We have a per-order agreement with our supplier. 
3.  **Direct Fulfillment:** Once a QR is generated and an order is placed with the supplier, it ships directly to the customer.

---

## 🤝 Contributing
We welcome contributors who want to help build the future of professional apparel. 

### Roadmap
- [ ] **Stripe Integration:** Replacing/Complementing Shopify checkout for service tier handling.
- [ ] **QR Generation Pipeline:** Automating the creation of unique QR assets per order.
- [ ] **Tier Landing Pages:** Building the templates for Standard and Premium tiers.
- [ ] **Supplier Automation:** Integrating the backend to forward orders directly to the printer.

---

## 🛠 Local Development

```sh
# Install dependencies
npm i

# Set up environment variables
cp .env.example .env

# Run development server
npm run dev
```

See [BUSINESS.md](./BUSINESS.md) for a deep dive into the operational workflow.
