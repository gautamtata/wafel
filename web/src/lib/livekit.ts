import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { log } from "@/lib/log";

export const AGENT_NAME = "wafel-tutor";
export const LEARNER_IDENTITY = "learner";

const ROOM_PREFIX = "wafel-";
const EMPTY_TIMEOUT_SEC = 300;
const MAX_PARTICIPANTS = 2;
const TOKEN_TTL = "30m";

export type SessionRoom = { roomName: string; token: string; url: string };

export const roomNameFor = (sessionId: string) => `${ROOM_PREFIX}${sessionId}`;

function requireEnv(name: "LIVEKIT_URL" | "LIVEKIT_API_KEY" | "LIVEKIT_API_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function credentials() {
  return {
    url: requireEnv("LIVEKIT_URL"),
    apiKey: requireEnv("LIVEKIT_API_KEY"),
    apiSecret: requireEnv("LIVEKIT_API_SECRET"),
  };
}

export async function createSessionRoom(sessionId: string): Promise<SessionRoom> {
  const { url, apiKey, apiSecret } = credentials();
  const roomName = roomNameFor(sessionId);

  const rooms = new RoomServiceClient(url, apiKey, apiSecret);
  await rooms.createRoom({
    name: roomName,
    emptyTimeout: EMPTY_TIMEOUT_SEC,
    maxParticipants: MAX_PARTICIPANTS,
  });

  try {
    const dispatches = new AgentDispatchClient(url, apiKey, apiSecret);
    await dispatches.createDispatch(roomName, AGENT_NAME, {
      metadata: JSON.stringify({ sessionId }),
    });

    const token = new AccessToken(apiKey, apiSecret, { identity: LEARNER_IDENTITY, ttl: TOKEN_TTL });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return { roomName, token: await token.toJwt(), url };
  } catch (error) {
    await rooms.deleteRoom(roomName).catch((cleanupError: unknown) => {
      log.warn(`could not delete room ${roomName} after setup failure`, cleanupError);
    });
    throw error;
  }
}
