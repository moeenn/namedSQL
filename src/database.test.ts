import test from "node:test"
import assert from "node:assert/strict"
import { MissingArgumentError, named } from "./database.ts"

test("basic scenario", () => {
    const input = `insert into "user" (id, email, password, role, created_at) values ($id, $email, $password, $role, $created_at)`
    const expectedQuery = `insert into "user" (id, email, password, role, created_at) values ($1, $2, $3, $4, $5)`

    const inputParams = {
        id: crypto.randomUUID(),
        email: "admin@site.com",
        password: "1knclskcnlc",
        role: "ADMIN",
        created_at: new Date(),
    }

    const expectedParams = [
        inputParams.id,
        inputParams.email,
        inputParams.password,
        inputParams.role,
        inputParams.created_at.toISOString(),
    ]

    const got = named(input, inputParams)
    assert.equal(got.preparedQuery, expectedQuery)
    assert.deepEqual(got.params, expectedParams)
})

test("repeated params", () => {
    const input = `insert into record (id, name, created_at, updated_at) values ($id, $name, $created_at, $created_at)`
    const expectedQuery = `insert into record (id, name, created_at, updated_at) values ($1, $2, $3, $3)`

    const inputParams = {
        id: 300,
        name: "admin",
        created_at: new Date(),
    }

    const expectedParams = [
        inputParams.id,
        inputParams.name,
        inputParams.created_at.toISOString(),
    ]

    const got = named(input, inputParams)
    assert.equal(got.preparedQuery, expectedQuery)
    assert.deepEqual(got.params, expectedParams)
})

test("missing argument", () => {
    const input = `select * from entity limit $limit offset $offset`
    const inputParms = {
        limit: 20,
    }

    let missingErr: MissingArgumentError | null = null
    try {
        named(input, inputParms)
    } catch (err) {
        assert(err instanceof MissingArgumentError)
        missingErr = err
    }

    assert(missingErr != null)
    assert(missingErr.arg == "offset")
})

class Entity {
    id: number
    fullName: string

    constructor(id: number, fullName: string) {
        this.id = id
        this.fullName = fullName
    }
}

test("camelCase args", () => {
    const inputQuery = `insert into entity (id, full_name) values ($id, $fullName)`
    const expectedQuery = `insert into entity (id, full_name) values ($1, $2)`

    const inputEntity = new Entity(300, "Something Random")
    const expectedParams = [inputEntity.id, inputEntity.fullName]

    const got = named(inputQuery, { ...inputEntity })
    assert.equal(got.preparedQuery, expectedQuery)
    assert.deepEqual(got.params, expectedParams)
})

test("pass array as value", () => {
    const inputQuery = `select * from users where id = any($ids) and role = $role`
    const expectedQuery = `select * from users where id = any($1) and role = $2`
    const expectedParams = [[10, 20, 30, 40], "user"]

    const got = named(inputQuery, { ids: [10, 20, 30, 40], role: "user" })
    assert.equal(got.preparedQuery, expectedQuery)
    assert.deepEqual(got.params, expectedParams)
})

test("type-coersion in sql", () => {
    const inputQuery = `select u.* from users u where ($email::text is null or u.email = $email::text) and ($age::numeric is null or u.age = $age::numeric)`
    const expectedQuery = `select u.* from users u where ($1::text is null or u.email = $1::text) and ($2::numeric is null or u.age = $2::numeric)`
    const expectedParams = ["samaple@site.com", 30]

    const got = named(inputQuery, { email: "samaple@site.com", age: 30 })
    assert.equal(got.preparedQuery, expectedQuery)
    assert.deepEqual(got.params, expectedParams)
})
