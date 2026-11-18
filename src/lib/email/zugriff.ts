import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

type U = { id: string; role: UserRole };

/** EmailNachricht filter: only mails of mailboxes assigned to the user (ADMIN: all). */
export function emailNachrichtZugriffWhere(user: U): Prisma.EmailNachrichtWhereInput {
  if (user.role === "ADMIN") return {};
  return { emailKonto: { zuweisungen: { some: { userId: user.id } } } };
}

export async function hatKontoZugriff(user: U, kontoId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const z = await prisma.emailKontoZuweisung.findFirst({
    where: { kontoId, userId: user.id },
    select: { id: true },
  });
  return z !== null;
}
