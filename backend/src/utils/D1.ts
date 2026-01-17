type Env = {
	DB: D1Database;
};

export type CreateEventBody = {
    user_id: number;
    location: number;
    image: string;
};

function getDB(env: unknown): D1Database {
    if (
        typeof env === "object" &&
        env !== null &&
        "DB" in env &&
        (env as any).DB
    ) {
        return (env as any).DB as D1Database;
    }
    throw new Error("env.DB is missing. Check wrangler.toml binding = \"DB\".");
}

export async function handleEvent(
    pathname: string,
	req: Request,
	env: unknown
): Promise<Response | null> {
    if (req.method !== "POST") return null;
    if (pathname !== "/events") return null;

    let body: CreateEventBody
    try {
        body = await req.json()
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON"}), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    if (
        typeof body.user_id !== 'number' ||
        typeof body.location !== 'string' ||
        typeof body.image !== 'string' ||
        body.image.length === 0
    ) {
        return new Response(JSON.stringify({ error: "Invalid body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const now = new Date().toISOString();
    const db = getDB(env);

    const stmt = db.prepare(`
        INSERT INTO events (user_id, location, image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    `).bind(body.user_id, body.location, body.image, now, now);

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