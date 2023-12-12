import { NodelEvent } from './event.mjs'

export class NodelListener {
  constructor(nodeManager, nodeRender) {
    this.manager = nodeManager
    this.render = nodeRender
  }
  on(eventType, callback, connections=false) {
    // listen for events on connections
    if (connections) {
      // manage connections
      this.render.addConnectionBinding(eventType, (e, nodeIds) => {
        // parse nodes
        const nodes = nodeIds.map(id => this.manager.nodes[id])

        // trigger event
        callback(new NodelEvent(NodelEvent.TYPES.Connection, e, nodes))
      })
      
      // redraw to set the bindings
      this.manager.redraw()
    } else {

      // listen for events on the nodel element
      const nodel = document.getElementById('nodel')
      nodel.addEventListener(eventType, e => {

        // add the node to the event if one selected
        const nodeId = e.target?.id
        let node = null
        if (nodeId && nodeId !== 'nodel'&& this.manager.verify(nodeId, true)) {
          node = this.manager.nodes[nodeId]
        }
        // trigger new custom event
        callback(new NodelEvent(NodelEvent.TYPES.Node, e, node))
      })
    }
  }
}
