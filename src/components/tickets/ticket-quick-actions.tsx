"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/select";

interface UserOption {
  id: string;
  name: string | null;
}

interface TicketStatusSelectProps {
  ticketId: string;
  currentStatus: string;
}

export function TicketStatusSelect({ ticketId, currentStatus }: TicketStatusSelectProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Select
      value={currentStatus}
      onChange={handleChange}
      disabled={loading}
      className="w-36 text-xs py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <option value="OFFEN">Offen</option>
      <option value="IN_BEARBEITUNG">In Bearbeitung</option>
      <option value="ERLEDIGT">Erledigt</option>
    </Select>
  );
}

interface TicketVerantwortlichSelectProps {
  ticketId: string;
  currentUserId: string | null;
  users: UserOption[];
}

export function TicketVerantwortlichSelect({
  ticketId,
  currentUserId,
  users,
}: TicketVerantwortlichSelectProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newUserId = e.target.value || null;
    if (newUserId === currentUserId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verantwortlichId: newUserId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Select
      value={currentUserId ?? ""}
      onChange={handleChange}
      disabled={loading}
      className="w-36 text-xs py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">– Niemand –</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name ?? u.id}
        </option>
      ))}
    </Select>
  );
}
