import { Env } from "../types";

export async function handleEvent(
    userId: number,
    location: string,
    imgKey: string,
	env: Env
): Promise<Response | null> {
    if (
        typeof userId !== 'number' ||
        typeof location !== 'string' ||
        typeof imgKey !== 'string' ||
        imgKey.length === 0
    ) {
        return new Response(JSON.stringify({ error: "Invalid body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const imgURL = `https://pub-b72f7038c8a745e0af4028c7a9575f6a.r2.dev/${imgKey}`
    const now = new Date().toISOString();

    const stmt = env.DB.prepare(`
        INSERT INTO events (user_id, location, image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    `).bind(userId, location, imgURL, now, now);

    try {
        const result = await stmt.run();

        return new Response(
            JSON.stringify({
                ok: true,
                id: result.meta?.last_row_id ?? null,
                created_at: now,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: "Failed to insert event",
                message: error instanceof Error ? error.message : String(error),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
} 