import assert from 'node:assert/strict'
import { findCorrelations } from '../src/engine/correlate.js'
import { buildReport } from '../src/engine/report.js'
import { encryptToVault, decryptFromVault } from '../src/utils/crypto.js'
import { normalizeValue, nodeIdOf, edgeLabelFor } from '../src/utils/kinds.js'
import { md5 } from '../src/utils/md5.js'
import { parseCdx } from '../src/api/wayback.js'
import { nextMoves } from '../src/engine/nextmoves.js'
import { collectEvents } from '../src/engine/timeline.js'

let passed = 0
function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`)
    process.exitCode = 1
  }
}

function node(kind, label, evidence = []) {
  return { id: nodeIdOf(kind, label), type: 'entity', position: { x: 0, y: 0 }, data: { kind, label, notes: '', evidence } }
}

const ev = (source, detail) => ({ at: Date.now(), source, detail })

console.log('\n[1] normalizeValue / nodeIdOf')
check('strips protocol, www, paths from domains', () => {
  assert.equal(normalizeValue('domain', 'https://www.Example.com/path?q=1'), 'example.com')
})
check('strips @ and wildcards', () => {
  assert.equal(normalizeValue('username', '@JaneDoe'), 'janedoe')
  assert.equal(normalizeValue('subdomain', '*.API.Example.com.'), 'api.example.com')
})
check('deterministic ids dedupe entities', () => {
  assert.equal(nodeIdOf('email', ' A@B.com '), 'email:a@b.com')
})

console.log('\n[2] correlation rules')
{
  const nodes = [
    node('domain', 'example.com'),
    node('subdomain', 'api.example.com'),
    node('ip', '93.184.216.34'),
    node('email', 'jdoe@example.com'),
    node('username', 'jdoe'),
    node('account', 'github/jdoe'),
    node('nameserver', 'ns1.example.com'),
  ]
  const edges = [
    { id: 'e1', source: 'domain:example.com', target: 'subdomain:api.example.com' },
    { id: 'e2', source: 'domain:example.com', target: 'ip:93.184.216.34' },
    { id: 'e3', source: 'subdomain:api.example.com', target: 'ip:93.184.216.34' },
    { id: 'e4', source: 'domain:example.com', target: 'nameserver:ns1.example.com' },
  ]

  check('email domain matches domain node (high)', () => {
    const s = findCorrelations(nodes, edges)
    assert.ok(
      s.some((x) => x.aId === 'email:jdoe@example.com' && x.bId === 'domain:example.com' && x.confidence === 'high'),
      `got: ${JSON.stringify(s)}`
    )
  })
  check('account handle equals username (high)', () => {
    const s = findCorrelations(nodes, edges)
    assert.ok(
      s.some((x) => x.aId === 'username:jdoe' && x.bId === 'account:github/jdoe' && x.confidence === 'high')
    )
  })
  check('no duplicate pair suggestions', () => {
    const s = findCorrelations(nodes, edges)
    const keys = s.map((x) => [x.aId, x.bId].sort().join('|'))
    assert.equal(new Set(keys).size, keys.length)
  })
  check('existing edges are never re-suggested', () => {
    const s = findCorrelations(nodes, edges)
    assert.ok(!s.some((x) => x.aId === 'domain:example.com' && x.bId === 'subdomain:api.example.com'))
  })

  const nodes2 = [
    node('domain', 'foo.org'),
    node('domain', 'bar.net'),
    node('ip', '10.0.0.1'),
  ]
  const edges2 = [
    { id: 'a', source: 'domain:foo.org', target: 'ip:10.0.0.1' },
    { id: 'b', source: 'domain:bar.net', target: 'ip:10.0.0.1' },
  ]
  check('shared IP links two domains (medium)', () => {
    const s = findCorrelations(nodes2, edges2)
    assert.ok(s.some((x) => x.confidence === 'medium' && x.reason.includes('same IP')))
  })
}

console.log('\n[3] report builder')
{
  const nodes = [
    node('domain', 'example.com', [ev('WHOIS · RDAP', 'Registered: 1995-08-27')]),
    node('note', 'suspected operator', [ev('Operator input', '')]),
  ]
  nodes[1].data.notes = 'pivot next via breach data'
  const edges = [
    {
      id: 'x1',
      source: 'domain:example.com',
      target: 'note:suspected operator',
      data: { correlation: true, reason: '[high] test link' },
    },
  ]
  const log = [{ at: Date.now(), level: 'ok', text: 'DNS records: done — 4 linked finding(s)' }]
  const base = { caseName: 'Test Case', nodes, edges, log, aiNarrative: 'AI says hello.' }

  check('analyst report has exec summary + evidence + correlations', () => {
    const md = buildReport(base, 'analyst')
    for (const part of ['OSINT Intelligence Report — Test Case', 'AI says hello.', 'Registered: 1995-08-27', 'Correlated Relationships', '⇄']) {
      assert.ok(md.includes(part), `missing: ${part}`)
    }
  })
  check('ctf writeup has methodology + findings', () => {
    const md = buildReport(base, 'ctf')
    for (const part of ['CTF Writeup', 'Methodology', 'Intelligence Gathered']) {
      assert.ok(md.includes(part), `missing: ${part}`)
    }
  })
}

console.log('\n[4] md5 (gravatar hashing)')
check('rfc 1321 vectors', () => {
  assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e')
  assert.equal(md5('a'), '0cc175b9c0f1b6a831c399e269772661')
  assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72')
  assert.equal(md5('hello'), '5d41402abc4b2a76b9719d911017c592')
  assert.equal(
    md5('The quick brown fox jumps over the lazy dog'),
    '9e107d9d372bb6826bd81d3542a419d6'
  )
})
check('utf-8 multibyte input', () => {
  assert.equal(md5(String.fromCharCode(0x71, 0xe9)), '39aa48b0078cac1a8e3100a108113b81')
})

console.log('\n[5] wayback CDX parsing')
check('parses hosts, strips header row and www', () => {
  const rows = [
    ['original', 'timestamp'],
    ['https://www.example.com/page', '20200101'],
    ['https://api.example.com/v1', '20210101'],
    ['https://unrelated.org/x', '20210101'],
    ['not a url', '20210101'],
  ]
  const { hosts, snapshots } = parseCdx(rows, 'example.com')
  assert.deepEqual(hosts.sort(), ['api.example.com', 'example.com'])
  assert.equal(snapshots, 2)
})
check('handles headerless arrays and junk', () => {
  assert.deepEqual(parseCdx(null, 'x.com'), { hosts: [], snapshots: 0 })
  assert.deepEqual(parseCdx([], 'x.com'), { hosts: [], snapshots: 0 })
})

console.log('\n[6] next-moves rules')
{
  const bareDomain = node('domain', 'example.com')
  const emailNode = node('email', 'jdoe@ghost.io')
  const acct = node('account', 'github/jdoe')

  check('bare domain suggests whois/certs/dns/archive', () => {
    const keys = nextMoves([bareDomain]).map((m) => m.module)
    for (const want of ['rdap', 'certs', 'dns', 'wayback']) {
      assert.ok(keys.includes(want), `missing ${want}`)
    }
  })
  check('scanned domain does not repeat suggestions', () => {
    const scanned = node('domain', 'example.com', [
      ev('WHOIS · RDAP', 'Registered: 2020-01-01'),
      ev('DNS-over-HTTPS', 'A ×1'),
      ev('Certificate transparency · crt.sh', '5 unique hostname(s)'),
      ev('Wayback Machine', 'archived URL(s)'),
    ])
    const moves = nextMoves([scanned]).filter((m) => m.nodeId === scanned.id)
    assert.equal(moves.length, 0)
  })
  check('email with unknown domain suggests add-domain + gravatar', () => {
    const moves = nextMoves([emailNode])
    assert.ok(moves.some((m) => m.action === 'add-domain' && m.value === 'ghost.io'))
    assert.ok(moves.some((m) => m.action === 'gravatar'))
  })
  check('account without username hub suggests hub creation', () => {
    const moves = nextMoves([acct])
    assert.ok(moves.some((m) => m.action === 'add-username' && m.value === 'jdoe'))
  })
}

console.log('\n[7] timeline extraction')
check('milestones parsed from evidence details', () => {
  const n = node('domain', 'example.com', [
    ev('WHOIS · RDAP', 'Registered: 1995-08-27'),
    ev('EXIF · GPS', 'Captured: 2019-03-02 14:22 UTC'),
  ])
  const events = collectEvents([n])
  const milestones = events.filter((e) => e.type === 'milestone').map((e) => e.label)
  assert.ok(milestones.some((l) => l.includes('Registered') && l.includes('example.com')))
  assert.ok(milestones.some((l) => l.startsWith('Photo captured')))
  const times = events.map((e) => e.at)
  assert.deepEqual([...times].sort((a, b) => b - a), times)
})

console.log('\n[8] edge relationship labels')
check('domain to ip resolves-to', () => {
  assert.equal(edgeLabelFor('domain', 'ip'), 'resolves-to')
  assert.equal(edgeLabelFor('subdomain', 'ip'), 'resolves-to')
})
check('domain to subdomain subdomain-of', () => {
  assert.equal(edgeLabelFor('domain', 'subdomain'), 'subdomain-of')
})
check('domain delegates nameservers and contacts', () => {
  assert.equal(edgeLabelFor('domain', 'nameserver'), 'delegates-to')
  assert.equal(edgeLabelFor('domain', 'email'), 'registrant-contact')
})
check('username hub found-on account', () => {
  assert.equal(edgeLabelFor('username', 'account'), 'found-on')
})
check('fallback labels are never empty', () => {
  assert.equal(edgeLabelFor('email', 'domain'), 'hosted-at')
  assert.equal(edgeLabelFor('note', 'email'), 'mentions-email')
  assert.equal(edgeLabelFor('note', 'phone'), 'related-to')
})

console.log('\n[9] encrypted vault roundtrip')
;(async () => {
  const secret = { format: 'zero-trace-case', caseName: 'classified', nodes: [{ id: 'n1' }] }
  const vault = await encryptToVault(secret, 'correct horse battery')

  check('vault structure is well-formed', () => {
    assert.equal(vault.format, 'ztvault')
    assert.equal(vault.kdf, 'PBKDF2-SHA256-250000')
    assert.ok(vault.salt.length > 20 && vault.iv.length > 15 && vault.data.length > 10)
  })
  const round = await decryptFromVault(vault, 'correct horse battery')
  check('decrypts to identical payload', () => {
    assert.deepEqual(round, secret)
  })
  let rejected = false
  try {
    await decryptFromVault(vault, 'wrong password!!')
  } catch {
    rejected = true
  }
  check('wrong password is rejected', () => {
    assert.ok(rejected)
  })

  console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures above)' : ''}`)
})()
