'use strict';

// Helpers

function uniqueId() {
  return String(Math.random().toString(16).slice(2))
}

function arrRemove(arr, elem) {
  const idx = arr.indexOf(elem)
  if (idx > -1) {
    arr.splice(idx, 1)
  }
}

function findTemplates() {
  const nodel = document.getElementById('nodel')
  const templates = nodel.children
  const templateIds = []

  for (let idx = 0; idx < templates.length; idx++) {
    const elem = templates[idx]
    templateIds.push(elem.id)
  }

  return templateIds
}

function toRegPos(node) {
  const nodel = document.getElementById('nodel')
  const elemX = node.x + nodel.offsetWidth/2
  const elemY = node.y + nodel.offsetHeight/2
  return [elemX, elemY]
}

// Nodel

class Nodel {
  constructor(id, template, x, y, data) {
    this.id = id
    this.template = template
    this.x = x 
    this.y = y
    this.data = data
    this.group = {
      name: null,
      collapsed: false,
      ends: [],
    }
    this.parents = {}
    this.children = {}
  }
  isLeaf() {
    return !Object.values(this.children)?.length
  }
  isHead() {
    return !Object.values(this.parents)?.length
  }
  isGroup(collapsed=null) {
    // is it a group?
    if (!!this.group.ends.length) {

      // ignore collapsed state
      if (collapsed === null) {
        return true
      }

      // is the collapsed state as expected
      return this.group.collapsed === collapsed
    }

    // not a group
    return false
  }
  groupAllChildren(nodes) {
    this.group.ends = this.getLeaves(nodes)
  }
  parentGroupNodes(nodes, visited=[]) {
    // base case
    if (visited.includes(this.id)) {
      return []
    }
    visited.push(this.id)

    // get the closest group in parents
    let groups = []
    for (const [connectionType, parents] of Object.entries(this.parents)) {
      for (const parentId of parents) {
        const parentNode = nodes[parentId]

        // collect
        if (parentNode.isGroup()) {
          groups.push(parentNode.id)
        }

        // recurse
        groups = groups.concat(parentNode.parentGroupNodes(nodes, visited))
      }
    }
    return groups
  }
  hasChild(nodes, id, end=null) {
    if (this.id === id) {
      return true
    }
    if (this.id === end) {
      return false
    }

    for (const [connectionType, children] of Object.entries(this.children)) {
      for (const childId of children) {
        const child = nodes[childId]
        if (child.hasChild(nodes, id, end)) {
          return true
        }
      }
    }
    return false
  }
  moveConnection(list, id, prevType, newType) {
    // remove the (target) id from the type
    list[prevType].splice(list[prevType].indexOf(id), 1)

    // create the new type if it doesn't exist
    if (!list[newType]) {
      list[newType] = []
    }

    // add the child to the new type
    list[newType].push(id)
  }
  moveParent(parentId, prevType, newType) {
    this.moveConnection(this.parents, parentId, prevType, newType)
  }
  moveChild(childId, prevType, newType) {
    this.moveConnection(this.children, childId, prevType, newType)
  }
  isDirectChild(id, connectionType) {
    return !!this.children[connectionType]?.includes(id)
  }
  groupContains(nodes, id) {
    for (const end of this.group.ends) {
      if (this.hasChild(nodes, id, end)) {
        return true
      }
    }
    return false
  }
  getInvolvedGroupNodes(nodes) {
    // get the groups a node is part of, if any
    const parentGroups = this.parentGroupNodes(nodes)
    const myGroups = []
    for (const nodeId of parentGroups) {
      const node = nodes[nodeId]
      if (node.groupContains(nodes, this.id)) {
        myGroups.push(node)
      }
    }
    return myGroups
  }
  isVisible(nodes) {
    const myGroups = this.getInvolvedGroupNodes(nodes)
    for (const node of myGroups) {
      if (node.group.collapsed) {
        return false
      }
    }
    return true
  }
  getLeaves(nodes, visited=[]) {
    // visit
    if (visited.includes(this.id)) {
      return null
    } else {
      visited.push(this.id)
    }

    // base case
    if (this.isLeaf()) {
      return [this.id]
    }

    // recurse
    let leaves = []
    for (const [connectionType, children] of Object.entries(this.children)) {
      for (const childId of children) {
        const childNode = nodes[childId]
        leaves = leaves.concat(childNode.getLeaves(nodes, visited))
      }
    }
    return leaves
  }
}

class NodelEvent {

  static TYPES = {
    Node: 0,
    Connection: 1,
  }

