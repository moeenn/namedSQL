import assert from "node:assert/strict"
import { Database, type DbHandle } from "./database.ts"

type DateRange = {
    start: Date,
    end: Date,
}

function* loopWeeks(start: Date, end: Date): Generator<DateRange> {
    const incrementDate = (d: Date, days: number) => {
        const clone = new Date(d)
        clone.setDate(clone.getDate() + days)
        return clone
    }

    let s = new Date(start)
    let e = incrementDate(s, 6)

    while (e.valueOf() <= end.valueOf()) {
        yield { start: s, end: e }
        s = incrementDate(s, 7)
        e = incrementDate(s, 6)
    }
}


type Traffic = {
    listing_id: number
    week_start: Date
    week_end: Date
    our_traffic: number
    market_traffic: number
}

async function addTraffic(db: DbHandle, args: Traffic) {
    const query = `
        insert into listing_weekly_traffic_stats (
            listing_id, week_start, week_end, our_traffic, market_traffic
        )
        values (
            $listing_id, $week_start, $week_end, $our_traffic, $market_traffic
        )
    `

    await db.namedQuery(query, args)
}

function getRandomIntInclusive(min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main(): Promise<void> {
    const db = new Database({
        url: "postgres://devuser:devpass@localhost:5432/dev" /* actual connection URI from env. */,
    })
    assert(await db.ping())
    console.log("-- connection established")

    const listingId = 404763 // 426603, 404763

    let start = new Date("2024-12-29")
    let end = new Date("2027-01-02")

    for (let r of loopWeeks(start, end)) {
        await addTraffic(db, {
            listing_id: listingId,
            week_start: r.start,
            week_end: r.end,
            our_traffic: getRandomIntInclusive(0, 5000),
            market_traffic: getRandomIntInclusive(0, 5000),
        })
    }

    await db.disconnect()
    console.log("-- closing connection")
}

main()
