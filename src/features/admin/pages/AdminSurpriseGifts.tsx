/**
 * AdminSurpriseGifts.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Admin panel for managing surprise-gift rules.
 *
 * Features
 * - List all rules (active + inactive) with cart-value range display
 * - Create / Edit rules with:
 *     • giftType: Physical Coupon | Physical Gift
 *     • Cart range: min ₹ — max ₹ (max optional = "no upper limit")
 *     • For Physical Gift: SKU, HSN code, weight
 * - Toggle active / inactive
 * - Soft-delete
 */

import { useState, useEffect, useCallback } from "react";
import api from "@/shared/api/axiosInstance";
import { invalidateSurpriseGiftTiersCache } from "@/shared/utils/surpriseGift";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GiftRule {
  giftRuleId: number;
  giftName: string;
  giftDescription: string | null;
  giftType: "physical_coupon" | "physical_gift";
  minCartValue: number;
  maxCartValue: number | null;
  sku: string | null;
  hsnCode: string | null;
  weight: number | null;
  isActive: boolean;
  sortOrder: number;
  createdDate: string | null;
}

interface FormState {
  giftName: string;
  giftDescription: string;
  giftType: "physical_coupon" | "physical_gift";
  minCartValue: string;
  maxCartValue: string;
  sku: string;
  hsnCode: string;
  weight: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  giftName: "",
  giftDescription: "",
  giftType: "physical_gift",
  minCartValue: "",
  maxCartValue: "",
  sku: "",
  hsnCode: "",
  weight: "",
  isActive: true,
  sortOrder: "0",
};

function formFromRule(rule: GiftRule): FormState {
  return {
    giftName: rule.giftName,
    giftDescription: rule.giftDescription ?? "",
    giftType: rule.giftType,
    minCartValue: String(rule.minCartValue),
    maxCartValue: rule.maxCartValue != null ? String(rule.maxCartValue) : "",
    sku: rule.sku ?? "",
    hsnCode: rule.hsnCode ?? "",
    weight: rule.weight != null ? String(rule.weight) : "",
    isActive: rule.isActive,
    sortOrder: String(rule.sortOrder),
  };
}

