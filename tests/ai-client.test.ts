import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// A fake OpenAI SDK: each test queues the responses the API "returns".
const queue: Array<unknown> = [];
const calls: Array<{ input: Array<{ content: Array<{ text?: string }> }> }> = [];

vi.mock("openai", () => {
  class APIError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  class OpenAI {
    static APIError = APIError;
    responses = {
      parse: async (req: (typeof calls)[number]) => {
        calls.push(req);
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    };
  }
  return { default: OpenAI };
});

const { generateStructured, AIError } = await import("@/lib/ai/client");
const OpenAI = (await import("openai")).default as unknown as { APIError: new (status: number, msg: string) => Error };

const schema = z.object({ answer: z.number().int().min(0) });
const ok = (value: unknown) => ({ output: [{ type: "message", content: [{ type: "output_text" }] }], output_parsed: value });

describe("generateStructured", () => {
  beforeEach(() => {
    queue.length = 0;
    calls.length = 0;
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("returns schema-validated output", async () => {
    queue.push(ok({ answer: 4 }));
    await expect(generateStructured({ name: "t", schema, system: "s", user: "u" })).resolves.toEqual({ answer: 4 });
  });

  it("retries once with the validation problems fed back to the model", async () => {
    queue.push(ok({ answer: -1 }), ok({ answer: 2 }));
    const r = await generateStructured({ name: "t", schema, system: "s", user: "u" });
    expect(r).toEqual({ answer: 2 });
    expect(calls).toHaveLength(2);
    expect(calls[1].input[0].content[0].text).toMatch(/kunde inte användas/);
  });

  it("applies semantic validators too", async () => {
    queue.push(ok({ answer: 3 }), ok({ answer: 3 }));
    await expect(
      generateStructured({ name: "t", schema, system: "s", user: "u", validate: (v) => (v.answer % 2 ? ["måste vara jämnt"] : []) }),
    ).rejects.toMatchObject({ code: "invalid_output", retryable: true });
  });

  it("maps refusals, rate limits and missing configuration to AIError codes", async () => {
    queue.push({ output: [{ type: "message", content: [{ type: "refusal" }] }], output_parsed: null });
    await expect(generateStructured({ name: "t", schema, system: "s", user: "u" })).rejects.toMatchObject({ code: "refusal" });

    queue.push(new OpenAI.APIError(429, "slow down"));
    await expect(generateStructured({ name: "t", schema, system: "s", user: "u" })).rejects.toMatchObject({ code: "rate_limited", retryable: true });

    delete process.env.OPENAI_API_KEY;
    await expect(generateStructured({ name: "t", schema, system: "s", user: "u" })).rejects.toBeInstanceOf(AIError);
  });
});
