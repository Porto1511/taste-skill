import { getViewer } from "@/server/auth/viewer";
import { cardInput, uploadCard } from "@/server/files/cards";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

/** File a card or ticket on someone's profile (their boss or the MSW office). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  const parsed = cardInput.safeParse({
    userId: form.get("userId"), cardType: form.get("cardType"),
    cardNumber: form.get("cardNumber") || undefined, expiresOn: form.get("expiresOn") || undefined,
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const file = await fileFrom(form.get("file"));
  if (!file) return Response.json({ error: "Take a photo of the card or choose a PDF." }, { status: 422 });
  try {
    return Response.json(await uploadCard(viewer, parsed.data, file), { status: 201 });
  } catch (err) {
    return jsonError(err, "api.cards.upload");
  }
}
