import assert from "node:assert/strict"
import z from "zod"
import { Database, type DbHandle } from "./database.ts"

const PlayerSchema = z.object({
    player_id: z.number(),
    name: z.string(),
    score: z.number(),
})

type Player = z.infer<typeof PlayerSchema>

class PlayerRepo {
    #findPlayersQuery = `
        select p.* from players p
        where p.player_id = any($ids)
    `

    async findPlayers(db: DbHandle, ids: number[]): Promise<Player[]> {
        const result = await db.namedQuery(this.#findPlayersQuery, { ids })
        return Promise.all(result.rows.map((row) => PlayerSchema.parseAsync(row)))
    }
}

async function main(): Promise<void> {
    const db = new Database({
        url: "postgres://devuser:devpass@localhost:5432/dev" /* actual connection URI from env. */,
    })
    assert(await db.ping())
    console.log("-- connection established")

    const playerRepo = new PlayerRepo()
    const players = await playerRepo.findPlayers(db, [3, 4, 5])
    for (const p of players) {
        console.log(p)
    }

    await db.disconnect()
    console.log("-- closing connection")
}

main()
