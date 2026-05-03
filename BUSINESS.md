# QONNECT — Operational Workflow & Business Model

This document outlines the end-to-end process of the QONNECT business model, from customer acquisition to supplier fulfillment.

## 1. Customer Journey
1.  **Selection:** Customer visits the site and selects an **Edition** (e.g., Robotics & Tech).
2.  **Tier Choice:** Customer selects a **Service Tier** (Basic, Standard, or Premium).
3.  **Payment:** Customer checks out via Stripe (integrated with our tier pricing).
4.  **Intake:** Upon successful payment, the customer is redirected to an **Intake Form**.
    *   **Basic:** They provide their existing link (LinkedIn, Linktree, etc.).
    *   **Standard/Premium:** They provide the content/bio/assets for us to build their page.

## 2. Fulfillment Process (The "Order-by-Order" Model)
Since every hoodie is unique (unique QR code), we do not hold stock. Every order is a custom manufacturing request.

### Step A: Asset Generation
*   For every order, a high-resolution QR code is generated using the customer's specific URL.
*   The QR is embedded into the specific edition's artwork (the "Two Hands" design).

### Step B: Supplier Handoff
*   QONNECT operates on a **Print-on-Demand (POD)** model but with a specialized agreement.
*   Once the digital asset (QR + Design) is ready, the order is sent to our supplier.
*   **The Agreement:** We pay the supplier per order. There is no wholesale bulk requirement, allowing us to maintain a "Zero Inventory" risk profile.

### Step C: Shipping
*   The supplier prints the design and ships the hoodie directly to the customer's address (White-label fulfillment).

## 3. Technical Roadmap for Fulfillment
To scale this "Order-by-Order" model, the following automation is required:

- **Webhooks:** Stripe webhooks to trigger the Intake Form email automatically.
- **QR Engine:** A backend service (Node.js/Python) that generates SVG/PNG QR codes on the fly.
- **Image Composition:** Automating the placement of the QR code onto the hoodie mockup for the supplier.
- **Supplier API:** (Future) Automated order submission to the supplier's print-queue API.

---

## 4. Why This Model?
*   **Hyper-Personalization:** The product is literally "un-fakeable" and unique to the owner.
*   **Scalability:** No warehouse costs or unsold inventory risks.
*   **Premium Positioning:** We are not selling hoodies; we are selling a "Digital Bridge" as a service.
