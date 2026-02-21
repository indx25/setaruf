const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const TEST_WEIGHTS = {
  pre_marriage: 0.4,
  disc: 0.2,
  clinical: 0.2,
  '16pf': 0.2
}

function calculateMatch(userTests, otherTests) {
  if (!userTests.length || !otherTests.length) return 50
  let total = 0
  let weightSum = 0
  for (const k of Object.keys(TEST_WEIGHTS)) {
    const w = TEST_WEIGHTS[k]
    const a = userTests.find(t => t.testType === k)
    const b = otherTests.find(t => t.testType === k)
    if (a && b && typeof a.score === 'number' && typeof b.score === 'number') {
      const similarity = 100 - Math.abs(a.score - b.score)
      total += similarity * w
      weightSum += w
    }
  }
  if (weightSum === 0) return 50
  return Math.round(total / weightSum)
}

async function main() {
  const batchArg = process.argv.find(a => a.startsWith('--batch='))
  const batch = Math.min(parseInt(batchArg ? batchArg.split('=')[1] : '500', 10) || 500, 2000)
  let processed = 0
  let updated = 0
  let cursor = null
  while (true) {
    const matches = await prisma.match.findMany({
      take: batch,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: {
        requester: { include: { psychotests: true } },
        target: { include: { psychotests: true } }
      }
    })
    if (!matches.length) break
    for (const m of matches) {
      const before = typeof m.matchPercentage === 'number' ? m.matchPercentage : null
      const after = calculateMatch(m.requester.psychotests || [], m.target.psychotests || [])
      if (before !== after) {
        await prisma.match.update({ where: { id: m.id }, data: { matchPercentage: after } })
        updated++
      }
      processed++
      cursor = m.id
    }
    if (matches.length < batch) break
  }
  console.log(JSON.stringify({ status: 'ok', processed, updated }))
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

