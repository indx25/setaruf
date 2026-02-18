import { db } from '../src/lib/db.ts'

async function main() {
  const total = await db.user.count()
  console.log(JSON.stringify({ totalUsers: total }))
  process.exit(0)
}

main()
