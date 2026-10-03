import { beforeEach, describe, expect, it, vi } from "vitest";

const createRoom = vi.fn();
const createDispatch = vi.fn();
const addGrant = vi.fn();
const toJwt = vi.fn(async () => "jwt-token");
const roomClientArgs = vi.fn();
const dispatchClientArgs = vi.fn();
const tokenArgs = vi.fn();

vi.mock("livekit-server-sdk", () => ({
  RoomServiceClient: class {
    constructor(...args: unknown[]) {
      roomClientArgs(...args);
    }
    createRoom = createRoom;
  },
  AgentDispatchClient: class {
    constructor(...args: unknown[]) {
      dispatchClientArgs(...args);
    }
    createDispatch = createDispatch;
  },
  AccessToken: class {
    constructor(...args: unknown[]) {
      tokenArgs(...args);
    }
    addGrant = addGrant;
    toJwt = toJwt;
  },
}));

describe("createSessionRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LIVEKIT_URL", "wss://example.livekit.cloud");
    vi.stubEnv("LIVEKIT_API_KEY", "key");
    vi.stubEnv("LIVEKIT_API_SECRET", "secret");
  });

  it("creates the room, dispatches the tutor agent and mints a learner token", async () => {
    const { AGENT_NAME, createSessionRoom } = await import("@/lib/livekit");
    const result = await createSessionRoom("abc");

    expect(result).toEqual({ roomName: "wafel-abc", token: "jwt-token", url: "wss://example.livekit.cloud" });
    expect(roomClientArgs).toHaveBeenCalledWith("wss://example.livekit.cloud", "key", "secret");
    expect(createRoom).toHaveBeenCalledWith({ name: "wafel-abc", emptyTimeout: 300, maxParticipants: 2 });
    expect(AGENT_NAME).toBe("wafel-tutor");
    expect(createDispatch).toHaveBeenCalledWith("wafel-abc", "wafel-tutor", {
      metadata: JSON.stringify({ sessionId: "abc" }),
    });
    expect(tokenArgs).toHaveBeenCalledWith("key", "secret", { identity: "learner", ttl: "30m" });
    expect(addGrant).toHaveBeenCalledWith({
      room: "wafel-abc",
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
  });

  it("throws when LiveKit env is missing", async () => {
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    const { createSessionRoom } = await import("@/lib/livekit");
    await expect(createSessionRoom("abc")).rejects.toThrow(/LIVEKIT_API_SECRET/);
  });
});
