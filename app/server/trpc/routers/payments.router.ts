import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, procedure } from '../trpc';
import { db } from '../../../db/index.server';
import { donations } from '../../../db/schema';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export const paymentsRouter = router({
  // Create a checkout session for donations
  createDonationCheckout: procedure
    .input(z.object({
      amount: z.number().min(5, 'Minimum donation is $5'),
      tierLabel: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be signed in to donate',
        });
      }

      try {
        // Create a real Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          customer_email: ctx.user.email,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Donation - ${input.tierLabel}`,
                  description: `Support FamilyHub with a ${input.tierLabel} donation`,
                },
                unit_amount: Math.round(input.amount * 100), // Convert to cents
              },
              quantity: 1,
            },
          ],
          success_url: `${process.env.PREDEV_DEPLOYMENT_URL}/donate?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.PREDEV_DEPLOYMENT_URL}/donate?canceled=true`,
          metadata: {
            userId: ctx.user.id,
            tierLabel: input.tierLabel,
            amount: input.amount,
          },
        });

        if (!session.url) {
          throw new Error('Failed to create checkout session URL');
        }

        return {
          sessionId: session.id,
          url: session.url,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Stripe checkout error:', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create checkout session: ${errorMessage}`,
        });
      }
    }),

  // Verify payment and record donation
  verifyDonation: procedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be signed in',
        });
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(input.sessionId);

        if (session.payment_status === 'paid') {
          // Check if donation already recorded
          const existingDonation = await db.query.donations.findFirst({
            where: (donations, { eq }) => eq(donations.stripeSessionId, session.id),
          });

          if (!existingDonation) {
            // Record the donation
            await db.insert(donations).values({
              userId: ctx.user.id,
              amount: (session.amount_total || 0) / 100, // Convert from cents
              tierLabel: session.metadata?.tierLabel || 'Custom',
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string,
              status: 'completed',
            });
          }

          return {
            paid: true,
            amount: (session.amount_total || 0) / 100,
            tierLabel: session.metadata?.tierLabel || 'Custom',
          };
        }

        return { paid: false };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to verify donation: ${errorMessage}`,
        });
      }
    }),

  // Handle webhook for successful payments
  handleWebhook: procedure
    .input(z.object({
      event: z.any(),
    }))
    .mutation(async ({ input }) => {
      const event = input.event;

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
          // Check if donation already exists
          const existingDonation = await db.query.donations.findFirst({
            where: (donations, { eq }) => eq(donations.stripeSessionId, session.id),
          });

          if (!existingDonation && session.metadata?.userId) {
            // Record donation in database
            await db.insert(donations).values({
              userId: session.metadata.userId,
              amount: (session.amount_total || 0) / 100,
              tierLabel: session.metadata.tierLabel || 'Custom',
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string,
              status: 'completed',
            });

            console.log(`✅ Donation recorded: ${session.metadata.userId} - $${(session.amount_total || 0) / 100}`);
          }
        } catch (error) {
          console.error('Error recording donation from webhook:', error);
        }
      }

      return { received: true };
    }),
});
