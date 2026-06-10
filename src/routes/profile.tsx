import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGate, PageHeader, gradientFor } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyArtist, slugify, uploadToBucket } from "@/lib/artist-helpers";
import { Dropzone } from "@/components/Dropzone";
import { Camera, Check, Loader2, Sparkles, ExternalLink, Shield, Lock, CreditCard, Wallet } from "lucide-react";
import { avatarOrDefault } from "@/lib/default-avatar";
import { coverOrDefault } from "@/lib/default-cover";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  getArtistFeeStatus,
  createArtistFeePayment,
  payArtistFeeWithWallet,
  ARTIST_FEE_XOF,
} from "@/lib/artist-fee.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile Pro — VinaSound" },
      { name: "description", content: "Edit your artist profile, bio, avatar and cover image." },
    ],
  }),
  component: () => (
    <AuthGate>
      <ProfilePage />
    </AuthGate>
  ),
});

function ProfilePage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();

  const { data: artist, isLoading } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const feeStatusFn = useServerFn(getArtistFeeStatus);
  const createFeePaymentFn = useServerFn(createArtistFeePayment);
  const payFeeWalletFn = useServerFn(payArtistFeeWithWallet);

  const { data: feeStatus, isLoading: loadingFee } = useQuery({
    queryKey: ["artist-fee-status", user?.id],
    enabled: !!user?.id && !artist,
    queryFn: () => feeStatusFn(),
  });

  const [payingFlw, setPayingFlw] = useState(false);
  const [payingWallet, setPayingWallet] = useState(false);
  const [feeErr, setFeeErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (artist) {
      setName(artist.name ?? "");
      setBio(artist.bio ?? "");
      setAvatarPreview(avatarOrDefault(artist.avatar_url, user?.id ?? null));
      setCoverPreview(coverOrDefault(artist.cover_url));
    } else {
      setAvatarPreview(avatarOrDefault(null, user?.id ?? null));
      setCoverPreview(coverOrDefault(null));
    }
  }, [artist, user?.id]);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  async function persistImage(kind: "avatar" | "cover", file: File) {
    if (!user) return;
    setErr(null);
    setSaving(true);
    try {
      const url = await uploadToBucket("covers", user.id, file, kind === "avatar" ? "avatar-" : "cover-");
      if (kind === "avatar") {
        await supabase.from("profiles").upsert({ id: user.id, avatar_url: url }, { onConflict: "id" });
        await supabase.auth.updateUser({ data: { avatar_url: url } });
      }
      if (artist) {
        const patch = kind === "avatar" ? { avatar_url: url } : { cover_url: url };
        const { error } = await supabase.from("artists").update(patch).eq("id", artist.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["my-artist", user.id] });
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
        if (kind === "avatar") setAvatarFile(null);
        else setCoverFile(null);
      }
      // If no artist row yet, keep the local file; Save will create the record with these URLs.
      if (!artist) {
        if (kind === "avatar") (file as any)._uploadedUrl = url;
        else (file as any)._uploadedUrl = url;
      }
    } catch (e: any) {
      setErr(e.message ?? "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!user) return;
    // Block creation of a new artist profile if the 3000 XOF fee is unpaid.
    if (!artist && !feeStatus?.hasPaid) {
      setErr("Tu dois payer les frais de création (3 000 XOF) avant de créer ton profil artiste.");
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      let avatar_url = artist?.avatar_url ?? null;
      let cover_url = artist?.cover_url ?? null;
      if (avatarFile) avatar_url = (avatarFile as any)._uploadedUrl ?? await uploadToBucket("covers", user.id, avatarFile, "avatar-");
      if (coverFile) cover_url = (coverFile as any)._uploadedUrl ?? await uploadToBucket("covers", user.id, coverFile, "cover-");

      if (avatarFile && avatar_url) {
        await supabase.from("profiles").upsert({ id: user.id, avatar_url }, { onConflict: "id" });
        await supabase.auth.updateUser({ data: { avatar_url } });
      }

      if (artist) {
        const { error } = await supabase
          .from("artists")
          .update({ name: name.trim(), bio: bio.trim() || null, avatar_url, cover_url })
          .eq("id", artist.id);
        if (error) throw error;
      } else {
        const baseSlug = slugify(name);
        const slug = `${baseSlug}-${Date.now().toString(36)}`;
        const { error } = await supabase.from("artists").insert({
          user_id: user.id,
          name: name.trim(),
          slug,
          bio: bio.trim() || null,
          avatar_url,
          cover_url,
        });
        if (error) throw error;
      }

      setAvatarFile(null);
      setCoverFile(null);
      qc.invalidateQueries({ queryKey: ["my-artist", user.id] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e: any) {
      setErr(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function payFeeFlutterwave() {
    setFeeErr(null);
    setPayingFlw(true);
    try {
      const res = await createFeePaymentFn();
      if (res.alreadyPaid) {
        qc.invalidateQueries({ queryKey: ["artist-fee-status", user?.id] });
        return;
      }
      if (res.link) window.location.href = res.link;
    } catch (e: any) {
      setFeeErr(e.message ?? "Échec du paiement");
    } finally {
      setPayingFlw(false);
    }
  }

  async function payFeeWallet() {
    setFeeErr(null);
    setPayingWallet(true);
    try {
      await payFeeWalletFn();
      qc.invalidateQueries({ queryKey: ["artist-fee-status", user?.id] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e: any) {
      setFeeErr(e.message ?? "Échec du paiement");
    } finally {
      setPayingWallet(false);
    }
  }

  if (isLoading || (loadingFee && !artist)) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>;
  }

  const needsFee = !artist && !feeStatus?.hasPaid;
  const grad = gradientFor(name || "vinasound");
  const profileAvatar = avatarOrDefault(avatarPreview, user?.id ?? null);

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        accent="Profil"
        title="Pro"
        description="Your public artist identity. Cover image, avatar and bio appear on your artist page."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary/70 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 transition"
              >
                <Shield className="w-4 h-4" /> Panneau Admin
              </Link>
            )}
            {artist && (
              <Link
                to="/artists/$slug"
                params={{ slug: artist.slug }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-surface"
              >
                View public page <ExternalLink className="w-4 h-4" />
              </Link>
            )}
          </div>
        }
      />

      {needsFee && (
        <div className="mb-6 rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-surface/40 to-surface/40 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/15 p-3 shrink-0">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-xl font-extrabold uppercase tracking-tight">
                Frais de création de profil artiste
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pour limiter les comptes inactifs et garantir un stockage de qualité pour
                chaque artiste, la création d'un profil artiste nécessite un paiement unique
                de <span className="font-bold text-foreground">{ARTIST_FEE_XOF.toLocaleString("fr-FR")} XOF</span>.
                Une fois payé, tu pourras créer ton profil et publier ta musique sans limite.
              </p>

              {feeErr && <p className="text-sm text-destructive mt-3">{feeErr}</p>}

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={payFeeFlutterwave}
                  disabled={payingFlw || payingWallet}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60 hover:opacity-90"
                >
                  {payingFlw ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Payer {ARTIST_FEE_XOF.toLocaleString("fr-FR")} XOF
                </button>
                <button
                  onClick={payFeeWallet}
                  disabled={payingWallet || payingFlw}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-bold hover:bg-surface/70 disabled:opacity-60"
                >
                  {payingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  Payer depuis mon wallet
                </button>
                {feeStatus?.pendingLink && (
                  <a
                    href={feeStatus.pendingLink}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/50 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/10"
                  >
                    Reprendre paiement en cours
                  </a>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Paiement sécurisé via CinetPay (Mobile Money, carte, etc.) ou via ton wallet VinaSound.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Cover preview */}
      <div className="rounded-xl overflow-hidden border border-border mb-6">
        <Dropzone accept="image/*" onFiles={(f) => { setCoverFile(f[0]); persistImage("cover", f[0]); }} className="rounded-none border-0">
          <div className="relative h-44 sm:h-56 w-full">
            {coverPreview ? (
              <img src={coverPreview} className="w-full h-full object-cover pointer-events-none" alt="" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${grad} pointer-events-none`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 right-3 inline-flex items-center gap-2 bg-background/90 rounded-full px-3 py-1.5 text-xs font-bold pointer-events-none">
              <Camera className="w-4 h-4" /> {coverFile ? "Cover prête — clique Save" : "Cliquer pour changer la cover"}
            </div>
          </div>
        </Dropzone>
      </div>

      <div className="grid lg:grid-cols-[200px_1fr] gap-6 lg:gap-10 max-w-4xl">
        {/* Avatar */}
        <Dropzone accept="image/*" onFiles={(f) => { setAvatarFile(f[0]); persistImage("avatar", f[0]); }} className="lg:rounded-full">
          <div className="relative aspect-square w-44 lg:w-full mx-auto rounded-full overflow-hidden">
            <img
              key={profileAvatar}
              src={profileAvatar}
              onError={(e) => {
                const img = e.currentTarget;
                const fallback = avatarOrDefault(null, user?.id ?? null);
                if (!img.src.endsWith(fallback)) img.src = fallback;
              }}
              className="w-full h-full object-cover pointer-events-none"
              alt="Avatar"
            />
            <div className="absolute inset-0 grid place-items-center bg-black/30 pointer-events-none">
              <span className="inline-flex items-center gap-2 bg-background/90 rounded-full px-3 py-1.5 text-xs font-bold">
                <Camera className="w-4 h-4" /> {avatarFile ? "Prêt" : "Changer"}
              </span>
            </div>
          </div>
        </Dropzone>

        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Artist name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Your stage name"
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Bio</label>
            <textarea
              rows={6}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={1000}
              placeholder="Tell fans about your sound, influences, and journey…"
              className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">{bio.length}/1000</p>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !name.trim() || needsFee}
              title={needsFee ? "Paie d'abord les frais de création de profil artiste" : undefined}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60 hover:opacity-90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : needsFee ? <Lock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              <span>{artist ? "Save changes" : needsFee ? "Paiement requis" : "Create profile"}</span>
            </button>
            {savedFlash && (
              <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-semibold animate-fade-in">
                <Sparkles className="w-4 h-4" /> <span>Saved</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
