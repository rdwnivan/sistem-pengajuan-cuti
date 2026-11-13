import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { subscriptionSchema, unsubscribeSchema } from "@/lib/push-security";
import { samaAman } from "@/lib/aman-sama";
import { Prisma } from "@prisma/client";

async function bodyJson(req: Request): Promise<unknown> {
  try {
    const reader = req.body?.getReader();
    if (!reader) return undefined;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return undefined; }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  catch { return undefined; } // The caller returns an explicit 400 validation response.
}

export async function GET() {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}

export async function POST(req: Request) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await bodyJson(req));
  if (!parsed.success) {
    return Response.json({ error: "Payload push tidak valid" }, { status: 400 });
  }
  const body = parsed.data;
  // Shared-device relinking requires the same browser subscription secret.
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: body.endpoint } });
  if (existing && existing.userId !== user.id && (!samaAman(existing.auth, body.keys.auth) || !samaAman(existing.p256dh, body.keys.p256dh))) {
    return Response.json({ error: "Subscription sudah terdaftar pada perangkat lain" }, { status: 409 });
  }

  // Repeat the ownership condition atomically: another registration can race the read.
  const updated = await prisma.pushSubscription.updateMany({
    where: { endpoint: body.endpoint, OR: [{ userId: user.id }, { p256dh: body.keys.p256dh, auth: body.keys.auth }] },
    data: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  if (!updated.count) {
    try {
      await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: body.endpoint, ...body.keys } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Subscription sudah terdaftar. Coba lagi dari perangkat yang sama." }, { status: 409 });
      throw error;
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await userDariSesi();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = unsubscribeSchema.safeParse(await bodyJson(req));
  if (!parsed.success) {
    return Response.json({ error: "Endpoint tidak valid" }, { status: 400 });
  }
  const body = parsed.data;

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: user.id },
  });

  return Response.json({ ok: true });
}
