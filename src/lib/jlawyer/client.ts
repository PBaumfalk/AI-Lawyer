import type {
  JLawyerCredentials,
  JLawyerCase,
  JLawyerContact,
  JLawyerParticipant,
  JLawyerDocument,
  JLawyerCalendarEntry,
} from "./types";

export class JLawyerClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(credentials: JLawyerCredentials) {
    this.baseUrl = credentials.baseUrl.replace(/\/$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(
        `${credentials.username}:${credentials.password}`,
      ).toString("base64");
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
      // No cache -- always fetch fresh data during migration
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `J-Lawyer API error ${res.status} at ${path}: ${await res.text()}`,
      );
    }
    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.get("/j-lawyer/api/v2/cases/list?max=1");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async listCases(): Promise<JLawyerCase[]> {
    return this.get<JLawyerCase[]>("/j-lawyer/api/v2/cases/list");
  }

  async getCase(id: string): Promise<JLawyerCase> {
    return this.get<JLawyerCase>(`/j-lawyer/api/v2/cases/${id}`);
  }

  async getCaseParticipants(caseId: string): Promise<JLawyerParticipant[]> {
    return this.get<JLawyerParticipant[]>(
      `/j-lawyer/api/v2/cases/${caseId}/contacts`,
    );
  }

  async listContacts(): Promise<JLawyerContact[]> {
    return this.get<JLawyerContact[]>("/j-lawyer/api/v2/contacts/list");
  }

  async getCaseDocuments(caseId: string): Promise<JLawyerDocument[]> {
    return this.get<JLawyerDocument[]>(
      `/j-lawyer/api/v2/cases/${caseId}/documents`,
    );
  }

  async downloadDocument(
    caseId: string,
    docId: string,
  ): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/j-lawyer/api/v2/cases/${caseId}/documents/${docId}`;
    const res = await fetch(url, {
      headers: { Authorization: this.authHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Document download error ${res.status}: ${docId}`);
    }
    return res.arrayBuffer();
  }

  async getCaseCalendar(caseId: string): Promise<JLawyerCalendarEntry[]> {
    return this.get<JLawyerCalendarEntry[]>(
      `/j-lawyer/api/v2/cases/${caseId}/calendar`,
    );
  }
}
