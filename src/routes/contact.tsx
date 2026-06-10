import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Mail, MessageSquare, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — VinaSound" },
      { name: "description", content: "Une question, un partenariat ? Écris à l'équipe VinaSound." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Support</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">
          <span className="text-primary">Contactez</span> l'équipe
        </h1>
        <p className="text-muted-foreground max-w-2xl mb-12">
          Une question sur ton compte, un bug, un partenariat artiste ou label : on te répond en moins de 48h.
        </p>

        <div className="grid lg:grid-cols-3 gap-8">
          <aside className="space-y-5 text-sm">
            <Info icon={Mail} label="Email" value="hello@vinasound.app" />
            <Info icon={MessageSquare} label="Support" value="support@vinasound.app" />
            <Info icon={MapPin} label="Adresse" value="Abidjan, Côte d'Ivoire" />
          </aside>

          <form
            onSubmit={(e) => { e.preventDefault(); setSent(true); toast.success("Message envoyé"); }}
            className="lg:col-span-2 bg-surface/40 border border-border rounded-md p-6 space-y-5"
          >
            <Input label="Nom" name="name" required />
            <Input label="Email" name="email" type="email" required />
            <Input label="Sujet" name="subject" required />
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Message</label>
              <textarea rows={6} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button className="bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold hover:opacity-90 disabled:opacity-50" disabled={sent}>
              {sent ? "Message envoyé" : "Envoyer le message"}
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
        <p className="font-bold">{value}</p>
      </div>
    </div>
  );
}

function Input({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</label>
      <input id={name} name={name} type={type} required={required} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );
}
