import { NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/db/client";
import { getStripe } from "@/lib/payments/stripe";
import { logger } from "@/lib/observability/logger";

function subscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "ACTIVE" as const;
  if (status === "past_due" || status === "unpaid") return "PAST_DUE" as const;
  if (status === "canceled") return "CANCELED" as const;
  return "INCOMPLETE" as const;
}

type PaymentTransaction = Prisma.TransactionClient | PrismaClient;

async function processEvent(event: Stripe.Event, transaction: PaymentTransaction = db) {
  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object;
    const userId = checkout.metadata?.userId ?? checkout.client_reference_id;
    const planId = checkout.metadata?.planId;
    const providerRef = typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription?.id;
    if (!userId || !planId || !providerRef) throw new Error("Métadonnées Checkout incomplètes.");
    await transaction.subscription.upsert({
      where: { providerRef },
      update: { status: "ACTIVE", startedAt: new Date() },
      create: { userId, planId, provider: "STRIPE", providerRef, status: "ACTIVE", startedAt: new Date() },
    });
    if (typeof checkout.customer === "string") {
      await transaction.user.update({ where: { id: userId }, data: { stripeCustomerId: checkout.customer } });
    }
    return;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const stripeSubscription = event.data.object;
    await transaction.subscription.updateMany({
      where: { providerRef: stripeSubscription.id },
      data: {
        status: event.type === "customer.subscription.deleted" ? "CANCELED" : subscriptionStatus(stripeSubscription.status),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    });
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const providerSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    if (!providerSubscriptionId) return;
    const subscription = await transaction.subscription.findUnique({ where: { providerRef: providerSubscriptionId } });
    if (!subscription) return;
    const paid = event.type === "invoice.paid";
    await transaction.invoice.upsert({
        where: { providerRef: invoice.id },
        update: { status: invoice.status ?? (paid ? "paid" : "open"), amountPaidCents: invoice.amount_paid },
        create: {
          subscriptionId: subscription.id,
          provider: "STRIPE",
          providerRef: invoice.id,
          number: invoice.number,
          amountDueCents: invoice.amount_due,
          amountPaidCents: invoice.amount_paid,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status ?? (paid ? "paid" : "open"),
          hostedUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
        },
      });
    await transaction.payment.upsert({
        where: { providerRef: invoice.id },
        update: { status: paid ? "SUCCEEDED" : "FAILED" },
        create: {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          provider: "STRIPE",
          providerRef: invoice.id,
          amountCents: invoice.amount_paid || invoice.amount_due,
          currency: invoice.currency.toUpperCase(),
          status: paid ? "SUCCEEDED" : "FAILED",
        },
      });
    await transaction.subscription.update({
        where: { id: subscription.id },
        data: { status: paid ? "ACTIVE" : "PAST_DUE", currentPeriodEnd: new Date(invoice.period_end * 1000) },
      });
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook non configuré." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    logger.error("stripe.webhook.signature_error", error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    await db.$transaction(async (transaction) => {
      await transaction.webhookEvent.create({
        data: { provider: "STRIPE", providerEventId: event.id, eventType: event.type },
      });
      await processEvent(event, transaction);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    logger.error("stripe.webhook.processing_error", error, { eventId: event.id, eventType: event.type });
    throw error;
  }
  return NextResponse.json({ received: true });
}
