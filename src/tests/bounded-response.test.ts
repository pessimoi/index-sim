import {
  ResponseBodyTooLargeError,
  readBoundedResponseText
} from "../adapters/browser/bounded-response";

describe("bounded browser response reader", () => {
  it("reads UTF-8 text split across response chunks", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('{"label":"Rune scimitar"}');
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, 12));
          controller.enqueue(bytes.slice(12));
          controller.close();
        }
      })
    );

    await expect(readBoundedResponseText(response, bytes.byteLength)).resolves.toBe(
      '{"label":"Rune scimitar"}'
    );
  });

  it("rejects a declared oversized response before consuming it", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        }
      }),
      { headers: { "Content-Length": "101" } }
    );

    await expect(readBoundedResponseText(response, 100)).rejects.toBeInstanceOf(
      ResponseBodyTooLargeError
    );
    expect(cancelled).toBe(true);
  });

  it("cancels a streamed response as soon as the actual byte limit is exceeded", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(8));
          controller.enqueue(new Uint8Array(8));
        },
        cancel() {
          cancelled = true;
        }
      })
    );

    await expect(readBoundedResponseText(response, 10)).rejects.toBeInstanceOf(
      ResponseBodyTooLargeError
    );
    expect(cancelled).toBe(true);
  });
});
