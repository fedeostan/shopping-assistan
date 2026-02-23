"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BUDGET_OPTIONS = [
  { label: "Under $50", value: "under-50" },
  { label: "$50 – $200", value: "50-200" },
  { label: "$200 – $500", value: "200-500" },
  { label: "$500+", value: "500+" },
] as const;

const CATEGORY_OPTIONS = [
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Sports",
  "Beauty",
  "Books",
  "Toys",
  "Food & Grocery",
];

const QUALITY_OPTIONS = [
  { label: "Cheapest always", value: 1 },
  { label: "Prefer value", value: 2 },
  { label: "Balanced", value: 3 },
  { label: "Prefer quality", value: 4 },
  { label: "Quality first", value: 5 },
] as const;

const HOUSEHOLD_OPTIONS = [
  { label: "Living alone", value: "living-alone" },
  { label: "Couple", value: "couple" },
  { label: "Family with kids", value: "family" },
  { label: "Shared household", value: "shared" },
] as const;

const FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "A few times a year", value: "few-times" },
  { label: "Rarely", value: "rarely" },
] as const;

const RETAILER_OPTIONS = [
  "Amazon",
  "MercadoLibre",
  "Walmart",
  "eBay",
  "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgetRange, setBudgetRange] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState("");
  const [qualityVsPrice, setQualityVsPrice] = useState<number>(3);
  const [household, setHousehold] = useState<string>("");
  const [shoppingFrequency, setShoppingFrequency] = useState<string>("");
  const [retailers, setRetailers] = useState<string[]>([]);

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleRetailer(ret: string) {
    setRetailers((prev) =>
      prev.includes(ret) ? prev.filter((r) => r !== ret) : [...prev, ret]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    setError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetRange,
          categories,
          brands,
          qualityVsPrice,
          household,
          shoppingFrequency,
          retailers,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Welcome! Let&apos;s personalize your experience
          </CardTitle>
          <CardDescription>
            Answer a few questions so we can tailor recommendations to you.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* 1. Budget Range */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">Budget range</label>
              <p className="text-xs text-muted-foreground">
                What do you typically spend per purchase?
              </p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={budgetRange === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBudgetRange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </section>

            <Separator />

            {/* 2. Favorite Categories */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Favorite categories
              </label>
              <p className="text-xs text-muted-foreground">
                Select all that interest you.
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <Badge
                    key={cat}
                    variant={categories.includes(cat) ? "default" : "outline"}
                    className="cursor-pointer select-none px-3 py-1 text-sm"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator />

            {/* 3. Brand Preferences */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">Brand preferences</label>
              <p className="text-xs text-muted-foreground">
                List brands you love, separated by commas.
              </p>
              <Input
                placeholder="Apple, Nike, Sony..."
                value={brands}
                onChange={(e) => setBrands(e.target.value)}
              />
            </section>

            <Separator />

            {/* 4. Quality vs. Price */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">Quality vs. Price</label>
              <p className="text-xs text-muted-foreground">
                Where do you fall on the spectrum?
              </p>
              <div className="flex flex-wrap gap-2">
                {QUALITY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      qualityVsPrice === opt.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setQualityVsPrice(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </section>

            <Separator />

            {/* 5. Household */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">Household</label>
              <p className="text-xs text-muted-foreground">
                Who are you shopping for?
              </p>
              <div className="flex flex-wrap gap-2">
                {HOUSEHOLD_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={household === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHousehold(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </section>

            <Separator />

            {/* 6. Shopping Frequency */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">Shopping frequency</label>
              <p className="text-xs text-muted-foreground">
                How often do you shop online?
              </p>
              <div className="flex flex-wrap gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      shoppingFrequency === opt.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setShoppingFrequency(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </section>

            <Separator />

            {/* 7. Preferred Retailers */}
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Preferred retailers
              </label>
              <p className="text-xs text-muted-foreground">
                Where do you usually shop?
              </p>
              <div className="flex flex-wrap gap-2">
                {RETAILER_OPTIONS.map((ret) => (
                  <Badge
                    key={ret}
                    variant={retailers.includes(ret) ? "default" : "outline"}
                    className="cursor-pointer select-none px-3 py-1 text-sm"
                    onClick={() => toggleRetailer(ret)}
                  >
                    {ret}
                  </Badge>
                ))}
              </div>
            </section>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="mt-4 w-full" disabled={loading}>
              {loading ? "Setting up..." : "Start Shopping"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
