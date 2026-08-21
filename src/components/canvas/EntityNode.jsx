import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { kindMeta } from '../../utils/kinds'

function EntityNode({ data, selected }) {
  const meta = kindMeta(data.kind)
  const label = data.label || `${meta.label}…`
  return (
    <div
      className={`entity-node ${selected ? 'selected' : ''}`}
      style={{ '--node-accent': meta.color }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="entity-head">
        <span className="entity-icon">{meta.icon}</span>
        <span className="entity-kind">{meta.label}</span>
      </div>
      <div className="entity-label" title={label}>{label}</div>
      {data.evidence?.length > 0 && (
        <span className="entity-badge">{data.evidence.length}</span>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

export default memo(EntityNode)
