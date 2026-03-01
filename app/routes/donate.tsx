import { Heart, Coffee, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useNavigate } from 'react-router';
import { useAuth } from '~/utils/auth';
import { useEffect, useState } from 'react';
import { trpc } from '~/utils/trpc';

export default function DonatePage() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [loadingTier, setLoadingTier] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState(false);

  const createCheckout = trpc.payments.createDonationCheckout.useMutation();

  // Redirect to signup if not authenticated (but only after auth is loaded)
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/signup');
    }
  }, [isLoaded, isSignedIn, navigate]);

  // Show success message if returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 5000);
    }
  }, []);

  const donationTiers = [
    {
      amount: 5,
      label: 'One Coffee ☕',
      description: 'Buy us a coffee',
      benefits: ['Warm fuzzy feeling', 'Our gratitude'],
    },
    {
      amount: 15,
      label: 'Weekly Supporter 💙',
      description: 'Support our mission weekly',
      benefits: ['All previous benefits', 'Special supporter badge', 'Monthly impact report'],
      featured: true,
    },
    {
      amount: 50,
      label: 'Family Champion 🏆',
      description: 'Help us build faster',
      benefits: ['All previous benefits', 'Priority feature requests', 'Direct email support', 'Quarterly updates'],
    },
    {
      amount: 100,
      label: 'Founding Member 👑',
      description: 'Become part of our story',
      benefits: ['All previous benefits', 'Lifetime supporter status', 'Exclusive founding member badge', 'Direct access to founders'],
    },
  ];

  const handleDonate = async (amount: number, tierLabel: string) => {
    try {
      console.log('🎯 handleDonate called with:', { amount, tierLabel });
      setLoadingTier(amount);
      const result = await createCheckout.mutateAsync({ amount, tierLabel });
      console.log('✅ Checkout result:', result);

      if (result.url) {
        // Redirect to the Stripe checkout URL
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Donation error:', error);
      alert('Failed to process donation. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Support FamilyHub</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Help us build the best family communication platform. Your support makes a difference.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <Check className="w-5 h-5 text-green-600 mr-3" />
            <p className="text-green-800">Thank you for your donation! Your support means everything to us.</p>
          </div>
        )}

        {/* Donation Tiers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {donationTiers.map((tier) => (
            <div
              key={tier.amount}
              className={`rounded-lg p-6 transition-all ${
                tier.featured
                  ? 'bg-white shadow-lg ring-2 ring-indigo-600 scale-105'
                  : 'bg-white shadow hover:shadow-lg'
              }`}
            >
              {tier.featured && (
                <div className="mb-4 inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">${tier.amount}</h3>
              <p className="text-lg font-semibold text-gray-700 mb-2">{tier.label}</p>
              <p className="text-gray-600 text-sm mb-4">{tier.description}</p>

              <ul className="space-y-2 mb-6">
                {tier.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start text-sm text-gray-600">
                    <Heart className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleDonate(tier.amount, tier.label)}
                disabled={loadingTier === tier.amount}
                className={`w-full ${
                  tier.featured
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                {loadingTier === tier.amount ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  `Donate ${tier.amount}`
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-lg shadow p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is my donation secure?</h3>
              <p className="text-gray-600">Yes! We use Stripe, a trusted payment processor, to handle all donations securely.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I get a receipt?</h3>
              <p className="text-gray-600">Yes, you'll receive a receipt via email after your donation is processed.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I donate more than the listed amounts?</h3>
              <p className="text-gray-600">Absolutely! Contact us at support@familyhub.app to arrange a custom donation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
