import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { Users, CreditCard, TrendingUp, Settings } from "lucide-react";
import { useDashboard } from "./hooks/useDashboard";
import { formatAUDFromCents } from "../../lib/utils";

const S = {
  section: { padding: 24 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(1, minmax(0,1fr))", gap: 24 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(1, minmax(0,1fr))", gap: 24, marginTop: 12 },
  gridTable: { display: "grid", gridTemplateColumns: "1fr", gap: 24, marginTop: 12 },
  card: { background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 },
  subtitle: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  avatar: { height: 48, width: 48, borderRadius: 9999, objectFit: "cover" },
  kpiGrid3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 },
  kpiBox: { borderRadius: 12, background: "#f9fafb", padding: 12, textAlign: "center" },
  kpiLabel: { fontSize: 12, color: "#6b7280", margin: 0 },
  kpiValue: { fontSize: 14, fontWeight: 600, margin: 0 },
  kpiRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  pillRow: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 },
  th: { textAlign: "left", color: "#6b7280", padding: "8px 12px" },
  td: { padding: "8px 12px", borderTop: "1px solid #f3f4f6" },
  muted: { fontSize: 12, color: "#6b7280" },
};

/* --- helpers --- */
function Card({ title, subtitle, children }) {
  return (
    <div style={S.card}>
      <div style={S.header}>
        <h3 style={S.title}>{title}</h3>
        {subtitle && <p style={S.subtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Stat({ title, value, icon, muted }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 90,
        borderRadius: 12,
        background: muted ? "#f9fafb" : "#f5f3ff",
        padding: 12,
        textAlign: "center",
      }}
    >
      <div style={{ margin: "0 auto 4px", height: 24, width: 24, color: "#4b5563" }}>
        {icon ?? <Users size={18} />}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase().replace(" ", "_"); // normalize
  const map = {
    active: ["#ecfdf5", "#065f46", "#a7f3d0"],
    past_due: ["#fffbeb", "#92400e", "#fde68a"],
    cancelled: ["#fef2f2", "#991b1b", "#fecaca"],
    canceled: ["#fef2f2", "#991b1b", "#fecaca"], // both spellings
    trialing: ["#eff6ff", "#1e40af", "#bfdbfe"],
    incomplete: ["#f3f4f6", "#374151", "#e5e7eb"],
  };
  const [bg, color, ring] = map[s] || ["#f3f4f6", "#374151", "#e5e7eb"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 9999,
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        boxShadow: `inset 0 0 0 1px ${ring}`,
      }}
    >
      {status ?? "—"}
    </span>
  );
}

