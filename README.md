# NamedSQL
Parameterized SQL queries for NodeJS.


## Connecting to a database

```ts
const db = new Database({ url: /* actual connection URI from env. */ })
assert(await db.ping())
```


## Defining the models

```sql
-- Up Migration
create table
  users (
    user_id uuid primary key
    , email text not null
    , password text not null
    , role user_role not null default 'user'
    , is_active boolean not null default true
    , created_at timestamp not null default now()
    , deleted_at timestamp null
    , constraint user_email_unique unique (email)
    , constraint user_role_enum check (role in ('ADMIN', 'CUSTOMER'))
  )

-- Down Migration
drop table users;
```

**Note**: `node-pg-migrate` can be used to define and run SQL migrations.

```ts
import z from "zod"

const UserEntitySchema = z.object({
    user_id: z.uuid(),
    email: z.email(),
    password: z.string(),
    role: z.enum(["ADMIN", "CUSTOMER"]),
    is_active: z.boolean(),
    created_at: z.date(),
    deleted_at: z.date().nullable(),
})

type UserEntity = z.infer<typeof UserEntitySchema>
```

**Note**: Optional table columns must be defined as nullable (and NOT optional).


## Defining a Repository

```ts
import { DatabaseError } from "pg"

class UserRepo {
    handleConstraintViolations(err: unknown) {
        if (err instanceof DatabaseError) {
            switch (err.constraint) {
                case "user_email_unique":
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
```

## Performing transactions

```ts
const userRepo = new UserRepo()
const users: UserEntity[] = [
    {
        user_id: crypto.randomUUID().toString(),
        email: "admin-two@site.com",
        password: "my-strong-hashed-password",
        role: "ADMIN",
        is_active: true,
        created_at: new Date(),
        deleted_at: null,
    },
    {
        user_id: crypto.randomUUID().toString(),
        email: "user-three@site.com",
        password: "my-strong-hashed-password",
        role: "CUSTOMER",
        is_active: true,
        created_at: new Date(),
        deleted_at: null,
    },
]

await db.transaction(async (tx) => {
    for (const u of users) {
        await userRepo.createUser(tx, u)
    }
})
```


## Scripts

```bash
# start the application
$ npm start

# run the tests (using native NodeJS test runner)
$ npm test

# perform linting (using Eslint) and type checking (using TSC)
$ npm run check

# format code (using prettier)
$ npm run fmt
```
