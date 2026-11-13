/* The one storage interface the screens use. Every call goes to a server function; the browser never
   writes the database. Identity is an invisible anonymous session created on first use. */
import { supabase } from "@/integrations/supabase/client";
import * as fns from "@/server/game.functions";

export type ApiResult = { ok: true; [k: string]: unknown } | { ok: false; error: string };

let identity: Promise<string> | null = null;
export function ensureIdentity(): Promise<string> {
  if (!identity) {
    identity = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user.id;
      const { data: made, error } = await supabase.auth.signInAnonymously();
      if (error || !made.user) {
        identity = null;
        throw new Error("Could not connect. If you run this site, turn on anonymous users in Lovable (More → Users → Settings → Sign-up controls).");
      }
      return made.user.id;
    })();
  }
  return identity;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(fn: any, data?: unknown): Promise<any> {
  try {
    await ensureIdentity();
    return await fn(data === undefined ? undefined : { data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { ok: false, error: message && message.length < 300 ? message : "Connection problem. Check your network and try again." };
  }
}

export const api = {
  hostCreateRoom: (d: { design?: unknown; designId?: string }) => call(fns.hostCreateRoom, d),
  hostReopen: (d: { code: string; recoveryKey: string }) => call(fns.hostReopen, d),
  hostAction: (d: { roomId: string; action: string }) => call(fns.hostAction, d),
  hostMove: (d: { roomId: string; seatId: string; actor: string; takeover?: boolean }) => call(fns.hostMove, d),
  npcTurn: (d: { roomId: string; seq: number }) => call(fns.npcTurn, d),
  submitAudit: (d: { roomId: string; seq: number; text: string }) => call(fns.submitAudit, d),
  hostTag: (d: { roomId: string; seq: number; ballot: number; tag: "strong" | "check" | "anachronism" | null }) => call(fns.hostTag, d),
  hostNote: (d: { roomId: string; round: number; note: string }) => call(fns.hostNote, d),
  getRoom: (d: { roomId: string }) => call(fns.getRoom, d),
  joinRoom: (d: { code: string; nickname: string }) => call(fns.joinRoom, d),
  claimCourt: (d: { roomId: string; actor: string }) => call(fns.claimCourt, d),
  leaveRoom: (d: { roomId: string }) => call(fns.leaveRoom, d),
  submitVote: (d: { roomId: string; seq: number; action?: string; target?: string; why?: string; src?: string; loc?: string; quote?: string; pass?: boolean }) => call(fns.submitVote, d),
  getHistory: (d: { roomId: string; round?: number; actor?: string; target?: string }) => call(fns.getHistory, d),
  getRound: (d: { roomId: string; round: number }) => call(fns.getRound, d),
  aiReading: (d: { roomId: string; logId: string; lensId: string }) => call(fns.aiReading, d),
  listLibrary: () => call(fns.listLibrary),
  submitDesign: (d: { design: unknown; nickname: string; id?: string; editKey?: string }) => call(fns.submitDesign, d),
  mySubmissions: (d: { items: { id: string; editKey: string }[] }) => call(fns.mySubmissions, d),
  withdrawDesign: (d: { id: string; editKey: string }) => call(fns.withdrawDesign, d),
  instructorList: (d: { passcode: string }) => call(fns.instructorList, d),
  instructorReview: (d: { passcode: string; id: string; approve: boolean; note: string; version: number }) => call(fns.instructorReview, d),
  sendFeedback: (d: { designId: string; nickname: string; trap: string; text: string }) => call(fns.sendFeedback, d),
  /* Live updates for one room: realtime changes (row-level security limits these to the host and seated
     players), plus a slow poll as a safety net. Returns an unsubscribe function. */
  subscribeRoom(roomId: string, onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ping = () => { clearTimeout(timer); timer = setTimeout(onChange, 150); };
    const channel = supabase.channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, ping)
      .subscribe();
    const poll = setInterval(onChange, 8000);
    return () => { clearTimeout(timer); clearInterval(poll); void supabase.removeChannel(channel); };
  },
};
export type Api = typeof api;
