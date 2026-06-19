// Diffusion multi-canal d'un rapport validé à la Direction : notification in-app + email.
// Le ciblage est SCOPÉ PAR SPA via la table direction_spa_access (source de vérité du
// périmètre Direction, cf. src/hooks/useDirectionData.ts). Volontairement générique :
// aucune logique métier Sanagua hardcodée hors libellés i18n — réutilisable (Polypus).
//
// Config requise (secrets Supabase) :
//   - BREVO_API_KEY      : clé API Brevo (Brevo → SMTP & API → API Keys)
//   - BREVO_SENDER_EMAIL : adresse expéditrice vérifiée dans Brevo (Senders, Domains & Dedicated IPs)
//   - BREVO_SENDER_NAME  : (optionnel) nom affiché, défaut "Sanagua OMS"
// Si BREVO_API_KEY ou BREVO_SENDER_EMAIL manque, l'email est silencieusement ignoré
// (la notif in-app part quand même).

import { createClient } from "jsr:@supabase/supabase-js@2";

type Admin = ReturnType<typeof createClient>;

// URL de base de l'app (même valeur que src/pages/ForgotPassword.tsx).
const APP_BASE_URL = "https://spa-flow-pilot.lovable.app";

type Lang = "fr" | "en" | "es";
const SUPPORTED: Lang[] = ["fr", "en", "es"];
function normLang(l: unknown): Lang {
  return SUPPORTED.includes(l as Lang) ? (l as Lang) : "fr";
}

type Cycle = "weekly" | "monthly";

export interface ReportLike {
  id: string;
  spa_id: string;
  cycle_type: string;
  cycle_label: string | null;
}

interface Recipient {
  id: string;
  email: string;
  language: Lang;
}

interface Copy {
  subject: (cycle: Cycle, spa: string, label: string) => string;
  greeting: string;
  intro: (cycle: Cycle, spa: string, label: string) => string;
  summaryHeading: string;
  cta: string;
  footer: string;
  notifTitle: string;
  notifBody: (cycle: Cycle, spa: string, label: string) => string;
}

