'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import {
  AlertCircle,
  Check,
  ChevronRight,
  TrendingUp,
  Lock,
  Zap,
} from 'lucide-react';
import { trpc } from '~/utils/trpc';
import { formatDate, formatCurrency } from '~/utils/formatting';
import type { Subscription, SubscriptionTier } from '~/db/schema';

interface SubscriptionSectionProps {
  subscription?: Subscription;
  tiers: SubscriptionTier[];
  isLoading: boolean;
  accessibility?: any;
}

export default function SubscriptionSection({
  subscription,
  tiers,
  isLoading,
  accessibility,
}: SubscriptionSectionProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const currentTier = subscription?.tier || 'free';

  // Mutations
  const selectTierMutation = trpc.billing.selectTier.useMutation();
  const upgradeMutation = trpc.payments.createCheckoutSession.useMutation();

  const handleSelectTier = async (tierId: string) => {
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) return;

    // Free tier selection
    if (!tier.priceMonthly || tier.priceMonthly === 0) {
      selectTierMutation.mutate({ tierId });
    } else {
      // Paid tier - redirect to checkout
      upgradeMutation.mutate({
        tierId,
        billingCycle: 'monthly',
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing`,
      });
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">Loading subscription...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-xl font-bold capitalize">{currentTier}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={subscription?.status === 'active' ? 'default' : 'destructive'}
                className="mt-1"
              >
                {subscription?.status}
              </Badge>
            </div>
            {subscription?.currentPeriodEnd && (
              <div>
                <p className="text-sm text-muted-foreground">Next Billing Date</p>
                <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
              </div>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <Alert className="col-span-2 border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  Your subscription will cancel at the end of the billing period
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Features included */}
          {accessibility && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-semibold mb-3">Included Features</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(accessibility.accessibility || {}).map(
                  ([feature, details]: any) => {
                    if (details.userHasAccess) {
                      return (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                        </div>
                      );
                    }
                    return null;
                  }
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Available Plans</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tiers.map((tier) => {
            const isCurrent = tier.id === currentTier;
            const isHigherTier = (tiers.findIndex((t) => t.id) > tiers.findIndex((t) => t.id === currentTier));

            return (
              <Card
                key={tier.id}
                className={`relative transition-all ${
                  isCurrent
                    ? 'border-primary ring-2 ring-primary/50 bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute top-4 right-4" variant="default">
                    Current
                  </Badge>
                )}

                <CardHeader>
                  <CardTitle className="capitalize">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Pricing */}
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Price</p>
                    <div className="flex items-baseline gap-1">
                      {tier.priceMonthly ? (
                        <>
                          <p className="text-3xl font-bold">
                            {formatCurrency(tier.priceMonthly, 'USD')}
                          </p>
                          <span className="text-sm text-muted-foreground">/month</span>
                        </>
                      ) : (
                        <p className="text-3xl font-bold">Free</p>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Features</p>
                    <ul className="space-y-1">
                      {Object.entries(tier.features || {})
                        .filter(([, included]) => included)
                        .slice(0, 4)
                        .map(([feature]) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <Check className="h-3 w-3 text-green-600" />
                            <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                          </li>
                        ))}
                      {Object.values(tier.features || {}).filter((v) => v).length > 4 && (
                        <li className="text-sm text-muted-foreground">
                          +{Object.values(tier.features || {}).filter((v) => v).length - 4} more
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Limits */}
                  {tier.maxFamilyMembers && (
                    <div className="text-sm text-muted-foreground">
                      <p>Up to {tier.maxFamilyMembers} family members</p>
                    </div>
                  )}

                  {/* Action Button */}
                  {isCurrent ? (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSelectTier(tier.id)}
                      disabled={selectTierMutation.isLoading || upgradeMutation.isLoading}
                      className="w-full"
                      variant={isHigherTier ? 'default' : 'outline'}
                    >
                      {isHigherTier ? 'Upgrade' : 'Downgrade'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Downgrade Warning */}
      {selectedTier && selectedTier !== currentTier && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Downgrade Notice</AlertTitle>
          <AlertDescription>
            Downgrading may restrict your access to some features. Changes take effect at your
            next billing cycle.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
