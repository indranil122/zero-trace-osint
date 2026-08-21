import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCaseFile } from '../../store/casefile'
import { useRunner } from '../../engine/useRunner'
import EntityNode from './EntityNode'

const nodeTypes = { entity: EntityNode }
const proOptions = { hideAttribution: true }

function nodeColor(node) {
  return node?.data?.kind ? undefined : '#64748b'
}

export default function FlowCanvas() {
  const nodes = useCaseFile((s) => s.nodes)
  const edges = useCaseFile((s) => s.edges)
  const onNodesChange = useCaseFile((s) => s.onNodesChange)
  const onEdgesChange = useCaseFile((s) => s.onEdgesChange)
  const onConnect = useCaseFile((s) => s.onConnect)
  const select = useCaseFile((s) => s.select)
  const addNode = useCaseFile((s) => s.addNode)
  const { runImageExif } = useRunner()
  const screenToFlowPosition = useReactFlow().screenToFlowPosition

  function handleImageDrop(file, position) {
    if (!file || !file.type.startsWith('image/')) {
      useCaseFile.getState().pushLog('Drop an image file (jpg/png/webp…)', 'warn')
      return
    }
    const node = addNode('image', position, { label: file.name })
    runImageExif(node.id ?? node, file)
  }

  return (
    <div className="canvas-wrap">
      <ReactFlow
        colorMode="dark"
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={useCaseFile.getState().onNodeDragStop}
        onNodeClick={(_, n) => select(n.id)}
        onPaneClick={() => select(null)}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          handleImageDrop(file, pos)
        }}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={proOptions}
        defaultEdgeOptions={{ style: { stroke: '#3b4a63' } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="#223049" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="#0b112099" nodeColor={nodeColor} />
      </ReactFlow>

      <div className="canvas-hint">
        Drag from a node&apos;s bottom handle to another node to link them · Select a node to inspect it
      </div>
    </div>
  )
}