const COPY: Record<Lang, Copy> = {
  fr: {
    subject: (c, spa, label) =>
      `Rapport ${c === "monthly" ? "mensuel" : "hebdomadaire"} validé — ${spa} (${label})`,
    greeting: "Bonjour,",
    intro: (c, spa, label) =>
      `Le rapport ${c === "monthly" ? "mensuel" : "hebdomadaire"} « ${label} » du spa ${spa} vient d'être validé et diffusé à la Direction.`,
    summaryHeading: "Synthèse",
    cta: "Consulter le rapport",
    footer: "Email envoyé automatiquement par SPA OMS.",
    notifTitle: "Nouveau rapport disponible",
    notifBody: (c, spa, label) =>
      `Le rapport ${c === "monthly" ? "mensuel" : "hebdomadaire"} « ${label} » de ${spa} a été validé.`,
  },
  en: {
    subject: (c, spa, label) =>
      `${c === "monthly" ? "Monthly" : "Weekly"} report validated — ${spa} (${label})`,
    greeting: "Hello,",
    intro: (c, spa, label) =>
      `The ${c === "monthly" ? "monthly" : "weekly"} report "${label}" for ${spa} has just been validated and shared with the Direction.`,
    summaryHeading: "Summary",
    cta: "View report",
    footer: "Email sent automatically by SPA OMS.",
    notifTitle: "New report available",
    notifBody: (c, spa, label) =>
      `The ${c === "monthly" ? "monthly" : "weekly"} report "${label}" for ${spa} has been validated.`,
  },
  es: {
    subject: (c, spa, label) =>
      `Informe ${c === "monthly" ? "mensual" : "semanal"} validado — ${spa} (${label})`,
    greeting: "Hola,",
    intro: (c, spa, label) =>
      `El informe ${c === "monthly" ? "mensual" : "semanal"} «${label}» del spa ${spa} acaba de ser validado y enviado a la Dirección.`,
    summaryHeading: "Resumen",
    cta: "Ver el informe",
    footer: "Correo enviado automáticamente por SPA OMS.",
    notifTitle: "Nuevo informe disponible",
    notifBody: (c, spa, label) =>
      `El informe ${c === "monthly" ? "mensual" : "semanal"} «${label}» de ${spa} ha sido validado.`,
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(
  c: Copy,
  cycle: Cycle,
  spa: string,
  label: string,
  summary: string | null,
  link: string,
): string {
  const summaryBlock = summary?.trim()
    ? `<h3 style="font-size:15px;color:#0f766e;margin:24px 0 8px;">${c.summaryHeading}</h3>
       <p style="font-size:14px;line-height:1.6;color:#334155;margin:0;">${escapeHtml(summary).replace(/\n/g, "<br/>")}</p>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:15px;color:#0f172a;margin:0 0 12px;">${c.greeting}</p>
      <p style="font-size:15px;line-height:1.6;color:#334155;margin:0;">${c.intro(cycle, escapeHtml(spa), escapeHtml(label))}</p>
      ${summaryBlock}
      <p style="margin:28px 0 8px;">
        <a href="${link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${c.cta}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 12px;"/>
      <p style="font-size:12px;color:#94a3b8;margin:0;">${c.footer}</p>
    </div>
  </body>
</html>`;
}

async function getDirectionRecipients(admin: Admin, spaId: string): Promise<Recipient[]> {
  const { data: access, error } = await admin
    .from("direction_spa_access")
    .select("user_id")
    .eq("spa_id", spaId);
  if (error) {
    console.error("[notify] direction_spa_access query failed", error);
    return [];
  }
  const ids = new Set((access ?? []).map((r: { user_id: string }) => r.user_id));
  if (ids.size === 0) return [];

  // listUsers() renvoie max 50 users/page — suffisant à l'échelle Direction.
  const { data: { users } } = await admin.auth.admin.listUsers();
  return (users ?? [])
    .filter((u) => ids.has(u.id) && u.app_metadata?.role === "direction" && !!u.email)
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      language: normLang(u.app_metadata?.language),
    }));
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") ?? "Sanagua OMS";
  if (!apiKey || !senderEmail) {
    console.warn("[email] BREVO_API_KEY / BREVO_SENDER_EMAIL absent — envoi ignoré");
    return;
  }
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!resp.ok) {
    console.error("[email] Brevo error", resp.status, await resp.text());
  }
}

/**
 * Diffuse un rapport validé à la Direction scopée sur le spa du rapport :
 * insère une notification in-app + envoie un email (lien + synthèse) par destinataire.
 * Entièrement non bloquant : toute erreur est logguée mais n'interrompt jamais l'appelant.
 */
export async function notifyDirectionReportValidated(
  admin: Admin,
  report: ReportLike,
  summaryText: string | null,
): Promise<void> {
  const recipients = await getDirectionRecipients(admin, report.spa_id);
  if (recipients.length === 0) return;

  const { data: spa } = await admin
    .from("spas")
    .select("name")
    .eq("id", report.spa_id)
    .maybeSingle();
  const spaName = (spa as { name?: string } | null)?.name ?? "Spa";
  const cycle: Cycle = report.cycle_type === "monthly" ? "monthly" : "weekly";
  const label = report.cycle_label ?? "";
  const link = `${APP_BASE_URL}/direction/spa/${report.spa_id}`;
  const now = new Date().toISOString();

  // Notifications in-app (batch).
  const notifRows = recipients.map((r) => {
    const c = COPY[r.language];
    return {
      user_id: r.id,
      title: c.notifTitle,
      body: c.notifBody(cycle, spaName, label),
      type: "synthesis_ready",
      language: r.language,
      report_id: report.id,
      spa_id: report.spa_id,
      is_read: false,
      created_at: now,
    };
  });
  const { error: notifErr } = await admin.from("notifications").insert(notifRows);
  if (notifErr) console.error("[notify] in-app insert failed", notifErr);

  // Emails (un par destinataire → langue + adresse propres).
  await Promise.all(
    recipients.map(async (r) => {
      const c = COPY[r.language];
      const subject = c.subject(cycle, spaName, label);
      const html = buildHtml(c, cycle, spaName, label, summaryText, link);
      try {
        await sendEmail(r.email, subject, html);
      } catch (e) {
        console.error("[email] send failed", r.email, e);
      }
    }),
  );
}