  constructor(type, htmlEvent, nodes=null) {
    const nodel = document.getElementById('nodel')
    this.elem = htmlEvent.target
    this.x = htmlEvent.x - nodel.offsetWidth/2
    this.y = htmlEvent.y - nodel.offsetHeight/2

    // Event type specific setters
    switch (type) {
      case NodelEvent.TYPES.Node:
        this.node = nodes
        break;
      case NodelEvent.TYPES.Connection:
        this.nodes = nodes
        break;
      default:
        console.error(`Unknown NodelEvent type: ${type}`)
    }
  }
}

class NodelManager {
  constructor(renderEngine) {
    this.nodes = {}
    this.render = renderEngine
    this.isDrawingPaused = false
    this.onDrawCallbacks = []
  }
  // helpers
  exists(id) {
    return id && (id in this.nodes)
  }
  verify(id, exists=true) {
    // by default, returns true if id exists
    if (this.exists(id) === exists) {
      return true
    }
  
    console.warn(`(nodel) ${!exists ? "found" : "couldn't find"} #${id}`)
    return false
  }
  verifyBoth(idA, idB, exists=true) {
    return this.verify(idA) && this.verify(idB) && idA != idB
  }
  onDraw(callback) {
    this.onDrawCallbacks.push(callback)
  }
  redraw() {
    if (!this.isDrawingPaused) {
      this.render.draw(this.nodes)

      // call on draw callbacks
      for (const callback of this.onDrawCallbacks) {
        callback()
      }
    } else {
      console.warn(`skipping draw request, drawing is paused`)
    }
  }
  pauseDraw() {
    console.debug(`Drawing paused`)
    this.isDrawingPaused = true
  }
  unpauseDraw() {
    console.debug(`Drawing unpaused`)
    this.isDrawingPaused = false
    this.redraw()
  }

