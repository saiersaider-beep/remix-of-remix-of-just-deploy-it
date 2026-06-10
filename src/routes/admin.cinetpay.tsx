import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Settings2 } from "lucide-react";
import { getCinetPaySettings, updateCinetPaySettings } from "@/lib/cinetpay.functions";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/cinetpay")({
  head: () => ({ meta: [{ title: "CinetPay — Admin" }] }),
  component: AdminCinetPayPage,
});

function AdminCinetPayPage() {
  const fetchSettings = useServerFn(getCinetPaySettings);
  const saveSettings = useServerFn(updateCinetPaySettings);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cinetpay-settings"],
    queryFn: () => fetchSettings(),
  });

  const [form, setForm] = useState({
    api_key: "",
    site_id: "",
    secret_key: "",
    api_url: "https://api-checkout.cinetpay.com/v1/payment",
    currency: "XOF",
    mode: "test" as "test" | "prod",
    enabled: false,
  });

  useEffect(() => {
    const s = data?.settings;
    if (s) {
      setForm({
        api_key: s.api_key ?? "",
        site_id: s.site_id ?? "",
        secret_key: s.secret_key ?? "",
        api_url: s.api_url ?? "https://api-checkout.cinetpay.com/v1/payment",
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
          site_id: form.site_id.trim() || null,
          secret_key: form.secret_key.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Paramètres CinetPay enregistrés");
      qc.invalidateQueries({ queryKey: ["cinetpay-settings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Échec de l'enregistrement"),
  });

  return (
    <>
      <AdminPageHeader
        title="Paramètres CinetPay"
        description="Configure tes identifiants CinetPay pour activer les paiements (abonnements PRO, achats de pistes et d'albums)."
      />

      <div className="mb-6 rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted-foreground max-w-3xl">
        <p className="font-bold text-foreground mb-2">Où trouver ces valeurs ?</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Connecte-toi sur <a href="https://app.cinetpay.com" target="_blank" rel="noreferrer" className="text-primary underline">app.cinetpay.com</a> (Sandbox ou Production).</li>
          <li>Ouvre <b>Ressources → API & sécurité</b>.</li>
          <li>Copie l'<b>API Key</b> → champ « Clé API ».</li>
          <li>Copie le <b>Mot de passe API</b> → champ « Clé secrète / Mot de passe API ».</li>
          <li><i>Site ID</i> : seulement si CinetPay l'affiche encore dans <b>Caisses</b> — sinon laisse vide.</li>
          <li>Choisis le mode <b>Test</b> (compte Sandbox) ou <b>Production</b>, puis active.</li>
        </ol>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.api_key.trim()) {
              toast.error("La Clé API est requise.");
              return;
            }
            if (!form.secret_key.trim()) {
              toast.error("Le Mot de passe API est requis.");
              return;
            }
            mut.mutate();
          }}
          className="rounded-xl border border-border bg-card p-6 space-y-5 max-w-3xl"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Settings2 className="w-4 h-4" /> Identifiants
          </div>

          <Field label="Clé API CinetPay (API Key) *">
            <input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="Colle l'API Key (Ressources → API & sécurité)"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
            />
          </Field>

          <Field label="Site ID (optionnel)">
            <input
              value={form.site_id}
              onChange={(e) => setForm({ ...form, site_id: e.target.value })}
              placeholder="Laisse vide si CinetPay ne le demande plus"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
            />
          </Field>

          <Field label="Mot de passe API CinetPay *">
            <input
              type="password"
              value={form.secret_key}
              onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
              placeholder="Colle le Mot de passe API (API & sécurité)"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Mode">
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "test" | "prod" })}
                className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="test">Test</option>
                <option value="prod">Production</option>
              </select>
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
            <span className="text-sm font-bold">
              Activer les paiements CinetPay sur le site
            </span>
          </label>

          <div className="flex gap-3 pt-2">
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
