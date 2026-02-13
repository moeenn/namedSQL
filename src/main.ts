import assert from "node:assert/strict"
import z from "zod"
import { DatabaseError } from "pg"
import { Database, type IDatabase } from "./database.ts"

const UserEntitySchema = z.object({
    user_id: z.uuid(),
    email: z.email(),
    password: z.string(),
    role: z.enum(["ADMIN", "CUSTOMER"]),
    isActive: z.boolean(),
    created_at: z.date(),
    deleted_at: z.date().nullable(),
})

type UserEntity = z.infer<typeof UserEntitySchema>

class UserRepo {
    handleConstraintViolations(err: unknown) {
        if (err instanceof DatabaseError) {
            switch (err.constraint) {
                case "email_unique":
                    throw new Error("email address already in use")
            }
        }

        throw err
    }

    #createUserQuery = `
        insert into users (user_id, email, password, role, is_active, created_at)
        values ($user_id, $email, $password, $role, $is_active, $created_at)
    `

    async createUser(db: IDatabase, user: UserEntity): Promise<void> {
        try {
            await db.namedQuery(this.#createUserQuery, user)
        } catch (err) {
            this.handleConstraintViolations(err)
        }
    }

    #findByIdQuery = `
        select * from users
        where user_id = $user_id
        limit 1
    `

    async findById(db: IDatabase, id: string): Promise<UserEntity | undefined> {
        const result = await db.namedQuery(this.#findByIdQuery, { id })
        if (result.rowCount === 0) return
        return UserEntitySchema.parse(result.rows[0])
    }

    #updateUserQuery = `
        update users
        set email = $email,
            password = $password,
            role = $role,
            is_active = $is_active,
            created_at = $created_at,
            deleted_at = $deleted_at
        where id = $user_id
    `

    async updateUser(db: IDatabase, user: UserEntity): Promise<void> {
        try {
            await db.namedQuery(this.#updateUserQuery, user)
        } catch (err) {
            this.handleConstraintViolations(err)
        }
    }

    #deleteUserQuery = `
        delete from users
        where user_id = $user_id
    `

    async deleteUser(db: IDatabase, id: string) {
        await db.namedQuery(this.#deleteUserQuery, { id })
    }
}

async function main(): Promise<void> {
    const db = new Database({ url: "" /* actual connection URI from env. */ })
    assert(await db.ping())
    console.log("-- connection established")

    const userRepo = new UserRepo()
    const users: UserEntity[] = [
        {
            user_id: crypto.randomUUID().toString(),
            email: "admin-two@site.com",
            password: "my-strong-hashed-password",
            role: "ADMIN",
            isActive: true,
            created_at: new Date(),
            deleted_at: null,
        },
        {
            user_id: crypto.randomUUID().toString(),
            email: "user-three@site.com",
            password: "my-strong-hashed-password",
            role: "CUSTOMER",
            isActive: true,
            created_at: new Date(),
            deleted_at: null,
        },
    ]

    await db.transaction(async (tx) => {
        for (const u of users) {
            await userRepo.createUser(tx, u)
        }
    })
}

main()