  // api
  addNode(templateId, x, y, data) {
    if (this.render.verify(templateId)) {
      // generate new id
      const id = uniqueId()
      // create and track the node
      this.nodes[id] = new Nodel(id, templateId, x, y, data)
      this.redraw()
      return id
    }
    return null
  }
  createGroup(id, name) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      node.group.name = name
      // NOTE this will create the group up to the nodes leaves
      node.groupAllChildren(this.nodes)
      this.redraw()
    }
  }
  toggleGroup(id, collapsed=null) {
    if (this.verify(id)) {
      const node = this.nodes[id]

      // create the group if none exist
      if (!node.group.ends.length) {
        this.createGroup(id, `${node.data.name} group`)
      }

      node.group.collapsed = (collapsed == null) ? !node.group.collapsed : collapsed
      this.redraw()
    }
  }
  deleteNode(id) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      // delete the node
      delete this.nodes[id]
      // delete the  childs parent reference
      this.eachChild(node, child => {
        for (const [connectionType, parents] of Object.entries(child.parents)) {
          if (node.id in parents) {
            child.parents[connectionType].splice(parents.indexOf(node.id), 1)
          }
        }
      })
      // delete the parents child reference
      this.eachParent(parent, childsParent => {
        for (const [connectionType, children] of Object.entries(parent.children)) {
          if (node.id in children) {
            parent.children[connectionType].splice(children.indexOf(node.id), 1)
          }
        }
      })
      this.redraw()
    }
  }
  toggleConnect(parentId, childId, connectionType='default') {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }

    // get the nodes to link
    const parentNode = this.nodes[parentId]

    // handle groups
    if (parentNode.group.collapsed) {
      // parentNode must be a group, use its ends instead
      for (const endId of parentNode.group.ends) {
        this.toggleConnect(endId, childId, connectionType)
        return
      }
    } 

    // toggle connected state
    if (parentNode.isDirectChild(childId, connectionType)) {
      this.disconnectNodes(parentId, childId, connectionType)
    } else {
      this.connectNodes(parentId, childId, connectionType)
    }

    this.redraw()
  }
  getConnectionType(parentId, childId) {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }
    
    // find the connection type
    const parentNode = this.nodes[parentId]
    for (const [connectionType, children] of Object.entries(parentNode.children)) {
      if (children.includes(childId)) {
        return connectionType
      }
    }
    return null
  }
  setConnectionType(parentId, childId, type) {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }

    // find the connection type
    const prevType = this.getConnectionType(parentId, childId)
    this.nodes[parentId].moveChild(childId, prevType, type)
    this.nodes[childId].moveParent(parentId, prevType, type)

    this.redraw()
  }
  connectNodes(parentId, childId, connectionType) {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }

    // get connecting children and parents
    const children = this.nodes[parentId].children
    const parents = this.nodes[childId].parents

    // setup
    if (!(connectionType in children)) {
      children[connectionType] = []
    }
    if (!(connectionType in parents)) {
      parents[connectionType] = []
    }

    // connect
    children[connectionType].push(childId)
    parents[connectionType].push(parentId)
    console.debug('Connected', parentId, childId)
  }
  disconnectNodes(parentId, childId, connectionType) {
    // get connecting children and parents
    const children = this.nodes[parentId].children
    const parents = this.nodes[childId].parents

    // disconnect
    arrRemove(children[connectionType], childId)
    arrRemove(parents[connectionType], parentId)
    console.debug('Disconnected', parentId, childId)
  }
  moveNode(id, x, y) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      const deltaX = x - node.x
      const deltaY = y - node.y
      // 

      // update the nodes location
      node.x = x
      node.y = y

      // update the location location
      if (node.isGroup() && node.group.collapsed) {
        // TODO i think you also need to move the child nodes children here, recursively
        this.eachChild(node, (child, connectionType) => {
          child.x += deltaX
          child.y += deltaY
        }, node.group.ends)
      }
      this.redraw()
      console.debug('Moved node to', x, y)
    }
  }
  getHeads() {
    return Object.values(this.nodes).filter(node => node.isHead())
  }
  eachChild(node, callback, until=[]) {
    this.eachConnection(node.children, callback, until)
  }
  eachParent(node, callback, until=[]) {
    this.eachConnection(node.parents, callback, until)
  }
  eachConnection(connectionList, callback, until=[]) {
    if (!connectionList) {
      return
    }
    // callback on each connection
    for (const [connectionType, connection] of Object.entries(connectionList)) {
      for (const nodeId of connection) {
        if (!(nodeId in until)) {
          callback(this.nodes[nodeId], connectionType)
        }
      }
    }
  }
  getDirectNodes(map) {
    const connections = {}
    for (const [connectionType, nodes] of Object.entries(map)) {
      // setup
      if (!(connectionType in connections)) {
        connections[connectionType] = []
      }

      // aggregate 
      for (const childGroupMap of nodes) {
        connections[connectionType].push(childGroupMap.id)
      }
    }
    return connections
  }
  createGroupMap(node, ends=null, originX=0, originY=0) {
    if (!ends) {
      // decendant node
      ends = node.group.ends
    }

    // base case
    if (node.id in ends) {
      return null
    }

    const childrenMap = {}
    for (const [connectionType, children] of Object.entries(node.children)) {
      // setup map
      if (!(connectionType in childrenMap)) {
        childrenMap[connectionType] = []
      }

      // aggregate children
      for (const childId of children) {
        const child = this.nodes[childId]

        // save the map
        const childMap = this.createGroupMap(child, ends, node.x, node.y)
        childrenMap[connectionType].push(childMap)
      }
    }

    return {
      id: node.data.name || node.id,
      offsetX: node.x - originX,
      offsetY: node.y - originY,
      parents: ends ? node.parents : null,
      children: childrenMap ? childrenMap : null,
    }
  }
}

