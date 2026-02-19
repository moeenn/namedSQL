import { Pool, type PoolClient, type QueryResult } from "pg"
import assert from "node:assert/strict"

interface Stringable {
    toString(): string
}

type NamedArgs = {
    [x: string]: Stringable | Date | null
}

type ParamType = string | null | string[] | number[]

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

// function namedArray(values: ParamType[], offset: number): string {
//     const pieces: string[] = []
//     for (let i = 0; i < values.length; i++) {
//         pieces.push(`$${offset + i}`)
//     }
//
//     return pieces.join(", ")
// }

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

        // if (Array.isArray(paramValue)) {
        //     const replaceValue = namedArray(paramValue, idx)
        //     query = query.replaceAll(`$${param}`, replaceValue)
        //     paramArray.push(...paramValue.map((v) => v.toString()))
        //     idx += paramValue.length
        //     continue
        // }

        query = query.replaceAll(`$${param}`, `$${idx}`)
        if (paramValue === null) {
            paramArray.push(null)
        }

        if (paramValue != null) {
            if (paramValue instanceof Date) {
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

export interface IDatabase {
    query(query: string, values: any[]): Promise<QueryResult<any>>
    namedQuery(query: string, args: NamedArgs): Promise<QueryResult<any>>
}

export class Transaction implements IDatabase {
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

    query(query: string, values: any[]): Promise<QueryResult<any>> {
        return this.#client.query(query, values)
    }

    namedQuery(query: string, args: NamedArgs): Promise<QueryResult<any>> {
        const q = named(query, args)
        return this.#client.query(q.preparedQuery, q.params)
    }
}

export class Database implements IDatabase {
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

    async query(query: string, args: any[]): Promise<QueryResult<any>> {
        return await this.#pool.query(query, args)
    }

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