const fmt = (v: number | null | undefined) =>
  v != null ? `₹${Number(v).toLocaleString("en-IN")}` : "—";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminSurpriseGifts() {
  const [rules, setRules] = useState<GiftRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState<GiftRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<GiftRule | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/SurpriseGift/Admin/Rules", {
        params: { include_inactive: true },
      });
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load gift rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreate = () => {
    setEditRule(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (rule: GiftRule) => {
    setEditRule(rule);
    setForm(formFromRule(rule));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.giftName.trim())
      return showToast("Gift name is required.", false);
    const min = parseFloat(form.minCartValue);
    if (!Number.isFinite(min) || min < 0)
      return showToast("Min cart value must be a valid number.", false);

    const max = form.maxCartValue.trim() ? parseFloat(form.maxCartValue) : null;
    if (max !== null && (!Number.isFinite(max) || max <= min))
      return showToast("Max cart value must be greater than min.", false);

    if (form.giftType === "physical_gift" && !form.sku.trim())
      return showToast("SKU is required for Physical Gifts.", false);

    setSaving(true);
    const payload = {
      giftName: form.giftName.trim(),
      giftDescription: form.giftDescription.trim() || null,
      giftType: form.giftType,
      minCartValue: min,
      maxCartValue: max,
      sku: form.sku.trim() || null,
      hsnCode: form.hsnCode.trim() || null,
      weight: form.weight.trim() ? parseFloat(form.weight) : null,
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    try {
      if (editRule) {
        await api.put(
          `/SurpriseGift/Admin/Rules/${editRule.giftRuleId}`,
          payload,
        );
        showToast("Gift rule updated.");
      } else {
        await api.post("/SurpriseGift/Admin/Rules", payload);
        showToast("Gift rule created.");
      }
      invalidateSurpriseGiftTiersCache();
      setShowModal(false);
      fetchRules();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Save failed.", false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: GiftRule) => {
    try {
      await api.put(`/SurpriseGift/Admin/Rules/${rule.giftRuleId}`, {
        isActive: !rule.isActive,
      });
      invalidateSurpriseGiftTiersCache();
      showToast(rule.isActive ? "Rule deactivated." : "Rule activated.");
      fetchRules();
    } catch {
      showToast("Failed to update status.", false);
    }
  };

  const handleDelete = async (rule: GiftRule) => {
    try {
      await api.delete(`/SurpriseGift/Admin/Rules/${rule.giftRuleId}`);
      invalidateSurpriseGiftTiersCache();
      setDeleteConfirm(null);
      showToast("Gift rule deleted.");
      fetchRules();
    } catch {
      showToast("Delete failed.", false);
    }
  };

  const f = (field: keyof FormState, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${
            toast.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <i className="bi bi-gift-fill text-pink-500" />
            Surprise Gift Rules
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define cart-value ranges and assign physical coupons or physical
            gifts. Gifts are hidden from users until delivery.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow transition"
        >
          <i className="bi bi-plus-lg" />
          Add Rule
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {error}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <i className="bi bi-gift text-5xl" />
          <p className="mt-3 text-base">
            No gift rules yet. Click "Add Rule" to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Gift Name</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Cart Range</th>
                <th className="text-left px-4 py-3">SKU</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rules.map((rule) => (
                <tr
                  key={rule.giftRuleId}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {rule.giftName}
                    </div>
                    {rule.giftDescription && (
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">
                        {rule.giftDescription}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {rule.giftType === "physical_gift" ? (
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <i className="bi bi-box-seam" /> Physical Gift
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <i className="bi bi-ticket-perforated" /> Coupon
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono">
                    {fmt(rule.minCartValue)} —{" "}
                    {rule.maxCartValue != null
                      ? fmt(rule.maxCartValue)
                      : "No limit"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono">
                    {rule.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${
                        rule.isActive
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(rule)}
                        className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition"
                        title="Edit"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(rule)}
                        className="text-red-500 hover:text-red-700 px-2 py-1 rounded transition"
                        title="Delete"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editRule ? "Edit Gift Rule" : "New Gift Rule"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="bi bi-x-lg text-xl" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Gift Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Gift Type *
                </label>
                <div className="flex gap-3">
                  {[
                    {
                      val: "physical_gift",
                      icon: "bi-box-seam",
                      label: "Physical Gift",
                    },
                    {
                      val: "physical_coupon",
                      icon: "bi-ticket-perforated",
                      label: "Physical Coupon",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => f("giftType", opt.val as any)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-semibold transition ${
                        form.giftType === opt.val
                          ? "bg-pink-600 text-white border-pink-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-pink-400"
                      }`}
                    >
                      <i className={`bi ${opt.icon}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.giftType === "physical_coupon" && (
                  <p className="text-xs text-blue-600 mt-2 bg-blue-50 rounded-lg px-3 py-2">
                    <i className="bi bi-info-circle me-1" />
                    Coupons are packed inside the parcel by your inventory team
                    — no details sent to Ekart.
                  </p>
                )}
                {form.giftType === "physical_gift" && (
                  <p className="text-xs text-purple-700 mt-2 bg-purple-50 rounded-lg px-3 py-2">
                    <i className="bi bi-info-circle me-1" />
                    Full gift details (SKU, HSN) will be sent to Ekart for
                    packing. Hidden from user until delivered.
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Gift Name *
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                  placeholder="e.g. Premium Fragrance Sachet"
                  value={form.giftName}
                  onChange={(e) => f("giftName", e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                  rows={2}
                  placeholder="Internal description for your team"
                  value={form.giftDescription}
                  onChange={(e) => f("giftDescription", e.target.value)}
                />
              </div>

              {/* Cart Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cart Value Range *
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                      placeholder="Min (e.g. 2500)"
                      value={form.minCartValue}
                      onChange={(e) => f("minCartValue", e.target.value)}
                    />
                  </div>
                  <span className="text-gray-400 text-sm">—</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                      placeholder="Max (leave blank = no limit)"
                      value={form.maxCartValue}
                      onChange={(e) => f("maxCartValue", e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Leave Max blank for "cart value ≥ Min → gift applies".
                </p>
              </div>

              {/* Physical Gift extras */}
              {form.giftType === "physical_gift" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        SKU *
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                        placeholder="e.g. GIFT-FRAG-001"
                        value={form.sku}
                        onChange={(e) => f("sku", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        HSN Code
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                        placeholder="e.g. 33049900"
                        value={form.hsnCode}
                        onChange={(e) => f("hsnCode", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                      placeholder="e.g. 0.05"
                      value={form.weight}
                      onChange={(e) => f("weight", e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Sort Order + Active */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                    value={form.sortOrder}
                    onChange={(e) => f("sortOrder", e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="w-4 h-4 accent-pink-600"
                    checked={form.isActive}
                    onChange={(e) => f("isActive", e.target.checked)}
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Active
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3 border-t pt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold shadow transition disabled:opacity-60"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : editRule ? (
                  "Save Changes"
                ) : (
                  "Create Rule"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <i className="bi bi-exclamation-triangle-fill text-4xl text-red-500 mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete Gift Rule?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              "<strong>{deleteConfirm.giftName}</strong>" will be permanently
              removed from the gift tiers. Existing orders are not affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
