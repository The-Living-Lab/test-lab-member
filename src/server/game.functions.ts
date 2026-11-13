/* Server functions: the only way the browser changes anything. Each one verifies the caller's
   anonymous identity (playerAuth), validates its input, then runs server-only code in game.server.ts.
   NOTE for the Lovable agent: if this TanStack Start version names the input validator `.validator`
   instead of `.inputValidator`, rename it; change nothing else. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { playerAuth } from "./auth";

const server = () => import("./game.server");
const id = z.string().uuid();

export const hostCreateRoom = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ design: z.unknown().optional(), designId: id.optional() }))
  .handler(async ({ data, context }) => (await server()).hostCreateRoom(context, data));

export const hostReopen = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ code: z.string().max(20), recoveryKey: z.string().max(40) }))
  .handler(async ({ data, context }) => (await server()).hostReopen(context, data));

export const hostAction = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, action: z.enum(["start", "reveal", "skip", "lock", "unlock", "end", "close", "ai-on", "ai-off", "balance", "continue", "pause-round", "pause-move", "share-on", "share-off"]) }))
  .handler(async ({ data, context }) => (await server()).hostAction(context, data));

export const hostMove = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, seatId: id, actor: z.string().max(40), takeover: z.boolean().optional() }))
  .handler(async ({ data, context }) => (await server()).hostMove(context, data));

export const npcTurn = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, seq: z.number().int() }))
  .handler(async ({ data, context }) => (await server()).npcTurn(context, data));

export const submitAudit = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, seq: z.number().int().min(0), text: z.string().max(2000) }))
  .handler(async ({ data, context }) => (await server()).submitAudit(context, data));

export const hostTag = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, seq: z.number().int().min(0), ballot: z.number().int().min(0).max(200), tag: z.enum(["strong", "check", "anachronism"]).nullable() }))
  .handler(async ({ data, context }) => (await server()).hostTag(context, data));

export const hostNote = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, round: z.number().int().min(1).max(500), note: z.string().max(2000) }))
  .handler(async ({ data, context }) => (await server()).hostNote(context, data));

export const getRoom = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id }))
  .handler(async ({ data, context }) => (await server()).getRoom(context, data));

export const joinRoom = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ code: z.string().max(20), nickname: z.string().max(60) }))
  .handler(async ({ data, context }) => (await server()).joinRoom(context, data));

export const claimCourt = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, actor: z.string().max(40) }))
  .handler(async ({ data, context }) => (await server()).claimCourt(context, data));

export const leaveRoom = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id }))
  .handler(async ({ data, context }) => (await server()).leaveRoom(context, data));

export const submitVote = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, seq: z.number().int(), action: z.string().max(40).optional(), target: z.string().max(40).optional(), why: z.string().max(600).optional(), src: z.string().max(40).optional(), loc: z.string().max(300).optional(), quote: z.string().max(500).optional(), pass: z.boolean().optional() }))
  .handler(async ({ data, context }) => (await server()).submitVote(context, data));

export const getHistory = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, round: z.number().int().min(1).max(99).optional(), actor: z.string().max(40).optional(), target: z.string().max(40).optional() }))
  .handler(async ({ data, context }) => (await server()).getHistory(context, data));

export const getRound = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, round: z.number().int().min(1).max(99) }))
  .handler(async ({ data, context }) => (await server()).getRound(context, data));

export const aiReading = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ roomId: id, logId: z.string().max(40), lensId: z.string().max(40) }))
  .handler(async ({ data, context }) => (await server()).aiReading(context, data));

export const listLibrary = createServerFn({ method: "POST" }).middleware([playerAuth])
  .handler(async () => (await server()).listLibrary());

export const submitDesign = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ design: z.unknown(), nickname: z.string().max(60), id: id.optional(), editKey: z.string().max(40).optional() }))
  .handler(async ({ data, context }) => (await server()).submitDesign(context, data));

export const mySubmissions = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ items: z.array(z.object({ id, editKey: z.string().max(40) })).max(30) }))
  .handler(async ({ data }) => (await server()).mySubmissions(data));

export const withdrawDesign = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ id, editKey: z.string().max(40) }))
  .handler(async ({ data }) => (await server()).withdrawDesign(data));

export const instructorList = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ passcode: z.string().max(200) }))
  .handler(async ({ data, context }) => (await server()).instructorList(context, data));

export const instructorReview = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ passcode: z.string().max(200), id, approve: z.boolean(), note: z.string().max(4000), version: z.number() }))
  .handler(async ({ data, context }) => (await server()).instructorReview(context, data));

export const sendFeedback = createServerFn({ method: "POST" }).middleware([playerAuth])
  .inputValidator(z.object({ designId: id, nickname: z.string().max(60), trap: z.string().max(2000), text: z.string().max(2000) }))
  .handler(async ({ data, context }) => (await server()).sendFeedback(context, data));
