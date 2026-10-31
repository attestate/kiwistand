// The figures of the protocol guide (src/pages/guide.mdx), drawn as inline
// SVG. They have no background of their own and take their colours from the
// --kf-* tokens in src/pages/_root.css, which follow the docs' light and dark
// theme. Coordinates are in px of the 720 px wide text column; the figures
// scale down with it.
import type { ReactNode } from 'react'

type Tone = 'a' | 'b' | 'ok' | 'plain' | 'ghost'
type Pt = readonly [number, number]
type Mark = 'ok' | 'bad'

// ---------------------------------------------------------------------------
// Primitives

function Figure(props: {
  id: string
  caption: ReactNode
  label: string
  width: number
  height: number
  children: ReactNode
}) {
  const { id, caption, label, width, height, children } = props
  return (
    <figure id={id} className="kiwi-figure">
      <svg
        className="kf"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={label}
        // On phones, wide figures keep a legible size and scroll sideways.
        style={{ maxWidth: `${width}px`, minWidth: `${Math.min(width, 520)}px` }}
      >
        {children}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

function Text(props: {
  x: number
  y: number
  children: ReactNode
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  cls?: string
}) {
  const { x, y, children, anchor = 'middle', size = 13, cls } = props
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} className={cls}>
      {children}
    </text>
  )
}

// An arrow along `points`, with a head at the end (or both ends).
function Arrow(props: { points: Pt[]; head?: 'end' | 'both' | 'none'; cls?: string }) {
  const { head = 'end', cls = '' } = props
  const pts = props.points.map((p) => [...p] as [number, number])
  const heads: ReactNode[] = []
  const tip = (from: [number, number], to: [number, number], key: string) => {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const l = 8
    const w = 4
    const bx = to[0] - ux * l
    const by = to[1] - uy * l
    heads.push(
      <polygon
        key={key}
        points={`${to[0]},${to[1]} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`}
      />,
    )
    // End the line inside the head, so it doesn't poke out of the tip.
    to[0] -= ux * (l - 1)
    to[1] -= uy * (l - 1)
  }
  const n = pts.length
  if (head !== 'none') tip([...pts[n - 2]] as [number, number], pts[n - 1], 'end')
  if (head === 'both') tip([...pts[1]] as [number, number], pts[0], 'start')
  return (
    <g className={`kf-arrow ${cls}`}>
      <path d={`M${pts.map((p) => `${round(p[0])} ${round(p[1])}`).join(' L')}`} />
      {heads}
    </g>
  )
}

const round = (n: number) => Math.round(n * 10) / 10

function Circle(props: {
  x: number
  y: number
  r: number
  tone?: Tone
  lines: string[]
  size?: number
  mark?: Mark
}) {
  const { x, y, r, tone = 'plain', lines, size = 12, mark } = props
  const lead = size + 2
  const top = y - ((lines.length - 1) * lead) / 2 + size * 0.36
  return (
    <g className={`kf-node kf-${tone}`}>
      <circle cx={x} cy={y} r={r} />
      {lines.map((line, i) => (
        <text key={i} x={x} y={top + i * lead} textAnchor="middle" fontSize={size}>
          {line}
        </text>
      ))}
      {mark && <MarkAt mark={mark} x={x + r * 0.78} y={y - r * 0.78} />}
    </g>
  )
}

// Messages as small lettered circles, in a row.
function Dots(props: { x: number; y: number; r: number; gap: number; dots: [string, Tone][] }) {
  const { x, y, r, gap, dots } = props
  return (
    <g>
      {dots.map(([letter, tone], i) => (
        <Circle key={i} x={x + i * gap} y={y} r={r} tone={tone} lines={[letter]} size={Math.round(r * 1.05)} />
      ))}
    </g>
  )
}

const letters = (s: string, tone: Tone): [string, Tone][] => [...s].map((l) => [l, tone])

function Panel(props: { x: number; y: number; w: number; h: number }) {
  return <rect className="kf-panel" x={props.x} y={props.y} width={props.w} height={props.h} rx={8} />
}

