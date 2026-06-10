import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Mic2,
  Music2,
  MessageSquare,
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
  Menu,
  X,
  Banknote,
  Receipt,
  Flag,
  Scale,
  Ban,
  Megaphone,
  FileText,
  HelpCircle,
  Wallet,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ShieldAlert } from "lucide-react";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/admin/branding", label: "Logo & Branding", icon: ImageIcon },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/artists", label: "Artistes", icon: Mic2 },
  { to: "/admin/tracks", label: "Pistes", icon: Music2 },
  { to: "/admin/comments", label: "Commentaires", icon: MessageSquare },
  { to: "/admin/payments", label: "Paiements", icon: CreditCard },
  { to: "/admin/cinetpay", label: "CinetPay", icon: Wallet },
  { to: "/admin/withdrawals", label: "Retraits", icon: Banknote },
  { to: "/admin/bank-receipts", label: "Reçus bancaires", icon: Receipt },
  { to: "/admin/artist-verification", label: "Vérifications", icon: ShieldCheck },
  { to: "/admin/reports", label: "Signalements", icon: Flag },
  { to: "/admin/copyrights", label: "Copyright", icon: Scale },
  { to: "/admin/banned-ips", label: "IPs bannies", icon: Ban },
  { to: "/admin/announcements", label: "Annonces", icon: Megaphone },
  { to: "/admin/pages", label: "Pages CMS", icon: FileText },
  { to: "/admin/faq", label: "FAQ", icon: HelpCircle },
];

export function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return <Forbidden message="Vous devez être connecté." />;
  }

  if (!isAdmin) {
    return <Forbidden message="Accès réservé aux administrateurs." />;
  }

  return (
    <div className="min-h-screen flex bg-background -mx-px">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="grid place-items-center w-8 h-8 rounded-md bg-primary text-primary-foreground font-black">
              D
            </span>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm">VinaSound</div>
              <div className="text-[10px] uppercase tracking-widest text-primary font-bold">
                Admin
              </div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-5 mb-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Gestion
          </div>
          {NAV.map((item) => {
            const active =
              item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition border-l-2 ${
                  active
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour au site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-display font-bold text-base">Panel d'administration</div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition text-xs font-semibold"
              title="Visiter le site"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Visiter le site
            </Link>
            <div className="text-xs text-muted-foreground hidden sm:block">
              {user.email}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Forbidden({ message }: { message: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h1 className="font-display text-xl font-bold mb-1">Accès refusé</h1>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-bold"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof LayoutDashboard;
  accent?: "primary" | "emerald" | "sky" | "rose";
}) {
  const ring = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-400",
    sky: "bg-sky-500/10 text-sky-400",
    rose: "bg-rose-500/10 text-rose-400",
  }[accent];
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="font-display text-3xl font-bold mt-2">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg grid place-items-center ${ring}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  empty = "Aucun résultat",
  keyOf,
}: {
  columns: { key: string; label: string; render: (row: T) => ReactNode; className?: string }[];
  rows: T[];
  empty?: string;
  keyOf: (row: T) => string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`text-left font-bold px-4 py-3 ${c.className ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                className="border-t border-border hover:bg-muted/20 transition"
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
