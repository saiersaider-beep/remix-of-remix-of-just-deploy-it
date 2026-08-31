import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Settings2, PlugZap, Copy } from "lucide-react";
import {
  getGeniusPaySettings,
  updateGeniusPaySettings,
  testGeniusPayConnection,
} from "@/lib/geniuspay.functions";
import { AdminPageHeader } from "@/components/AdminLayout";

const DEFAULT_API_URL = "https://geniuspay.ci/api/v1/merchant";

export const Route = createFileRoute("/admin/geniuspay")({
  head: () => ({ meta: [{ title: "GeniusPay — Admin" }] }),
  component: AdminGeniusPayPage,
});

function AdminGeniusPayPage() {
  const fetchSettings = useServerFn(getGeniusPaySettings);
  const saveSettings = useServerFn(updateGeniusPaySettings);
  const testConn = useServerFn(testGeniusPayConnection);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["geniuspay-settings"],
    queryFn: () => fetchSettings(),
  });

  const [form, setForm] = useState({
    api_key: "",
    secret_key: "",
    site_id: "",
    api_url: DEFAULT_API_URL,
    currency: "XOF",
    mode: "test" as "test" | "prod",
    enabled: false,
  });

  useEffect(() => {
    const s = data?.settings;
    if (s) {
      setForm({
        api_key: s.api_key ?? "",
        secret_key: s.secret_key ?? "",
        site_id: s.site_id ?? "",
        api_url: s.api_url ?? DEFAULT_API_URL,
        currency: s.currency ?? "XOF",
        mode: (s.mode as "test" | "prod") ?? "test",
        enabled: !!s.enabled,
      });
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          ...form,
          api_key: form.api_key.trim(),
          secret_key: form.secret_key.trim(),
          site_id: form.site_id.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Paramètres GeniusPay enregistrés");
      qc.invalidateQueries({ queryKey: ["geniuspay-settings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Échec de l'enregistrement"),
  });

  const testMut = useMutation({
    mutationFn: () => testConn({ data: undefined }),
    onSuccess: (r) =>
      toast.success(
        `Connexion OK — ${r.account?.business_name ?? "compte marchand"} (${r.account?.environment ?? "?"})`,
      ),
    onError: (e: Error) => toast.error(e.message || "Connexion échouée"),
  });

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/geniuspay-webhook`
      : "/api/public/geniuspay-webhook";

  return (
    <>
      <AdminPageHeader
        title="Paiements GeniusPay"
        description="Configure tes clés GeniusPay pour encaisser les paiements du site : abonnements PRO, achats de pistes/albums, recharge du wallet et frais de création de profil artiste."
      />

      <div className="mb-6 rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted-foreground max-w-3xl">
        <p className="font-bold text-foreground mb-2">Où trouver ces valeurs ?</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Connecte-toi sur{" "}
            <a
              href="https://geniuspay.ci"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              geniuspay.ci
            </a>{" "}
            puis ouvre <b>Intégrations → Clés API</b>.
          </li>
          <li>
            Copie la <b>clé publique</b> (<code>pk_…</code>) → champ « Clé publique (X-API-Key) ».
          </li>
          <li>
            Copie la <b>clé secrète</b> (<code>sk_…</code>) → champ « Clé secrète (X-API-Secret) ».
          </li>
          <li>
            Dans <b>Intégrations → Webhooks</b>, crée un webhook vers l'URL ci-dessous avec les
            événements <code>payment.success</code> et <code>payment.failed</code>, puis colle le
            secret <code>whsec_…</code> dans le champ prévu.
          </li>
          <li>Choisis le mode Sandbox (Test) ou Production, puis active.</li>
        </ol>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-surface px-3 py-2 text-xs">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("URL webhook copiée");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-bold hover:bg-surface"
          >
            <Copy className="w-3.5 h-3.5" /> Copier
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.api_key.trim()) return toast.error("La clé publique est requise.");
            if (!form.secret_key.trim()) return toast.error("La clé secrète est requise.");
            mut.mutate();
          }}
          className="rounded-xl border border-border bg-card p-6 space-y-5 max-w-3xl"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Settings2 className="w-4 h-4" /> Identifiants API
          </div>

          <Field label="Clé publique GeniusPay (X-API-Key) *">
            <input
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="pk_sandbox_… ou pk_live_…"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
            />
          </Field>

          <Field label="Clé secrète GeniusPay (X-API-Secret) *">
            <input
              type="password"
              value={form.secret_key}
              onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
              placeholder="sk_sandbox_… ou sk_live_…"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
            />
          </Field>

          <Field label="Secret webhook (whsec_…)">
            <input
              type="password"
              value={form.site_id}
              onChange={(e) => setForm({ ...form, site_id: e.target.value })}
              placeholder="Laisse vide pour désactiver la vérification de signature"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
            />
          </Field>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Mode">
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "test" | "prod" })}
                className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="test">Sandbox (test)</option>
                <option value="prod">Production (live)</option>
              </select>
            </Field>
            <Field label="Devise">
              <input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="URL de l'API">
              <input
                value={form.api_url}
                onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-bold">Activer les paiements GeniusPay sur le site</span>
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={mut.isPending}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-bold hover:bg-primary/90 transition disabled:opacity-60"
            >
              {mut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending}
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-bold hover:bg-surface transition disabled:opacity-60"
            >
              {testMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlugZap className="w-4 h-4" />
              )}
              Tester la connexion
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