function Envelope(props: { x: number; y: number; tone: Tone }) {
  const { x, y, tone } = props
  const w = 20
  const h = 14
  return (
    <g className={`kf-envelope kf-${tone}`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={2} />
      <path d={`M${x - w / 2} ${y - h / 2} L${x} ${y + 1.5} L${x + w / 2} ${y - h / 2}`} />
    </g>
  )
}

function Check(props: { x: number; y: number; s?: number }) {
  const { x, y, s = 1 } = props
  return <path className="kf-check" d={`M${x - 5 * s} ${y} L${x - 1.5 * s} ${y + 4 * s} L${x + 6 * s} ${y - 5 * s}`} />
}

function Cross(props: { x: number; y: number; s?: number }) {
  const { x, y, s = 1 } = props
  const d = 5 * s
  return <path className="kf-cross" d={`M${x - d} ${y - d} L${x + d} ${y + d} M${x + d} ${y - d} L${x - d} ${y + d}`} />
}

function MarkAt(props: { mark: Mark; x: number; y: number }) {
  return props.mark === 'ok' ? <Check x={props.x} y={props.y} /> : <Cross x={props.x} y={props.y} s={0.9} />
}

// A node of a Merkle tree: its name with a subscript and its hash.
function TreeNode(props: {
  x: number
  y: number
  name: string
  sub?: string
  hash: string
  tone: Tone
  mark?: Mark
  leaf?: boolean
  small?: boolean
}) {
  const { x, y, name, sub, hash, tone, mark, leaf, small } = props
  const w = small ? 48 : 60
  const h = small ? 30 : 38
  const nameSize = small ? 10.5 : 12.5
  const hashSize = small ? 9.5 : 11
  return (
    <g className={`kf-node kf-${tone}`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={leaf ? h / 2 : 5} />
      <text x={x} y={y - (small ? 2 : 3)} textAnchor="middle" fontSize={nameSize} className="kf-strong">
        {name}
        {sub && (
          <tspan dy={3} fontSize={nameSize * 0.72}>
            {sub}
          </tspan>
        )}
      </text>
      <text x={x} y={y + (small ? 10 : 12)} textAnchor="middle" fontSize={hashSize} className="kf-mono">
        {hash}
      </text>
      {mark && <MarkAt mark={mark} x={x + w / 2 + 2} y={y - h / 2 - 2} />}
    </g>
  )
}

type TreeSpec = {
  name: string
  sub?: string
  hash: string
  tone: Tone
  mark?: Mark
  leaf?: boolean
  children?: TreeSpec[]
}

type Placed = { spec: TreeSpec; x: number; y: number; parent?: Placed }

// Lays a tree out: leaves `dx` apart from `x`, parents centred over their
// children, levels `dy` apart from `y`.
function place(spec: TreeSpec, x: number, y: number, dx: number, dy: number): Placed[] {
  const out: Placed[] = []
  let next = 0
  const visit = (node: TreeSpec, depth: number, parent?: Placed): Placed => {
    const me: Placed = { spec: node, x: 0, y: y + depth * dy, parent }
    out.push(me)
    if (!node.children?.length) {
      me.x = x + next++ * dx
    } else {
      const kids = node.children.map((child) => visit(child, depth + 1, me))
      me.x = (kids[0].x + kids[kids.length - 1].x) / 2
    }
    return me
  }
  visit(spec, 0)
  return out
}

function Tree(props: { spec: TreeSpec; x: number; y: number; dx: number; dy: number; small?: boolean }) {
  const { small } = props
  const nodes = place(props.spec, props.x, props.y, props.dx, props.dy)
  const h = small ? 30 : 38
  return (
    <g>
      {nodes
        .filter((n) => n.parent)
        .map((n, i) => {
          const p = n.parent!
          const mid = (p.y + h / 2 + n.y - h / 2) / 2
          return (
            <path
              key={i}
              className="kf-edge"
              d={`M${p.x} ${p.y + h / 2} L${p.x} ${mid} L${n.x} ${mid} L${n.x} ${n.y - h / 2}`}
            />
          )
        })}
      {nodes.map(({ spec, x, y }, i) => (
        <TreeNode
          key={i}
          x={x}
          y={y}
          small={small}
          name={spec.name}
          sub={spec.sub}
          hash={spec.hash}
          tone={spec.tone}
          mark={spec.mark}
          leaf={spec.leaf}
        />
      ))}
    </g>
  )
}

function Levels(props: { x: number; y: number; dy: number; count: number; anchor?: 'start' | 'end' }) {
  return (
    <g>
      {Array.from({ length: props.count }, (_, i) => (
        <Text key={i} x={props.x} y={props.y + i * props.dy + 4} anchor={props.anchor ?? 'start'} size={11.5} cls="kf-soft">
          {`level ${i}`}
        </Text>
      ))}
    </g>
  )
}

function Bitmap(props: { x: number; y: number; cell: number; h: number; set: boolean[]; labels?: string[] }) {
  const { x, y, cell, h, set, labels } = props
  return (
    <g>
      {set.map((on, i) => (
        <g key={i} className={`kf-node kf-${on ? 'ok' : 'plain'}`}>
          <rect x={x + i * cell} y={y} width={cell} height={h} />
          {labels && on && (
            <text x={x + i * cell + cell / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12} className="kf-mono">
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Figures 1, 2 and 7: a node broadcasting to the others.

type NodeKey = 'A' | 'B' | 'C' | 'D' | 'F'
const NET: Record<NodeKey, Pt> = { A: [115, 100], D: [292, 48], F: [285, 172], C: [45, 210], B: [182, 262] }
const NET_R = 30

type NetNode = { tone: Tone; lines: string[]; mark?: Mark; note?: ReactNode }
type NetEdge = { to: Exclude<NodeKey, 'A'>; envelope: Tone; blocked?: boolean }

function Network(props: { ox: number; title: string; nodes: Record<NodeKey, NetNode>; edges: NetEdge[] }) {
  const { ox, title, nodes, edges } = props
  const at = (k: NodeKey): Pt => [ox + NET[k][0], NET[k][1]]
  return (
    <g>
      <Text x={ox} y={18} anchor="start" size={14} cls="kf-strong">
        {title}
      </Text>
      {edges.map((edge) => {
        const [ax, ay] = at('A')
        const [tx, ty] = at(edge.to)
        const len = Math.hypot(tx - ax, ty - ay)
        const ux = (tx - ax) / len
        const uy = (ty - ay) / len
        const start: Pt = [ax + ux * (NET_R + 3), ay + uy * (NET_R + 3)]
        const end: Pt = [tx - ux * (NET_R + 4), ty - uy * (NET_R + 4)]
        const along = (t: number): Pt => [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]
        const env = along(edge.blocked ? 0.35 : 0.5)
        const stop = along(0.72)
        return (
          <g key={edge.to}>
            <Arrow points={[start, end]} />
            <Envelope x={env[0]} y={env[1]} tone={edge.envelope} />
            {edge.blocked && <Cross x={stop[0]} y={stop[1]} s={1.2} />}
          </g>
        )
      })}
      {(Object.keys(nodes) as NodeKey[]).map((k) => {
        const [x, y] = at(k)
        const n = nodes[k]
        return (
          <g key={k}>
            <Circle x={x} y={y} r={NET_R} tone={n.tone} lines={n.lines} size={11.5} mark={n.mark} />
            {n.note}
          </g>
        )
      })}
    </g>
  )
}

const note = (ox: number, k: NodeKey, children: ReactNode, cls = 'kf-soft') => {
  const [x, y] = NET[k]
  return (
    <Text x={ox + x + NET_R + 8} y={y + 4} anchor="start" size={12} cls={cls}>
      {children}
    </Text>
  )
}

const state = (name: string, tone: Tone, s: number, mark?: Mark): NetNode => ({
  tone,
  lines: [`Node ${name}`, `state: ${s}`],
  mark,
})

export function Figure1() {
  const right = 370
  return (
    <Figure
      id="figure-1"
      caption="Figure 1"
      width={720}
      height={300}
      label="Step 1: Node A moves from state 0 to state 1 and sends the transition to Nodes B, C, D and F. Step 2: C, D and F are in state 1; Node B was offline and is still in state 0."
    >
      <Network
        ox={0}
        title="Step 1"
        nodes={{
          A: state('A', 'a', 1),
          D: state('D', 'plain', 0),
          F: state('F', 'plain', 0),
          C: state('C', 'plain', 0),
          B: { ...state('B', 'plain', 0), note: note(0, 'B', 'offline') },
        }}
        edges={[
          { to: 'D', envelope: 'a' },
          { to: 'F', envelope: 'a' },
          { to: 'C', envelope: 'a' },
          { to: 'B', envelope: 'a', blocked: true },
        ]}
      />
      <Network
        ox={right}
        title="Step 2"
        nodes={{
          A: state('A', 'a', 1),
          D: state('D', 'a', 1, 'ok'),
          F: state('F', 'a', 1, 'ok'),
          C: state('C', 'a', 1, 'ok'),
          B: { ...state('B', 'plain', 0), note: note(right, 'B', 'offline') },
        }}
        edges={[
          { to: 'D', envelope: 'a' },
          { to: 'F', envelope: 'a' },
          { to: 'C', envelope: 'a' },
          { to: 'B', envelope: 'a', blocked: true },
        ]}
      />
    </Figure>
  )
}

export function Figure2() {
  const right = 370
  return (
    <Figure
      id="figure-2"
      caption="Figure 2"
      width={720}
      height={300}
      label="Step 3: Node A moves to state 2 and sends the transition to all nodes; Node B is back online in state 0. Step 4: C, D and F move to state 2; Node B receives the message but can't apply it because state 1 is missing."
    >
      <Network
        ox={0}
        title="Step 3"
        nodes={{
          A: state('A', 'b', 2),
          D: state('D', 'a', 1),
          F: state('F', 'a', 1),
          C: state('C', 'a', 1),
          B: { ...state('B', 'plain', 0), note: note(0, 'B', 'back online') },
        }}
        edges={[
          { to: 'D', envelope: 'b' },
          { to: 'F', envelope: 'b' },
          { to: 'C', envelope: 'b' },
          { to: 'B', envelope: 'b' },
        ]}
      />
      <Network
        ox={right}
        title="Step 4"
        nodes={{
          A: state('A', 'b', 2),
          D: state('D', 'b', 2, 'ok'),
          F: state('F', 'b', 2, 'ok'),
          C: state('C', 'b', 2, 'ok'),
          B: {
            ...state('B', 'plain', 0, 'bad'),
            note: (
              <>
                {note(right, 'B', "can't apply state 2:", 'kf-bad-text')}
                <Text x={right + NET.B[0] + NET_R + 8} y={NET.B[1] + 20} anchor="start" size={12} cls="kf-bad-text">
                  state 1 is missing
                </Text>
              </>
            ),
          },
        }}
        edges={[
          { to: 'D', envelope: 'b' },
          { to: 'F', envelope: 'b' },
          { to: 'C', envelope: 'b' },
          { to: 'B', envelope: 'b' },
        ]}
      />
    </Figure>
  )
}

// ---------------------------------------------------------------------------
// Figures 3 to 6: the naive set reconciliation with bitmaps.

export function Figure3() {
  const ids = ['0x0', '0x1', '0x2', '0x3', '0x4', '0x5']
  const grid = (ox: number, items: string[], mono: boolean) =>
    items.map((item, i) => (
      <Circle
        key={item}
        x={ox + 55 + (i % 3) * 65}
        y={i < 3 ? 100 : 158}
        r={22}
        lines={[item]}
        size={mono ? 11.5 : 13}
      />
    ))
  return (
    <Figure
      id="figure-3"
      caption="Figure 3"
      width={720}
      height={216}
      label="A hash function maps the set of all possible messages, A to F, to the set of all possible identities, 0x0 to 0x5."
    >
      <Panel x={0} y={24} w={240} h={180} />
      <Text x={120} y={54} cls="kf-strong">
        All possible messages
      </Text>
      {grid(0, [...'ABCDEF'], false)}
      <Arrow points={[[246, 130], [296, 130]]} />
      <g className="kf-node kf-plain">
        <rect x={302} y={98} width={116} height={64} rx={10} />
      </g>
      <Text x={360} y={135} cls="kf-mono" size={14}>
        hash()
      </Text>
      <Text x={360} y={188} size={12} cls="kf-soft kf-mono">
        hash("A") = 0x0
      </Text>
      <Arrow points={[[424, 130], [474, 130]]} />
      <Panel x={480} y={24} w={240} h={180} />
      <Text x={600} y={54} cls="kf-strong">
        All possible identities
      </Text>
      {grid(480, ids, true)}
    </Figure>
  )
}

export function Figure4() {
  const cell = 45
  const ax = 22
  const bx = 418
  const centre = (x0: number, i: number) => x0 + i * cell + cell / 2
  const ids = ['0x0', '0x1', '0x2', '0x3', '0x4', '0x5']
  return (
    <Figure
      id="figure-4"
      caption="Figure 4"
      width={720}
      height={226}
      label="Node A stores messages A to D and Node B stores E and F. Each node flags the identities of its messages in a bitmap: Node A's has 0x0 to 0x3 set, Node B's 0x4 and 0x5."
    >
      <Text x={10} y={16} anchor="start" cls="kf-strong">
        Node A
      </Text>
      <Panel x={10} y={26} w={290} h={64} />
      {[...'ABCD'].map((l, i) => (
        <g key={l}>
          <Circle x={centre(ax, i)} y={58} r={17} tone="a" lines={[l]} size={13} />
          <Arrow points={[[centre(ax, i), 77], [centre(ax, i), 138]]} />
        </g>
      ))}
      <Text x={400} y={16} anchor="start" cls="kf-strong">
        Node B
      </Text>
      <Panel x={400} y={26} w={310} h={64} />
      {[...'EF'].map((l, i) => (
        <g key={l}>
          <Circle x={centre(bx, i + 4)} y={58} r={17} tone="b" lines={[l]} size={13} />
          <Arrow points={[[centre(bx, i + 4), 77], [centre(bx, i + 4), 138]]} />
        </g>
      ))}
      <path className="kf-link" d="M300 55 H400 M300 61 H400" />
      <Text x={350} y={46} size={12} cls="kf-soft">
        connection
      </Text>
      <Bitmap x={ax} y={140} cell={cell} h={36} set={[true, true, true, true, false, false]} labels={ids} />
      <Bitmap x={bx} y={140} cell={cell} h={36} set={[false, false, false, false, true, true]} labels={ids} />
      <Text x={ax} y={200} anchor="start" size={12} cls="kf-soft">
        Bitmap of Node A
      </Text>
      <Text x={bx + 6 * cell} y={200} anchor="end" size={12} cls="kf-soft">
        Bitmap of Node B
      </Text>
    </Figure>
  )
}

export function Figure5() {
  const cell = 56
  const x0 = 22
  return (
    <Figure
      id="figure-5"
      caption="Figure 5"
      width={380}
      height={170}
      label="A bitmap with one flag for each message identity, 0x0 to 0x5."
    >
      <Bitmap x={x0} y={12} cell={cell} h={42} set={[false, false, false, false, false, false]} />
      {['0x0', '0x1', '0x2', '0x3', '0x4', '0x5'].map((id, i) => {
        const x = x0 + i * cell + cell / 2
        return (
          <g key={id}>
            <Arrow points={[[x, 120], [x, 58]]} />
            <Circle x={x} y={144} r={22} lines={[id]} size={11.5} />
          </g>
        )
      })}
    </Figure>
  )
}

// One row of a sequence: Node or Peer A on the left, B on the right and what
// travels between them in the middle.
type Side = { x: number; w: number }
function Row(props: {
  y: number
  h: number
  step: string
  a: Side
  b: Side
  aDots: [string, Tone][]
  bDots: [string, Tone][]
  r: number
  gap: number
  dir: 'right' | 'left' | 'both' | 'none'
  payload?: ReactNode
  label?: string
}) {
  const { y, h, step, a, b, aDots, bDots, r, gap, dir, payload, label } = props
  const cy = y + h / 2
  const ay = cy + 6
  const from = a.x + a.w + 4
  const to = b.x - 4
  const mid = (from + to) / 2
  return (
    <g>
      <Text x={0} y={cy + 5} anchor="start" size={14} cls="kf-strong">
        {step}
      </Text>
      <Panel x={a.x} y={y} w={a.w} h={h} />
      <Dots x={a.x + r + 10} y={cy} r={r} gap={gap} dots={aDots} />
      <Panel x={b.x} y={y} w={b.w} h={h} />
      <Dots x={b.x + r + 10} y={cy} r={r} gap={gap} dots={bDots} />
      {dir !== 'none' && (
        <Arrow
          points={dir === 'left' ? [[to, ay], [from, ay]] : [[from, ay], [to, ay]]}
          head={dir === 'both' ? 'both' : 'end'}
        />
      )}
      <g transform={`translate(${mid} ${cy - 14})`}>{payload}</g>
      {label && (
        <Text x={mid} y={ay + 18} size={11.5} cls="kf-soft">
          {label}
        </Text>
      )}
    </g>
  )
}

function MiniBitmap(props: { set: boolean[] }) {
  const c = 12
  const x0 = -(props.set.length * c) / 2
  return (
    <g>
      {props.set.map((on, i) => (
        <rect key={i} className={`kf-cell kf-${on ? 'ok' : 'plain'}`} x={x0 + i * c} y={-c / 2} width={c} height={c} />
      ))}
    </g>
  )
}

function MiniDots(props: { dots: [string, Tone][] }) {
  const gap = 20
  const x0 = (-(props.dots.length - 1) * gap) / 2
  return <Dots x={x0} y={0} r={8.5} gap={gap} dots={props.dots} />
}

export function Figure6() {
  const a = { x: 76, w: 238 }
  const b = { x: 482, w: 238 }
  const rowH = 56
  const step = 78
  const top = 28
  const all: [string, Tone][] = [...letters('ABCD', 'a'), ...letters('EF', 'b')]
  const rows = [
    { aDots: letters('ABCD', 'a'), bDots: letters('EF', 'b'), dir: 'right', payload: <MiniBitmap set={[true, true, true, true, false, false]} />, label: "Node A's bitmap" },
    { aDots: letters('ABCD', 'a'), bDots: letters('EF', 'b'), dir: 'left', payload: <MiniDots dots={letters('EF', 'b')} />, label: 'Missing messages' },
    { aDots: all, bDots: letters('EF', 'b'), dir: 'left', payload: <MiniBitmap set={[false, false, false, false, true, true]} />, label: "Node B's bitmap" },
    { aDots: all, bDots: letters('EF', 'b'), dir: 'right', payload: <MiniDots dots={letters('ABCD', 'a')} />, label: 'Missing messages' },
    { aDots: all, bDots: all, dir: 'none', payload: <Check x={0} y={10} s={2.2} />, label: 'Bitmaps match' },
  ] as const
  return (
    <Figure
      id="figure-6"
      caption="Figure 6"
      width={720}
      height={top + 4 * step + rowH + 4}
      label="Step 1: Node A sends its bitmap to Node B. Step 2: Node B sends the missing messages E and F to Node A. Step 3: Node B sends its bitmap to Node A. Step 4: Node A sends the missing messages A to D to Node B. Step 5: both nodes store A to F and their bitmaps match."
    >
      <Text x={a.x} y={16} anchor="start" cls="kf-strong">
        Node A
      </Text>
      <Text x={b.x} y={16} anchor="start" cls="kf-strong">
        Node B
      </Text>
      {rows.map((row, i) => (
        <Row
          key={i}
          y={top + i * step}
          h={rowH}
          step={`Step ${i + 1}`}
          a={a}
          b={b}
          r={15}
          gap={36}
          aDots={[...row.aDots]}
          bDots={[...row.bDots]}
          dir={row.dir}
          payload={row.payload}
          label={row.label}
        />
      ))}
    </Figure>
  )
}

// ---------------------------------------------------------------------------
// Figures 7 to 11: set reconciliation with Merkle trees.

const peer = (name: string, tone: Tone, mark?: Mark, noteText?: ReactNode, ox = 0, cls?: string): NetNode => ({
  tone,
  lines: [`Peer ${name}`],
  mark,
  note: noteText ? note(ox, name as NodeKey, noteText, cls) : undefined,
})

export function Figure7() {
  const right = 370
  const rootA = (
    <Text x={NET.A[0] - NET_R - 8} y={NET.A[1] + 4} anchor="end" size={12} cls="kf-soft kf-mono">
      0xuvw
    </Text>
  )
  return (
    <Figure
      id="figure-7"
      caption="Figure 7"
      width={720}
      height={300}
      label="Peer A broadcasts its tree root hash 0xuvw to all other peers. Peers C, D and F have the same root; Peer B's root is 0xabc, so it differs."
    >
      <Network
        ox={0}
        title="Peer A sends its root"
        nodes={{
          A: { ...peer('A', 'a'), note: rootA },
          D: peer('D', 'plain', undefined, <tspan className="kf-mono">0xuvw</tspan>),
          F: peer('F', 'plain', undefined, <tspan className="kf-mono">0xuvw</tspan>),
          C: peer('C', 'plain', undefined, <tspan className="kf-mono">0xuvw</tspan>),
          B: peer('B', 'plain', undefined, <tspan className="kf-mono">0xabc</tspan>),
        }}
        edges={[
          { to: 'D', envelope: 'a' },
          { to: 'F', envelope: 'a' },
          { to: 'C', envelope: 'a' },
          { to: 'B', envelope: 'a' },
        ]}
      />
      <Network
        ox={right}
        title="Each peer compares it to its own"
        nodes={{
          A: peer('A', 'a'),
          D: peer('D', 'plain', 'ok'),
          F: peer('F', 'plain', 'ok'),
          C: peer('C', 'plain', 'ok'),
          B: peer('B', 'b', 'bad', <tspan className="kf-mono">0xabc ≠ 0xuvw</tspan>, right),
        }}
        edges={[
          { to: 'D', envelope: 'a' },
          { to: 'F', envelope: 'a' },
          { to: 'C', envelope: 'a' },
          { to: 'B', envelope: 'a' },
        ]}
      />
    </Figure>
  )
}

const PEER_A = { x: 66, w: 216 }
const PEER_B = { x: 498, w: 222 }
const PEER_ROW = 52
const PEER_STEP = 74
const AF = letters('ABCDEF', 'a')
const AH = letters('ABCDEFGH', 'b')

function PeerHeader() {
  return (
    <g>
      <Text x={PEER_A.x} y={16} anchor="start" cls="kf-strong">
        Peer A
      </Text>
      <Text x={PEER_B.x} y={16} anchor="start" cls="kf-strong">
        Peer B
      </Text>
    </g>
  )
}

function PeerRow(props: {
  y: number
  step: number
  aDots?: [string, Tone][]
  dir: 'right' | 'left' | 'both'
  payload?: ReactNode
  label: string
}) {
  return (
    <Row
      y={props.y}
      h={PEER_ROW}
      step={`Step ${props.step}`}
      a={PEER_A}
      b={PEER_B}
      r={10}
      gap={24}
      aDots={props.aDots ?? AF}
      bDots={AH}
      dir={props.dir}
      payload={props.payload}
      label={props.label}
    />
  )
}

// Tree nodes in transit, side by side.
function Sent(props: { nodes: Omit<TreeSpec, 'children'>[] }) {
  const gap = 56
  const x0 = (-(props.nodes.length - 1) * gap) / 2
  return (
    <g>
      {props.nodes.map((n, i) => (
        <TreeNode key={i} x={x0 + i * gap} y={-2} small {...n} />
      ))}
    </g>
  )
}

const B11 = { name: 'B', sub: '1,1', hash: '0xdef' }
const B12 = { name: 'B', sub: '1,2', hash: '0xghi' }
const B23 = { name: 'B', sub: '2,3', hash: '0xopq' }
const B24 = { name: 'B', sub: '2,4', hash: '0xprs' }

export function Figure8() {
  const top = 28
  const treesY = top + 3 * PEER_STEP + 30
  return (
    <Figure
      id="figure-8"
      caption="Figure 8"
      width={720}
      height={treesY + 132}
      label="Step 1: Peer A sends its tree root hash 0xuvw to Peer B, which has a different root. Step 2: Peer B sends its level 1 nodes B1,1 (0xdef) and B1,2 (0xghi). Step 3: Peer A sends back that B1,1 matches its A1,1 and B1,2 doesn't match. Below: both trees after step 3."
    >
      <PeerHeader />
      <PeerRow
        y={top}
        step={1}
        dir="right"
        payload={
          <g>
            <Envelope x={-26} y={-1} tone="a" />
            <Text x={-10} y={3} anchor="start" size={12} cls="kf-mono">
              0xuvw
            </Text>
          </g>
        }
        label="Tree root hash"
      />
      <PeerRow
        y={top + PEER_STEP}
        step={2}
        dir="left"
        payload={<Sent nodes={[{ ...B11, tone: 'b' }, { ...B12, tone: 'b' }]} />}
        label="Level 1 nodes"
      />
      <PeerRow
        y={top + 2 * PEER_STEP}
        step={3}
        dir="right"
        payload={<Sent nodes={[{ ...B11, tone: 'ok', mark: 'ok' }, { ...B12, tone: 'b', mark: 'bad' }]} />}
        label="Comparison"
      />
      <Text x={PEER_A.x} y={treesY - 8} anchor="start" size={12.5} cls="kf-soft">
        Peer A's tree after step 3
      </Text>
      <Text x={PEER_B.x} y={treesY - 8} anchor="start" size={12.5} cls="kf-soft">
        Peer B's tree after step 3
      </Text>
      <Levels x={0} y={treesY + 30} dy={72} count={2} />
      <Tree
        x={PEER_A.x + 50}
        y={treesY + 30}
        dx={92}
        dy={72}
        spec={{
          name: 'A',
          sub: '0',
          hash: '0xuvw',
          tone: 'a',
          mark: 'bad',
          children: [
            { name: 'A', sub: '1,1', hash: '0xdef', tone: 'ok', mark: 'ok' },
            { name: 'A', sub: '1,2', hash: '0xopq', tone: 'a', mark: 'bad' },
          ],
        }}
      />
      <Tree
        x={PEER_B.x + 50}
        y={treesY + 30}
        dx={92}
        dy={72}
        spec={{
          name: 'B',
          sub: '0',
          hash: '0xabc',
          tone: 'b',
          mark: 'bad',
          children: [
            { ...B11, tone: 'ok', mark: 'ok' },
            { ...B12, tone: 'b', mark: 'bad' },
          ],
        }}
      />
    </Figure>
  )
}

// Comparing two trees: A's on the left, B's on the right.
function Comparison(props: { link: Pt[]; label: string; labelAt: Pt; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <g>
      <Arrow points={props.link} head="both" />
      <Text x={props.labelAt[0]} y={props.labelAt[1]} anchor={props.anchor} size={12} cls="kf-soft">
        {props.label}
      </Text>
    </g>
  )
}

export function Figure9() {
  const y0 = 40
  const dy = 80
  const h = 38
  // A's tree: A0 at 175, children at 125 and 225. B's: B0 at 505, 455, 555.
  return (
    <Figure
      id="figure-9"
      caption="Figure 9"
      width={720}
      height={250}
      label="Peer A compares the nodes it received from Peer B with its own tree: A0 and B0 mismatch, A1,1 and B1,1 match, A1,2 and B1,2 mismatch."
    >
      <Levels x={0} y={y0} dy={dy} count={2} />
      <Levels x={720} y={y0} dy={dy} count={2} anchor="end" />
      <Text x={175} y={14} size={12.5} cls="kf-soft">
        Peer A
      </Text>
      <Text x={505} y={14} size={12.5} cls="kf-soft">
        Peer B
      </Text>
      <Tree
        x={125}
        y={y0}
        dx={100}
        dy={dy}
        spec={{
          name: 'A',
          sub: '0',
          hash: '0xuvw',
          tone: 'a',
          mark: 'bad',
          children: [
            { name: 'A', sub: '1,1', hash: '0xdef', tone: 'ok', mark: 'ok' },
            { name: 'A', sub: '1,2', hash: '0xopq', tone: 'a', mark: 'bad' },
          ],
        }}
      />
      <Tree
        x={455}
        y={y0}
        dx={100}
        dy={dy}
        spec={{
          name: 'B',
          sub: '0',
          hash: '0xabc',
          tone: 'b',
          mark: 'bad',
          children: [
            { ...B11, tone: 'ok', mark: 'ok' },
            { ...B12, tone: 'b', mark: 'bad' },
          ],
        }}
      />
      <Comparison link={[[210, y0], [470, y0]]} label="mismatch" labelAt={[340, y0 - 7]} />
      <Comparison
        link={[[125, y0 + dy + h / 2 + 4], [125, 190], [455, 190], [455, y0 + dy + h / 2 + 4]]}
        label="match"
        labelAt={[300, 184]}
      />
      <Comparison
        link={[[225, y0 + dy + h / 2 + 4], [225, 232], [555, 232], [555, y0 + dy + h / 2 + 4]]}
        label="mismatch"
        labelAt={[390, 226]}
      />
    </Figure>
  )
}

export function Figure10() {
  const top = 28
  const y0 = top + PEER_ROW + 66
  const dy = 72
  const h = 38
  // A's tree: A1,1 at 116, A1,2 at 221 over E (186) and F (256).
  // B's tree: B1,1 at 538, B1,2 at 643 over B2,3 (608) and B2,4 (678).
  return (
    <Figure
      id="figure-10"
      caption="Figure 10"
      width={720}
      height={y0 + 2 * dy + 74}
      label="Step 4: Peer B sends its level 2 nodes B2,3 (0xopq) and B2,4 (0xprs). Peer A finds B2,3's hash as its A1,2, a match, so A1,2's subtree with E and F is in sync. At B2,4's place, Peer A has the leaf F, a mismatch."
    >
      <PeerHeader />
      <PeerRow
        y={top}
        step={4}
        dir="left"
        payload={<Sent nodes={[{ ...B23, tone: 'b' }, { ...B24, tone: 'b' }]} />}
        label="Level 2 nodes"
      />
      <Levels x={0} y={y0} dy={dy} count={3} />
      <Tree
        x={116}
        y={y0}
        dx={70}
        dy={dy}
        spec={{
          name: 'A',
          sub: '0',
          hash: '0xuvw',
          tone: 'a',
          mark: 'bad',
          children: [
            { name: 'A', sub: '1,1', hash: '0xdef', tone: 'ok', mark: 'ok' },
            {
              name: 'A',
              sub: '1,2',
              hash: '0xopq',
              tone: 'ok',
              mark: 'ok',
              children: [
                { name: 'E', hash: '0x4', tone: 'ok', mark: 'ok', leaf: true },
                { name: 'F', hash: '0x5', tone: 'ok', mark: 'bad', leaf: true },
              ],
            },
          ],
        }}
      />
      <Tree
        x={538}
        y={y0}
        dx={70}
        dy={dy}
        spec={{
          name: 'B',
          sub: '0',
          hash: '0xabc',
          tone: 'b',
          mark: 'bad',
          children: [
            { ...B11, tone: 'ok', mark: 'ok' },
            { ...B12, tone: 'b', mark: 'bad', children: [{ ...B23, tone: 'ok', mark: 'ok' }, { ...B24, tone: 'b', mark: 'bad' }] },
          ],
        }}
      />
      <Comparison
        link={[[221 + 30 + 4, y0 + dy], [390, y0 + dy], [390, y0 + 2 * dy], [608 - 30 - 4, y0 + 2 * dy]]}
        label="match"
        labelAt={[398, y0 + 1.5 * dy + 4]}
        anchor="start"
      />
      <Comparison
        link={[[256, y0 + 2 * dy + h / 2 + 4], [256, y0 + 2 * dy + 52], [678, y0 + 2 * dy + 52], [678, y0 + 2 * dy + h / 2 + 4]]}
        label="mismatch"
        labelAt={[467, y0 + 2 * dy + 46]}
      />
    </Figure>
  )
}

export function Figure11() {
  const top = 28
  const y0 = top + PEER_ROW + 66
  const dy = 66
  const h = 38
  const bracketY = y0 + 3 * dy + h / 2 + 30
  const last = bracketY + 30
  // A's tree as in figure 10, with G and H missing under E and F. B's tree:
  // B1,1 at 484, B2,3 at 550, B2,4 at 649 over G (616) and H (682).
  return (
    <Figure
      id="figure-11"
      caption="Figure 11"
      width={720}
      height={last + PEER_ROW + 4}
      label="Step 5: Peer B sends the leaves G (0x6) and H (0x7) under B2,4. Peer A finds neither their hashes nor other nodes in their places, so they are missing. Step 6: Peer A adds G and H to its tree, and both peers have the same root hash."
    >
      <PeerHeader />
      <PeerRow
        y={top}
        step={5}
        dir="left"
        payload={
          <Sent
            nodes={[
              { name: 'G', hash: '0x6', tone: 'b', leaf: true },
              { name: 'H', hash: '0x7', tone: 'b', leaf: true },
            ]}
          />
        }
        label="Leaves"
      />
      <Levels x={0} y={y0} dy={dy} count={4} />
      <Tree
        x={116}
        y={y0}
        dx={70}
        dy={dy}
        spec={{
          name: 'A',
          sub: '0',
          hash: '0xuvw',
          tone: 'a',
          mark: 'bad',
          children: [
            { name: 'A', sub: '1,1', hash: '0xdef', tone: 'ok', mark: 'ok' },
            {
              name: 'A',
              sub: '1,2',
              hash: '0xopq',
              tone: 'ok',
              mark: 'ok',
              children: [
                { name: 'E', hash: '0x4', tone: 'ok', mark: 'ok', leaf: true },
                { name: 'F', hash: '0x5', tone: 'ok', mark: 'ok', leaf: true },
              ],
            },
          ],
        }}
      />
      <TreeNode x={186} y={y0 + 3 * dy} name="G" hash="0x6" tone="ghost" leaf />
      <TreeNode x={256} y={y0 + 3 * dy} name="H" hash="0x7" tone="ghost" leaf />
      <Tree
        x={484}
        y={y0}
        dx={66}
        dy={dy}
        spec={{
          name: 'B',
          sub: '0',
          hash: '0xabc',
          tone: 'b',
          mark: 'bad',
          children: [
            { ...B11, tone: 'ok', mark: 'ok' },
            {
              ...B12,
              tone: 'b',
              mark: 'bad',
              children: [
                { ...B23, tone: 'ok', mark: 'ok' },
                {
                  ...B24,
                  tone: 'b',
                  mark: 'bad',
                  children: [
                    { name: 'G', hash: '0x6', tone: 'b', leaf: true },
                    { name: 'H', hash: '0x7', tone: 'b', leaf: true },
                  ],
                },
              ],
            },
          ],
        }}
      />
      <path
        className="kf-edge"
        d={`M186 ${bracketY - 10} V${bracketY} H256 V${bracketY - 10} M616 ${bracketY - 10} V${bracketY} H682 V${bracketY - 10}`}
      />
      <Comparison
        link={[[221, bracketY + 1], [221, bracketY + 16], [649, bracketY + 16], [649, bracketY + 1]]}
        label="missing"
        labelAt={[435, bracketY + 10]}
      />
      <Row
        y={last}
        h={PEER_ROW}
        step="Step 6"
        a={PEER_A}
        b={PEER_B}
        r={10}
        gap={24}
        aDots={[...AF, ...letters('GH', 'b')]}
        bDots={AH}
        dir="both"
        payload={<Check x={0} y={6} s={1.6} />}
        label="Same root hash"
      />
    </Figure>
  )
}

// ---------------------------------------------------------------------------
// The trees of "Using Merkle Trees for Set Reconciliation".

const leaf = (name: string, hash: string, tone: Tone): TreeSpec => ({ name, hash, tone, leaf: true })

export function TreeA() {
  return (
    <Figure
      id="tree-a"
      caption="Tree A, on Peer A"
      width={540}
      height={290}
      label="Tree A: root A0 (0xuvw) with A1,1 (0xdef) and A1,2 (0xopq). A1,1 has A2,1 (0xjkl) over leaves A (0x0) and B (0x1), and A2,2 (0xlmn) over C (0x2) and D (0x3). A1,2 has the leaves E (0x4) and F (0x5)."
    >
      <Levels x={0} y={30} dy={76} count={4} />
      <Tree
        x={110}
        y={30}
        dx={80}
        dy={76}
        spec={{
          name: 'A',
          sub: '0',
          hash: '0xuvw',
          tone: 'a',
          children: [
            {
              name: 'A',
              sub: '1,1',
              hash: '0xdef',
              tone: 'a',
              children: [
                { name: 'A', sub: '2,1', hash: '0xjkl', tone: 'a', children: [leaf('A', '0x0', 'a'), leaf('B', '0x1', 'a')] },
                { name: 'A', sub: '2,2', hash: '0xlmn', tone: 'a', children: [leaf('C', '0x2', 'a'), leaf('D', '0x3', 'a')] },
              ],
            },
            { name: 'A', sub: '1,2', hash: '0xopq', tone: 'a', children: [leaf('E', '0x4', 'a'), leaf('F', '0x5', 'a')] },
          ],
        }}
      />
    </Figure>
  )
}

// Peer B's tree; with `synced`, the subtrees both peers have are green.
export function TreeB(props: { synced?: boolean }) {
  const { synced } = props
  const same: Tone = synced ? 'ok' : 'b'
  return (
    <Figure
      id={synced ? 'tree-b-step-3' : 'tree-b'}
      caption={synced ? "Tree B after step 3: the parts Peer A has too are green" : 'Tree B, on Peer B'}
      width={680}
      height={290}
      label={
        synced
          ? 'Tree B after step 3: B1,1 with its subtree, and B2,3 with E and F, match Peer A and are green. B0, B1,2, B2,4, G and H are still to compare.'
          : 'Tree B: root B0 (0xabc) with B1,1 (0xdef) and B1,2 (0xghi). B1,1 has B2,1 (0xjkl) over A and B, and B2,2 (0xlmn) over C and D. B1,2 has B2,3 (0xopq) over E and F, and B2,4 (0xprs) over G (0x6) and H (0x7).'
      }
    >
      <Levels x={0} y={30} dy={76} count={4} />
      <Tree
        x={84}
        y={30}
        dx={80}
        dy={76}
        spec={{
          name: 'B',
          sub: '0',
          hash: '0xabc',
          tone: 'b',
          children: [
            {
              ...B11,
              tone: same,
              children: [
                { name: 'B', sub: '2,1', hash: '0xjkl', tone: same, children: [leaf('A', '0x0', same), leaf('B', '0x1', same)] },
                { name: 'B', sub: '2,2', hash: '0xlmn', tone: same, children: [leaf('C', '0x2', same), leaf('D', '0x3', same)] },
              ],
            },
            {
              ...B12,
              tone: 'b',
              children: [
                { ...B23, tone: same, children: [leaf('E', '0x4', same), leaf('F', '0x5', same)] },
                { ...B24, tone: 'b', children: [leaf('G', '0x6', 'b'), leaf('H', '0x7', 'b')] },
              ],
            },
          ],
        }}
      />
    </Figure>
  )
}
