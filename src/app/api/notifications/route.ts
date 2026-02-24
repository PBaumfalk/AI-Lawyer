import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUnreadNotifications,
  getNotificationsSince,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
} from "@/lib/notifications/service";

/**
 * GET /api/notifications
 *
 * Query params:
 * - `since` (ISO timestamp): return notifications created after this time (catch-up)
 * - `limit` (number, default 50): max notifications to return
 *
 * Returns: { notifications, unreadCount }
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const userId = session.user.id;

  const [notifications, unreadCount] = await Promise.all([
    since
      ? getNotificationsSince(userId, new Date(since))
      : getUnreadNotifications(userId, limit),
    getUnreadCount(userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

/**
 * PATCH /api/notifications
 *
 * Body: { action: "read" | "readAll" | "dismiss", notificationId?: string }
 *
 * - "read" + notificationId: mark single notification as read
 * - "readAll": mark all notifications as read
 * - "dismiss" + notificationId: dismiss single notification
 *
 * Returns: { unreadCount }
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  let body: { action: string; notificationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const { action, notificationId } = body;

  switch (action) {
    case "read":
      if (!notificationId) {
        return NextResponse.json(
          { error: "notificationId ist erforderlich" },
          { status: 400 }
        );
      }
      await markAsRead(notificationId, userId);
      break;

    case "readAll":
      await markAllAsRead(userId);
      break;

    case "dismiss":
      if (!notificationId) {
        return NextResponse.json(
          { error: "notificationId ist erforderlich" },
          { status: 400 }
        );
      }
      await dismissNotification(notificationId, userId);
      break;

    default:
      return NextResponse.json(
        { error: `Unbekannte Aktion: ${action}` },
        { status: 400 }
      );
  }

  const unreadCount = await getUnreadCount(userId);
  return NextResponse.json({ unreadCount });
}
