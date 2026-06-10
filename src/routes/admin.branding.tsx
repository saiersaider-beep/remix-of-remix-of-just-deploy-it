import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Upload, Copy, Check, Trash2, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { toast } from "sonner";
import fallbackLogo from "@/assets/brand-logo.png";

export const Route = createFileRoute("/admin/branding")({
  head: () => ({ meta: [{ title: "Branding — Admin" }, { name: "robots", content: "noindex" }] }),
  component: BrandingAdmin,
});

function BrandingAdmin() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  const { data: logoUrl, refetch } = useQuery({
    queryKey: ["admin-site-logo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings" as never)
        .select("logo_url")
        .eq("id", "default")
        .maybeSingle();
      return (data as { logo_url: string | null } | null)?.logo_url ?? null;
    },
  });

  const shareUrl =
    logoUrl ||
    (typeof window !== "undefined"
      ? new URL(fallbackLogo, window.location.origin).href
      : fallbackLogo);

  async function saveLogoUrl(url: string | null) {
    const { error } = await supabase
      .from("site_settings" as never)
      .upsert({ id: "default", logo_url: url, updated_at: new Date().toISOString() } as never);
    if (error) {
      toast.error("Échec de la sauvegarde : " + error.message);
      return false;
    }
    await refetch();
    qc.invalidateQueries({ queryKey: ["site-logo"] });
    return true;
  }

  async function onUpload(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 5 Mo).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      const ok = await saveLogoUrl(pub.publicUrl);
      if (ok) toast.success("Logo mis à jour !");
    } catch (e: unknown) {
      toast.error("Upload échoué : " + (e instanceof Error ? e.message : "erreur"));
    } finally {
      setUploading(false);
    }
  }

  async function copyUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 1500);
  }

  async function resetLogo() {
    if (!confirm("Restaurer le logo par défaut ?")) return;
    const ok = await saveLogoUrl(null);
    if (ok) toast.success("Logo réinitialisé.");
  }

  async function applyManual() {
    const url = manualUrl.trim();
    if (!url) return;
    const ok = await saveLogoUrl(url);
    if (ok) {
      toast.success("Logo appliqué depuis le lien.");
      setManualUrl("");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Logo & Branding"
        description="Téléverse ton logo, copie son lien, ou colle un lien externe."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Logo actuel
          </h2>
          <div className="aspect-square max-w-xs mx-auto bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg grid place-items-center p-6 border border-border">
            <img
              src={logoUrl || fallbackLogo}
              alt="Logo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="mt-4 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              URL publique du logo {logoUrl ? "(personnalisé)" : "(par défaut)"}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                value={shareUrl}
                  className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-2 text-xs font-mono"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={copyUrl}
                  className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copié" : "Copier"}
                </button>
              </div>
            {logoUrl && (
              <button
                onClick={resetLogo}
                className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline mt-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> Téléverser un logo
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              PNG, JPG ou SVG. 5 Mo max. Fond transparent recommandé.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            <button
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-3 rounded-md bg-primary text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Envoi en cours…" : "Choisir un fichier"}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold mb-2 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary" /> Utiliser un lien existant
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Colle l'URL d'une image hébergée ailleurs.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://…"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-2 text-sm"
              />
              <button
                onClick={applyManual}
                disabled={!manualUrl.trim()}
                className="px-4 py-2 rounded-md bg-foreground text-background font-bold text-sm hover:opacity-90 disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
