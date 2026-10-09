"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Invoice share tokens are secrets — strip them from URLs before they reach analytics.
function redactInvoiceToken(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.replace(/\/invoice\/[^/?#]+/, "/invoice/[token]") };
}

export default function VercelAnalytics() {
  return <Analytics beforeSend={redactInvoiceToken} />;
}
