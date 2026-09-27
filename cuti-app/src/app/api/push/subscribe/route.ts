import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";

export async function GET() {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}

export async function POST(req: Request) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: "Payload tidak lengkap" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    create: {
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { endpoint?: string };
  if (!body.endpoint) {
    return Response.json({ error: "Endpoint wajib" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: user.id },
  });

  return Response.json({ ok: true });
}
