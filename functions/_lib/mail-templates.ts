export type MailContent = { subject: string; text: string };

// French wording comes from the kind: stored titles are ASCII ('Bail 12', an appointment title).
const NOTIFICATION_LABELS: Record<string, string> = {
  lease_ending_soon: 'Bail bientôt à échéance',
  lease_grace: 'Bail échu · à renouveler',
  lease_expired: 'Bail expiré',
  registration_due: 'Enregistrement à faire',
  registration_overdue: 'Enregistrement en retard',
  appointment_reminder: 'Rappel de rendez-vous',
  visit_accepted: 'Votre visite est confirmée',
  visit_declined: 'Demande de visite refusée',
  rental_request: 'Nouvelle demande de location',
  visit_request: 'Nouvelle demande de visite',
};

const APPOINTMENT_KINDS: Record<string, string> = {
  viewing: 'Visite',
  move_in: 'Entrée dans les lieux',
  move_out: 'Sortie des lieux',
  meeting: 'Réunion',
  other: 'Rendez-vous',
};

const FORMATTER = new Intl.DateTimeFormat('fr-TN', {
  timeZone: 'Africa/Tunis',
  dateStyle: 'full',
  timeStyle: 'short',
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : FORMATTER.format(date);
}

/** A relative link needs APP_URL to become clickable; without it the link is left out. */
function absoluteLink(link: string | null, appUrl?: string): string | null {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return appUrl ? `${appUrl.replace(/\/+$/, '')}${link}` : null;
}

export function notificationMail(
  n: { kind: string; title: string; body: string | null; link: string | null },
  appUrl?: string,
): MailContent {
  const label = NOTIFICATION_LABELS[n.kind] ?? 'Notification';
  const link = absoluteLink(n.link, appUrl);
  const lines = ['Bonjour,', '', `${label} : ${n.title}`];
  if (n.body) lines.push('', n.body);
  if (link) lines.push('', `Ouvrir : ${link}`);
  lines.push('', 'Ceci est un message automatique.');
  return { subject: `${label} : ${n.title}`, text: lines.join('\n') };
}

const APPOINTMENT_SUBJECTS = {
  invitation: 'Invitation',
  update: 'Rendez-vous modifié',
  cancellation: 'Rendez-vous annulé',
} as const;

const APPOINTMENT_INTROS = {
  invitation: 'Vous êtes invité(e) au rendez-vous suivant.',
  update: 'Les informations de ce rendez-vous ont changé.',
  cancellation: 'Ce rendez-vous est annulé.',
} as const;

export function appointmentMail(
  kind: 'invitation' | 'update' | 'cancellation',
  a: { title: string; kind: string; startsAt: string; endsAt: string; location: string | null },
): MailContent {
  const lines = [
    'Bonjour,',
    '',
    APPOINTMENT_INTROS[kind],
    '',
    `${APPOINTMENT_KINDS[a.kind] ?? 'Rendez-vous'} : ${a.title}`,
    `Début : ${formatDate(a.startsAt)}`,
    `Fin : ${formatDate(a.endsAt)}`,
  ];
  if (a.location) lines.push(`Lieu : ${a.location}`);
  lines.push('', 'Ceci est un message automatique.');
  return { subject: `${APPOINTMENT_SUBJECTS[kind]} : ${a.title}`, text: lines.join('\n') };
}
