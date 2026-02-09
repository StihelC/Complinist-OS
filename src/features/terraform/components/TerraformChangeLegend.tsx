import { useTerraformStore } from '@/core/stores/useTerraformStore'

export function TerraformChangeLegend() {
  const afterState = useTerraformStore(state => state.afterState)
  
  if (!afterState) return null
  
  const counts = {
    create: afterState.nodes.filter(n => n.data.changeType === 'create').length,
    update: afterState.nodes.filter(n => n.data.changeType === 'update').length,
    delete: afterState.nodes.filter(n => n.data.changeType === 'delete').length,
  }
  
  return (
    <div className="flex gap-4 p-4 bg-white border rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-green-500 rounded" />
        <span>Create ({counts.create})</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-amber-500 rounded" />
        <span>Update ({counts.update})</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-red-500 rounded" />
        <span>Delete ({counts.delete})</span>
      </div>
    </div>
  )
}

