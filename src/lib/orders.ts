export interface OrderItemSummary {
  itemKey: string;
  title: string;
  variantTitle: string;
  quantity: number;
  price: { amount: string; currencyCode: string };
  imageUrl: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
  tier: string;
  brief?: string | null;
}

export interface IntakeEntry {
  itemKey: string;
  mode: 'direct' | 'bridge';
  targetUrl: string;
  slug: string | null;
  destinationType: string;
  brief: string | null;
}

export interface OrderIntakeSummary {
  contactEmail: string;
  entries: IntakeEntry[];
  submittedAt: string;
  updatedAt: string;
}

export interface OrderStatusSummary {
  payment: "pending" | "paid" | "failed" | "expired";
  intake: "pending" | "submitted";
  production:
    | "awaiting_payment"
    | "awaiting_intake"
    | "ready_for_qr"
    | "ready_for_supplier"
    | "fulfilled"
    | "on_hold";
  overall:
    | "draft"
    | "awaiting_intake"
    | "in_preparation"
    | "fulfilled"
    | "needs_attention";
}

export interface OrderTimelineEvent {
  type: string;
  label: string;
  description: string;
  at: string;
}

export interface OrderSummary {
  sessionId: string;
  shortOrderId: string;
  paymentStatus: string | null;
  customerEmail: string | null;
  items: OrderItemSummary[];
  intake: OrderIntakeSummary | null;
  status: OrderStatusSummary;
  timeline: OrderTimelineEvent[];
  createdAt: string | null;
  updatedAt: string | null;
}

interface IntakeSubmissionPayload {
  contactEmail: string;
  entries: IntakeEntry[];
}

export class ApiError extends Error {
  suggestion?: string;
  constructor(message: string, suggestion?: string) {
    super(message);
    this.suggestion = suggestion;
  }
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error : "Request failed";
    throw new ApiError(message, data?.suggestion);
  }

  return data as T;
}

export async function fetchOrderSummary(sessionId: string) {
  const response = await fetch(`/api/orders/${encodeURIComponent(sessionId)}`);
  return handleJsonResponse<OrderSummary>(response);
}

export async function submitOrderIntake(
  sessionId: string,
  payload: IntakeSubmissionPayload
) {
  const response = await fetch(
    `/api/orders/${encodeURIComponent(sessionId)}/intake`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return handleJsonResponse<OrderSummary>(response);
}
