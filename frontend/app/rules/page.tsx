"use client";

import { useState, useEffect } from "react";
import { BookOpen, ChevronDown, ChevronUp, CheckCircle2, Info, Search, Database } from "lucide-react";
import { complianceRules } from "@/lib/mock-data/rules";
import { cn } from "@/lib/utils";
import { fetchRules, type FlaskRule } from "@/lib/api";
import type { ComplianceRequirement } from "@/lib/types";

const CATEGORIES = [
  "All",
  "Product Identification",
  "Manufacturer / Packer / Importer",
  "Country of Origin",
  "Net Quantity",
  "MRP",
  "Date Declarations",
  "Consumer Care",
  "Unit Sale Price",
  "Other Applicable Declarations",
];

const FIELD_LABEL_MAP: Record<string, string> = {
  product_name: "Product Name",
  brand: "Brand",
  category: "Category",
  manufacturer: "Manufacturer / Packer",
  address: "Manufacturer Address",
  country_of_origin: "Country of Origin",
  net_quantity: "Net Quantity",
  mrp: "MRP",
  mfg_date: "Manufacturing Date",
  best_before: "Best Before",
  consumer_care: "Consumer Care",
  unit_sale_price: "Unit Sale Price",
  fssai_license: "FSSAI License",
  batch_number: "Batch / Lot Number",
};

function flaskRuleToRequirement(rule: FlaskRule): ComplianceRequirement {
  const label = FIELD_LABEL_MAP[rule.field_name] || rule.field_name;
  return {
    id: `rule-${rule.id}`,
    category: rule.category || "Package Declarations",
    name: `${label} Declaration`,
    explanation: rule.rule_text,
    applicableField: label,
    example: `Mandatory declaration of ${label} under Legal Metrology Rules`,
    ruleReference: rule.rule_number,
    mandatory: true,
  };
}

export default function RulesPage() {
  const [rules, setRules] = useState<ComplianceRequirement[]>(complianceRules);
  const [isLive, setIsLive] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRules()
      .then((data) => {
        if (data && data.length > 0) {
          setRules(data.map(flaskRuleToRequirement));
          setIsLive(true);
        }
      })
      .catch((err) => {
        console.warn("Using default rules fallback:", err);
      });
  }, []);

  const filtered = rules.filter((rule) => {
    const matchSearch =
      !search ||
      rule.name.toLowerCase().includes(search.toLowerCase()) ||
      rule.explanation.toLowerCase().includes(search.toLowerCase()) ||
      rule.applicableField.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === "All" || rule.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rules & Requirements</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reference guide for Legal Metrology (Packaged Commodities) Rules 2011 compliance requirements.
          </p>
        </div>
        {isLive && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="h-3.5 w-3.5 text-emerald-600" />
            Connected to Flask Database ({rules.length} Rules)
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <strong>Reference only:</strong> This is a simplified reference guide for inspection assistance. It does not constitute a complete or legally authoritative rule database. Always refer to the official Legal Metrology (Packaged Commodities) Rules 2011 and relevant amendments for authoritative requirements.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules and requirements..."
          className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
              activeCategory === cat
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> requirement{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Rules list */}
      <div className="space-y-3">
        {filtered.map((rule) => {
          const isExpanded = expandedId === rule.id;
          return (
            <div
              key={rule.id}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              <button
                className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : rule.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5",
                    rule.mandatory ? "bg-primary/10" : "bg-muted"
                  )}>
                    <BookOpen className={cn("h-3.5 w-3.5", rule.mandatory ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                      {rule.mandatory && (
                        <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          MANDATORY
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{rule.category} · {rule.ruleReference}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{rule.explanation}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-muted/50 px-3 py-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Applicable Field
                      </p>
                      <p className="text-xs text-foreground">{rule.applicableField}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Example
                      </p>
                      <p className="text-xs text-foreground font-mono">{rule.example}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-muted-foreground">{rule.ruleReference}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No rules found</p>
            <p className="text-xs mt-1">Try adjusting your search or selecting a different category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
