// Who runs the meeting. Bec is the facilitator every week; the others can step in when she
// is away. To change the list, edit it here: it is matched by Google sign-in email.
export const FACILITATORS = [
  { email: "bec@carrara.is", name: "Bec" },
  { email: "shannon@carrara.is", name: "Shannon" },
];

export const isFacilitatorEmail = (email: string | null | undefined) =>
  !!email && FACILITATORS.some((f) => f.email === email.trim().toLowerCase());

// The name shown to everyone else ("Bec starts the meeting").
export const FACILITATOR_NAME = FACILITATORS[0].name;