function Tile({ label, value }) {
  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [showAllSubs, setShowAllSubs] = useState(false);
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) return <div style={{ padding: 24 }}>Loading dashboard…</div>;

  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        Couldn’t load dashboard.{" "}
        <button onClick={() => refetch()} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}>
          Retry
        </button>
      </div>
    );
  }

  const { overview, charts, recentSubscriptions } = data;
  // Read Stripe Product IDs from env with fallback error messages
  const PRO_PRODUCT_ID = import.meta.env.VITE_STRIPE_PRO_PRODUCT_ID;
  const PREMIUM_PRODUCT_ID = import.meta.env.VITE_STRIPE_PREMIUM_PRODUCT_ID;
  const proIdText = (typeof PRO_PRODUCT_ID === 'string' && PRO_PRODUCT_ID.trim()) ? PRO_PRODUCT_ID : 'No VITE_STRIPE_PRO_PRODUCT_ID Found';
  const premiumIdText = (typeof PREMIUM_PRODUCT_ID === 'string' && PREMIUM_PRODUCT_ID.trim()) ? PREMIUM_PRODUCT_ID : 'No VITE_STRIPE_PREMIUM_PRODUCT_ID Found';

  return (
    <div style={S.section}>
      {/* Overview row */}
      <section style={S.grid3}>
        <Card title="Overview" subtitle="Admin name and details">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Divyam Juneja</p>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Admin · divyam@qfo.org
              </p>
            </div>
          </div>
        </Card>

        <Card title="Traffic" subtitle="Rolling 6 months">
          <div style={{ height: 160 }}>
            {charts.trafficTrend.length === 0 ? (
              <div style={S.muted}>No traffic data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.trafficTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="traffic" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Pro Customers" subtitle="Active">
          <div style={S.pillRow}>
            <Stat title="Total" value={overview.proCustomers.total.toLocaleString()} icon={<Users size={16} />} />
            <Stat title="New" value={`+${overview.proCustomers.new.toLocaleString()}`} muted />
            <Stat title="Churn" value={`-${overview.proCustomers.churn.toLocaleString()}`} muted />
          </div>
        </Card>

        <Card title="Premium Customers" subtitle="Active">
          <div style={S.pillRow}>
            <Stat title="Total" value={overview.premiumCustomers.total.toLocaleString()} icon={<Users size={16} />} />
            <Stat title="New" value={`+${overview.premiumCustomers.new.toLocaleString()}`} muted />
            <Stat title="Churn" value={`-${overview.premiumCustomers.churn.toLocaleString()}`} muted />
          </div>
        </Card>
      </section>

      {/* KPI row */}
      <section style={S.grid4}>
        <Card title="Traffic" subtitle="Today / Monthly / Quarterly">
          <div style={S.kpiGrid3}>
            <div style={S.kpiBox}>
              <p style={S.kpiLabel}>Today</p>
              <p style={S.kpiValue}>{overview.traffic.today ?? "—"}</p>
            </div>
            <div style={S.kpiBox}>
              <p style={S.kpiLabel}>Monthly</p>
              <p style={S.kpiValue}>{overview.traffic.monthly ?? "—"}</p>
            </div>
            <div style={S.kpiBox}>
              <p style={S.kpiLabel}>Quarterly</p>
              <p style={S.kpiValue}>{overview.traffic.quarterly ?? "—"}</p>
            </div>
          </div>
        </Card>

        <Card title="Revenue" subtitle={`This ${overview.revenue.period}`}>
          <div style={S.kpiRow}>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                {formatAUDFromCents(overview.revenue.amountCents)}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#059669" }}>
                {overview.revenue.growth.growthPercent.toFixed(1)}% vs last month
              </p>
            </div>
            <TrendingUp size={28} color="#059669" />
          </div>
        </Card>

        <Card title="Update Payment" subtitle="Payout account">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f5f3ff", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={18} color="#7c3aed" />
              <p style={{ margin: 0, fontSize: 14 }}>Stripe · **** 4242</p>
            </div>
            <button
              style={{
                border: "none", borderRadius: 8, background: "#7c3aed",
                color: "#fff", padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
              onClick={() => {
                const url = import.meta.env.VITE_STRIPE_DASHBOARD_PAYOUT_URL ||
                  "https://dashboard.stripe.com/test/settings/payouts";
                window.open(url, "_blank", "noopener");
              }}
            >
              Update
            </button>
          </div>
        </Card>

        <Card title="User Profiles & Settings" subtitle="Manage accounts">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#374151" }}>
              <Settings size={18} />
              <span style={{ fontSize: 14 }}>Open Console</span>
            </div>
            <button style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "white", padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Go
            </button>
          </div>
        </Card>
      </section>

      {/* Subscriptions table + revenue chart */}
      <section style={S.gridTable}>
        <Card title="Subscriptions" subtitle="Recent signups & renewals">
          <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: '#fff7ed', color: '#92400e', fontSize: 12 }}>
            Pro Product ID: {proIdText} · Premium Product ID: {premiumIdText}
          </div>
          {recentSubscriptions.length === 0 ? (
            <div style={S.muted}>No subscriptions yet.</div>
          ) : (
            <div style={S.tableWrap}>
              {/* More/Less toggle */}
              {recentSubscriptions.length > 5 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <button
                    onClick={() => setShowAllSubs(prev => !prev)}
                    style={{ border: "1px solid #ddd", borderRadius: 8, background: "white", padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {showAllSubs ? "Less" : "More"}
                  </button>
                </div>
              )}
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>ID</th>
                    <th style={S.th}>User</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Period</th>
                    <th style={S.th}>Amount</th>
                    <th style={S.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllSubs ? recentSubscriptions : recentSubscriptions.slice(0, 5)).map((s, i) => (
                    <tr key={s.id || i} style={{ background: i % 2 ? "#f9fafb" : "white" }}>
                      <td style={{ ...S.td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 }}>
                        {s.id || "—"}
                      </td>
                      <td style={S.td}>{s.userName || s.userEmail || "—"}</td>
                      <td style={S.td}>{s.tier || "—"}</td>
                      <td style={S.td}>{s.period || "—"}</td>
                      <td style={S.td}>{formatAUDFromCents(s.amountCents)}</td>
                      <td style={S.td}><StatusPill status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Revenue Trend" subtitle="Last 6 months">
          <div style={{ height: 256 }}>
            {charts.revenueTrend.length === 0 ? (
              <div style={S.muted}>No revenue data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
