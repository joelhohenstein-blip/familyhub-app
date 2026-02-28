import { z } from 'zod';
import { router, procedure } from '../trpc';
import {
  subscriptions,
  subscriptionTiers,
  invoices,
  auditLog,
  users,
} from '~/db/schema';
import { eq, and } from 'drizzle-orm';
import { EmailService, type SubscriptionEmailData } from '~/server/services/email.service';

// Stripe types (you'll need to install stripe package)
// For now, we define types for the payment intent

const createCheckoutSchema = z.object({
  tierId: z.string().min(1, 'Tier ID required'),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
});

const verifyPaymentSchema = z.object({
  paymentIntentId: z.string(),
});

const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().default(true),
});

const retryPaymentSchema = z.object({
  invoiceId: z.string(),
});

export const paymentsRouter = router({
  /**
   * Create a Stripe checkout session for subscription
   */
  createCheckoutSession: procedure
    .input(createCheckoutSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      try {
        // Get tier details
        const [tier] = await ctx.db
          .select()
          .from(subscriptionTiers)
          .where(eq(subscriptionTiers.id, input.tierId))
          .limit(1);

        if (!tier) {
          throw new Error('Tier not found');
        }

        // Get price ID based on billing cycle
        const priceId =
          input.billingCycle === 'monthly'
            ? tier.stripePriceIdMonthly
            : tier.stripePriceIdYearly;

        if (!priceId) {
          throw new Error('Pricing not configured for this tier');
        }

        // Get or create Stripe customer
        let [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, ctx.user.id))
          .limit(1);

        let stripeCustomerId = subscription?.stripeCustomerId || '';

        if (!stripeCustomerId) {
          // In a real implementation, create a Stripe customer here
          // For now, we'll use a placeholder that would be created by webhook
          stripeCustomerId = `cus_${Date.now()}`;
        }

        // In a real app, you would call:
        // const session = await stripe.checkout.sessions.create({
        //   mode: 'subscription',
        //   payment_method_types: ['card'],
        //   customer: stripeCustomerId,
        //   line_items: [{
        //     price: priceId,
        //     quantity: 1,
        //   }],
        //   success_url: input.successUrl,
        //   cancel_url: input.cancelUrl,
        //   metadata: {
        //     userId: ctx.user.id,
        //     tierId: input.tierId,
        //   },
        // });

        // For now, return a mock response
        return {
          sessionId: `cs_${Date.now()}`,
          stripeCustomerId,
          priceId,
          tierId: input.tierId,
          billingCycle: input.billingCycle,
          // In real app: sessionUrl: session.url
        };
      } catch (error) {
        console.error('Error creating checkout session:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to create checkout'
        );
      }
    }),

  /**
   * Handle successful payment - called after Stripe webhook or client confirmation
   */
  confirmPayment: procedure
    .input(verifyPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      try {
        // In a real app, verify the payment intent with Stripe:
        // const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
        // if (paymentIntent.status !== 'succeeded') throw new Error('Payment not completed');

        // Get user's current subscription
        let [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, ctx.user.id))
          .limit(1);

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // Update subscription status
        const [updated] = await ctx.db
          .update(subscriptions)
          .set({
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id))
          .returning();

        // Log audit
        await ctx.db.insert(auditLog).values({
          actionType: 'payment_confirmed',
          actorId: ctx.user.id,
          targetId: subscription.id,
          targetType: 'subscription',
          description: `Payment confirmed for subscription`,
        });

        return { success: true, subscription: updated };
      } catch (error) {
        console.error('Error confirming payment:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to confirm payment'
        );
      }
    }),

  /**
   * Handle failed payment - notify user and queue retry
   */
  handleFailedPayment: procedure
    .input(
      z.object({
        paymentIntentId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      try {
        // Get subscription
        const [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, ctx.user.id))
          .limit(1);

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // Update subscription status
        const [updated] = await ctx.db
          .update(subscriptions)
          .set({
            status: 'past_due',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id))
          .returning();

        // Log audit
        await ctx.db.insert(auditLog).values({
          actionType: 'payment_failed',
          actorId: ctx.user.id,
          targetId: subscription.id,
          targetType: 'subscription',
          description: `Payment failed: ${input.reason || 'Unknown reason'}`,
        });

        return { success: true, subscription: updated };
      } catch (error) {
        console.error('Error handling failed payment:', error);
        throw new Error('Failed to process payment failure');
      }
    }),

  /**
   * Retry a failed payment
   */
  retryPayment: procedure
    .input(retryPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      try {
        // Get invoice
        const [invoice] = await ctx.db
          .select()
          .from(invoices)
          .where(eq(invoices.id, input.invoiceId))
          .limit(1);

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        // Verify user owns invoice
        if (invoice.userId !== ctx.user.id) {
          throw new Error('Unauthorized');
        }

        // In real app, retry with Stripe:
        // const retried = await stripe.invoices.pay(invoice.stripeInvoiceId!);

        // Log audit
        await ctx.db.insert(auditLog).values({
          actionType: 'payment_retry_attempted',
          actorId: ctx.user.id,
          targetId: input.invoiceId,
          targetType: 'invoice',
          description: 'Retried failed payment',
        });

        return { success: true, message: 'Payment retry initiated' };
      } catch (error) {
        console.error('Error retrying payment:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to retry payment'
        );
      }
    }),

  /**
   * Update payment method
   */
  updatePaymentMethod: procedure
    .input(updatePaymentMethodSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      try {
        const [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, ctx.user.id))
          .limit(1);

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // In real app, update Stripe customer:
        // await stripe.customers.update(subscription.stripeCustomerId, {
        //   invoice_settings: {
        //     default_payment_method: input.paymentMethodId,
        //   },
        // });

        // Update local metadata
        const updatedMetadata = {
          ...(subscription.billingMetadata || {}),
          defaultPaymentMethodId: input.paymentMethodId,
        };

        const [updated] = await ctx.db
          .update(subscriptions)
          .set({
            billingMetadata: updatedMetadata,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id))
          .returning();

        // Log audit
        await ctx.db.insert(auditLog).values({
          actionType: 'payment_method_updated',
          actorId: ctx.user.id,
          targetId: subscription.id,
          targetType: 'subscription',
          description: 'Updated payment method',
        });

        return { success: true, subscription: updated };
      } catch (error) {
        console.error('Error updating payment method:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to update payment method'
        );
      }
    }),

  /**
   * Get payment methods for user
   */
  getPaymentMethods: procedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      const [subscription] = await ctx.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (!subscription || !subscription.stripeCustomerId) {
        return [];
      }

      // In real app:
      // const methods = await stripe.paymentMethods.list({
      //   customer: subscription.stripeCustomerId,
      //   type: 'card',
      // });
      // return methods.data;

      return [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw new Error('Failed to fetch payment methods');
    }
  }),

  /**
   * Get billing history/invoices
   */
  getBillingHistory: procedure
    .input(
      z.object({
        limit: z.number().default(10),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      try {
        const history = await ctx.db
          .select()
          .from(invoices)
          .where(eq(invoices.userId, ctx.user.id))
          .orderBy((inv) => inv.issuedAt)
          .limit(input.limit)
          .offset(input.offset);

        return history;
      } catch (error) {
        console.error('Error fetching billing history:', error);
        throw new Error('Failed to fetch billing history');
      }
    }),

  /**
   * Send subscription confirmation email
   */
  sendSubscriptionConfirmationEmail: procedure
    .input(
      z.object({
        userId: z.string().uuid('Invalid user ID'),
        tierId: z.string(),
        billingInterval: z.enum(['monthly', 'yearly']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      // Verify user can only send email for themselves
      if (input.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      try {
        // Get user details
        const [user] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!user || !user.email) {
          throw new Error('User not found or has no email');
        }

        // Get tier details
        const [tier] = await ctx.db
          .select()
          .from(subscriptionTiers)
          .where(eq(subscriptionTiers.id, input.tierId))
          .limit(1);

        if (!tier) {
          throw new Error('Tier not found');
        }

        // Get user's subscription to get next billing date
        const [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, input.userId))
          .limit(1);

        const billingInterval = input.billingInterval || 'monthly';
        const amount =
          billingInterval === 'yearly' ? tier.priceYearly : tier.priceMonthly;

        const userName = user.firstName || user.lastName
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : 'Valued Member';

        const emailData: SubscriptionEmailData = {
          email: user.email,
          userName,
          tierName: tier.name,
          amount: amount ?? undefined,
          nextBillingDate: subscription?.currentPeriodEnd || undefined,
          features: Object.entries(tier.features || {})
            .filter(([_, enabled]) => enabled)
            .map(([feature]) => feature),
          billingInterval,
        };

        const result = await EmailService.sendSubscriptionCreatedEmail(
          emailData,
          input.userId
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to send email');
        }

        return { success: true, messageId: result.messageId };
      } catch (error) {
        console.error('Error sending subscription confirmation email:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to send confirmation email'
        );
      }
    }),

  /**
   * Send subscription renewal email
   */
  sendSubscriptionRenewalEmail: procedure
    .input(
      z.object({
        userId: z.string().uuid('Invalid user ID'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      // Verify user can only send email for themselves
      if (input.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      try {
        // Get user details
        const [user] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!user || !user.email) {
          throw new Error('User not found or has no email');
        }

        // Get user's subscription
        const [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, input.userId))
          .limit(1);

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // Get tier details
        const [tier] = await ctx.db
          .select()
          .from(subscriptionTiers)
          .where(eq(subscriptionTiers.id, subscription.tier))
          .limit(1);

        if (!tier) {
          throw new Error('Tier not found');
        }

        // Determine billing interval and amount
        const isYearly =
          subscription.currentPeriodEnd &&
          subscription.currentPeriodStart &&
          (subscription.currentPeriodEnd.getTime() -
            subscription.currentPeriodStart.getTime()) /
            (1000 * 60 * 60 * 24) >
            180; // If period is longer than 180 days, assume yearly

        const amount = isYearly ? tier.priceYearly : tier.priceMonthly;

        const userName = user.firstName || user.lastName
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : 'Valued Member';

        const emailData: SubscriptionEmailData = {
          email: user.email,
          userName,
          tierName: tier.name,
          amount: amount ?? undefined,
          nextBillingDate: subscription.currentPeriodEnd || undefined,
          billingInterval: isYearly ? 'yearly' : 'monthly',
        };

        const result = await EmailService.sendSubscriptionRenewalEmail(
          emailData,
          input.userId
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to send email');
        }

        return { success: true, messageId: result.messageId };
      } catch (error) {
        console.error('Error sending subscription renewal email:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to send renewal email'
        );
      }
    }),

  /**
   * Send subscription cancellation email
   */
  sendSubscriptionCancellationEmail: procedure
    .input(
      z.object({
        userId: z.string().uuid('Invalid user ID'),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User must be authenticated');
      }

      // Verify user can only send email for themselves
      if (input.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      try {
        // Get user details
        const [user] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!user || !user.email) {
          throw new Error('User not found or has no email');
        }

        // Get user's subscription
        const [subscription] = await ctx.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, input.userId))
          .limit(1);

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // Get tier details
        const [tier] = await ctx.db
          .select()
          .from(subscriptionTiers)
          .where(eq(subscriptionTiers.id, subscription.tier))
          .limit(1);

        if (!tier) {
          throw new Error('Tier not found');
        }

        const userName = user.firstName || user.lastName
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : 'Valued Member';

        const emailData: SubscriptionEmailData = {
          email: user.email,
          userName,
          tierName: tier.name,
        };

        const result = await EmailService.sendSubscriptionCancelledEmail(
          emailData,
          input.userId,
          input.reason
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to send email');
        }

        return { success: true, messageId: result.messageId };
      } catch (error) {
        console.error('Error sending subscription cancellation email:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to send cancellation email'
        );
      }
    }),
});
