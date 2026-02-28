'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { CreditCard, Plus, Trash2, CheckCircle } from 'lucide-react';
import { trpc } from '~/utils/trpc';

interface PaymentMethodsSectionProps {
  userId?: string;
}

export default function PaymentMethodsSection({ userId }: PaymentMethodsSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = trpc.payments.getPaymentMethods.useQuery();

  // Mutations
  const updatePaymentMethod = trpc.payments.updatePaymentMethod.useMutation({
    onSuccess: () => {
      setShowAddForm(false);
    },
  });

  return (
    <div className="space-y-6">
      {/* Current Payment Method */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>Manage your payment methods and billing information</CardDescription>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
            </div>
          ) : paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method: any, index: number) => (
                <div
                  key={method.id || index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {method.card?.brand || 'Card'} ending in {method.card?.last4 || 'xxxx'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.card?.exp_month}/{method.card?.exp_year}
                      </p>
                    </div>
                  </div>
                  {method.isDefault && (
                    <Badge className="mr-2">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" disabled>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No payment methods on file. Add one to enable automatic billing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Form (Placeholder) */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Payment Method</CardTitle>
            <CardDescription>
              Enter your card details below. We use Stripe to process payments securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Payment form would be embedded here using Stripe Elements. This requires
                additional setup with Stripe publishable key configuration.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button disabled>
                Save Payment Method
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>Update your billing address and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Billing information is tied to your payment method. Update it in your account
              settings.
            </AlertDescription>
          </Alert>
          <Button variant="outline">
            Edit Billing Address
          </Button>
        </CardContent>
      </Card>

      {/* Auto-Pay Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Pay Settings</CardTitle>
          <CardDescription>Control how your subscription is billed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Automatic Billing</p>
                <p className="text-sm text-muted-foreground">
                  We'll charge your payment method automatically each billing cycle
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Failed Payment Retry</p>
                <p className="text-sm text-muted-foreground">
                  Automatically retry failed payments up to 3 times
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Email Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Get notified before your next billing date
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
