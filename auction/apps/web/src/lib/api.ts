const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data as T;
}

export type User = { id: string; username: string; email: string; displayName: string; avatar?: string | null };
export type UserOption = Pick<User, "id" | "username" | "email" | "displayName">;
export type Tournament = { id: string; name: string; slug: string; description?: string | null; createdAt: string };
export type Team = { id: string; name: string; logo: string; captainId?: string | null; captainName?: string | null; logoConfig: { icon: string; primaryColor: string; secondaryColor: string; shape: string } };
export type Player = { id: string; name: string; role: string; age?: number | null; isForeign: boolean; status: string; stats?: Record<string, number> | null };
