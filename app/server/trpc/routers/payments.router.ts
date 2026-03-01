import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import { router, procedure } from '../trpc';
import { db } from '../../../db/index.server';
import { donations } from '../../../db/schema';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
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
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `FamilyHub Donation - ${input.tierLabel}`,
                  description: 'Support FamilyHub development',
                },
                unit_amount: Math.round(input.amount * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${process.env.PREDEV_DEPLOYMENT_URL}/donate?success=true`,
          cancel_url: `${process.env.PREDEV_DEPLOYMENT_URL}/donate?canceled=true`,
          customer_email: ctx.user.email,
          metadata: {
            userId: ctx.user.id,
            tierLabel: input.tierLabel,
            amount: input.amount,
          },
        });

        return {
          sessionId: session.id,
          url: session.url,
        };
      } catch (error) {
        console.error('Stripe checkout error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session',
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
          // Record donation in database
          await db.insert(donations).values({
            userId: session.metadata.userId,
            amount: session.metadata.amount,
            tierLabel: session.metadata.tierLabel,
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            status: 'completed',
          });

          console.log(`Donation recorded: ${session.metadata.userId} - $${session.metadata.amount}`);
        } catch (error) {
          console.error('Error recording donation:', error);
        }
      }

      return { received: true };
    }),
});
