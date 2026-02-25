import { Pool, type PoolClient, type QueryResult } from "pg"
import assert from "node:assert/strict"

interface Stringable {
    toString(): string
}

type NamedArgs = {
    [x: string]: Stringable | Date | null
}

type ParamType = number | number[] | string | string[] | null

export class NamedQueryResult {
    public readonly preparedQuery: string
    public readonly params: ParamType[]

    constructor(preparedQuery: string, params: ParamType[]) {
        this.preparedQuery = preparedQuery
        this.params = params
    }
}

export class MissingArgumentError extends Error {
    public readonly arg: string

    constructor(arg: string) {
        super("missing sql query argument: " + arg)
        this.arg = arg
    }
}

export function named(query: string, args: NamedArgs): NamedQueryResult {
    const params = [...query.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((match) =>
        match[0].slice(1),
    )

    const paramsSet = new Set(params)
    const paramArray: ParamType[] = []
    let idx = 1

    for (const param of paramsSet) {
        const paramValue = args[param]
        if (paramValue === undefined) {
            throw new MissingArgumentError(param)
        }

        // match against param name - ending with white-space, EOL or special characters.
        // this means if params are similar (e.g. country and country_code) they will
        // be handled properly and not replaced blindly.
        const replacePattern = new RegExp(`\\$${param}(?=\\W|$)`, "g")
        query = query.replaceAll(replacePattern, `$${idx}`)

        if (paramValue === null) {
            paramArray.push(null)
        }

        if (paramValue != null) {
            if (typeof paramValue == "number") {
                paramArray.push(paramValue)
            } else if (paramValue instanceof Date) {
                paramArray.push(paramValue.toISOString())
            } else if (Array.isArray(paramValue)) {
                paramArray.push(paramValue)
            } else {
                paramArray.push(paramValue.toString())
            }
        }

        idx++
    }

    return new NamedQueryResult(query.trim(), paramArray)
}

export interface DbHandle {
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
    query(query: string, values: any[]): Promise<QueryResult<any>>

    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
    namedQuery(query: string, args: NamedArgs): Promise<QueryResult<any>>
}

export class Transaction implements DbHandle {
    #client: PoolClient

    constructor(client: PoolClient) {
        this.#client = client
    }

    async commit() {
        this.#client.query("commit")
    }

    async rollback() {
        this.#client.query("rollback")
    }

    release() {
        this.#client.release()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query(query: string, values: any[]): Promise<QueryResult<any>> {
        return this.#client.query(query, values)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namedQuery(query: string, args: NamedArgs): Promise<QueryResult<any>> {
        const q = named(query, args)
        return this.#client.query(q.preparedQuery, q.params)
    }
}

export class Database implements DbHandle {
    #pool: Pool

    constructor(config: { url: string }) {
        this.#pool = new Pool({
            connectionString: config.url,
        })
    }

    async ping(): Promise<boolean> {
        const result = await this.#pool.query("select 1")
        return result.rowCount == 1
    }

    get conn() {
        assert(this.#pool != null)
        return this.#pool
    }

    // eslint-disable-next-line no-unused-vars
    async transaction(callback: (tx: Transaction) => Promise<void>) {
        const handle = await this.#pool.connect()
        await handle.query("begin")
        const tx = new Transaction(handle)

        try {
            await callback(tx)
            await tx.commit()
        } catch (err) {
            await tx.rollback()
            throw err
        } finally {
            tx.release()
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query(query: string, args: any[]): Promise<QueryResult<any>> {
        return await this.#pool.query(query, args)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async namedQuery(query: string, args: NamedArgs): Promise<QueryResult<any>> {
        const q = named(query, args)
        return await this.#pool.query(q.preparedQuery, q.params)
    }

    async disconnect() {
        await this.#pool.end()
    }
}

export type PaginatedResults<T> = {
    total_count: number
    data: T[]
}
