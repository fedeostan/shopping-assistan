"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, X, Plus, Store, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { UserPersona } from "@/lib/persona/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileData {
  persona: UserPersona;
  confidenceScore: number;
  confidenceLabel: string;
  lastRefreshedAt: string;
}

interface ShippingData {
  fullName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const EMPTY_SHIPPING: ShippingData = {
  fullName: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
};

type EditingSection =
  | "shopping"
  | "personal"
  | "lifestyle"
  | "shipping"
  | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPECTRUM_LABELS: Record<number, string> = {
  [-1]: "Best Price",
  [-0.5]: "Price Leaning",
  [0]: "Balanced",
  [0.5]: "Quality Leaning",
  [1]: "Best Quality",
};

function spectrumToStep(value: number): number {
  if (value <= -0.75) return -1;
  if (value <= -0.25) return -0.5;
  if (value <= 0.25) return 0;
  if (value <= 0.75) return 0.5;
  return 1;
}

function spectrumLabel(value: number): string {
  return SPECTRUM_LABELS[spectrumToStep(value)] ?? "Balanced";
}

// ---------------------------------------------------------------------------
// ArrayField — reusable badge list with add/remove
// ---------------------------------------------------------------------------

function ArrayField({
  items,
  editing,
  onAdd,
  onRemove,
  placeholder = "Add item...",
}: {
  items: string[];
  editing: boolean;
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setInput("");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <Badge key={item} variant="secondary" className="gap-1">
          {item}
          {editing && (
            <button
              onClick={() => onRemove(i)}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {editing && (
        <div className="flex items-center gap-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={placeholder}
            className="h-7 w-32 text-xs"
          />
          <Button size="icon-xs" variant="outline" onClick={handleAdd}>
            <Plus className="size-3" />
          </Button>
        </div>
      )}
      {!editing && items.length === 0 && (
        <span className="text-sm text-muted-foreground">None set</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section edit button
// ---------------------------------------------------------------------------

function SectionEditButton({
  section,
  editingSection,
  onEdit,
  onSave,
  onCancel,
  saving,
}: {
  section: EditingSection;
  editingSection: EditingSection;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  if (editingSection === section) {
    return (
      <div className="flex gap-2">
        <Button size="xs" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="xs" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    );
  }
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      onClick={onEdit}
      disabled={editingSection !== null}
    >
      <Pencil className="size-3" />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [draft, setDraft] = useState<Partial<UserPersona>>({});
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState<ShippingData>(EMPTY_SHIPPING);
  const [shippingDraft, setShippingDraft] = useState<ShippingData>(EMPTY_SHIPPING);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  // Fetch persona + shipping on mount
  const fetchPersona = useCallback(async () => {
    try {
      const [personaRes, shippingRes] = await Promise.all([
        fetch("/api/profile/persona"),
        fetch("/api/profile/shipping"),
      ]);
      if (!personaRes.ok) throw new Error("Failed to load profile");
      const json = await personaRes.json();
      setData(json);

      if (shippingRes.ok) {
        const shippingJson = await shippingRes.json();
        if (shippingJson.data) {
          setShipping(shippingJson.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersona();
  }, [fetchPersona]);

  // Start editing a section: initialize draft from current persona
  function startEdit(section: EditingSection) {
    if (!data && section !== "shipping") return;
    if (section === "shipping") {
      setShippingDraft({ ...shipping });
      setShippingError(null);
    } else if (data) {
      setDraft({ ...data.persona });
    }
    setEditingSection(section);
  }

  function cancelEdit() {
    setEditingSection(null);
    setDraft({});
    setShippingError(null);
  }

  // Save draft changes via PATCH
  async function saveEdit() {
    if (!data) return;
    setSaving(true);
    try {
      // Only send fields that differ from the current persona
      const patch: Partial<UserPersona> = {};
      for (const key of Object.keys(draft) as (keyof UserPersona)[]) {
        if (JSON.stringify(draft[key]) !== JSON.stringify(data.persona[key])) {
          (patch as Record<string, unknown>)[key] = draft[key];
        }
      }

      if (Object.keys(patch).length > 0) {
        const res = await fetch("/api/profile/persona", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Failed to save");
        const json = await res.json();
        setData(json);
      }
      setEditingSection(null);
      setDraft({});
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function saveShipping() {
    setShippingError(null);

    // Client-side validation for required fields
    const required: { key: keyof ShippingData; label: string }[] = [
      { key: "fullName", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "address1", label: "Address Line 1" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "zip", label: "ZIP Code" },
    ];
    const missing = required.filter(f => !shippingDraft[f.key].trim());
    if (missing.length > 0) {
      setShippingError(`Please fill in: ${missing.map(f => f.label).join(", ")}`);
      return;
    }

    // Client-side email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shippingDraft.email.trim())) {
      setShippingError("Please enter a valid email address");
      return;
    }

    setShippingSaving(true);
    try {
      const res = await fetch("/api/profile/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shippingDraft),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.details
          ? Object.entries(body.details as Record<string, string[]>)
              .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
              .join("; ")
          : body?.error ?? "Failed to save shipping address";
        setShippingError(detail);
        return;
      }
      setShipping({ ...shippingDraft });
      setEditingSection(null);
    } catch {
      setShippingError("Failed to save shipping address");
    } finally {
      setShippingSaving(false);
    }
  }

  // Draft update helpers
  function updateDraft<K extends keyof UserPersona>(
    key: K,
    value: UserPersona[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function addToArrayDraft(key: keyof UserPersona, item: string) {
    const current = (draft[key] as string[] | undefined) ?? [];
    updateDraft(key, [...current, item] as UserPersona[typeof key]);
  }

  function removeFromArrayDraft(key: keyof UserPersona, index: number) {
    const current = (draft[key] as string[] | undefined) ?? [];
    updateDraft(
      key,
      current.filter((_, i) => i !== index) as UserPersona[typeof key]
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? "No profile data found"}</p>
        <Button asChild variant="outline">
          <Link href="/">Back to Chat</Link>
        </Button>
      </div>
    );
  }

  const { persona } = data;
  const isEditing = (section: EditingSection) => editingSection === section;

  // Brand affinities split
  const preferredBrands = Object.entries(persona.brandAffinities ?? {}).filter(
    ([, score]) => score > 0.3
  );
  const avoidedBrands = Object.entries(persona.brandAffinities ?? {}).filter(
    ([, score]) => score < -0.3
  );

  // Category interests sorted
  const topCategories = Object.entries(persona.categoryInterests ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="h-svh overflow-y-auto bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Your Shopping Profile</h1>
            <p className="text-sm text-muted-foreground">
              What the assistant has learned about you
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        {/* Confidence Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Confidence</CardTitle>
            <CardDescription>{data.confidenceLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={data.confidenceScore * 100}
              className="h-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.round(data.confidenceScore * 100)}% — updates as you chat
            </p>
          </CardContent>
        </Card>

        {/* Shopping Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Shopping Preferences</CardTitle>
              <SectionEditButton
                section="shopping"
                editingSection={editingSection}
                onEdit={() => startEdit("shopping")}
                onSave={saveEdit}
                onCancel={cancelEdit}
                saving={saving}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Price/Quality Spectrum */}
            <div>
              <p className="mb-1.5 text-sm font-medium">
                Price / Quality Preference
              </p>
              {isEditing("shopping") ? (
                <div className="flex gap-1">
                  {([-1, -0.5, 0, 0.5, 1] as const).map((val) => (
                    <Button
                      key={val}
                      size="sm"
                      variant={
                        spectrumToStep(
                          draft.priceQualitySpectrum ?? persona.priceQualitySpectrum ?? 0
                        ) === val
                          ? "default"
                          : "outline"
                      }
                      onClick={() => updateDraft("priceQualitySpectrum", val)}
                    >
                      {SPECTRUM_LABELS[val]}
                    </Button>
                  ))}
                </div>
              ) : (
                <Badge variant="outline">
                  {spectrumLabel(persona.priceQualitySpectrum ?? 0)}
                </Badge>
              )}
            </div>

            {/* Preferred Retailers */}
            <div>
              <p className="mb-1.5 text-sm font-medium">Preferred Retailers</p>
              <ArrayField
                items={
                  isEditing("shopping")
                    ? (draft.preferredRetailers ?? persona.preferredRetailers ?? [])
                    : (persona.preferredRetailers ?? [])
                }
                editing={isEditing("shopping")}
                onAdd={(item) => addToArrayDraft("preferredRetailers", item)}
                onRemove={(i) => removeFromArrayDraft("preferredRetailers", i)}
                placeholder="Add retailer..."
              />
            </div>

            {/* Brand Affinities */}
            <div>
              <p className="mb-1.5 text-sm font-medium">Preferred Brands</p>
              {isEditing("shopping") ? (
                <ArrayField
                  items={Object.entries(
                    (draft.brandAffinities ?? persona.brandAffinities ?? {}) as Record<string, number>
                  )
                    .filter(([, s]) => s > 0.3)
                    .map(([name]) => name)}
                  editing
                  onAdd={(brand) =>
                    updateDraft("brandAffinities", {
                      ...(draft.brandAffinities ?? persona.brandAffinities ?? {}),
                      [brand]: 0.8,
                    })
                  }
                  onRemove={(i) => {
                    const entries = Object.entries(
                      (draft.brandAffinities ?? persona.brandAffinities ?? {}) as Record<string, number>
                    ).filter(([, s]) => s > 0.3);
                    const name = entries[i]?.[0];
                    if (name) {
                      updateDraft("brandAffinities", {
                        ...(draft.brandAffinities ?? persona.brandAffinities ?? {}),
                        [name]: null as unknown as number,
                      });
                    }
                  }}
                  placeholder="Add brand..."
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {preferredBrands.length > 0 ? (
                    preferredBrands.map(([name]) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      None set
                    </span>
                  )}
                </div>
              )}
            </div>

            {avoidedBrands.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Avoided Brands</p>
                <div className="flex flex-wrap gap-2">
                  {avoidedBrands.map(([name]) => (
                    <Badge key={name} variant="destructive">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Budget Ranges */}
            {Object.keys(persona.budgetRanges ?? {}).length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Budget Ranges</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(persona.budgetRanges ?? {}).map(
                    ([category, range]) => (
                      <Badge key={category} variant="outline">
                        {category}: {range.currency}
                        {range.min}–{range.max}
                      </Badge>
                    )
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adjust via chat
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Personal Info</CardTitle>
              <SectionEditButton
                section="personal"
                editingSection={editingSection}
                onEdit={() => startEdit("personal")}
                onSave={saveEdit}
                onCancel={cancelEdit}
                saving={saving}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Household Size",
                  key: "householdSize" as const,
                  value: persona.householdSize,
                  type: "number",
                },
                {
                  label: "Life Stage",
                  key: "lifeStage" as const,
                  value: persona.lifeStage,
                  type: "text",
                },
                {
                  label: "Country",
                  key: "country" as const,
                  value: persona.country,
                  type: "text",
                },
                {
                  label: "Currency",
                  key: "currency" as const,
                  value: persona.currency,
                  type: "text",
                },
                {
                  label: "Locale",
                  key: "locale" as const,
                  value: persona.locale,
                  type: "text",
                },
              ].map((field) => (
                <div key={field.key}>
                  <p className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </p>
                  {isEditing("personal") ? (
                    <Input
                      className="mt-1 h-8 text-sm"
                      type={field.type}
                      value={
                        (draft[field.key] as string | number | undefined) ??
                        field.value ??
                        ""
                      }
                      onChange={(e) =>
                        updateDraft(
                          field.key,
                          field.type === "number"
                            ? Number(e.target.value)
                            : e.target.value
                        )
                      }
                    />
                  ) : (
                    <p className="mt-1 text-sm">
                      {field.value ?? (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Shipping Address</CardTitle>
                <CardDescription>
                  Default address used for purchases
                </CardDescription>
              </div>
              <SectionEditButton
                section="shipping"
                editingSection={editingSection}
                onEdit={() => startEdit("shipping")}
                onSave={saveShipping}
                onCancel={cancelEdit}
                saving={shippingSaving}
              />
            </div>
          </CardHeader>
          <CardContent>
            {shippingError && (
              <p className="mb-4 text-sm text-destructive">{shippingError}</p>
            )}
            {isEditing("shipping") ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([
                  { label: "Full Name*", key: "fullName" as const, span: 2 },
                  { label: "Email*", key: "email" as const, span: 1 },
                  { label: "Phone", key: "phone" as const, span: 1 },
                  { label: "Address Line 1*", key: "address1" as const, span: 2 },
                  { label: "Address Line 2", key: "address2" as const, span: 2 },
                  { label: "City*", key: "city" as const, span: 1 },
                  { label: "State*", key: "state" as const, span: 1 },
                  { label: "ZIP Code*", key: "zip" as const, span: 1 },
                  { label: "Country", key: "country" as const, span: 1 },
                ] as const).map((field) => (
                  <div
                    key={field.key}
                    className={field.span === 2 ? "sm:col-span-2" : ""}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {field.label}
                    </p>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={shippingDraft[field.key]}
                      onChange={(e) =>
                        setShippingDraft((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : shipping.fullName ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{shipping.fullName}</p>
                <p>{shipping.address1}</p>
                {shipping.address2 && <p>{shipping.address2}</p>}
                <p>
                  {shipping.city}, {shipping.state} {shipping.zip}
                </p>
                <p>{shipping.country}</p>
                <p className="text-muted-foreground">
                  {shipping.email}
                  {shipping.phone ? ` · ${shipping.phone}` : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No shipping address saved. Click edit to add one for faster
                checkout.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Store Credentials */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-purple-500/10">
                  <Store className="size-4 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Store Credentials</CardTitle>
                  <CardDescription>
                    Saved logins for automated purchases
                  </CardDescription>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/profile/credentials">
                  Manage
                  <ChevronRight className="size-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Learned Interests (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learned Interests</CardTitle>
            <CardDescription>
              These update automatically from your conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCategories.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Top Categories</p>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map(([category]) => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {(persona.searchPatterns ?? []).length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Search Patterns</p>
                <div className="flex flex-wrap gap-2">
                  {persona.searchPatterns!.map((pattern) => (
                    <Badge key={pattern} variant="outline">
                      {pattern}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {topCategories.length === 0 &&
              (persona.searchPatterns ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No learned interests yet — keep chatting!
                </p>
              )}
          </CardContent>
        </Card>

        {/* Lifestyle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lifestyle</CardTitle>
              <SectionEditButton
                section="lifestyle"
                editingSection={editingSection}
                onEdit={() => startEdit("lifestyle")}
                onSave={saveEdit}
                onCancel={cancelEdit}
                saving={saving}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-medium">
                Dietary Restrictions
              </p>
              <ArrayField
                items={
                  isEditing("lifestyle")
                    ? (draft.dietaryRestrictions ?? persona.dietaryRestrictions ?? [])
                    : (persona.dietaryRestrictions ?? [])
                }
                editing={isEditing("lifestyle")}
                onAdd={(item) => addToArrayDraft("dietaryRestrictions", item)}
                onRemove={(i) =>
                  removeFromArrayDraft("dietaryRestrictions", i)
                }
                placeholder="Add restriction..."
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Hobbies</p>
              <ArrayField
                items={
                  isEditing("lifestyle")
                    ? (draft.hobbies ?? persona.hobbies ?? [])
                    : (persona.hobbies ?? [])
                }
                editing={isEditing("lifestyle")}
                onAdd={(item) => addToArrayDraft("hobbies", item)}
                onRemove={(i) => removeFromArrayDraft("hobbies", i)}
                placeholder="Add hobby..."
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Upcoming Needs</p>
              <ArrayField
                items={
                  isEditing("lifestyle")
                    ? (draft.upcomingNeeds ?? persona.upcomingNeeds ?? [])
                    : (persona.upcomingNeeds ?? [])
                }
                editing={isEditing("lifestyle")}
                onAdd={(item) => addToArrayDraft("upcomingNeeds", item)}
                onRemove={(i) => removeFromArrayDraft("upcomingNeeds", i)}
                placeholder="Add need..."
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