class NodelRender {
  constructor() {
    this.recenter()
    this.resetScale()
    this.templates = findTemplates()

    this.pencil = jsPlumbBrowserUI.newInstance({
        container: document.getElementById('nodel')
    })

    // hide the templates
    this.hideTemplates = false
    this.toggleTemplates()
    this.connectionBinding = {}
    this.connectionColorCallback = () => '#ad00d9'
    this.connectionLabelCallback = () => ''
    this.helpers = {
      'connection-color': () => '#ad00d9',
      'connection-label': () => '',
    }
  }
  toggleTemplates() {
    this.hideTemplates = !this.hideTemplates

    // hide html elements
    for (const template of this.templates) {
      let elem = document.getElementById(template)
      elem.hidden = this.hideTemplates
    }
  }
  // internal
  clear() {
    const nodel = document.getElementById('nodel')

    // reset the lines
    this.pencil.deleteEveryConnection()

    // reset the nodes
    for (let idx = nodel.children.length-1; idx >= 0; idx--) {
      const child = nodel.children[idx]
      if (!this.templates.includes(child.id)) {
        nodel.removeChild(child)
      }
    }
  }
  on(type, callback) {
    this.helpers[type] = callback
  }
  draw(nodes) {
    const nodel = document.getElementById('nodel')

    // keep templates and remove all other elements
    this.clear()

    // filter out collapsed nodes
    const visibleNodes = Object.values(nodes).filter(node => node.isVisible(nodes))
    console.debug('Visible nodes', visibleNodes)

    // 
    // Draw Nodes
    
    for (const node of visibleNodes) {
      // add the element
      const nodeElem = document.getElementById(node.template).cloneNode(true)
      nodel.appendChild(nodeElem)

      // configure element
      nodeElem.id = node.id
      nodeElem.hidden = false
      if (node.isGroup(true)) {
        nodeElem.classList.add('group')
      }

      // supply variables
      // NOTE: vulnerable to XSS
      let varProps = node.group.collapsed ? node.group : node.data
      for (let [attr, value] of Object.entries(varProps)) {
        nodeElem.innerHTML = nodeElem.innerHTML.replaceAll(`{${attr}}`, value)
      }

      // calculate coordinates
      const [elemX, elemY] = toRegPos(node)

      // set the position
      nodeElem.style.position = 'absolute'
      nodeElem.style.left = `${elemX - nodeElem.offsetWidth/2}px`
      nodeElem.style.top = `${elemY - nodeElem.offsetHeight/2}px`
    }

    //
    // Link Children
    
    for (const node of visibleNodes) {
      // format the node as a leaf
      const leaves = node.group.collapsed ? node.group.ends : [node.id]

      // link node with the children of its leaves
      for (const leafId of leaves) {
        const leaf = nodes[leafId]
          
        for (const [connectionType, children] of Object.entries(leaf.children)) {
          for (const childId of children) {
            const child = nodes[childId]
            let start = node.id
            let end = null
            let dashed = false

            // filter out non visible nodes
            if (visibleNodes.includes(child)) {
              end = child.id
            } else {
              // draw a dotted connection to the nodes parent group
              const groups = child.getInvolvedGroupNodes(nodes)
              const firstCollapsedGroup = groups.reverse().find(node => node.group.collapsed)
              end = firstCollapsedGroup.id
              dashed = true
            }

            // draw the connection
            const connection = this.drawConnection(node, child, connectionType, dashed)

            // add any existing callbacks to the connection element
            const binding = this.connectionBinding
            if (binding) {
              const arrowElem = connection.connector.path
              arrowElem.addEventListener(binding.eventType, (e) => {
                binding.callback( e, [node.id, child.id])
              })
            }
          }
        }
      }
    }
  }
  drawConnection(fromNode, toNode, type, dashed=false) {
    const [fromId, toId] = [fromNode.id, toNode.id]
    console.debug(`Drawing from ${fromId} to ${toId}`)

    const fromElem = document.getElementById(fromId)
    const toElem = document.getElementById(toId)
    const lineColor = this.helpers['connection-color'](type)
    const lineLabel = this.helpers['connection-label'](fromNode, toNode, type)
    const lineStyle = { strokeWidth: 6, stroke: lineColor }
    const dashedLineStyle = { ...lineStyle, dashstyle: '3' }

    // draw a line to the child
    const connection = this.pencil.connect({
      source: fromElem,
      target: toElem,
      anchor: 'Continuous',
      paintStyle: dashed ? dashedLineStyle : lineStyle,
      overlays: [
        {type: "Arrow", options: { location: 1 }},
        {type: 'Label', options: { label: lineLabel, cssClass: 'line-label' }},
      ]
    })
    this.pencil.setDraggable(fromElem, false)
    this.pencil.setDraggable(toElem, false)
    return connection
  }
  addConnectionBinding(eventType, callback) {
    this.connectionBinding = { eventType, callback }
  }
  verify(template, exists=true) {
    if (template && this.templates.includes(template) == exists) {
      return true
    }
  
    console.error(`(nodel) ${!exists ? "found" : "couldn't find"} template #${template}`)
    return false
  }
  // api (pos)
  recenter() {
    self.x = 0
    self.y = 0
  }
  panView(x, y) {
    self.x += x
    self.y += y
  }
  // api (scale)
  adjustScale(delta) {
    this.scale += delta
  }
  setScale(scale) {
  this.scale = scale
  }
  resetScale() {
    this.scale = 1
  }
}

class NodelListener {
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
        if (nodeId && this.manager.verify(nodeId, true)) {
          node = this.manager.nodes[nodeId]
        }

        // create a new 'nodel' event
        const nodelEvent = new NodelEvent(NodelEvent.TYPES.Node, e, node)

        // trigger event
        callback(nodelEvent)
      })
    }
  }
}
