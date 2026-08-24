import { useCallback, useEffect, useState } from 'react'
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
import CanvasToolbar from './CanvasToolbar'
import NodeContextMenu from './NodeContextMenu'

const nodeTypes = { entity: EntityNode }
const proOptions = { hideAttribution: true }

function nodeColor(node) {
  return node?.data?.kind ? undefined : '#a1a1a6'
}

export default function FlowCanvas() {
  const nodes = useCaseFile((s) => s.nodes)
  const edges = useCaseFile((s) => s.edges)
  const onNodesChange = useCaseFile((s) => s.onNodesChange)
  const onEdgesChange = useCaseFile((s) => s.onEdgesChange)
  const onConnect = useCaseFile((s) => s.onConnect)
  const select = useCaseFile((s) => s.select)
  const addNode = useCaseFile((s) => s.addNode)
  const undo = useCaseFile((s) => s.undo)
  const redo = useCaseFile((s) => s.redo)
  const { runImageExif } = useRunner()
  const screenToFlowPosition = useReactFlow().screenToFlowPosition
  const [menu, setMenu] = useState(null)

  const closeMenu = useCallback(() => setMenu(null), [])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  function handleImageDrop(file, position) {
    if (!file || !file.type.startsWith('image/')) {
      useCaseFile.getState().pushLog('Drop an image file (jpg/png/webp…)', 'warn')
      return
    }
    const nodeId = addNode('image', position, { label: file.name })
    runImageExif(nodeId, file)
  }

  return (
    <div className="canvas-wrap">
      <ReactFlow
        colorMode="light"
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={useCaseFile.getState().onNodeDragStop}
        onNodeClick={(_, n) => select(n.id)}
        onPaneClick={() => { select(null); closeMenu() }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault()
          select(n.id)
          setMenu({ x: e.clientX, y: e.clientY, nodeId: n.id })
        }}
        onMoveStart={closeMenu}
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
        defaultEdgeOptions={{ style: { stroke: '#c7c7cc' } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.3} color="#d2d2d7" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgba(255,255,255,0.78)" nodeColor={nodeColor} />
      </ReactFlow>

      <CanvasToolbar />

      <div className="canvas-hint">
        Drag between handles to link · Right-click a node for actions · Ctrl+K to search · Ctrl+Z to undo
      </div>

      {menu && <NodeContextMenu x={menu.x} y={menu.y} nodeId={menu.nodeId} onClose={closeMenu} />}
    </div>
  )
}
