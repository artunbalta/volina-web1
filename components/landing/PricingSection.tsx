"use client";

import { Clock, CreditCard, Calendar, Check } from "lucide-react";

const pricingPlans = [
  {
    name: "Starter",
    minutes: "500",
    minutesLabel: "Minutes",
    pricePerMin: "$0.35",
    pricePerMinLabel: "per minute",
    monthlyTotal: "$175",
    monthlyLabel: "Monthly Total",
    popular: false,
  },
  {
    name: "Standard",
    minutes: "1,500",
    minutesLabel: "Minutes",
    pricePerMin: "$0.30",
    pricePerMinLabel: "per minute",
    monthlyTotal: "$450",
    monthlyLabel: "Monthly Total",
    popular: true,
  },
  {
    name: "Enterprise",
    minutes: "4,500",
    minutesLabel: "Minutes",
    pricePerMin: "$0.25",
    pricePerMinLabel: "per minute",
    monthlyTotal: "$1,125",
    monthlyLabel: "Monthly Total",
    popular: false,
  },
  {
    name: "Custom",
    minutes: "Custom",
    minutesLabel: "Minutes",
    pricePerMin: "Contact Us",
    pricePerMinLabel: "per minute",
    monthlyTotal: "Based on Needs",
    monthlyLabel: "Monthly Total",
    popular: false,
    isCustom: true,
  },
];

const features = [
  "24/7 AI Voice Agent",
  "Appointment Scheduling",
  "Call Transcriptions",
  "CRM Integration",
  "Analytics Dashboard",
  "Email Support",
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-400 text-lg">
            Choose the plan that fits your business needs. Scale up or down anytime.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingPlans.map((plan) => {
            // Same gradient for Starter, Standard, Enterprise
            // Custom gets a lighter gradient
            const gradientClass = plan.isCustom
              ? "bg-gradient-to-br from-slate-500 via-gray-600 to-slate-700"
              : "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600";
            
            const shadowClass = plan.isCustom
              ? "shadow-lg shadow-slate-500/40"
              : plan.popular
              ? "shadow-xl shadow-purple-500/50"
              : "shadow-lg shadow-purple-500/40";

            return (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${gradientClass} ${shadowClass}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-black text-xs font-bold rounded-full">
                  POPULAR
                </div>
              )}

              {/* Plan name */}
              <h3 className="text-2xl font-bold text-white mb-6">{plan.name}</h3>

              {/* Minutes */}
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{plan.minutesLabel}</span>
              </div>
              <p className="text-2xl font-bold text-white mb-4">
                {plan.minutes} {!plan.isCustom && <span className="text-lg font-normal">min</span>}
              </p>

              {/* Price per minute */}
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">{plan.pricePerMinLabel}</span>
              </div>
              <p className="text-2xl font-bold text-white mb-4">
                {plan.pricePerMin}{!plan.isCustom && <span className="text-lg font-normal">/min</span>}
              </p>

              {/* Monthly total */}
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{plan.monthlyLabel}</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {plan.monthlyTotal}
              </p>
            </div>
            );
          })}
        </div>

        {/* Features included */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-white mb-6">All Plans Include</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2"
              >
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-4">
            Need more minutes or have special requirements?
          </p>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-gray-100 transition-colors"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </section>
  );
}
